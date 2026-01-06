/**
 * Сервис matchmaking.
 * Управляет очередью поиска матча через MetaServer.
 */

import { metaServerClient } from '../api/metaServerClient';
import {
  setMatchmakingSearching,
  setMatchmakingPosition,
  setMatchFound,
  setMatchmakingConnecting,
  setMatchmakingError,
  resetMatchmaking,
  matchmakingStatus,
  matchAssignment,
  type MatchAssignment,
} from '../ui/signals/gameState';

// ========== Типы ==========

interface JoinQueueRequest {
  classId: number;
  nickname?: string;
}

interface JoinQueueResponse {
  status: 'queued' | 'matched';
  position?: number;
  assignment?: MatchAssignment;
}

interface QueueStatusResponse {
  status: 'waiting' | 'matched' | 'expired';
  position?: number;
  assignment?: MatchAssignment;
}

// ========== Constants ==========

const POLL_INTERVAL = 2000; // 2 seconds
const MAX_QUEUE_TIME = 60000; // 60 seconds

// ========== Service ==========

class MatchmakingService {
  private pollIntervalId: number | null = null;
  private queueStartTime: number = 0;
  private onMatchFound: ((assignment: MatchAssignment) => void) | null = null;

  /**
   * Присоединиться к очереди matchmaking.
   */
  async joinQueue(classId: number, nickname?: string): Promise<boolean> {
    try {
      // Сбрасываем предыдущее состояние
      resetMatchmaking();
      setMatchmakingSearching();
      this.queueStartTime = Date.now();

      console.log(`[MatchmakingService] Joining queue with classId=${classId}`);

      const response = await metaServerClient.post<JoinQueueResponse>('/api/v1/matchmaking/join', {
        classId,
        nickname,
      } as JoinQueueRequest);

      if (response.status === 'matched' && response.assignment) {
        // Мгновенный матч
        this.handleMatchFound(response.assignment);
        return true;
      }

      // В очереди — начинаем polling
      if (response.position !== undefined) {
        setMatchmakingPosition(response.position);
      }

      this.startPolling();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join queue';
      console.error('[MatchmakingService] Join failed:', message);
      setMatchmakingError(message);
      return false;
    }
  }

  /**
   * Отменить поиск матча.
   */
  async cancelQueue(): Promise<void> {
    this.stopPolling();

    try {
      await metaServerClient.post('/api/v1/matchmaking/cancel', {});
      console.log('[MatchmakingService] Queue cancelled');
    } catch (err) {
      console.error('[MatchmakingService] Cancel failed:', err);
    } finally {
      resetMatchmaking();
    }
  }

  /**
   * Установить callback для события "матч найден".
   */
  setOnMatchFound(callback: (assignment: MatchAssignment) => void): void {
    this.onMatchFound = callback;
  }

  /**
   * Получить текущее назначение матча.
   */
  getAssignment(): MatchAssignment | null {
    return matchAssignment.value;
  }

  /**
   * Проверить, идёт ли поиск.
   */
  isSearching(): boolean {
    return matchmakingStatus.value === 'searching';
  }

  /**
   * Начать polling статуса очереди.
   */
  private startPolling(): void {
    if (this.pollIntervalId !== null) return;

    this.pollIntervalId = window.setInterval(() => {
      this.checkStatus();
    }, POLL_INTERVAL);
  }

  /**
   * Остановить polling.
   */
  private stopPolling(): void {
    if (this.pollIntervalId !== null) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  /**
   * Проверить статус очереди.
   */
  private async checkStatus(): Promise<void> {
    // Проверяем таймаут
    if (Date.now() - this.queueStartTime > MAX_QUEUE_TIME) {
      console.log('[MatchmakingService] Queue timeout');
      this.stopPolling();
      setMatchmakingError('Queue timeout');
      return;
    }

    try {
      const response = await metaServerClient.get<QueueStatusResponse>('/api/v1/matchmaking/status');

      switch (response.status) {
        case 'matched':
          if (response.assignment) {
            this.handleMatchFound(response.assignment);
          }
          break;

        case 'waiting':
          if (response.position !== undefined) {
            setMatchmakingPosition(response.position);
          }
          break;

        case 'expired':
          console.log('[MatchmakingService] Queue expired');
          this.stopPolling();
          setMatchmakingError('Queue expired');
          break;
      }
    } catch (err) {
      console.error('[MatchmakingService] Status check failed:', err);
      // Не прерываем polling из-за одной ошибки
    }
  }

  /**
   * Обработать найденный матч.
   */
  private handleMatchFound(assignment: MatchAssignment): void {
    console.log(`[MatchmakingService] Match found: ${assignment.matchId}`);
    this.stopPolling();
    setMatchFound(assignment);

    if (this.onMatchFound) {
      this.onMatchFound(assignment);
    }
  }

  /**
   * Пометить как "подключение к матчу".
   */
  setConnecting(): void {
    setMatchmakingConnecting();
  }

  /**
   * Сбросить состояние (после завершения матча).
   */
  reset(): void {
    this.stopPolling();
    resetMatchmaking();
  }
}

// Экземпляр-синглтон
export const matchmakingService = new MatchmakingService();
