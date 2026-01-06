/**
 * HTTP-клиент для взаимодействия с MetaServer API.
 * Автоматически добавляет Authorization header и обрабатывает ошибки.
 */

// @ts-expect-error Vite env types
const META_SERVER_URL = (import.meta.env?.VITE_META_SERVER_URL as string) || 'http://localhost:3000';
const DEFAULT_TIMEOUT = 10000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1000;

interface ApiError {
  status: number;
  message: string;
  code?: string;
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
    const operationId = crypto.randomUUID();
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
        if (response.status === 401) {
          this.clearToken();
          if (this.onUnauthorized) {
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

      // Abort (timeout)
      if (err instanceof Error && err.name === 'AbortError') {
        throw { status: 0, message: 'Request timeout', code: 'TIMEOUT' } as ApiError;
      }

      // Network error — retry
      if (err instanceof TypeError && retryCount < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, retryCount);
        await this.sleep(delay);
        return this.request<T>(method, path, body, retryCount + 1);
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
      return {
        status: response.status,
        message: data.error || data.message || response.statusText,
        code: data.code,
      };
    } catch {
      return {
        status: response.status,
        message: response.statusText,
      };
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
