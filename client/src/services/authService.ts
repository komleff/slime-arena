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

/**
 * Ответ сервера на /auth/guest
 */
interface GuestAuthResponse {
  guestToken: string;
  expiresAt: string;
}

/**
 * Ответ сервера на /auth/telegram
 */
interface TelegramAuthResponse {
  accessToken: string;
  expiresAt: string;
  user: {
    id: string;
    nickname: string;
    isAnonymous: boolean;
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
    rating: 1500,
    ratingDeviation: 350,
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

    // Пытаемся восстановить сессию
    const token = metaServerClient.getToken();
    if (token) {
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
          setAuthState(user, profile, token);
          this.initialized = true;
          console.log('[AuthService] Session restored');
          return true;
        }
      } catch (err) {
        console.log('[AuthService] Session restore failed, clearing token');
        metaServerClient.clearToken();
      }
    }

    // Copilot P1: Автоматически авторизуем новых пользователей
    // Если нет существующей сессии, запускаем login flow
    console.log('[AuthService] No existing session, starting login flow');
    const loginSuccess = await this.login();
    this.initialized = true;
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

    if (platformType === 'telegram') {
      return this.loginViaTelegram();
    } else {
      return this.loginAsGuest();
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
      const user = createUser('guest', nickname, 'dev');
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
      localStorage.setItem('access_token', response.accessToken);
      localStorage.setItem('token_expires_at', response.expiresAt);
      localStorage.setItem('user_id', response.user.id);
      localStorage.setItem('user_nickname', response.user.nickname);
      localStorage.setItem('is_anonymous', String(response.user.isAnonymous));

      // Создаём User для UI
      const user = createUser(
        response.user.id,
        response.user.nickname,
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
   */
  private generateGuestNickname(): string {
    // Copilot P1: Слова должны быть безопасными для BANNED_WORDS на сервере
    // 'slime' и 'arena' в BANNED_WORDS, поэтому используем альтернативы
    const adjectives = ['Быстрый', 'Хитрый', 'Весёлый', 'Храбрый', 'Ловкий'];
    const nouns = ['Охотник', 'Воин', 'Странник', 'Игрок', 'Боец'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 1000);
    return `${adj}${noun}${num}`;
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
      clearAuthState();
      console.log('[AuthService] Logged out');
    }
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
}

// Экземпляр-синглтон
export const authService = new AuthService();
