/**
 * OAuth Redirect Handler
 *
 * Обрабатывает возврат с OAuth провайдера после авторизации.
 * Восстанавливает состояние из localStorage и делает запрос к серверу.
 *
 * @see docs/meta-min/TZ-StandaloneAdapter-OAuth-v1.9.md раздел 4.2-4.3
 */

import { OAUTH_STORAGE_KEYS, OAuthIntent, OAuthProviderName, OAuthResult, OAuthConflictResponse } from './types';
import { metaServerClient } from '../api/metaServerClient';

export interface OAuthCallbackParams {
  code: string;
  state: string;
  error?: string;
  error_description?: string;
}

export interface OAuthHandlerResult {
  success: boolean;
  result?: OAuthResult;
  conflict?: OAuthConflictResponse;
  error?: string;
}

/**
 * Парсит параметры из URL callback
 */
export function parseOAuthCallback(): OAuthCallbackParams | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  if (error) {
    return {
      code: '',
      state: state || '',
      error,
      error_description: errorDescription || undefined,
    };
  }

  if (!code || !state) {
    return null;
  }

  return { code, state };
}

/**
 * Проверяет, находимся ли мы на callback URL
 */
export function isOAuthCallback(): boolean {
  return window.location.pathname === '/oauth/callback' ||
         window.location.search.includes('code=');
}

/**
 * Сохраняет состояние OAuth перед редиректом
 */
export function saveOAuthState(
  state: string,
  provider: OAuthProviderName,
  intent: OAuthIntent,
  codeVerifier?: string,
  gameState?: string
): void {
  localStorage.setItem(OAUTH_STORAGE_KEYS.STATE, state);
  localStorage.setItem(OAUTH_STORAGE_KEYS.PROVIDER, provider);
  localStorage.setItem(OAUTH_STORAGE_KEYS.INTENT, intent);
  localStorage.setItem(OAUTH_STORAGE_KEYS.TIMESTAMP, Date.now().toString());

  if (codeVerifier) {
    localStorage.setItem(OAUTH_STORAGE_KEYS.CODE_VERIFIER, codeVerifier);
  }

  if (gameState) {
    localStorage.setItem(OAUTH_STORAGE_KEYS.SAVED_GAME_STATE, gameState);
  }
}

/**
 * Восстанавливает состояние OAuth после редиректа
 *
 * Copilot P2: Добавлен timestamp в возвращаемый объект
 */
export function loadOAuthState(): {
  state: string | null;
  provider: OAuthProviderName | null;
  intent: OAuthIntent | null;
  codeVerifier: string | null;
  savedGameState: string | null;
  timestamp: number | null;
} {
  const timestampStr = localStorage.getItem(OAUTH_STORAGE_KEYS.TIMESTAMP);
  return {
    state: localStorage.getItem(OAUTH_STORAGE_KEYS.STATE),
    provider: localStorage.getItem(OAUTH_STORAGE_KEYS.PROVIDER) as OAuthProviderName | null,
    intent: localStorage.getItem(OAUTH_STORAGE_KEYS.INTENT) as OAuthIntent | null,
    codeVerifier: localStorage.getItem(OAUTH_STORAGE_KEYS.CODE_VERIFIER),
    savedGameState: localStorage.getItem(OAUTH_STORAGE_KEYS.SAVED_GAME_STATE),
    timestamp: timestampStr ? parseInt(timestampStr, 10) : null,
  };
}

/**
 * Очищает OAuth данные из localStorage
 * ВАЖНО: вызывать всегда после обработки — и при успехе, и при ошибке
 */
export function clearOAuthState(): void {
  localStorage.removeItem(OAUTH_STORAGE_KEYS.STATE);
  localStorage.removeItem(OAUTH_STORAGE_KEYS.PROVIDER);
  localStorage.removeItem(OAUTH_STORAGE_KEYS.INTENT);
  localStorage.removeItem(OAUTH_STORAGE_KEYS.CODE_VERIFIER);
  localStorage.removeItem(OAUTH_STORAGE_KEYS.SAVED_GAME_STATE);
  localStorage.removeItem(OAUTH_STORAGE_KEYS.TIMESTAMP);
}

/**
 * Обрабатывает OAuth callback
 */
