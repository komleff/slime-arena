/**
 * OAuth модуль — экспорт публичного API
 */

// Типы
export type {
  OAuthProviderName,
  OAuthProviderConfig,
  AuthConfigResponse,
  OAuthIntent,
  OAuthStateData,
  OAuthResult,
  OAuthConflictResponse,
  OAuthButtonConfig,
} from './types';

export { OAUTH_STORAGE_KEYS } from './types';

// Интерфейсы
export type { IOAuthClient } from './IOAuthClient';

// Клиенты
export { GoogleOAuthClient } from './GoogleOAuthClient';
export { YandexOAuthClient } from './YandexOAuthClient';

// Redirect Handler
export {
  parseOAuthCallback,
  isOAuthCallback,
  saveOAuthState,
  loadOAuthState,
  clearOAuthState,
  handleOAuthCallback,
  resolveOAuthConflict,
} from './OAuthRedirectHandler';

// Сервис
export { oauthService, OAuthService } from './OAuthService';
