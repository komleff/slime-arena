/**
 * Google OAuth 2.0 Client
 *
 * Чистый OAuth 2.0 без SDK. Формирует URL авторизации и параметры.
 *
 * @see docs/meta-min/TZ-StandaloneAdapter-OAuth-v1.9.md раздел 5
 */

import { IOAuthClient } from './IOAuthClient';
import { OAuthButtonConfig } from './types';

// Google OAuth endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

// Google OAuth scopes
const GOOGLE_SCOPES = 'openid email profile';

export class GoogleOAuthClient implements IOAuthClient {
  private readonly clientId: string;
  private readonly redirectUri: string;

  constructor(clientId: string, redirectUri?: string) {
    this.clientId = clientId;
    // Используем текущий origin + /oauth/callback
    this.redirectUri = redirectUri || `${window.location.origin}/oauth/callback`;
  }

  getProviderName() {
    return 'google' as const;
  }

  /**
   * Генерация CSRF-токена (state)
   * Криптографически случайная строка 32+ символов
   */
  generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * PKCE не обязателен для Google, но рекомендуется
   * Возвращаем null - не используем для P0
   */
  generatePKCE(): null {
    return null;
  }

  requiresPKCE(): boolean {
    return false;
  }

  /**
   * Формирование URL авторизации Google
   */
  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES,
      state: state,
      // Не используем access_type=offline и prompt=consent для P0
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Конфигурация кнопки Google
   */
  getButtonConfig(): OAuthButtonConfig {
    return {
      label: 'Google',
      backgroundColor: '#ffffff',
      textColor: '#757575',
      iconUrl: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
    };
  }
}
