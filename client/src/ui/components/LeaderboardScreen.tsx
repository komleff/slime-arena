/**
 * LeaderboardScreen -- глобальная таблица лидеров
 * Показывает топ-100 игроков с двумя вкладками: total и best.
 */

// JSX runtime imported automatically via jsxImportSource
import { useCallback, useEffect } from 'preact/hooks';
import { injectStyles } from '../utils/injectStyles';
import {
  leaderboardService,
  leaderboardMode,
  leaderboardEntries,
  leaderboardUserEntry,
  leaderboardLoadStatus,
  leaderboardError,
  type LeaderboardMode,
} from '../../services/leaderboardService';

// ========== Styles ==========

const styles = `
  .leaderboard-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(10, 15, 30, 0.95);
    z-index: 1000;
    font-family: "IBM Plex Mono", monospace;
    color: #e6f3ff;
    animation: lbFadeIn 200ms ease-out;
    padding: 20px;
  }

  @keyframes lbFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .leaderboard-container {
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(145deg, #1a1a2e, #16213e);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .leaderboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .leaderboard-title {
    font-size: 20px;
    font-weight: 700;
    color: #ffc857;
    margin: 0;
  }

  .leaderboard-close {
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 8px;
    color: #8aa4c8;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 150ms, color 150ms;
  }

  .leaderboard-close:hover {
    background: rgba(255, 77, 77, 0.2);
    color: #ff6b6b;
  }

  .leaderboard-tabs {
    display: flex;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .leaderboard-tab {
    flex: 1;
    padding: 12px;
    background: transparent;
    border: none;
    color: #8aa4c8;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: color 150ms, background 150ms;
    position: relative;
  }

  .leaderboard-tab:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .leaderboard-tab.active {
    color: #ffc857;
  }

  .leaderboard-tab.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 20%;
    right: 20%;
    height: 2px;
    background: #ffc857;
    border-radius: 1px;
  }

  .leaderboard-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    min-height: 300px;
  }

  .leaderboard-loading,
  .leaderboard-error,
  .leaderboard-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    color: #8aa4c8;
    gap: 12px;
  }

  .leaderboard-error {
    color: #ff6b6b;
  }

  .leaderboard-loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 200, 87, 0.2);
    border-top-color: #ffc857;
    border-radius: 50%;
    animation: lbSpin 800ms linear infinite;
  }

  @keyframes lbSpin {
    to { transform: rotate(360deg); }
  }

  .leaderboard-retry {
    padding: 8px 16px;
    background: rgba(255, 77, 77, 0.2);
    border: 1px solid rgba(255, 77, 77, 0.4);
    border-radius: 6px;
    color: #ff6b6b;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    transition: background 150ms;
  }

  .leaderboard-retry:hover {
    background: rgba(255, 77, 77, 0.3);
  }

  .leaderboard-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .leaderboard-entry {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    gap: 12px;
    transition: background 150ms;
  }

  .leaderboard-entry:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .leaderboard-entry.is-user {
    background: rgba(155, 224, 112, 0.1);
    border: 1px solid rgba(155, 224, 112, 0.3);
  }

  .leaderboard-entry.top-1 .leaderboard-place {
    background: linear-gradient(135deg, #ffd700, #ffb300);
    color: #1a1a2e;
  }

  .leaderboard-entry.top-2 .leaderboard-place {
    background: linear-gradient(135deg, #c0c0c0, #9e9e9e);
    color: #1a1a2e;
  }

  .leaderboard-entry.top-3 .leaderboard-place {
    background: linear-gradient(135deg, #cd7f32, #a0522d);
    color: #fff;
  }

  .leaderboard-place {
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
    flex-shrink: 0;
  }

  .leaderboard-info {
    flex: 1;
    min-width: 0;
  }

  .leaderboard-name {
    font-size: 14px;
    font-weight: 600;
    color: #e6f3ff;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .leaderboard-meta {
    font-size: 11px;
    color: #6b7a94;
    margin-top: 2px;
  }

  .leaderboard-score {
    font-size: 16px;
    font-weight: 700;
    color: #ffc857;
    flex-shrink: 0;
  }

  .leaderboard-user-position {
    padding: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(155, 224, 112, 0.05);
  }

  .leaderboard-user-position .leaderboard-entry {
    background: rgba(155, 224, 112, 0.15);
    border: 1px solid rgba(155, 224, 112, 0.4);
  }

  .leaderboard-user-label {
    font-size: 11px;
    color: #9be070;
    margin-bottom: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Mobile */
  @media (max-width: 480px) {
    .leaderboard-container {
      max-height: 95vh;
      border-radius: 12px;
    }

    .leaderboard-header {
      padding: 12px 16px;
    }

    .leaderboard-title {
      font-size: 18px;
    }

    .leaderboard-content {
      padding: 8px;
    }

    .leaderboard-entry {
      padding: 8px 10px;
      gap: 10px;
    }

    .leaderboard-place {
      width: 28px;
      height: 28px;
      font-size: 12px;
    }

    .leaderboard-name {
      font-size: 13px;
    }

    .leaderboard-score {
      font-size: 14px;
    }
  }
`;

