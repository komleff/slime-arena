/**
 * OAuth Provider Factory — фабрика OAuth провайдеров с региональной фильтрацией
 *
 * Возвращает список доступных OAuth провайдеров для указанного региона.
 * Google недоступен для RU и UNKNOWN регионов.
 *
 * @see docs/meta-min/TZ-StandaloneAdapter-OAuth-v1.9.md раздел 1, 2
 */

import { OAuthRegion } from '../services/GeoIPService';
import { getGoogleOAuthProvider, GoogleOAuthProvider } from './GoogleOAuthProvider';
import { getYandexOAuthProvider, YandexOAuthProvider } from './YandexOAuthProvider';

export type OAuthProviderName = 'google' | 'yandex' | 'vk';

export interface OAuthProviderConfig {
  name: OAuthProviderName;
  clientId: string;
  priority: number;
  requiresPKCE: boolean;
}

export interface IOAuthProvider {
  exchangeCode(code: string, redirectUri?: string, codeVerifier?: string): Promise<OAuthUserInfo>;
}

export interface OAuthUserInfo {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}

// Матрица доступности провайдеров по регионам
// true = разрешён, false = запрещён
const PROVIDER_AVAILABILITY: Record<OAuthRegion, Record<OAuthProviderName, boolean>> = {
  RU: {
    google: false, // Запрещён в РФ
    yandex: true,
    vk: true,     // P1, пока не реализован
  },
  CIS: {
    google: true,
    yandex: true,
    vk: true,     // P1
  },
  GLOBAL: {
    google: true,
    yandex: true,
    vk: false,    // Не показывать вне РФ/СНГ
  },
  UNKNOWN: {
    google: false, // Запрещён при неизвестном регионе
    yandex: true,
    vk: false,
  },
};

// Приоритет отображения (меньше = выше)
const PROVIDER_PRIORITY: Record<OAuthProviderName, number> = {
  yandex: 1,
  google: 2,
  vk: 3,
};

export class OAuthProviderFactory {
  // Флаги включения провайдеров
  private readonly googleEnabled: boolean;
  private readonly yandexEnabled: boolean;
  private readonly vkEnabled: boolean;
  private readonly googleEnabledRU: boolean;

  // Client IDs для клиента
  private readonly googleClientId: string | undefined;
  private readonly yandexClientId: string | undefined;
  private readonly vkClientId: string | undefined;

  constructor() {
    // Читаем флаги из ENV
    this.googleEnabled = process.env.OAUTH_GOOGLE_ENABLED !== 'false';
    this.yandexEnabled = process.env.OAUTH_YANDEX_ENABLED !== 'false';
    this.vkEnabled = process.env.OAUTH_VK_ENABLED === 'true'; // По умолчанию выключен (P1)
    this.googleEnabledRU = process.env.OAUTH_GOOGLE_ENABLED_RU === 'true'; // По умолчанию выключен

    // Client IDs
    this.googleClientId = process.env.GOOGLE_CLIENT_ID;
    this.yandexClientId = process.env.YANDEX_CLIENT_ID;
    this.vkClientId = process.env.VK_CLIENT_ID;
  }

  /**
   * Получить список доступных провайдеров для региона
   */
  getProvidersForRegion(region: OAuthRegion): OAuthProviderConfig[] {
    const providers: OAuthProviderConfig[] = [];
    const availability = PROVIDER_AVAILABILITY[region];

    // Google
    // Copilot P2: Добавлена явная проверка clientId перед использованием
    if (this.isGoogleAvailable(region, availability) && this.googleClientId) {
      providers.push({
        name: 'google',
        clientId: this.googleClientId,
        priority: PROVIDER_PRIORITY.google,
        requiresPKCE: false, // Google не требует PKCE, но рекомендует
      });
    }

    // Yandex
    // Copilot P2: Добавлена явная проверка clientId перед использованием
    if (this.isYandexAvailable(availability) && this.yandexClientId) {
      providers.push({
        name: 'yandex',
        clientId: this.yandexClientId,
        priority: PROVIDER_PRIORITY.yandex,
        requiresPKCE: false,
      });
    }

    // VK (P1)
    // Copilot P2: Добавлена явная проверка clientId перед использованием
    if (this.isVKAvailable(availability) && this.vkClientId) {
      providers.push({
        name: 'vk',
        clientId: this.vkClientId,
        priority: PROVIDER_PRIORITY.vk,
        requiresPKCE: true, // VK требует PKCE
      });
    }

    // Сортируем по приоритету
    providers.sort((a, b) => a.priority - b.priority);

    return providers;
  }

