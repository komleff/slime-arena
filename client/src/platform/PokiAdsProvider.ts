/**
 * Провайдер рекламы для Poki.
 * Использует Poki SDK.
 */

import type { PlatformType } from './IAuthAdapter';
import type { IAdsProvider, AdPlacement, AdResult } from './IAdsProvider';

const AD_TIMEOUT_MS = 30000;

// Типы Poki SDK
declare global {
  interface Window {
    PokiSDK?: {
      rewardedBreak: () => Promise<boolean>;
      isAdBlocked: () => Promise<boolean>;
    };
  }
}

export class PokiAdsProvider implements IAdsProvider {
  private pokiSdk: typeof window.PokiSDK | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.PokiSDK) {
      this.pokiSdk = window.PokiSDK;
    }
  }

  getPlatformType(): PlatformType {
    return 'poki';
  }

  isAvailable(): boolean {
    return !!(this.pokiSdk && typeof this.pokiSdk.rewardedBreak === 'function');
  }

  async isAdReady(_placement: AdPlacement): Promise<boolean> {
    if (!this.pokiSdk) return false;
    try {
      // Poki предоставляет проверку блокировщика рекламы
      const isBlocked = await this.pokiSdk.isAdBlocked();
      return !isBlocked;
    } catch {
      return false;
    }
  }

  async showRewardedAd(placement: AdPlacement): Promise<AdResult> {
    if (!this.pokiSdk || !this.isAvailable()) {
      return { status: 'not_available', errorMessage: 'Poki SDK недоступен' };
    }

    console.log(`[PokiAdsProvider] Показ рекламы: ${placement}`);

    const timeoutPromise = new Promise<AdResult>((resolve) => {
      setTimeout(() => {
        console.warn('[PokiAdsProvider] Таймаут показа рекламы');
        resolve({ status: 'error', errorMessage: 'Таймаут показа рекламы' });
      }, AD_TIMEOUT_MS);
    });

    const adPromise = (async (): Promise<AdResult> => {
      try {
        const success = await this.pokiSdk!.rewardedBreak();
        if (success) {
          console.log('[PokiAdsProvider] Реклама успешно просмотрена');
          return { status: 'completed' };
        } else {
          console.log('[PokiAdsProvider] Реклама пропущена');
          return { status: 'skipped' };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
        console.warn(`[PokiAdsProvider] Ошибка: ${message}`);
        return { status: 'error', errorMessage: message };
      }
    })();

    return Promise.race([adPromise, timeoutPromise]);
  }
}
