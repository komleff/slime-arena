/**
 * Провайдер рекламы для CrazyGames.
 * Использует CrazyGames SDK.
 */

import type { PlatformType } from './IAuthAdapter';
import type { IAdsProvider, AdPlacement, AdResult } from './IAdsProvider';
import type { CrazyGamesSDK } from './CrazyGamesAdapter';

const AD_TIMEOUT_MS = 30000;

export class CrazyGamesAdsProvider implements IAdsProvider {
  private sdk: CrazyGamesSDK | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.CrazyGames?.SDK) {
      this.sdk = window.CrazyGames.SDK;
    }
  }

  getPlatformType(): PlatformType {
    return 'crazygames';
  }

  isAvailable(): boolean {
    return !!(this.sdk && typeof this.sdk.ad?.requestAd === 'function');
  }

  async isAdReady(_placement: AdPlacement): Promise<boolean> {
    // CrazyGames SDK не предоставляет API предварительной загрузки
    return this.isAvailable();
  }

  showRewardedAd(placement: AdPlacement): Promise<AdResult> {
    return new Promise((resolve) => {
      if (!this.sdk || !this.isAvailable()) {
        resolve({ status: 'not_available', errorMessage: 'CrazyGames SDK недоступен' });
        return;
      }

      console.log(`[CrazyGamesAdsProvider] Показ рекламы: ${placement}`);

      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('[CrazyGamesAdsProvider] Таймаут показа рекламы');
          resolve({ status: 'error', errorMessage: 'Таймаут показа рекламы' });
        }
      }, AD_TIMEOUT_MS);

      this.sdk.ad.requestAd('rewarded', {
        adStarted: () => {
          console.log('[CrazyGamesAdsProvider] Реклама началась (игра приостановлена)');
          // Игра должна быть приостановлена — это обрабатывается на уровне вызывающего кода
        },
        adFinished: () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          console.log('[CrazyGamesAdsProvider] Реклама успешно просмотрена');
          resolve({ status: 'completed' });
        },
        adError: (error: string) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          console.warn(`[CrazyGamesAdsProvider] Ошибка: ${error}`);
          // CrazyGames рекомендует продолжать игру даже при ошибке
          resolve({ status: 'error', errorMessage: error });
        },
      });
    });
  }
}
