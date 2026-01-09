/**
 * Провайдер рекламы для Telegram Mini Apps.
 * Использует Telegram Ads API через WebApp.
 */

import type { PlatformType } from './IAuthAdapter';
import type { IAdsProvider, AdPlacement, AdResult } from './IAdsProvider';

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

      console.log(`[TelegramAdsProvider] Показ рекламы для placement: ${placement}`);

      this.webApp.showAd!({
        onReward: () => {
          console.log('[TelegramAdsProvider] Реклама успешно просмотрена');
          resolve({ status: 'completed' });
        },
        onError: (error: string) => {
          console.warn(`[TelegramAdsProvider] Ошибка: ${error}`);
          // Telegram возвращает 'AD_CLOSED' если пользователь закрыл без просмотра
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
