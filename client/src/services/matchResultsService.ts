/**
 * Сервис результатов матча.
 * Работает с claimToken для guest upgrade flow.
 *
 * ВАЖНО: Награды (XP, coins) начисляются сервером автоматически при завершении матча
 * через endpoint /match-results/submit (вызывается MatchServer).
 * Клиент вычисляет награды локально для отображения в UI.
 */

import { metaServerClient } from '../api/metaServerClient';
import { signal } from '@preact/signals';

// ========== Типы ==========

/**
 * Ответ сервера на /claim запрос.
 * Возвращает claimToken для guest upgrade flow.
 */
export interface ClaimTokenResponse {
  claimToken: string;
  expiresAt: string;
}

/**
 * Награды за матч (локальный расчёт).
 */
export interface MatchRewards {
  xpGained: number;
  coinsGained: number;
  ratingChange: number;
}

/**
 * Состояние получения claimToken.
 */
export type ClaimStatus = 'idle' | 'claiming' | 'success' | 'error';

// ========== Конфигурация наград (UI-оценка) ==========
// ВАЖНО: Эти значения — ПРИБЛИЗИТЕЛЬНАЯ оценка для мгновенного отображения в UI.
// Реальные награды начисляются сервером и могут отличаться.
// TODO: Вынести в balance.json для синхронизации с сервером (P2).

const REWARDS_CONFIG = {
  xp: {
    base: 10,
    placement: { '1': 50, '2': 30, '3': 20, top5: 10 },
    perKill: 5,
  },
  coins: {
    base: 5,
    placement: { '1': 25, '2': 15, '3': 10, top5: 5 },
    perKill: 2,
  },
  // Рейтинг: упрощённая UI-оценка, реальный расчёт на сервере
  rating: {
    base: 5,
    perKill: 2,
    placement: { '1': 15, '2': 10, '3': 5, top5: 2 },
  },
} as const;

// ========== Сигналы состояния ==========

export const claimStatus = signal<ClaimStatus>('idle');
export const claimError = signal<string | null>(null);
export const claimRewards = signal<MatchRewards | null>(null);
export const claimToken = signal<string | null>(null);

// ========== Утилиты ==========

/**
 * Вычислить награды локально (для UI).
 * Формулы синхронизированы с server/src/meta/routes/matchResults.ts
 */
export function calculateLocalRewards(
  place: number,
  kills: number,
): MatchRewards {
  const { xp, coins, rating } = REWARDS_CONFIG;

  // XP
  let xpGained = xp.base;
  if (place === 1) xpGained += xp.placement['1'];
  else if (place === 2) xpGained += xp.placement['2'];
  else if (place === 3) xpGained += xp.placement['3'];
  else if (place <= 5) xpGained += xp.placement.top5;
  xpGained += kills * xp.perKill;

  // Coins
  let coinsGained = coins.base;
  if (place === 1) coinsGained += coins.placement['1'];
  else if (place === 2) coinsGained += coins.placement['2'];
  else if (place === 3) coinsGained += coins.placement['3'];
  else if (place <= 5) coinsGained += coins.placement.top5;
  coinsGained += kills * coins.perKill;

  // Rating (упрощённый локальный расчёт)
  let ratingChange = rating.base;
  if (place === 1) ratingChange += rating.placement['1'];
  else if (place === 2) ratingChange += rating.placement['2'];
  else if (place === 3) ratingChange += rating.placement['3'];
  else if (place <= 5) ratingChange += rating.placement.top5;
  ratingChange += kills * rating.perKill;

  return { xpGained, coinsGained, ratingChange };
}

// ========== Сервис ==========

class MatchResultsService {
  private pendingClaims: Set<string> = new Set();

  /**
   * Получить claimToken для матча (используется в guest upgrade flow).
   * Вызывает POST /api/v1/match-results/claim с { matchId }.
   *
   * @param matchId — ID матча
   * @returns claimToken или null при ошибке
   */
  async getClaimToken(matchId: string): Promise<string | null> {
    // Предотвращаем дублирование
    if (this.pendingClaims.has(matchId)) {
      console.log('[MatchResultsService] Claim already pending for match:', matchId);
      return null;
    }

    try {
      claimStatus.value = 'claiming';
      claimError.value = null;
      this.pendingClaims.add(matchId);

      console.log('[MatchResultsService] Getting claim token for match:', matchId);

      const response = await metaServerClient.post<ClaimTokenResponse>(
        '/api/v1/match-results/claim',
        { matchId }
      );

      claimStatus.value = 'success';
      claimToken.value = response.claimToken;
      console.log('[MatchResultsService] Claim token received, expires:', response.expiresAt);
      return response.claimToken;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка получения claim token';
      claimStatus.value = 'error';
      claimError.value = message;
      console.error('[MatchResultsService] Claim error:', message);
      return null;
    } finally {
      this.pendingClaims.delete(matchId);
    }
  }

  /**
   * Установить локально вычисленные награды (для UI).
   */
  setLocalRewards(place: number, kills: number): void {
    const rewards = calculateLocalRewards(place, kills);
    claimRewards.value = rewards;
    claimStatus.value = 'success';
    console.log('[MatchResultsService] Local rewards calculated:', rewards);
  }

  /**
   * Сбросить состояние сервиса (при начале нового матча).
   */
  reset(): void {
    claimStatus.value = 'idle';
    claimError.value = null;
    claimRewards.value = null;
    claimToken.value = null;
  }

  /**
   * Проверить, идёт ли запрос claimToken.
   */
  isClaiming(): boolean {
    return claimStatus.value === 'claiming';
  }

  /**
   * Проверить, успешно ли получен результат.
   */
  isClaimSuccess(): boolean {
    return claimStatus.value === 'success';
  }
}

// Экземпляр-синглтон
export const matchResultsService = new MatchResultsService();
