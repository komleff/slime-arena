/**
 * Провайдер рекламы для GameDistribution.
 * Использует GameDistribution SDK.
 */

import type { PlatformType } from './IAuthAdapter';
import type { IAdsProvider, AdPlacement, AdResult } from './IAdsProvider';
// Типы gdsdk определены в GameDistributionAdapter.ts

const AD_TIMEOUT_MS = 30000;

/**
 * Состояние показа рекламы.
 */
interface AdState {
  resolve: ((result: AdResult) => void) | null;
  isShowing: boolean;
}

export class GameDistributionAdsProvider implements IAdsProvider {
  private gdsdk: typeof window.gdsdk | null = null;
  private adState: AdState = { resolve: null, isShowing: false };
  private gamePauseCallback: (() => void) | null = null;
  private gameResumeCallback: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.gdsdk) {
      this.gdsdk = window.gdsdk;
    }
    this.setupEventHandlers();
  }

  /**
   * Настроить обработчики событий SDK.
   */
  private setupEventHandlers(): void {
    if (typeof window === 'undefined') return;

    // Если GD_OPTIONS уже существует, расширяем его
    const existingOnEvent = window.GD_OPTIONS?.onEvent;

    // Создаём или обновляем GD_OPTIONS
    if (!window.GD_OPTIONS) {
      window.GD_OPTIONS = {
        gameId: '', // Должен быть установлен разработчиком
        onEvent: (event) => this.handleSdkEvent(event),
      };
    } else {
      const originalOnEvent = existingOnEvent;
      window.GD_OPTIONS.onEvent = (event) => {
        // Вызываем оригинальный обработчик, если он был
        if (originalOnEvent) {
          originalOnEvent(event);
        }
        this.handleSdkEvent(event);
      };
    }
  }

  /**
   * Обработчик событий SDK.
   */
  private handleSdkEvent(event: { name: string; message?: string }): void {
    console.log(`[GameDistributionAdsProvider] SDK Event: ${event.name}`, event.message || '');

    switch (event.name) {
      case 'SDK_GAME_PAUSE':
        // Приостановить игру во время показа рекламы
        if (this.gamePauseCallback) {
          this.gamePauseCallback();
        }
        break;

      case 'SDK_GAME_START':
        // Возобновить игру после рекламы
        if (this.gameResumeCallback) {
          this.gameResumeCallback();
        }
        break;

      case 'SDK_REWARDED_WATCH_COMPLETE':
        // Пользователь полностью просмотрел rewarded рекламу
        if (this.adState.resolve && this.adState.isShowing) {
          console.log('[GameDistributionAdsProvider] Реклама успешно просмотрена');
          this.adState.resolve({ status: 'completed' });
          this.resetAdState();
        }
        break;

      case 'SDK_ERROR':
        // Ошибка SDK
        console.error('[GameDistributionAdsProvider] SDK Error:', event.message);
        if (this.adState.resolve && this.adState.isShowing) {
          this.adState.resolve({
            status: 'error',
            errorMessage: event.message || 'Ошибка SDK',
          });
          this.resetAdState();
        }
        break;

      default:
        // Другие события логируем, но не обрабатываем
        break;
    }
  }

  /**
   * Сбросить состояние показа рекламы.
   */
  private resetAdState(): void {
    this.adState = { resolve: null, isShowing: false };
  }

  /**
   * Установить колбэк для приостановки игры.
   */
  setGamePauseCallback(callback: () => void): void {
    this.gamePauseCallback = callback;
  }

  /**
   * Установить колбэк для возобновления игры.
   */
  setGameResumeCallback(callback: () => void): void {
    this.gameResumeCallback = callback;
  }

  getPlatformType(): PlatformType {
    return 'gamedistribution';
  }

  isAvailable(): boolean {
    return !!(this.gdsdk && typeof this.gdsdk.showAd === 'function');
  }

  async isAdReady(_placement: AdPlacement): Promise<boolean> {
    // GameDistribution не предоставляет метод проверки готовности рекламы
    // Предполагаем, что реклама доступна если SDK загружен
    return this.isAvailable();
  }

  async showRewardedAd(placement: AdPlacement): Promise<AdResult> {
    if (!this.gdsdk || !this.isAvailable()) {
      return { status: 'not_available', errorMessage: 'GameDistribution SDK недоступен' };
    }

    if (this.adState.isShowing) {
      return { status: 'error', errorMessage: 'Реклама уже показывается' };
    }

    console.log(`[GameDistributionAdsProvider] Показ рекламы: ${placement}`);

    // Предзагрузка (опционально, может не поддерживаться)
    try {
      await this.gdsdk.preloadAd('rewarded');
    } catch {
      // Игнорируем ошибку предзагрузки — некоторые реализации не поддерживают
      console.log('[GameDistributionAdsProvider] preloadAd не поддерживается или недоступен');
    }

    return new Promise<AdResult>((resolve) => {
      this.adState = { resolve, isShowing: true };

      // Таймаут
      const timeoutId = setTimeout(() => {
        if (this.adState.isShowing) {
          console.warn('[GameDistributionAdsProvider] Таймаут показа рекламы');
          resolve({ status: 'error', errorMessage: 'Таймаут показа рекламы' });
          this.resetAdState();
        }
      }, AD_TIMEOUT_MS);

      // Показ рекламы
      this.gdsdk!.showAd('rewarded')
        .then(() => {
          // showAd завершился, но результат приходит через события SDK
          // Ждём SDK_REWARDED_WATCH_COMPLETE или SDK_ERROR
          clearTimeout(timeoutId);
        })
        .catch((error: unknown) => {
          clearTimeout(timeoutId);
          const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
          console.warn(`[GameDistributionAdsProvider] Ошибка: ${message}`);

          if (this.adState.isShowing) {
            resolve({ status: 'error', errorMessage: message });
            this.resetAdState();
          }
        });
    });
  }
}
