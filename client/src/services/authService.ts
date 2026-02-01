/**
 * AuthService — управление авторизацией на клиенте.
 *
 * SECURITY NOTE: Токены хранятся в localStorage.
 * Это осознанный компромисс для игрового SPA-клиента:
 * - HttpOnly cookies не работают с WebSocket
 * - Токен нужен в JavaScript для API-вызовов
 * - XSS-защита обеспечивается на уровне CSP и санитизации входных данных
 * - Срок жизни токенов ограничен (24ч access, 7д guest)
 */

import { metaServerClient } from '../api/metaServerClient';
import { platformManager } from '../platform';
import {
  setAuthState,
  clearAuthState,
  setAuthError,
  setAuthenticating,
  type User,
  type Profile,
} from '../ui/signals/gameState';
import balanceConfig from '../../../config/balance.json';

/**
 * Ответ сервера на /auth/guest
 */
interface GuestAuthResponse {
  guestToken: string;
  expiresAt: string;
}

/**
 * Ответ сервера на /auth/telegram
 * Контракт: server/src/meta/routes/auth.ts:159-168
 */
interface TelegramAuthResponse {
  accessToken: string;
  userId: string;
  profile: {
    nickname: string;
    locale?: string;
  };
  isNewUser: boolean;
  isAnonymous: boolean;
}

/**
 * Ответ сервера на /auth/verify
 * Контракт: server/src/meta/routes/auth.ts:212-219
 */
interface PlatformAuthResponse {
  accessToken: string;
  userId: string;
  profile: {
    nickname: string;
    locale?: string;
  };
}

/**
 * Ответ сервера на /profile (ProfileSummary)
 */
interface ProfileSummary {
  userId: string;
  nickname: string;
  level: number;
  xp: number;
  selectedSkinId?: string;
  wallet: {
    coins: number;
    gems: number;
  };
}

/**
 * Создаёт объект Profile с дефолтными значениями.
 * TODO: В Sprint 2 эти значения должны приходить с сервера в ProfileSummary
 */
function createDefaultProfile(level = 1, xp = 0): Profile {
  return {
    rating: balanceConfig.initialProfile.rating,
    ratingDeviation: balanceConfig.initialProfile.ratingDeviation,
    gamesPlayed: 0,
    gamesWon: 0,
    totalKills: 0,
    highestMass: 0,
    level,
    xp,
  };
}

/**
 * Создаёт объект User с заданными параметрами.
 */
function createUser(
  userId: string,
  nickname: string,
  platformType: string
): User {
  return {
    id: userId,
    platformType,
    platformId: userId,
    nickname,
    createdAt: new Date().toISOString(),
  };
}

class AuthService {
  private initialized = false;

  /**
   * Инициализация сервиса.
   * Пытается восстановить сессию из localStorage.
   */
  async initialize(): Promise<boolean> {
    // P1-1: Всегда устанавливаем callback для 401 ошибок (до early return!)
    metaServerClient.setOnUnauthorized(() => {
      this.logout();
    });

    if (this.initialized) {
      return true;
    }

    // Инициализируем PlatformManager
    platformManager.initialize();

    // FIX-001: Пытаемся восстановить сессию только для зарегистрированных пользователей.
    // Для гостей (только guest_token) не вызываем fetchProfile(),
    // т.к. эндпоинт /profile требует access_token и вернёт 401.
    // Это предотвращает Auth Loop: 401 → logout() → очистка guest_token → OAuth fail
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      try {
        setAuthenticating(true);
        const profileSummary = await this.fetchProfile();
        if (profileSummary) {
          // Конвертируем ProfileSummary в User и Profile для signals
          const user = createUser(
            profileSummary.userId,
            profileSummary.nickname,
            platformManager.getPlatformType()
          );
          const profile = createDefaultProfile(profileSummary.level, profileSummary.xp);
          setAuthState(user, profile, accessToken);
          this.initialized = true;
          console.log('[AuthService] Session restored for registered user');
          return true;
        }
      } catch (err) {
        console.log('[AuthService] Session restore failed:', err);
        // Token is NOT cleared here to allow retry on network error.
        // 401 errors are handled by setOnUnauthorized callback.
      }
    }

    // FIX-001: Для гостей (есть guest_token, но нет access_token) — логируем и идём в login flow.
    // Это сохраняет guest_token и связанные данные (registration_claim_token).
    const guestToken = localStorage.getItem('guest_token');
    if (guestToken && !accessToken) {
      console.log('[AuthService] Guest session detected, skipping fetchProfile to preserve tokens');
    }

