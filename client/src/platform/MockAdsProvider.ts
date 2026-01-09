/**
 * Заглушка провайдера рекламы для dev-режима.
 * Симулирует показ рекламы с настраиваемой задержкой.
 */

import type { PlatformType } from './IAuthAdapter';
import type { IAdsProvider, AdPlacement, AdResult } from './IAdsProvider';

export class MockAdsProvider implements IAdsProvider {
  private simulateSuccess = true;
  private simulateDelay = 1500; // мс

  getPlatformType(): PlatformType {
    return 'dev';
  }

  isAvailable(): boolean {
    return true;
  }

  async isAdReady(_placement: AdPlacement): Promise<boolean> {
    return true;
  }

  async showRewardedAd(placement: AdPlacement): Promise<AdResult> {
    console.log(`[MockAdsProvider] Показ рекламы для placement: ${placement}`);

    // Симулируем задержку показа
    await new Promise((resolve) => setTimeout(resolve, this.simulateDelay));

    if (this.simulateSuccess) {
      console.log('[MockAdsProvider] Реклама успешно просмотрена');
      return { status: 'completed' };
    }

    console.log('[MockAdsProvider] Реклама пропущена');
    return { status: 'skipped' };
  }

  // Методы для тестирования
  setSimulateSuccess(value: boolean): void {
    this.simulateSuccess = value;
  }

  setSimulateDelay(ms: number): void {
    this.simulateDelay = ms;
  }
}