const STYLES_ID = 'leaderboard-screen-styles';
injectStyles(STYLES_ID, styles);

// ========== Component ==========

interface LeaderboardScreenProps {
  onClose: () => void;
}

export function LeaderboardScreen({ onClose }: LeaderboardScreenProps) {
  const mode = leaderboardMode.value;
  const entries = leaderboardEntries.value;
  const userEntry = leaderboardUserEntry.value;
  const status = leaderboardLoadStatus.value;
  const error = leaderboardError.value;

  // Copilot P2: Load leaderboard on mount and when mode changes
  useEffect(() => {
    leaderboardService.fetchLeaderboard(mode);
  }, [mode]);

  const handleTabClick = useCallback((newMode: LeaderboardMode) => {
    leaderboardService.switchMode(newMode);
  }, []);

  const handleRetry = useCallback(() => {
    leaderboardService.fetchLeaderboard(mode, true);
  }, [mode]);

  const handleOverlayClick = useCallback((e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('leaderboard-overlay')) {
      onClose();
    }
  }, [onClose]);

  const getPlaceClass = (place: number): string => {
    if (place === 1) return 'top-1';
    if (place === 2) return 'top-2';
    if (place === 3) return 'top-3';
    return '';
  };

  return (
    <div class="leaderboard-overlay" onClick={handleOverlayClick}>
      <div class="leaderboard-container">
        <div class="leaderboard-header">
          <h2 class="leaderboard-title">Таблица лидеров</h2>
          <button class="leaderboard-close" onClick={onClose} title="Закрыть">
            X
          </button>
        </div>

        <div class="leaderboard-tabs">
          <button
            class={`leaderboard-tab ${mode === 'total' ? 'active' : ''}`}
            onClick={() => handleTabClick('total')}
          >
            Всего очков
          </button>
          <button
            class={`leaderboard-tab ${mode === 'best' ? 'active' : ''}`}
            onClick={() => handleTabClick('best')}
          >
            Лучший матч
          </button>
        </div>

        <div class="leaderboard-content">
          {status === 'loading' && (
            <div class="leaderboard-loading">
              <div class="leaderboard-loading-spinner" />
              <span>Загрузка...</span>
            </div>
          )}

          {status === 'error' && (
            <div class="leaderboard-error">
              <span>{error || 'Ошибка загрузки'}</span>
              <button class="leaderboard-retry" onClick={handleRetry}>
                Повторить
              </button>
            </div>
          )}

          {status === 'success' && entries.length === 0 && (
            <div class="leaderboard-empty">
              <span>Пока нет данных</span>
            </div>
          )}

          {status === 'success' && entries.length > 0 && (
            <div class="leaderboard-list">
              {entries.map((entry) => (
                <div
                  key={entry.userId}
                  class={`leaderboard-entry ${getPlaceClass(entry.place)} ${
                    userEntry && entry.userId === userEntry.userId ? 'is-user' : ''
                  }`}
                >
                  <div class="leaderboard-place">{entry.place}</div>
                  <div class="leaderboard-info">
                    <div class="leaderboard-name">{entry.nickname}</div>
                    {entry.gamesPlayed !== undefined && (
                      <div class="leaderboard-meta">
                        {entry.gamesPlayed} игр | Ур. {entry.level ?? 1}
                      </div>
                    )}
                  </div>
                  <div class="leaderboard-score">{entry.score.toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {userEntry && !entries.find((e) => e.userId === userEntry.userId) && (
          <div class="leaderboard-user-position">
            <div class="leaderboard-user-label">Ваша позиция</div>
            <div class="leaderboard-entry is-user">
              <div class="leaderboard-place">{userEntry.place}</div>
              <div class="leaderboard-info">
                <div class="leaderboard-name">{userEntry.nickname}</div>
                {userEntry.gamesPlayed !== undefined && (
                  <div class="leaderboard-meta">
                    {userEntry.gamesPlayed} игр | Ур. {userEntry.level ?? 1}
                  </div>
                )}
              </div>
              <div class="leaderboard-score">{userEntry.score.toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LeaderboardScreen;
