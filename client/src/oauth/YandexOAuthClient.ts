/**
 * Yandex ID OAuth Client
 *
 * OAuth 2.0 для Яндекс ID.
 *
 * @see docs/meta-min/TZ-StandaloneAdapter-OAuth-v1.9.md раздел 6
 */

import { IOAuthClient } from './IOAuthClient';
import { OAuthButtonConfig } from './types';

// Yandex OAuth endpoints
const YANDEX_AUTH_URL = 'https://oauth.yandex.ru/authorize';

// Yandex OAuth scopes
const YANDEX_SCOPES = 'login:info login:email login:avatar';

export class YandexOAuthClient implements IOAuthClient {
  private readonly clientId: string;
  private readonly redirectUri: string;

  constructor(clientId: string, redirectUri?: string) {
    this.clientId = clientId;
    this.redirectUri = redirectUri || `${window.location.origin}/oauth/callback`;
  }

  getProviderName() {
    return 'yandex' as const;
  }

  /**
   * Генерация CSRF-токена (state)
   */
  generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * PKCE не обязателен для Яндекс
   */
  generatePKCE(): null {
    return null;
  }

  requiresPKCE(): boolean {
    return false;
  }

  /**
   * Формирование URL авторизации Яндекс
   */
  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: YANDEX_SCOPES,
      state: state,
      force_confirm: 'yes', // Всегда показывать экран подтверждения
    });

    return `${YANDEX_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Конфигурация кнопки Яндекс
   */
  getButtonConfig(): OAuthButtonConfig {
    return {
      label: 'Яндекс',
      backgroundColor: '#ffcc00',
      textColor: '#000000',
      // Copilot P2: Внешний URL заменён на пустую строку
      // Иконки уже inline в OAuthProviderSelector.tsx
      iconUrl: '',
    };
  }
}
