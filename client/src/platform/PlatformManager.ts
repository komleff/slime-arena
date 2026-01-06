/**
 * Менеджер платформ.
 * Определяет текущую платформу и предоставляет соответствующий адаптер.
 */

import type { IAuthAdapter, PlatformType } from './IAuthAdapter';
import { TelegramAdapter } from './TelegramAdapter';
import { StandaloneAdapter } from './StandaloneAdapter';

class PlatformManager {
  private adapter: IAuthAdapter | null = null;
  private detectedPlatform: PlatformType | null = null;

  /**
   * Инициализация: определение платформы и создание адаптера.
   * Вызывать при старте приложения.
   */
  initialize(): IAuthAdapter {
    // Приоритет определения платформы
    const telegramAdapter = new TelegramAdapter();
    if (telegramAdapter.isAvailable()) {
      this.adapter = telegramAdapter;
      this.detectedPlatform = 'telegram';
      console.log('[PlatformManager] Detected platform: Telegram Mini App');
      return this.adapter;
    }

    // TODO: Добавить YandexAdapter и PokiAdapter при необходимости

    // Fallback: Standalone (dev mode)
    this.adapter = new StandaloneAdapter();
    this.detectedPlatform = 'dev';
    console.log('[PlatformManager] Detected platform: Standalone (dev mode)');
    return this.adapter;
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
