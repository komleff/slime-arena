/**
 * Провайдер рекламы для Yandex Games.
 * Использует Yandex Games SDK.
 */

import type { PlatformType } from './IAuthAdapter';
import type { IAdsProvider, AdPlacement, AdResult } from './IAdsProvider';

// Типы Yandex Games SDK
declare global {
  interface YaGamesSDK {
    adv: {
      showRewardedVideo: (options: {
        callbacks: {
          onOpen?: () => void;
          onRewarded?: () => void;
          onClose?: (wasShown: boolean) => void;
          onError?: (error: Error) => void;
        };
      }) => void;
    };
  }
  interface Window {
    ysdk?: YaGamesSDK;
  }
}

export class YandexAdsProvider implements IAdsProvider {
  private ysdk: YaGamesSDK | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.ysdk) {
      this.ysdk = window.ysdk;
    }
  }

  getPlatformType(): PlatformType {
    return 'yandex';
  }

  isAvailable(): boolean {
    return !!(this.ysdk && this.ysdk.adv);
  }

  async isAdReady(_placement: AdPlacement): Promise<boolean> {
    // Yandex SDK не предоставляет preload API (API предварительной загрузки)
    return this.isAvailable();
  }

  showRewardedAd(placement: AdPlacement): Promise<AdResult> {
    return new Promise((resolve) => {
      if (!this.ysdk || !this.isAvailable()) {
        resolve({ status: 'not_available', errorMessage: 'Yandex SDK недоступен' });
        return;
      }

      console.log(`[YandexAdsProvider] Показ рекламы для placement: ${placement}`);
      let rewarded = false;

      this.ysdk.adv.showRewardedVideo({
        callbacks: {
          onRewarded: () => {
            rewarded = true;
            console.log('[YandexAdsProvider] Награда получена');
          },
          onClose: (wasShown: boolean) => {
            if (rewarded) {
              resolve({ status: 'completed' });
            } else if (wasShown) {
              resolve({ status: 'skipped' });
            } else {
              resolve({ status: 'not_available' });
            }
          },
          onError: (error: Error) => {
            console.warn(`[YandexAdsProvider] Ошибка: ${error.message}`);
            resolve({ status: 'error', errorMessage: error.message });
          },
        },
      });
    });
  }
}
