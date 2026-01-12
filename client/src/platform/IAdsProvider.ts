/**
 * Интерфейс провайдера рекламы.
 * Абстрагирует показ rewarded video (рекламы с вознаграждением) для разных платформ.
 */

import type { PlatformType } from './IAuthAdapter';

/**
 * Статус результата показа рекламы.
 */
export type AdResultStatus = 'completed' | 'skipped' | 'error' | 'not_available';

/**
 * Результат показа рекламы.
 */
export interface AdResult {
  /** Статус показа */
  status: AdResultStatus;
  /** Сообщение об ошибке (если status === 'error') */
  errorMessage?: string;
  /** Платформенные данные для верификации (если требуется) */
  providerPayload?: Record<string, unknown>;
}

/**
 * Точка размещения рекламы.
 * Соответствует ключам в RuntimeConfig.ads.rewards
 */
export type AdPlacement = 'match_end' | 'daily_bonus' | 'double_reward' | 'extra_life';

/**
 * Интерфейс провайдера рекламы.
 */
export interface IAdsProvider {
  /**
   * Тип платформы.
   */
  getPlatformType(): PlatformType;

  /**
   * Доступна ли реклама на текущей платформе.
   * Синхронная проверка (SDK загружен).
   */
  isAvailable(): boolean;

  /**
   * Готова ли реклама к показу.
   * Асинхронная проверка (preload завершен).
   */
  isAdReady(placement: AdPlacement): Promise<boolean>;

  /**
   * Показать rewarded video (рекламу с вознаграждением).
   * @param placement - Идентификатор точки показа
   * @returns Результат показа
   */
  showRewardedAd(placement: AdPlacement): Promise<AdResult>;
}
