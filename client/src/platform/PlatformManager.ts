/**
 * Менеджер платформ.
 * Определяет текущую платформу и предоставляет соответствующие адаптеры.
 */

import type { IAuthAdapter, PlatformType } from './IAuthAdapter';
import type { IAdsProvider } from './IAdsProvider';
import { TelegramAdapter } from './TelegramAdapter';
import { YandexAdapter } from './YandexAdapter';
import { CrazyGamesAdapter } from './CrazyGamesAdapter';
import { GameDistributionAdapter } from './GameDistributionAdapter';
import { PokiAdapter } from './PokiAdapter';
import { StandaloneAdapter } from './StandaloneAdapter';
import { MockAdsProvider } from './MockAdsProvider';
import { TelegramAdsProvider } from './TelegramAdsProvider';
import { YandexAdsProvider } from './YandexAdsProvider';
import { CrazyGamesAdsProvider } from './CrazyGamesAdsProvider';
import { GameDistributionAdsProvider } from './GameDistributionAdsProvider';
import { PokiAdsProvider } from './PokiAdsProvider';

class PlatformManager {
  private adapter: IAuthAdapter | null = null;
  private adsProvider: IAdsProvider | null = null;
  private detectedPlatform: PlatformType | null = null;

  /**
   * Инициализация: определение платформы и создание адаптеров.
   * Вызывать при старте приложения.
   *
   * Приоритет определения: Telegram → CrazyGames → GameDistribution → Yandex → Poki → Standalone
   */
  initialize(): IAuthAdapter {
    // 1. Telegram Mini App
    const telegramAdapter = new TelegramAdapter();
    if (telegramAdapter.isAvailable()) {
      this.adapter = telegramAdapter;
      this.detectedPlatform = 'telegram';
      console.log('[PlatformManager] Detected platform: Telegram Mini App');
      this.initializeAdsProvider();
      return this.adapter;
    }

    // 2. CrazyGames
    const crazyGamesAdapter = new CrazyGamesAdapter();
    if (crazyGamesAdapter.isAvailable()) {
      this.adapter = crazyGamesAdapter;
      this.detectedPlatform = 'crazygames';
      console.log('[PlatformManager] Detected platform: CrazyGames');
      this.initializeAdsProvider();
      return this.adapter;
    }

    // 3. GameDistribution
    const gameDistributionAdapter = new GameDistributionAdapter();
    if (gameDistributionAdapter.isAvailable()) {
      this.adapter = gameDistributionAdapter;
      this.detectedPlatform = 'gamedistribution';
      console.log('[PlatformManager] Detected platform: GameDistribution');
      this.initializeAdsProvider();
      return this.adapter;
    }

    // 4. Yandex Games
    const yandexAdapter = new YandexAdapter();
    if (yandexAdapter.isAvailable()) {
      this.adapter = yandexAdapter;
      this.detectedPlatform = 'yandex';
      console.log('[PlatformManager] Detected platform: Yandex Games');
      this.initializeAdsProvider();
      return this.adapter;
    }

    // 5. Poki
    const pokiAdapter = new PokiAdapter();
    if (pokiAdapter.isAvailable()) {
      this.adapter = pokiAdapter;
      this.detectedPlatform = 'poki';
      console.log('[PlatformManager] Detected platform: Poki');
      this.initializeAdsProvider();
      return this.adapter;
    }

    // 6. Fallback: Standalone (dev mode)
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
      case 'crazygames': {
        const crazyGamesAds = new CrazyGamesAdsProvider();
        if (crazyGamesAds.isAvailable()) {
          this.adsProvider = crazyGamesAds;
          console.log('[PlatformManager] Ads provider: CrazyGames');
        } else {
          console.log('[PlatformManager] CrazyGames Ads SDK not available');
        }
        return;
      }
      case 'gamedistribution': {
        const gameDistributionAds = new GameDistributionAdsProvider();
        if (gameDistributionAds.isAvailable()) {
          this.adsProvider = gameDistributionAds;
          console.log('[PlatformManager] Ads provider: GameDistribution');
        } else {
          console.log('[PlatformManager] GameDistribution Ads SDK not available');
        }
        return;
      }
      case 'yandex': {
        const yandexAds = new YandexAdsProvider();
        if (yandexAds.isAvailable()) {
          this.adsProvider = yandexAds;
          console.log('[PlatformManager] Ads provider: Yandex');
        } else {
          console.log('[PlatformManager] Yandex Ads SDK not available');
        }
        return;
      }
      case 'poki': {
        const pokiAds = new PokiAdsProvider();
        if (pokiAds.isAvailable()) {
          this.adsProvider = pokiAds;
          console.log('[PlatformManager] Ads provider: Poki');
        } else {
          console.log('[PlatformManager] Poki Ads SDK not available');
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
    // После initialize() всегда установлен fallback 'dev'
    return this.detectedPlatform ?? 'dev';
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
   * Проверить, является ли текущая платформа Yandex Games.
   */
  isYandex(): boolean {
    return this.getPlatformType() === 'yandex';
  }

  /**
   * Проверить, является ли текущая платформа Poki.
   */
  isPoki(): boolean {
    return this.getPlatformType() === 'poki';
  }

  /**
   * Проверить, является ли текущая платформа CrazyGames.
   */
  isCrazyGames(): boolean {
    return this.getPlatformType() === 'crazygames';
  }

  /**
   * Проверить, является ли текущая платформа GameDistribution.
   */
  isGameDistribution(): boolean {
    return this.getPlatformType() === 'gamedistribution';
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

  /**
   * Получить Yandex-специфичный адаптер (для getPlayerId и т.д.).
   */
  getYandexAdapter(): YandexAdapter | null {
    if (this.isYandex() && this.adapter instanceof YandexAdapter) {
      return this.adapter;
    }
    return null;
  }

  /**
   * Получить Poki-специфичный адаптер (для happyTime и т.д.).
   */
  getPokiAdapter(): PokiAdapter | null {
    if (this.isPoki() && this.adapter instanceof PokiAdapter) {
      return this.adapter;
    }
    return null;
  }

  /**
   * Получить CrazyGames-специфичный адаптер (для gameplayStart/Stop, happyTime и т.д.).
   */
  getCrazyGamesAdapter(): CrazyGamesAdapter | null {
    if (this.isCrazyGames() && this.adapter instanceof CrazyGamesAdapter) {
      return this.adapter;
    }
    return null;
  }

  /**
   * Получить GameDistribution-специфичный адаптер (для setNickname и т.д.).
   */
  getGameDistributionAdapter(): GameDistributionAdapter | null {
    if (this.isGameDistribution() && this.adapter instanceof GameDistributionAdapter) {
      return this.adapter;
    }
    return null;
  }
}

// Экземпляр-синглтон
export const platformManager = new PlatformManager();
