/**
 * Сервис глобальной таблицы лидеров.
 * Получает топ-100 игроков с MetaServer.
 */

import { metaServerClient } from '../api/metaServerClient';
import { signal } from '@preact/signals';
import { currentUser } from '../ui/signals/gameState';

// ========== Типы ==========

/**
 * Режим таблицы лидеров.
 * - total: суммарные очки за все матчи
 * - best: лучший результат в одном матче
 */
export type LeaderboardMode = 'total' | 'best';

/**
 * Запись в таблице лидеров.
 * LB-007: Добавлены skinId и matchesPlayed
 */
export interface GlobalLeaderboardEntry {
  place: number;
  nickname: string;
  userId: string;
  score: number;
  skinId?: string;          // LB-007: ID скина игрока
  gamesPlayed?: number;     // Оставляем для совместимости, заполняется из matchesPlayed
  matchesPlayed?: number;   // LB-007: Количество сыгранных матчей (только mode=total)
  level?: number;
}

/**
 * Запись с сервера (использует position/value).
 * LB-007: Добавлены skinId и matchesPlayed
 */
interface ServerLeaderboardEntry {
  position: number;
  nickname: string;
  userId: string;
  value: number;
  skinId?: string;          // LB-007: ID скина игрока
  matchesPlayed?: number;   // LB-007: Количество сыгранных матчей
  gamesPlayed?: number;     // Deprecated, сохраняем для совместимости
  level?: number;
}

/**
 * Ответ сервера на запрос таблицы лидеров.
 * LB-007: Добавлен myMatchesPlayed
 */
interface ServerLeaderboardResponse {
  mode: LeaderboardMode;
  entries: ServerLeaderboardEntry[];
  myPosition?: number;
  myValue?: number;
  myMatchesPlayed?: number; // LB-007: Количество матчей текущего пользователя (только mode=total)
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

      const response = await metaServerClient.get<ServerLeaderboardResponse>(
        `/api/v1/leaderboard?mode=${mode}`
      );

      // Маппинг серверных полей (position/value) на клиентские (place/score)
      // LB-007: Добавлены skinId и matchesPlayed
      const mappedEntries: GlobalLeaderboardEntry[] = response.entries.map(entry => ({
        place: entry.position,
        nickname: entry.nickname,
        userId: entry.userId,
        score: entry.value,
        skinId: entry.skinId,
        matchesPlayed: entry.matchesPlayed,
        gamesPlayed: entry.matchesPlayed ?? entry.gamesPlayed, // Для обратной совместимости
        level: entry.level,
      }));

      // Copilot P2: Маппинг позиции текущего пользователя
      // Берём nickname и userId из currentUser сигнала, т.к. сервер их не возвращает
      // Gemini P2: Для гостей не показываем userEntry (даже если сервер вернёт myPosition)
      // LB-007: Добавлен matchesPlayed
      const user = currentUser.value;
      const hasValidUser = user?.id && user?.nickname;
      const userEntry: GlobalLeaderboardEntry | null =
        response.myPosition !== undefined && hasValidUser
          ? {
              place: response.myPosition,
              nickname: user.nickname,
              userId: user.id,
              score: response.myValue ?? 0,
              matchesPlayed: response.myMatchesPlayed,
              gamesPlayed: response.myMatchesPlayed, // Для обратной совместимости
            }
          : null;

      leaderboardEntries.value = mappedEntries;
      leaderboardUserEntry.value = userEntry;
      leaderboardUpdatedAt.value = new Date().toISOString();
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
