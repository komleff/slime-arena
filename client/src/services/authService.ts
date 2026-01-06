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

interface AuthResponse {
  token: string;
  user: User;
  profile: Profile;
}

interface ProfileResponse {
  user: User;
  profile: Profile;
}

class AuthService {
  private initialized = false;

  /**
   * Инициализация сервиса.
   * Пытается восстановить сессию из localStorage.
   */
  async initialize(): Promise<boolean> {
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
        const profile = await this.fetchProfile();
        if (profile) {
          setAuthState(profile.user, profile.profile, token);
          this.initialized = true;
          console.log('[AuthService] Session restored');
          return true;
        }
      } catch (err) {
        console.log('[AuthService] Session restore failed, clearing token');
        metaServerClient.clearToken();
      }
    }

    // Устанавливаем callback для 401 ошибок
    metaServerClient.setOnUnauthorized(() => {
      this.logout();
    });

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

      // Отправляем на сервер
      const response = await metaServerClient.post<AuthResponse>('/api/v1/auth/verify', {
        platformType: credentials.platformType,
        platformData: credentials.platformData,
        nickname: credentials.nickname,
      });

      // Сохраняем токен и обновляем состояние
      metaServerClient.setToken(response.token);
      setAuthState(response.user, response.profile, response.token);

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
      const response = await metaServerClient.post<ProfileResponse>('/api/v1/profile/nickname', {
        nickname,
      });

      // Обновляем состояние
      const token = metaServerClient.getToken();
      if (token) {
        setAuthState(response.user, response.profile, token);
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
  async fetchProfile(): Promise<ProfileResponse | null> {
    try {
      return await metaServerClient.get<ProfileResponse>('/api/v1/profile');
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
