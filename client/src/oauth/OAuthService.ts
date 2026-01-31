/**
 * OAuth Service
 *
 * Управление OAuth авторизацией на клиенте.
 * Загружает конфигурацию с сервера и инициирует OAuth flow.
 *
 * @see docs/meta-min/TZ-StandaloneAdapter-OAuth-v1.9.md раздел 4
 */

import { metaServerClient } from '../api/metaServerClient';
import { IOAuthClient } from './IOAuthClient';
import { GoogleOAuthClient } from './GoogleOAuthClient';
import { YandexOAuthClient } from './YandexOAuthClient';
import {
  AuthConfigResponse,
  OAuthProviderConfig,
  OAuthProviderName,
  OAuthIntent,
} from './types';
import { saveOAuthState, isOAuthCallback } from './OAuthRedirectHandler';

export class OAuthService {
  private config: AuthConfigResponse | null = null;
  private clients: Map<OAuthProviderName, IOAuthClient> = new Map();
  private configLoaded = false;
  private configLoading: Promise<void> | null = null;

  /**
   * Загружает конфигурацию OAuth с сервера
   */
  async loadConfig(): Promise<AuthConfigResponse> {
    if (this.configLoading) {
      await this.configLoading;
      return this.config!;
    }

    if (this.configLoaded && this.config) {
      return this.config;
    }

    this.configLoading = this.fetchConfig();
    await this.configLoading;
    this.configLoading = null;

    return this.config!;
  }

  private async fetchConfig(): Promise<void> {
    try {
      const response = await metaServerClient.getRaw('/api/v1/auth/config');

      if (!response.ok) {
        throw new Error('Failed to load OAuth config');
      }

      this.config = await response.json() as AuthConfigResponse;
      this.configLoaded = true;

      // Инициализируем клиенты для доступных провайдеров
      this.initializeClients();

      console.log(`[OAuthService] Loaded config: region=${this.config.region}, providers=${this.config.providers.map(p => p.name).join(', ')}`);
    } catch (error) {
      console.error('[OAuthService] Failed to load config:', error);
      throw error;
    }
  }

  private initializeClients(): void {
    if (!this.config) return;

    this.clients.clear();

    for (const provider of this.config.providers) {
      let client: IOAuthClient | null = null;

      switch (provider.name) {
        case 'google':
          client = new GoogleOAuthClient(provider.clientId);
          break;
        case 'yandex':
          client = new YandexOAuthClient(provider.clientId);
          break;
        case 'vk':
          // VK будет добавлен в P1
          break;
      }

      if (client) {
        this.clients.set(provider.name, client);
      }
    }
  }

  /**
   * Получить список доступных провайдеров
   */
  getAvailableProviders(): OAuthProviderConfig[] {
    return this.config?.providers || [];
  }

  /**
   * Получить регион пользователя
   */
  getRegion(): string | null {
    return this.config?.region || null;
  }

  /**
   * Получить OAuth клиент по имени провайдера
   */
  getClient(provider: OAuthProviderName): IOAuthClient | null {
    return this.clients.get(provider) || null;
  }

  /**
   * Инициировать OAuth авторизацию
   *
   * @param provider - Имя провайдера
   * @param intent - Намерение (login или convert_guest)
   * @param gameState - Состояние игры для восстановления (опционально)
   */
  async startOAuth(
    provider: OAuthProviderName,
    intent: OAuthIntent,
    gameState?: string
  ): Promise<void> {
    const client = this.clients.get(provider);
    if (!client) {
      throw new Error(`OAuth client not found for provider: ${provider}`);
    }

    // Генерируем state для CSRF protection
    const state = client.generateState();

    // Генерируем PKCE если требуется
    const pkce = client.generatePKCE();
    const codeVerifier = pkce?.codeVerifier;
    const codeChallenge = pkce?.codeChallenge;

    // Сохраняем состояние в localStorage
    saveOAuthState(state, provider, intent, codeVerifier, gameState);

    // Формируем URL авторизации
    const authUrl = client.buildAuthUrl(state, codeChallenge);

    console.log(`[OAuthService] Starting OAuth: provider=${provider}, intent=${intent}`);

    // Редиректим на провайдера
    // Для мобильных устройств — полный редирект
    // Для десктопа можно использовать popup (P2)
    window.location.href = authUrl;
  }

  /**
   * Проверка, находимся ли мы на callback URL
   */
  isCallback(): boolean {
    return isOAuthCallback();
  }

  /**
   * Сброс конфигурации (для тестирования)
   */
  reset(): void {
    this.config = null;
    this.configLoaded = false;
    this.clients.clear();
  }
}

// Singleton
export const oauthService = new OAuthService();
