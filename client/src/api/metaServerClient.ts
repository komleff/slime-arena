/**
 * HTTP-клиент для взаимодействия с MetaServer API.
 * Автоматически добавляет Authorization header и обрабатывает ошибки.
 */

const getMetaServerUrl = () => {
  // MetaServer URL задаётся через env-переменную VITE_META_SERVER_URL
  // Если не задан, возвращаем пустую строку (offline режим)
  return import.meta.env?.VITE_META_SERVER_URL || '';
};

const META_SERVER_URL = getMetaServerUrl();
// 10 секунд: достаточно для типичных запросов, не блокирует UI слишком долго
const DEFAULT_TIMEOUT = 10000;
// 3 попытки: баланс между устойчивостью к сбоям и нагрузкой на сервер
const MAX_RETRIES = 3;
// 1 секунда базовой задержки для exponential backoff (1s, 2s, 4s...)
const RETRY_BASE_DELAY = 1000;

/**
 * Генерация UUID v4 с fallback для non-secure context.
 * crypto.randomUUID() доступен только в Secure Context (HTTPS/localhost).
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: генерация UUID v4 вручную
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

class MetaServerClient {
  private token: string | null = null;
  private onUnauthorized: (() => void) | null = null;

  /**
   * Установить Bearer token для авторизации.
   */
  setToken(token: string): void {
    this.token = token;
    try {
      localStorage.setItem('authToken', token);
    } catch (err) {
      console.warn('[MetaServerClient] Failed to save token to localStorage:', err);
    }
  }

  /**
   * Очистить token (при logout или 401).
   */
  clearToken(): void {
    this.token = null;
    try {
      localStorage.removeItem('authToken');
    } catch (err) {
      console.warn('[MetaServerClient] Failed to remove token from localStorage:', err);
    }
  }

  /**
   * Получить текущий token.
   */
  getToken(): string | null {
    if (!this.token) {
      try {
        this.token = localStorage.getItem('authToken');
      } catch (err) {
        console.warn('[MetaServerClient] Failed to read token from localStorage:', err);
        this.token = null;
      }
    }
    return this.token;
  }

  /**
   * Установить callback для обработки 401 ошибок.
   */
  setOnUnauthorized(callback: () => void): void {
    this.onUnauthorized = callback;
  }

  /**
   * GET-запрос с авторизацией.
   */
  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  /**
   * POST-запрос с авторизацией.
   */
  async post<T>(path: string, body?: object): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  /**
   * POST-запрос с operationId для идемпотентности.
   * Используется для операций, которые не должны дублироваться при повторе.
   */
  async postIdempotent<T>(path: string, body?: object): Promise<T> {
    const operationId = generateUUID();
    return this.request<T>('POST', path, { ...body, operationId });
  }

  /**
   * Основной метод для HTTP-запросов с retry логикой.
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: object,
    retryCount = 0
  ): Promise<T> {
    const url = `${META_SERVER_URL}${path}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Если META_SERVER_URL пустой, сразу выбрасываем понятную ошибку
    if (!META_SERVER_URL) {
      throw new ApiError(
        'MetaServer недоступен (VITE_META_SERVER_URL не задан)',
        0,
        'NO_META_SERVER'
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await this.parseError(response);

        // 401 — очищаем сессию и вызываем callback
        // Исключение: путь /logout — не вызываем callback чтобы избежать бесконечного цикла
        if (response.status === 401) {
          this.clearToken();
          const isLogoutPath = path.includes('/logout');
          if (this.onUnauthorized && !isLogoutPath) {
            this.onUnauthorized();
          }
          throw error;
        }

        // 5xx — retry с exponential backoff
        if (response.status >= 500 && retryCount < MAX_RETRIES) {
          const delay = RETRY_BASE_DELAY * Math.pow(2, retryCount);
          await this.sleep(delay);
          return this.request<T>(method, path, body, retryCount + 1);
        }

        throw error;
      }

      // Пустой ответ
      const text = await response.text();
      if (!text) {
        return {} as T;
      }

      return JSON.parse(text) as T;
    } catch (err) {
      clearTimeout(timeoutId);

      const isAbortError = err instanceof Error && err.name === 'AbortError';
      const isNetworkError = err instanceof TypeError;

      // Timeout и Network error — retry с exponential backoff
      if ((isAbortError || isNetworkError) && retryCount < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, retryCount);
        await this.sleep(delay);
        return this.request<T>(method, path, body, retryCount + 1);
      }

      // Timeout после исчерпания попыток
      if (isAbortError) {
        throw new ApiError('Превышено время ожидания запроса', 0, 'TIMEOUT');
      }

      throw err;
    }
  }

  /**
   * Парсинг ошибки из response.
   */
  private async parseError(response: Response): Promise<ApiError> {
    try {
      const data = await response.json();
      return new ApiError(
        data.error || data.message || response.statusText,
        response.status,
        data.code
      );
    } catch {
      return new ApiError(response.statusText, response.status);
    }
  }

  /**
   * Утилита для задержки.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Экземпляр-синглтон
export const metaServerClient = new MetaServerClient();
export type { ApiError };