    // Copilot P1: Автоматически авторизуем новых пользователей
    // Если нет существующей сессии, запускаем login flow
    console.log('[AuthService] No existing session, starting login flow');
    const loginSuccess = await this.login();
    // Copilot P2: Устанавливаем initialized только при успешном login,
    // чтобы разрешить повторные попытки при ошибках сети
    if (loginSuccess) {
      this.initialized = true;
    }
    setAuthenticating(false);
    return loginSuccess;
  }

  /**
   * Авторизация через платформу.
   * Автоматически выбирает метод в зависимости от платформы.
   */
  async login(): Promise<boolean> {
    const adapter = platformManager.getAdapter();
    const platformType = adapter.getPlatformType();

    switch (platformType) {
      case 'telegram':
        return this.loginViaTelegram();
      case 'yandex':
      case 'poki':
      case 'crazygames':
      case 'gamedistribution':
        return this.loginViaPlatform(platformType);
      default:
        // Standalone и неизвестные платформы — гостевой режим
        return this.loginAsGuest();
    }
  }

  /**
   * Универсальная авторизация через платформу (Yandex, Poki, CrazyGames, GameDistribution).
   * Вызывает /auth/verify с credentials от адаптера.
   */
  private async loginViaPlatform(platformType: string): Promise<boolean> {
    try {
      setAuthenticating(true);
      setAuthError(null);

      const adapter = platformManager.getAdapter();
      const credentials = await adapter.getCredentials();

      if (!credentials?.platformData) {
        console.warn(`[AuthService] No credentials for ${platformType}, falling back to guest`);
        return this.loginAsGuest();
      }

      console.log(`[AuthService] Logging in via ${platformType}`);

      const response = await metaServerClient.post<PlatformAuthResponse>('/api/v1/auth/verify', {
        platformType: credentials.platformType,
        platformAuthToken: credentials.platformData,
      });

      // SECURITY: localStorage chosen intentionally - see file header comment
      localStorage.setItem('access_token', response.accessToken);
      localStorage.setItem('user_id', response.userId);
      localStorage.setItem('user_nickname', response.profile.nickname);
      localStorage.setItem('is_anonymous', 'false');

      // Очищаем гостевые данные
      this.clearGuestData();

      // Создаём User для UI
      const user = createUser(
        response.userId,
        response.profile.nickname,
        platformType
      );
      const profile = createDefaultProfile();

      // Устанавливаем токен в metaServerClient
      metaServerClient.setToken(response.accessToken);
      setAuthState(user, profile, response.accessToken);

      console.log(`[AuthService] ${platformType} login successful`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : `Ошибка авторизации ${platformType}`;
      console.error(`[AuthService] ${platformType} login failed:`, message);

      // При ошибке авторизации платформы — fallback на гостевой режим
      console.log(`[AuthService] Falling back to guest login`);
      return this.loginAsGuest();
    } finally {
      setAuthenticating(false);
    }
  }

  /**
   * Создаёт гостевую сессию для Standalone-пользователей.
   *
   * MVP DESIGN NOTE: Никнейм и скин генерируются на клиенте, а не на сервере.
   * Причины:
   * 1. Гостевые данные нужны только для UI до регистрации
   * 2. Сервер не хранит гостевые никнеймы — они временные
   * 3. При регистрации (auth/upgrade) сервер выдаёт настоящий никнейм
   * 4. Упрощает API и снижает нагрузку (меньше запросов к БД)
   *
   * See slime-arena-o4y for potential server-side generation improvements.
   */
  async loginAsGuest(): Promise<boolean> {
    try {
      setAuthenticating(true);
      setAuthError(null);

      console.log('[AuthService] Logging in as guest');

      const response = await metaServerClient.post<GuestAuthResponse>('/api/v1/auth/guest', {});

      // SECURITY: localStorage chosen intentionally - see file header comment
      localStorage.setItem('guest_token', response.guestToken);
      localStorage.setItem('token_expires_at', response.expiresAt);

      // Генерируем локальный никнейм и скин для UI
      const nickname = this.generateGuestNickname();
      const skinId = this.generateGuestSkinId();
      localStorage.setItem('guest_nickname', nickname);
      localStorage.setItem('guest_skin_id', skinId);

      // Создаём локальный User для UI (без полноценной серверной сессии)
      const user = createUser('guest', nickname, platformManager.getPlatformType());
      const profile = createDefaultProfile();

      // Устанавливаем токен в metaServerClient для последующих запросов
      metaServerClient.setToken(response.guestToken);
      setAuthState(user, profile, response.guestToken);

      console.log('[AuthService] Guest login successful');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка гостевой авторизации';
      console.error('[AuthService] Guest login failed:', message);
      setAuthError(message);
      return false;
    } finally {
      // Copilot P1: Всегда сбрасываем флаг authenticating
      setAuthenticating(false);
    }
  }

  /**
   * Авторизация через Telegram (Silent Auth).
   */
  async loginViaTelegram(): Promise<boolean> {
    try {
      setAuthenticating(true);
      setAuthError(null);

      const adapter = platformManager.getAdapter();
      if (adapter.getPlatformType() !== 'telegram') {
        throw new Error('Not running in Telegram');
      }

      const credentials = await adapter.getCredentials();
      if (!credentials?.platformData) {
        throw new Error('No Telegram initData available');
      }

      console.log('[AuthService] Logging in via Telegram');

      const response = await metaServerClient.post<TelegramAuthResponse>('/api/v1/auth/telegram', {
        initData: credentials.platformData,
      });

      // Copilot P1: Очищаем guest данные при успешной Telegram авторизации
      // Иначе isAnonymous() будет возвращать неверное значение
      this.clearGuestData();

      // SECURITY: localStorage chosen intentionally - see file header comment
      // Codex P0: Исправлен контракт — сервер отдаёт userId/profile/isAnonymous, а не user.*
      localStorage.setItem('access_token', response.accessToken);
      localStorage.setItem('user_id', response.userId);
      localStorage.setItem('user_nickname', response.profile.nickname);
      localStorage.setItem('is_anonymous', String(response.isAnonymous));

      // Создаём User для UI
      const user = createUser(
        response.userId,
        response.profile.nickname,
        'telegram'
      );
      const profile = createDefaultProfile();

      // Устанавливаем токен в metaServerClient
      metaServerClient.setToken(response.accessToken);
      setAuthState(user, profile, response.accessToken);

      console.log('[AuthService] Telegram login successful');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка авторизации Telegram';
      console.error('[AuthService] Telegram login failed:', message);
      setAuthError(message);
      return false;
    } finally {
      // Copilot P1: Всегда сбрасываем флаг authenticating
      setAuthenticating(false);
    }
  }

  /**
   * Генерация случайного никнейма для гостя.
   *
   * Gemini P1: Списки слов проверены против серверных BANNED_WORDS
   * (admin, moderator, system, bot, dev, staff, gm, gamemaster, slime, arena).
   * При добавлении новых слов необходимо проверить совместимость.
   * Сервер выполняет финальную валидацию при /auth/upgrade.
   */
  private generateGuestNickname(): string {
    // Copilot P1: Слова безопасны для BANNED_WORDS на сервере
    const adjectives = ['Быстрый', 'Хитрый', 'Весёлый', 'Храбрый', 'Ловкий'];
    const nouns = ['Охотник', 'Воин', 'Странник', 'Игрок', 'Боец'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    // Copilot P2: Date.now() уменьшает вероятность коллизий никнеймов
    const uniqueId = Date.now() % 10000;
    return `${adj}${noun}${uniqueId}`;
  }

  /**
   * Генерация случайного скина для гостя.
   */
  private generateGuestSkinId(): string {
    const basicSkins = ['slime_green', 'slime_blue', 'slime_red', 'slime_yellow'];
    return basicSkins[Math.floor(Math.random() * basicSkins.length)];
  }

  /**
   * Очистить гостевые данные из localStorage.
   * Вызывается при успешной авторизации через Telegram или upgrade.
   */
  private clearGuestData(): void {
    localStorage.removeItem('guest_token');
    localStorage.removeItem('guest_nickname');
    localStorage.removeItem('guest_skin_id');
    // Copilot P2: Также очищаем authToken от metaServerClient
    localStorage.removeItem('authToken');
  }

  /**
   * Выход из аккаунта.
   */
  async logout(): Promise<void> {
    try {
      // Уведомляем сервер (fire and forget)
      await metaServerClient.post('/api/v1/auth/logout', {}).catch(() => {});
    } finally {
      metaServerClient.clearToken();
      // Очищаем все auth-данные из localStorage
      this.clearAllAuthData();
      clearAuthState();
      console.log('[AuthService] Logged out');
    }
  }

  /**
   * Полная очистка всех auth-данных из localStorage.
   * Вызывается при logout для сброса сессии.
   */
  private clearAllAuthData(): void {
    // Registered/Telegram user data
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_expires_at');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_nickname');
    localStorage.removeItem('is_anonymous');
    // Guest data
    localStorage.removeItem('guest_token');
    localStorage.removeItem('guest_nickname');
    localStorage.removeItem('guest_skin_id');
    // metaServerClient token
    localStorage.removeItem('authToken');
  }

  /**
   * Обновить никнейм.
   */
  async updateNickname(nickname: string): Promise<boolean> {
    try {
      const profileSummary = await metaServerClient.postIdempotent<ProfileSummary>('/api/v1/profile/nickname', {
        nickname,
      });

      // Обновляем состояние
      const token = metaServerClient.getToken();
      if (token && profileSummary) {
        const user = createUser(
          profileSummary.userId,
          profileSummary.nickname,
          platformManager.getPlatformType()
        );
        const profile = createDefaultProfile(profileSummary.level, profileSummary.xp);
        setAuthState(user, profile, token);
      }

      // Для Standalone также сохраняем локально
      const standaloneAdapter = platformManager.getStandaloneAdapter();
      if (standaloneAdapter) {
        standaloneAdapter.setNickname(nickname);
      }

      return true;
    } catch (err) {
      console.error('[AuthService] Failed to update nickname:', err);
      return false;
    }
  }

  /**
   * Получить профиль текущего пользователя.
   */
  async fetchProfile(): Promise<ProfileSummary | null> {
    try {
      return await metaServerClient.get<ProfileSummary>('/api/v1/profile');
    } catch (err) {
      console.error('[AuthService] Failed to fetch profile:', err);
      return null;
    }
  }

  /**
   * Проверить, авторизован ли пользователь.
   */
  isLoggedIn(): boolean {
    return metaServerClient.getToken() !== null;
  }

  /**
   * Получить текущий токен.
   */
  getToken(): string | null {
    return metaServerClient.getToken();
  }

  /**
   * Получить токен для подключения к матчу.
   * Возвращает access_token (для зарегистрированных/Telegram) или guest_token.
   */
  getJoinToken(): string | null {
    return localStorage.getItem('access_token') || localStorage.getItem('guest_token');
  }

  /**
   * Проверить, авторизован ли пользователь (есть любой токен).
   */
  isAuthenticated(): boolean {
    return !!this.getJoinToken();
  }

  /**
   * Проверить, является ли пользователь анонимным (гость или анонимный Telegram).
   * Copilot P1: Учитываем приоритет access_token над guest_token
   */
  isAnonymous(): boolean {
    const hasAccessToken = !!localStorage.getItem('access_token');
    const hasGuestToken = !!localStorage.getItem('guest_token');
    const isAnonymousFlag = localStorage.getItem('is_anonymous') === 'true';

    // Если есть access_token, проверяем флаг is_anonymous
    if (hasAccessToken) {
      return isAnonymousFlag;
    }

    // Если только guest_token — пользователь анонимный
    return hasGuestToken;
  }

  /**
   * Получить никнейм пользователя.
   */
  getNickname(): string {
    return localStorage.getItem('user_nickname') || localStorage.getItem('guest_nickname') || 'Игрок';
  }

  /**
   * Получить ID выбранного скина.
   */
  getSkinId(): string {
    return localStorage.getItem('selected_skin_id') || localStorage.getItem('guest_skin_id') || 'slime_green';
  }

  /**
   * Получить joinToken для подключения к игровой комнате.
   * joinToken включает guestSubjectId для верификации claim на сервере.
   * @param nickname - Никнейм игрока
   * @returns joinToken или null при ошибке
   */
  async getRoomJoinToken(nickname: string): Promise<string | null> {
    try {
      const response = await metaServerClient.post<{ joinToken: string; expiresIn: number }>(
        '/api/v1/auth/join-token',
        { nickname }
      );
      console.log('[AuthService] Room join token obtained');
      return response.joinToken;
    } catch (error) {
      console.error('[AuthService] Failed to get room join token:', error);
      return null;
    }
  }

  /**
   * Завершить upgrade гостя в зарегистрированного пользователя.
   * Очищает гостевые данные и обновляет UI состояние.
   * Вызывается из RegistrationPromptModal после успешного /auth/upgrade.
   */
  finishUpgrade(accessToken: string, nickname?: string): void {
    // Очищаем гостевые данные
    this.clearGuestData();

    // P1-3: Устанавливаем токен в HTTP-клиент для последующих запросов.
    // Без этого HTTP-клиент остаётся с гостевым токеном после OAuth upgrade.
    metaServerClient.setToken(accessToken);

    // Обновляем UI состояние
    const user = createUser(
      '', // userId будет получен при следующем fetchProfile
      nickname || this.getNickname(),
      platformManager.getPlatformType()
    );
    const profile = createDefaultProfile();
    setAuthState(user, profile, accessToken);

    console.log('[AuthService] Upgrade finished, guest data cleared');
  }
}

// Экземпляр-синглтон
export const authService = new AuthService();
