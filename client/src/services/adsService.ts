/**
 * Сервис рекламы.
 * Оркестрирует полный цикл показа: grant → show → claim.
 */

import { metaServerClient } from '../api/metaServerClient';
import { platformManager } from '../platform';
import { configService } from './configService';
import type { AdPlacement } from '../platform/IAdsProvider';

/**
 * Ответ сервера на /ads/grant
 */
interface GrantResponse {
  grantId: string;
  message: string;
}

/**
 * Ответ сервера на /ads/claim
 */
interface ClaimResponse {
  success: boolean;
  rewardType: 'soft_currency' | 'hard_currency' | 'item';
  rewardAmount?: number;
  rewardItemId?: string;
  message: string;
}

/**
 * Результат полного цикла показа рекламы.
 */
export interface AdsShowResult {
  success: boolean;
  reward?: {
    type: string;
    amount?: number;
    itemId?: string;
  };
  error?: string;
}

/**
 * Состояния показа рекламы.
 * После завершения (успех или ошибка) сразу возвращается в 'idle'.
 */
export type AdsFlowState =
  | 'idle'
  | 'requesting_grant'
  | 'showing_ad'
  | 'claiming_reward';

class AdsService {
  private currentState: AdsFlowState = 'idle';
  private _currentGrantId: string | null = null;

  /**
   * Проверить, включена ли реклама с наградой в конфиге.
   */
  isEnabled(): boolean {
    return configService.isAdsRewardEnabled();
  }

  /**
   * Получить текущий grantId (для отладки).
   */
  getCurrentGrantId(): string | null {
    return this._currentGrantId;
  }

  /**
   * Проверить, доступна ли реклама на текущей платформе.
   */
  isAvailable(): boolean {
    if (!this.isEnabled()) return false;
    return platformManager.isAdsAvailable();
  }

  /**
   * Проверить, готова ли реклама к показу.
   */
  async isReady(placement: AdPlacement): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const provider = platformManager.getAdsProvider();
    if (!provider) return false;
    return provider.isAdReady(placement);
  }

  /**
   * Получить текущее состояние.
   */
  getState(): AdsFlowState {
    return this.currentState;
  }

  /**
   * Показать рекламу и получить награду.
   * Полный цикл: grant → show → claim
   */
  async showAndClaim(placement: AdPlacement): Promise<AdsShowResult> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Реклама недоступна' };
    }

    if (this.currentState !== 'idle') {
      return { success: false, error: 'Показ рекламы уже в процессе' };
    }

    const provider = platformManager.getAdsProvider();
    if (!provider) {
      return { success: false, error: 'Провайдер рекламы не найден' };
    }

    try {
      // Шаг 1: Запрос grantId с сервера
      this.currentState = 'requesting_grant';
      const grantId = await this.requestGrant(placement);
      this._currentGrantId = grantId;

      // Шаг 2: Показ рекламы через провайдер
      this.currentState = 'showing_ad';
      const adResult = await provider.showRewardedAd(placement);

      // Проверяем результат показа
      if (adResult.status !== 'completed') {
        this.currentState = 'idle';
        this._currentGrantId = null;

        switch (adResult.status) {
          case 'skipped':
            return { success: false, error: 'Реклама пропущена' };
          case 'not_available':
            return { success: false, error: 'Реклама временно недоступна' };
          case 'error':
            return { success: false, error: adResult.errorMessage || 'Ошибка показа рекламы' };
        }
      }

      // Шаг 3: Claim награды на сервере
      // providerPayload зарезервирован для будущих интеграций (подпись провайдера, ID показа)
      this.currentState = 'claiming_reward';
      const reward = await this.claimReward(grantId, adResult.providerPayload);

      this.currentState = 'idle';
      this._currentGrantId = null;

      return {
        success: true,
        reward: {
          type: reward.rewardType,
          amount: reward.rewardAmount,
          itemId: reward.rewardItemId,
        },
      };
    } catch (error) {
      this.currentState = 'idle';
      this._currentGrantId = null;

      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      console.error('[AdsService] Ошибка:', message);

      return { success: false, error: message };
    }
  }

  /**
   * Запросить grantId с сервера.
   */
  private async requestGrant(placement: AdPlacement): Promise<string> {
    const response = await metaServerClient.post<GrantResponse>('/api/v1/ads/grant', {
      adPlacement: placement,
    });

    if (!response.grantId) {
      throw new Error('Сервер не вернул grantId');
    }

    console.log(`[AdsService] Получен grant: ${response.grantId}`);
    return response.grantId;
  }

  /**
   * Получить награду с сервера.
   */
  private async claimReward(
    grantId: string,
    providerPayload?: Record<string, unknown>
  ): Promise<ClaimResponse> {
    const response = await metaServerClient.postIdempotent<ClaimResponse>('/api/v1/ads/claim', {
      grantId,
      providerPayload,
    });

    if (!response.success) {
      throw new Error(response.message || 'Не удалось получить награду');
    }

    console.log(
      `[AdsService] Награда получена: ${response.rewardType} x${response.rewardAmount || 1}`
    );
    return response;
  }

  /**
   * Сбросить состояние (принудительно).
   */
  reset(): void {
    this.currentState = 'idle';
    this._currentGrantId = null;
  }
}

// Экземпляр-синглтон
export const adsService = new AdsService();
