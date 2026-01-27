/**
 * Сервис глобальной таблицы лидеров.
 * Получает топ-100 игроков с MetaServer.
 */

import { metaServerClient } from '../api/metaServerClient';
import { signal } from '@preact/signals';

// ========== Типы ==========

/**
 * Режим таблицы лидеров.
 * - total: суммарные очки за все матчи
 * - best: лучший результат в одном матче
 */
export type LeaderboardMode = 'total' | 'best';

/**
 * Запись в таблице лидеров.
 */
export interface GlobalLeaderboardEntry {
  place: number;
  nickname: string;
  userId: string;
  score: number;
  gamesPlayed?: number;
  level?: number;
}

/**
 * Ответ сервера на запрос таблицы лидеров.
 */
export interface LeaderboardResponse {
  mode: LeaderboardMode;
  entries: GlobalLeaderboardEntry[];
  updatedAt: string;
  userEntry?: GlobalLeaderboardEntry; // Позиция текущего игрока
}

/**
 * Состояние загрузки таблицы лидеров.
 */
export type LeaderboardLoadStatus = 'idle' | 'loading' | 'success' | 'error';

// ========== Сигналы состояния ==========

export const leaderboardMode = signal<LeaderboardMode>('total');
export const leaderboardEntries = signal<GlobalLeaderboardEntry[]>([]);
export const leaderboardUserEntry = signal<GlobalLeaderboardEntry | null>(null);
export const leaderboardLoadStatus = signal<LeaderboardLoadStatus>('idle');
export const leaderboardError = signal<string | null>(null);
export const leaderboardUpdatedAt = signal<string | null>(null);

// ========== Сервис ==========

class LeaderboardService {
  private lastFetchMode: LeaderboardMode | null = null;
  private lastFetchTime = 0;
  private cacheTimeMs = 30000; // Кэш на 30 секунд

  /**
   * Загрузить таблицу лидеров.
   * @param mode — режим: 'total' или 'best'
   * @param forceRefresh — принудительное обновление (игнорировать кэш)
   */
  async fetchLeaderboard(mode: LeaderboardMode, forceRefresh = false): Promise<boolean> {
    const now = Date.now();
    const cacheValid =
      this.lastFetchMode === mode &&
      (now - this.lastFetchTime) < this.cacheTimeMs &&
      !forceRefresh;

    if (cacheValid && leaderboardLoadStatus.value === 'success') {
      console.log('[LeaderboardService] Using cached leaderboard');
      return true;
    }

    try {
      leaderboardLoadStatus.value = 'loading';
      leaderboardError.value = null;
      leaderboardMode.value = mode;

      console.log('[LeaderboardService] Fetching leaderboard, mode:', mode);

      const response = await metaServerClient.get<LeaderboardResponse>(
        `/api/v1/leaderboard?mode=${mode}`
      );

      leaderboardEntries.value = response.entries;
      leaderboardUserEntry.value = response.userEntry ?? null;
      leaderboardUpdatedAt.value = response.updatedAt;
      leaderboardLoadStatus.value = 'success';

      this.lastFetchMode = mode;
      this.lastFetchTime = now;

      console.log('[LeaderboardService] Loaded', response.entries.length, 'entries');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка загрузки таблицы лидеров';
      leaderboardLoadStatus.value = 'error';
      leaderboardError.value = message;
      console.error('[LeaderboardService] Error:', message);
      return false;
    }
  }

  /**
   * Переключить режим таблицы.
   * Copilot P2: Используем fetchLeaderboard для всех переключений, чтобы кеш проверялся единообразно.
   */
  async switchMode(mode: LeaderboardMode): Promise<boolean> {
    // fetchLeaderboard сам проверит кеш и вернёт true если данные свежие
    return this.fetchLeaderboard(mode);
  }

  /**
   * Обновить таблицу лидеров (принудительно).
   */
  async refresh(): Promise<boolean> {
    return this.fetchLeaderboard(leaderboardMode.value, true);
  }

  /**
   * Сбросить состояние.
   */
  reset(): void {
    leaderboardEntries.value = [];
    leaderboardUserEntry.value = null;
    leaderboardLoadStatus.value = 'idle';
    leaderboardError.value = null;
    leaderboardUpdatedAt.value = null;
    this.lastFetchMode = null;
    this.lastFetchTime = 0;
  }

  /**
   * Проверить, идёт ли загрузка.
   */
  isLoading(): boolean {
    return leaderboardLoadStatus.value === 'loading';
  }
}

// Экземпляр-синглтон
export const leaderboardService = new LeaderboardService();
