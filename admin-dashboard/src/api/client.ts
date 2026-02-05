/**
 * HTTP-клиент для Admin API.
 * Автоматически добавляет Authorization header.
 * При 401 пытается обновить токен через /refresh.
 */
import { accessToken, setAccessToken, clearAuth } from '../auth/signals';

// В production (serve) нет proxy, поэтому используем абсолютный URL MetaServer
// В dev режиме Vite proxy перенаправляет /api на localhost:3000
const API_BASE = import.meta.env.PROD
  ? `${window.location.protocol}//${window.location.hostname}:3000/api/v1/admin`
  : '/api/v1/admin';

/** Флаг, предотвращающий параллельные refresh-запросы */
let isRefreshing = false;
/** Очередь запросов, ожидающих завершения refresh */
let refreshQueue: Array<() => void> = [];

/**
 * Выполнить запрос к Admin API.
 * При 401 автоматически пытается refresh токен.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetchWithAuth(endpoint, options);

  if (response.status === 401) {
    // Попытка обновить токен
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Повторить оригинальный запрос
      const retryResponse = await fetchWithAuth(endpoint, options);
      if (!retryResponse.ok) {
        throw new ApiError(retryResponse.status, await parseErrorMessage(retryResponse));
      }
      return retryResponse.json();
    } else {
      // Refresh не удался — logout
      clearAuth();
      throw new ApiError(401, 'Сессия истекла');
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessage(response));
  }

  // Для 204 No Content возвращаем пустой объект
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * Выполнить fetch с Authorization header.
 */
async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);

  if (accessToken.value) {
    headers.set('Authorization', `Bearer ${accessToken.value}`);
  }

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Для отправки refresh_token cookie
  });
}

/**
 * Попытка обновить access token через refresh endpoint.
 * Использует очередь для предотвращения параллельных запросов.
 */
let lastRefreshResult = false;

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing) {
    // P2: Ждём завершения текущего refresh и используем его результат
    return new Promise((resolve) => {
      refreshQueue.push(() => resolve(lastRefreshResult));
    });
  }

  isRefreshing = true;
  lastRefreshResult = false;

  try {
    const response = await fetch(`${API_BASE}/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      setAccessToken(data.accessToken);
      lastRefreshResult = true;
      return true;
    }

    // P2: При неуспешном refresh очищаем токен до уведомления очереди
    clearAuth();
    return false;
  } catch {
    // P2: При ошибке также очищаем токен
    clearAuth();
    return false;
  } finally {
    isRefreshing = false;
    // Уведомить все ожидающие запросы с результатом refresh
    const queue = refreshQueue;
    refreshQueue = [];
    queue.forEach((callback) => callback());
  }
}

/**
 * Извлечь сообщение об ошибке из ответа сервера.
 */
async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.message || data.error || 'Неизвестная ошибка';
  } catch {
    return `Ошибка ${response.status}`;
  }
}

/**
 * Класс ошибки API.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// --- Специфичные API-функции ---

export interface LoginResponse {
  accessToken: string;
  totpRequired: boolean;
}

/**
 * Логин администратора.
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessage(response));
  }

  return response.json();
}

/**
 * Logout администратора.
 */
export async function logout(): Promise<void> {
  try {
    await apiRequest('/logout', { method: 'POST' });
  } finally {
    clearAuth();
  }
}

/**
 * Попытка восстановить сессию при загрузке страницы.
 */
export async function tryRestoreSession(): Promise<boolean> {
  return tryRefreshToken();
}

export interface TotpSetupResponse {
  secret: string;
  qrCodeUrl: string;
}

/**
 * Получить данные для настройки 2FA.
 */
export async function getTotpSetup(): Promise<TotpSetupResponse> {
  return apiRequest('/totp/setup', { method: 'POST' });
}

/**
 * Подтвердить настройку 2FA.
 */
export async function verifyTotp(code: string): Promise<void> {
  return apiRequest('/totp/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}
