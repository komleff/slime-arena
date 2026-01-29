/**
 * Провайдер рекламы для Poki.
 * Использует Poki SDK.
 */

import type { PlatformType } from './IAuthAdapter';
import type { IAdsProvider, AdPlacement, AdResult } from './IAdsProvider';
// Типы PokiSDK определены в PokiAdapter.ts

const AD_TIMEOUT_MS = 30000;

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

    // P2 fix: используем флаг resolved для предотвращения race condition
    let resolved = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<AdResult>((resolve) => {
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('[PokiAdsProvider] Таймаут показа рекламы');
          resolve({ status: 'error', errorMessage: 'Таймаут показа рекламы' });
        }
      }, AD_TIMEOUT_MS);
    });

    const adPromise = (async (): Promise<AdResult> => {
      try {
        const success = await this.pokiSdk!.rewardedBreak();
        if (resolved) return { status: 'error', errorMessage: 'Таймаут' }; // Уже отвечено
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);

        if (success) {
          console.log('[PokiAdsProvider] Реклама успешно просмотрена');
          return { status: 'completed' };
        } else {
          console.log('[PokiAdsProvider] Реклама пропущена');
          return { status: 'skipped' };
        }
      } catch (error) {
        if (resolved) return { status: 'error', errorMessage: 'Таймаут' };
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);

        const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
        console.warn(`[PokiAdsProvider] Ошибка: ${message}`);
        return { status: 'error', errorMessage: message };
      }
    })();

    return Promise.race([adPromise, timeoutPromise]);
  }
}
