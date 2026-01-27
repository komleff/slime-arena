/**
 * Сервис результатов матча.
 * Отправляет результаты на MetaServer и обрабатывает claimToken.
 */

import { metaServerClient } from '../api/metaServerClient';
import { signal } from '@preact/signals';

// ========== Типы ==========

/**
 * Результат матча для отправки на сервер.
 */
export interface MatchResultPayload {
  matchId: string;
  claimToken: string;
  place: number;
  kills: number;
  maxMass: number;
  survivalTimeMs: number;
  classId: number;
}

/**
 * Ответ сервера на claim результата.
 */
export interface ClaimResultResponse {
  success: boolean;
  rewards?: {
    xpGained: number;
    coinsGained: number;
    ratingChange: number;
    newRating: number;
    newLevel?: number;
    levelUp?: boolean;
  };
  error?: string;
}

/**
 * Состояние отправки результата.
 */
export type ClaimStatus = 'idle' | 'claiming' | 'success' | 'error';

// ========== Сигналы состояния ==========

export const claimStatus = signal<ClaimStatus>('idle');
export const claimError = signal<string | null>(null);
export const claimRewards = signal<ClaimResultResponse['rewards'] | null>(null);

// ========== Сервис ==========

class MatchResultsService {
  private pendingClaims: Map<string, MatchResultPayload> = new Map();

  /**
   * Отправить результат матча на сервер.
   * @param payload — данные результата с claimToken
   * @returns true если успешно, false если ошибка
   */
  async claimResult(payload: MatchResultPayload): Promise<boolean> {
    const { matchId, claimToken } = payload;

    // Предотвращаем дублирование
    if (this.pendingClaims.has(matchId)) {
      console.log('[MatchResultsService] Claim already pending for match:', matchId);
      return false;
    }

    try {
      claimStatus.value = 'claiming';
      claimError.value = null;
      claimRewards.value = null;
      this.pendingClaims.set(matchId, payload);

      console.log('[MatchResultsService] Claiming result for match:', matchId);

      const response = await metaServerClient.post<ClaimResultResponse>(
        '/api/v1/match-results/claim',
        {
          matchId,
          claimToken,
          place: payload.place,
          kills: payload.kills,
          maxMass: Math.floor(payload.maxMass),
          survivalTimeMs: payload.survivalTimeMs,
          classId: payload.classId,
        }
      );

      if (response.success) {
        claimStatus.value = 'success';
        claimRewards.value = response.rewards ?? null;
        console.log('[MatchResultsService] Claim successful:', response.rewards);
        return true;
      } else {
        claimStatus.value = 'error';
        claimError.value = response.error ?? 'Неизвестная ошибка';
        console.error('[MatchResultsService] Claim failed:', response.error);
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка отправки результата';
      claimStatus.value = 'error';
      claimError.value = message;
      console.error('[MatchResultsService] Claim error:', message);
      return false;
    } finally {
      this.pendingClaims.delete(matchId);
    }
  }

  /**
   * Сбросить состояние сервиса (при начале нового матча).
   */
  reset(): void {
    claimStatus.value = 'idle';
    claimError.value = null;
    claimRewards.value = null;
  }

  /**
   * Проверить, идёт ли отправка результата.
   */
  isClaiming(): boolean {
    return claimStatus.value === 'claiming';
  }

  /**
   * Проверить, был ли результат успешно отправлен.
   */
  isClaimSuccess(): boolean {
    return claimStatus.value === 'success';
  }
}

// Экземпляр-синглтон
export const matchResultsService = new MatchResultsService();
