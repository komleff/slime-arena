/**
 * Провайдер рекламы для Telegram Mini Apps.
 * Использует Telegram Ads API через WebApp.
 */

import type { PlatformType } from './IAuthAdapter';
import type { IAdsProvider, AdPlacement, AdResult } from './IAdsProvider';

const AD_TIMEOUT_MS = 30000;

// Тип для Telegram WebApp с методом showAd
interface TelegramWebAppWithAds {
  showAd?: (params: { onReward: () => void; onError: (error: string) => void }) => void;
}

export class TelegramAdsProvider implements IAdsProvider {
  private webApp: TelegramWebAppWithAds | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      this.webApp = window.Telegram.WebApp as TelegramWebAppWithAds;
    }
  }

  getPlatformType(): PlatformType {
    return 'telegram';
  }

  isAvailable(): boolean {
    // Telegram Ads доступен только внутри WebApp и если метод showAd существует
    return !!(this.webApp && typeof this.webApp.showAd === 'function');
  }

  async isAdReady(_placement: AdPlacement): Promise<boolean> {
    // Telegram не имеет preload API, всегда считаем готовым если доступен
    return this.isAvailable();
  }

  showRewardedAd(placement: AdPlacement): Promise<AdResult> {
    return new Promise((resolve) => {
      if (!this.webApp || !this.isAvailable()) {
        resolve({ status: 'not_available', errorMessage: 'Telegram Ads недоступен' });
        return;
      }

      console.log(`[TelegramAdsProvider] Показ рекламы: ${placement}`);

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('[TelegramAdsProvider] Таймаут показа рекламы');
          resolve({ status: 'error', errorMessage: 'Таймаут показа рекламы' });
        }
      }, AD_TIMEOUT_MS);

      this.webApp.showAd!({
        onReward: () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          console.log('[TelegramAdsProvider] Реклама успешно просмотрена');
          resolve({ status: 'completed' });
        },
        onError: (error: string) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          console.warn(`[TelegramAdsProvider] Ошибка: ${error}`);
          if (error === 'AD_CLOSED') {
            resolve({ status: 'skipped' });
          } else {
            resolve({ status: 'error', errorMessage: error });
          }
        },
      });
    });
  }
}
