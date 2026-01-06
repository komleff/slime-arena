/**
 * Сервис авторизации.
 * Управляет аутентификацией через MetaServer и сессией пользователя.
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
 * Ответ сервера на /auth/verify
 * Формат от MetaServer DevAuthProvider
 */
interface AuthResponse {
  accessToken: string;
  userId: string;
  profile: {
    nickname: string;
    locale: string;
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

    this.initialized = true;
    setAuthenticating(false);
    return false;
  }

  /**
   * Авторизация через платформу.
   */
  async login(): Promise<boolean> {
    try {
      setAuthenticating(true);
      setAuthError(null);

      // Получаем credentials от платформы
      const adapter = platformManager.getAdapter();
      const credentials = await adapter.getCredentials();

      console.log(`[AuthService] Logging in via ${credentials.platformType}`);

      // Отправляем на сервер (P0-1: platformAuthToken вместо platformData)
      const response = await metaServerClient.post<AuthResponse>('/api/v1/auth/verify', {
        platformType: credentials.platformType,
        platformAuthToken: credentials.platformData, // Сервер ожидает platformAuthToken, передаём platformData
      });

      // Конвертируем ответ сервера в User и Profile для signals
      const user = createUser(
        response.userId,
        response.profile.nickname,
        credentials.platformType
      );
      const profile = createDefaultProfile();

      // Сохраняем токен и обновляем состояние
      metaServerClient.setToken(response.accessToken);
      setAuthState(user, profile, response.accessToken);

      console.log('[AuthService] Login successful');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      console.error('[AuthService] Login failed:', message);
      setAuthError(message);
      return false;
    }
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
}

// Экземпляр-синглтон
export const authService = new AuthService();
