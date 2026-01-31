/**
 * OAuth типы для клиента
 *
 * @see docs/meta-min/TZ-StandaloneAdapter-OAuth-v1.9.md раздел 4
 */

export type OAuthProviderName = 'google' | 'yandex' | 'vk';

/** Конфигурация провайдера от сервера */
export interface OAuthProviderConfig {
  name: OAuthProviderName;
  clientId: string;
  priority: number;
  requiresPKCE: boolean;
}

/** Ответ GET /api/v1/auth/config */
export interface AuthConfigResponse {
  region: 'RU' | 'CIS' | 'GLOBAL' | 'UNKNOWN';
  providers: OAuthProviderConfig[];
}

/** Намерение OAuth авторизации */
export type OAuthIntent = 'login' | 'convert_guest';

/** Данные, сохраняемые в localStorage перед redirect */
export interface OAuthStateData {
  state: string;
  codeVerifier?: string;
  provider: OAuthProviderName;
  intent: OAuthIntent;
  savedGameState?: string;
  timestamp: number;
}

/** Результат обмена code на токен */
export interface OAuthResult {
  accessToken: string;
  userId: string;
  profile: {
    nickname: string;
    locale?: string;
  };
  isAnonymous: boolean;
}

/** Ответ 409 при конфликте OAuth */
export interface OAuthConflictResponse {
  error: 'oauth_already_linked';
  pendingAuthToken: string;
  existingAccount: {
    userId: string;
    nickname: string;
    totalMass: number;
    avatarUrl?: string;
  };
}

/** P1-4: Ответ /oauth/prepare-upgrade для подтверждения никнейма */
export interface OAuthPrepareResponse {
  displayName: string;
  avatarUrl?: string;
  prepareToken: string;
}

/** Конфигурация кнопки провайдера */
export interface OAuthButtonConfig {
  label: string;
  backgroundColor: string;
  textColor: string;
  iconUrl?: string;
}

/** localStorage ключи для OAuth */
export const OAUTH_STORAGE_KEYS = {
  STATE: 'oauth_state',
  CODE_VERIFIER: 'oauth_code_verifier',
  PROVIDER: 'oauth_provider',
  INTENT: 'oauth_intent',
  SAVED_GAME_STATE: 'oauth_saved_game_state',
  TIMESTAMP: 'oauth_timestamp',
} as const;
