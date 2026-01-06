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
          const user: User = {
            id: profileSummary.userId,
            platformType: 'dev',
            platformId: profileSummary.userId,
            nickname: profileSummary.nickname,
            createdAt: new Date().toISOString(),
          };
          const profile: Profile = {
            rating: 1500,
            ratingDeviation: 350,
            gamesPlayed: 0,
            gamesWon: 0,
            totalKills: 0,
            highestMass: 0,
            level: profileSummary.level,
            xp: profileSummary.xp,
          };
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
        platformAuthToken: credentials.platformData, // Сервер ожидает это поле
      });

      // Конвертируем ответ сервера в User и Profile для signals
      const user: User = {
        id: response.userId,
        platformType: credentials.platformType,
        platformId: response.userId,
        nickname: response.profile.nickname,
        createdAt: new Date().toISOString(),
      };
      const profile: Profile = {
        rating: 1500,
        ratingDeviation: 350,
        gamesPlayed: 0,
        gamesWon: 0,
        totalKills: 0,
        highestMass: 0,
        level: 1,
        xp: 0,
      };

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
      const profileSummary = await metaServerClient.post<ProfileSummary>('/api/v1/profile/nickname', {
        nickname,
      });

      // Обновляем состояние
      const token = metaServerClient.getToken();
      if (token && profileSummary) {
        const user: User = {
          id: profileSummary.userId,
          platformType: 'dev',
          platformId: profileSummary.userId,
          nickname: profileSummary.nickname,
          createdAt: new Date().toISOString(),
        };
        const profile: Profile = {
          rating: 1500,
          ratingDeviation: 350,
          gamesPlayed: 0,
          gamesWon: 0,
          totalKills: 0,
          highestMass: 0,
          level: profileSummary.level,
          xp: profileSummary.xp,
        };
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

// Singleton instance
export const authService = new AuthService();