  /**
   * Получить OAuth провайдер по имени
   */
  getProvider(name: OAuthProviderName): IOAuthProvider | null {
    switch (name) {
      case 'google':
        if (!this.googleClientId || !process.env.GOOGLE_CLIENT_SECRET) {
          return null;
        }
        return this.wrapGoogleProvider();

      case 'yandex':
        if (!this.yandexClientId || !process.env.YANDEX_CLIENT_SECRET) {
          return null;
        }
        return this.wrapYandexProvider();

      case 'vk':
        // VK пока не реализован (P1)
        return null;

      default:
        return null;
    }
  }

  /**
   * Проверить, доступен ли провайдер для региона
   */
  isProviderAvailable(name: OAuthProviderName, region: OAuthRegion): boolean {
    const availability = PROVIDER_AVAILABILITY[region];

    switch (name) {
      case 'google':
        return this.isGoogleAvailable(region, availability);
      case 'yandex':
        return this.isYandexAvailable(availability);
      case 'vk':
        return this.isVKAvailable(availability);
      default:
        return false;
    }
  }

  private isGoogleAvailable(region: OAuthRegion, availability: Record<OAuthProviderName, boolean>): boolean {
    // Глобальный флаг
    if (!this.googleEnabled) return false;
    // Client ID должен быть настроен
    if (!this.googleClientId) return false;
    // Региональная матрица
    if (!availability.google) return false;
    // Особый флаг для РФ
    if (region === 'RU' && !this.googleEnabledRU) return false;

    return true;
  }

  private isYandexAvailable(availability: Record<OAuthProviderName, boolean>): boolean {
    if (!this.yandexEnabled) return false;
    if (!this.yandexClientId) return false;
    if (!availability.yandex) return false;

    return true;
  }

  private isVKAvailable(availability: Record<OAuthProviderName, boolean>): boolean {
    if (!this.vkEnabled) return false;
    if (!this.vkClientId) return false;
    if (!availability.vk) return false;

    return true;
  }

  /**
   * Обёртка для Google провайдера с унифицированным интерфейсом
   */
  private wrapGoogleProvider(): IOAuthProvider {
    const provider = getGoogleOAuthProvider();
    return {
      async exchangeCode(code: string): Promise<OAuthUserInfo> {
        const userInfo = await provider.exchangeCode(code);
        return {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          avatarUrl: userInfo.picture,
        };
      },
    };
  }

  /**
   * Обёртка для Yandex провайдера с унифицированным интерфейсом
   */
  private wrapYandexProvider(): IOAuthProvider {
    const provider = getYandexOAuthProvider();
    return {
      async exchangeCode(code: string): Promise<OAuthUserInfo> {
        const userInfo = await provider.exchangeCode(code);
        return {
          id: userInfo.id,
          email: undefined, // Yandex может не отдавать email
          name: userInfo.display_name || userInfo.login,
          avatarUrl: YandexOAuthProvider.getAvatarUrl(userInfo.default_avatar_id),
        };
      },
    };
  }
}

// Lazy singleton
let instance: OAuthProviderFactory | null = null;

export function getOAuthProviderFactory(): OAuthProviderFactory {
  if (!instance) {
    instance = new OAuthProviderFactory();
  }
  return instance;
}
