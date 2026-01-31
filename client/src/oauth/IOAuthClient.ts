/**
 * Интерфейс OAuth клиента
 *
 * @see docs/meta-min/TZ-StandaloneAdapter-OAuth-v1.9.md раздел 4.1
 */

import { OAuthProviderName, OAuthButtonConfig } from './types';

export interface IOAuthClient {
  /** Идентификатор провайдера */
  getProviderName(): OAuthProviderName;

  /** Генерация CSRF-токена */
  generateState(): string;

  /** Генерация PKCE verifier и challenge (если требуется) */
  generatePKCE(): { codeVerifier: string; codeChallenge: string } | null;

  /** Формирование URL авторизации */
  buildAuthUrl(state: string, codeChallenge?: string): string;

  /** Конфигурация кнопки провайдера */
  getButtonConfig(): OAuthButtonConfig;

  /** Требуется ли PKCE */
  requiresPKCE(): boolean;
}
