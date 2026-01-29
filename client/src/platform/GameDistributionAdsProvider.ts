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
  timeoutId: ReturnType<typeof setTimeout> | null;
  resolved: boolean;
}

export class GameDistributionAdsProvider implements IAdsProvider {
  private adState: AdState = { resolve: null, isShowing: false, timeoutId: null, resolved: false };
  private gamePauseCallback: (() => void) | null = null;
  private gameResumeCallback: (() => void) | null = null;

  constructor() {
    this.setupEventHandlers();
  }

  /**
   * Получить SDK (не кэшируем, т.к. SDK может загрузиться асинхронно после создания провайдера).
   */
  private getSDK(): typeof window.gdsdk | null {
    return typeof window !== 'undefined' ? window.gdsdk ?? null : null;
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
      console.warn('[GameDistributionAdsProvider] GD_OPTIONS.gameId не установлен. SDK может работать некорректно.');
      window.GD_OPTIONS = {
        gameId: '', // P2: Должен быть установлен в конфигурации приложения
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
        if (this.adState.resolve && this.adState.isShowing && !this.adState.resolved) {
          this.adState.resolved = true;
          console.log('[GameDistributionAdsProvider] Реклама успешно просмотрена');
          this.adState.resolve({ status: 'completed' });
          this.resetAdState(); // Метод очищает timeout
        }
        break;

      case 'SDK_ERROR':
        // Ошибка SDK
        console.error('[GameDistributionAdsProvider] SDK Error:', event.message);
        if (this.adState.resolve && this.adState.isShowing && !this.adState.resolved) {
          this.adState.resolved = true;
          this.adState.resolve({
            status: 'error',
            errorMessage: event.message || 'Ошибка SDK',
          });
          this.resetAdState(); // Метод очищает timeout
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
    if (this.adState.timeoutId) {
      clearTimeout(this.adState.timeoutId);
    }
    this.adState = { resolve: null, isShowing: false, timeoutId: null, resolved: false };
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
    const sdk = this.getSDK();
    return !!(sdk && typeof sdk.showAd === 'function');
  }

  async isAdReady(_placement: AdPlacement): Promise<boolean> {
    // GameDistribution не предоставляет метод проверки готовности рекламы
    // Предполагаем, что реклама доступна если SDK загружен
    return this.isAvailable();
  }

  async showRewardedAd(placement: AdPlacement): Promise<AdResult> {
    const sdk = this.getSDK();
    if (!sdk || !this.isAvailable()) {
      return { status: 'not_available', errorMessage: 'GameDistribution SDK недоступен' };
    }

    if (this.adState.isShowing) {
      return { status: 'error', errorMessage: 'Реклама уже показывается' };
    }

    console.log(`[GameDistributionAdsProvider] Показ рекламы: ${placement}`);

    // Предзагрузка (опционально, может не поддерживаться)
    try {
      await sdk.preloadAd('rewarded');
    } catch {
      // Игнорируем ошибку предзагрузки — некоторые реализации не поддерживают
      console.log('[GameDistributionAdsProvider] preloadAd не поддерживается или недоступен');
    }

    return new Promise<AdResult>((resolve) => {
      // Инициализируем состояние ДО создания таймаута, чтобы избежать race condition
      this.adState = { resolve, isShowing: true, timeoutId: null, resolved: false };

      // Таймаут
      const timeoutId = setTimeout(() => {
        if (this.adState.isShowing && !this.adState.resolved) {
          this.adState.resolved = true;
          console.warn('[GameDistributionAdsProvider] Таймаут показа рекламы');
          resolve({ status: 'error', errorMessage: 'Таймаут показа рекламы' });
          this.resetAdState();
        }
      }, AD_TIMEOUT_MS);

      this.adState.timeoutId = timeoutId;

      // Показ рекламы
      sdk.showAd('rewarded')
        .then(() => {
          // showAd завершился, но результат приходит через события SDK
          // Ждём SDK_REWARDED_WATCH_COMPLETE или SDK_ERROR
          // НЕ очищаем таймаут здесь — очистка происходит в handleSdkEvent
        })
        .catch((error: unknown) => {
          if (this.adState.resolved) return;
          this.adState.resolved = true;
          const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
          console.warn(`[GameDistributionAdsProvider] Ошибка: ${message}`);
          resolve({ status: 'error', errorMessage: message });
          this.resetAdState(); // Метод очищает timeout
        });
    });
  }
}