export async function handleOAuthCallback(
  params: OAuthCallbackParams,
  guestToken?: string,
  claimToken?: string,
  nickname?: string
): Promise<OAuthHandlerResult> {
  // Проверяем ошибку от провайдера
  if (params.error) {
    clearOAuthState();
    return {
      success: false,
      error: params.error_description || params.error,
    };
  }

  // Восстанавливаем состояние
  const savedState = loadOAuthState();

  // Проверяем state (CSRF protection)
  if (!savedState.state || savedState.state !== params.state) {
    clearOAuthState();
    return {
      success: false,
      error: 'Invalid OAuth state (possible CSRF attack)',
    };
  }

  // Copilot P2: Используем timestamp из savedState вместо повторной загрузки
  const timestamp = savedState.timestamp || 0;
  if (Date.now() - timestamp > 10 * 60 * 1000) {
    clearOAuthState();
    return {
      success: false,
      error: 'OAuth session expired',
    };
  }

  const provider = savedState.provider;
  const intent = savedState.intent;
  const codeVerifier = savedState.codeVerifier;

  if (!provider || !intent) {
    clearOAuthState();
    return {
      success: false,
      error: 'Missing OAuth state data',
    };
  }

  try {
    let result: OAuthHandlerResult;

    if (intent === 'login') {
      // Вход в существующий аккаунт
      result = await handleOAuthLogin(provider, params.code, codeVerifier);
    } else {
      // Конвертация гостя
      if (!guestToken || !claimToken || !nickname) {
        clearOAuthState();
        return {
          success: false,
          error: 'Missing guest data for convert_guest flow',
        };
      }
      result = await handleOAuthUpgrade(provider, params.code, guestToken, claimToken, nickname, codeVerifier);
    }

    // Очищаем состояние после обработки
    clearOAuthState();

    return result;
  } catch (error: any) {
    clearOAuthState();
    return {
      success: false,
      error: error.message || 'OAuth processing failed',
    };
  }
}

/**
 * POST /api/v1/auth/oauth - вход в существующий аккаунт
 */
async function handleOAuthLogin(
  provider: OAuthProviderName,
  code: string,
  codeVerifier?: string | null
): Promise<OAuthHandlerResult> {
  const body: Record<string, string> = {
    provider,
    code,
    redirectUri: `${window.location.origin}/oauth/callback`,
  };

  if (codeVerifier) {
    body.codeVerifier = codeVerifier;
  }

  const response = await metaServerClient.postRaw('/auth/oauth', body);

  if (response.status === 404) {
    // Аккаунт не найден — это нормально для нового пользователя
    return {
      success: false,
      error: 'account_not_found',
    };
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: errorData.message || 'OAuth login failed',
    };
  }

  const data = await response.json();
  return {
    success: true,
    result: data,
  };
}

/**
 * POST /api/v1/auth/upgrade - конвертация гостя
 */
async function handleOAuthUpgrade(
  provider: OAuthProviderName,
  code: string,
  guestToken: string,
  claimToken: string,
  nickname: string,
  codeVerifier?: string | null
): Promise<OAuthHandlerResult> {
  const body: Record<string, string> = {
    mode: 'convert_guest',
    provider,
    code,
    redirectUri: `${window.location.origin}/oauth/callback`,
    claimToken,
    nickname,
  };

  if (codeVerifier) {
    body.codeVerifier = codeVerifier;
  }

  const response = await metaServerClient.postRaw('/auth/upgrade', body, {
    headers: {
      Authorization: `Bearer ${guestToken}`,
    },
  });

  if (response.status === 409) {
    // Конфликт — OAuth уже привязан к другому аккаунту
    const conflictData = await response.json() as OAuthConflictResponse;
    return {
      success: false,
      conflict: conflictData,
    };
  }

  if (response.status === 410) {
    // claimToken истёк или использован
    return {
      success: false,
      error: 'Claim token expired. Please play another match.',
    };
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: errorData.message || 'OAuth upgrade failed',
    };
  }

  const data = await response.json();
  return {
    success: true,
    result: data,
  };
}

/**
 * POST /api/v1/auth/oauth/resolve - вход после 409 конфликта
 */
export async function resolveOAuthConflict(
  pendingAuthToken: string
): Promise<OAuthHandlerResult> {
  const response = await metaServerClient.postRaw('/auth/oauth/resolve', {
    pendingAuthToken,
  });

  if (response.status === 410) {
    return {
      success: false,
      error: 'Token already used',
    };
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: errorData.message || 'OAuth resolve failed',
    };
  }

  const data = await response.json();
  return {
    success: true,
    result: data,
  };
}
