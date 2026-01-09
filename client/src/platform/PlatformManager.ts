/**
 * Менеджер платформ.
 * Определяет текущую платформу и предоставляет соответствующие адаптеры.
 */

import type { IAuthAdapter, PlatformType } from './IAuthAdapter';
import type { IAdsProvider } from './IAdsProvider';
import { TelegramAdapter } from './TelegramAdapter';
import { StandaloneAdapter } from './StandaloneAdapter';
import { MockAdsProvider } from './MockAdsProvider';
import { TelegramAdsProvider } from './TelegramAdsProvider';
// YandexAdsProvider и PokiAdsProvider будут добавлены когда появятся соответствующие auth adapters

class PlatformManager {
  private adapter: IAuthAdapter | null = null;
  private adsProvider: IAdsProvider | null = null;
  private detectedPlatform: PlatformType | null = null;

  /**
   * Инициализация: определение платформы и создание адаптеров.
   * Вызывать при старте приложения.
   */
  initialize(): IAuthAdapter {
    // Приоритет определения платформы
    const telegramAdapter = new TelegramAdapter();
    if (telegramAdapter.isAvailable()) {
      this.adapter = telegramAdapter;
      this.detectedPlatform = 'telegram';
      console.log('[PlatformManager] Detected platform: Telegram Mini App');
      this.initializeAdsProvider();
      return this.adapter;
    }

    // TODO: Добавить YandexAdapter и PokiAdapter при необходимости

    // Fallback: Standalone (dev mode)
    this.adapter = new StandaloneAdapter();
    this.detectedPlatform = 'dev';
    console.log('[PlatformManager] Detected platform: Standalone (dev mode)');
    this.initializeAdsProvider();
    return this.adapter;
  }

  /**
   * Инициализация провайдера рекламы.
   * MockAdsProvider используется ТОЛЬКО для dev-платформы.
   * Для остальных платформ — null если SDK недоступен.
   */
  private initializeAdsProvider(): void {
    switch (this.detectedPlatform) {
      case 'telegram': {
        const telegramAds = new TelegramAdsProvider();
        if (telegramAds.isAvailable()) {
          this.adsProvider = telegramAds;
          console.log('[PlatformManager] Ads provider: Telegram');
        } else {
          console.log('[PlatformManager] Telegram Ads SDK not available');
        }
        return;
      }
      case 'dev': {
        this.adsProvider = new MockAdsProvider();
        console.log('[PlatformManager] Ads provider: Mock (dev)');
        return;
      }
      default: {
        console.log('[PlatformManager] No ads provider for platform:', this.detectedPlatform);
      }
    }
  }

  /**
   * Получить текущий адаптер.
   */
  getAdapter(): IAuthAdapter {
    if (!this.adapter) {
      return this.initialize();
    }
    return this.adapter;
  }

  /**
   * Получить провайдер рекламы.
   */
  getAdsProvider(): IAdsProvider | null {
    if (!this.adapter) {
      this.initialize();
    }
    return this.adsProvider;
  }

  /**
   * Проверить, доступна ли реклама.
   */
  isAdsAvailable(): boolean {
    return this.adsProvider?.isAvailable() ?? false;
  }

  /**
   * Получить тип текущей платформы.
   */
  getPlatformType(): PlatformType {
    if (!this.detectedPlatform) {
      this.initialize();
    }
    return this.detectedPlatform!;
  }

  /**
   * Проверить, является ли текущая платформа Telegram.
   */
  isTelegram(): boolean {
    return this.getPlatformType() === 'telegram';
  }

  /**
   * Проверить, является ли текущая платформа Standalone (dev mode).
   */
  isStandalone(): boolean {
    return this.getPlatformType() === 'dev';
  }

  /**
   * Получить Telegram-специфичный адаптер (для доступа к BackButton и т.д.).
   */
  getTelegramAdapter(): TelegramAdapter | null {
    if (this.isTelegram() && this.adapter instanceof TelegramAdapter) {
      return this.adapter;
    }
    return null;
  }

  /**
   * Получить Standalone-специфичный адаптер (для setNickname и т.д.).
   */
  getStandaloneAdapter(): StandaloneAdapter | null {
    if (this.isStandalone() && this.adapter instanceof StandaloneAdapter) {
      return this.adapter;
    }
    return null;
  }
}

// Экземпляр-синглтон
export const platformManager = new PlatformManager();
