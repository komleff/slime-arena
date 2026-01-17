/**
 * ResultsScreen — экран результатов матча
 */

// JSX runtime imported automatically via jsxImportSource
import { useCallback } from 'preact/hooks';
import { injectStyles } from '../utils/injectStyles';
import { CLASSES_DATA } from '../data/classes';
import {
  matchResults,
  matchTimer,
  selectedClassId,
  resetGameState,
} from '../signals/gameState';

// ========== Стили ==========

const styles = `
  .results-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(10, 15, 30, 0.92);
    z-index: 1000;
    font-family: "IBM Plex Mono", monospace;
    color: #e6f3ff;
    animation: fadeIn 300ms ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .results-content {
    text-align: center;
    max-width: 600px;
    width: 90%;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .results-title {
    font-size: 32px;
    margin: 0;
    color: #ffc857;
    text-shadow: 0 0 20px rgba(255, 200, 87, 0.5);
  }

  .results-winner {
    font-size: 24px;
    color: #9be070;
  }

  .results-leaderboard {
    text-align: left;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    padding: 15px;
    max-height: 200px;
    overflow-y: auto;
  }

  .results-entry {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .results-entry:last-child {
    border-bottom: none;
  }

  .results-entry.is-local {
    color: #9be070;
    font-weight: 600;
  }

  .results-place {
    width: 30px;
    color: #ffc857;
  }

  .results-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .results-stats {
    display: flex;
    gap: 8px;
    min-width: 120px;
    justify-content: flex-end;
  }

  .results-stat {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
  }

  .results-stat.mass {
    background: rgba(155, 224, 112, 0.2);
    color: #9be070;
  }

  .results-stat.kills {
    background: rgba(255, 77, 77, 0.2);
    color: #ff4d4d;
  }

  .results-personal {
    display: flex;
    justify-content: space-around;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .results-personal-stat {
    text-align: center;
  }

  .results-personal-value {
    font-size: 24px;
    font-weight: 700;
    color: #fff;
  }

  .results-personal-label {
    font-size: 12px;
    color: #8aa4c8;
    margin-top: 4px;
  }

  .results-timer {
    font-size: 16px;
    color: #6fd6ff;
  }

  .results-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 10px;
  }

  .results-button {
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: transform 150ms, box-shadow 150ms;
    font-family: inherit;
  }

  .results-button:hover {
    transform: scale(1.02);
  }

  .results-button.primary {
    background: linear-gradient(135deg, #4a90c2, #2d4a6d);
    color: #fff;
  }

  .results-button.play {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: #fff;
  }

  .results-button.secondary {
    background: #ef4444;
    color: #fff;
  }
`;

const STYLES_ID = 'results-screen-styles';
injectStyles(STYLES_ID, styles);

// ========== Компонент ==========

interface ResultsScreenProps {
  onPlayAgain: (classId: number) => void;
  onExit: () => void;
}

export function ResultsScreen({ onPlayAgain, onExit }: ResultsScreenProps) {
  const results = matchResults.value;
  const currentClassId = selectedClassId.value;

  const handlePlayAgain = useCallback(() => {
    onPlayAgain(currentClassId);
  }, [onPlayAgain, currentClassId]);

  const handleExit = useCallback(() => {
    resetGameState();
    onExit();
  }, [onExit]);

  if (!results) {
    return null;
  }

  const { winner, finalLeaderboard, personalStats } = results;

  return (
    <div class="results-overlay">
      <div class="results-content">
        <h1 class="results-title">🏆 Матч завершён!</h1>
        
        {winner && (
          <div class="results-winner">
            🏆 Победитель: {winner}
          </div>
        )}

        {/* Таблица лидеров */}
        <div class="results-leaderboard">
          {finalLeaderboard.map((entry) => (
            <div key={entry.place} class={`results-entry ${entry.isLocal ? 'is-local' : ''}`}>
              <span class="results-place">{entry.place}.</span>
              <span class="results-name">
                {CLASSES_DATA[entry.classId ?? 0]?.icon ?? '?'} {entry.name}
              </span>
              <div class="results-stats">
                <span class="results-stat mass">{Math.floor(entry.mass)} кг</span>
                <span class="results-stat kills">{entry.kills} 💀</span>
              </div>
            </div>
          ))}
        </div>

        {/* Личная статистика: Класс → Уровень → Масса → Убийств */}
        {personalStats && (
          <div class="results-personal">
            <div class="results-personal-stat">
              <div class="results-personal-value">
                {CLASSES_DATA[personalStats.classId]?.icon ?? '?'} {CLASSES_DATA[personalStats.classId]?.name ?? 'Неизвестно'}
              </div>
              <div class="results-personal-label">Класс</div>
            </div>
            <div class="results-personal-stat">
              <div class="results-personal-value">{personalStats.level}</div>
              <div class="results-personal-label">Уровень</div>
            </div>
            <div class="results-personal-stat">
              <div class="results-personal-value">{Math.floor(personalStats.maxMass)}</div>
              <div class="results-personal-label">Макс. масса</div>
            </div>
            <div class="results-personal-stat">
              <div class="results-personal-value">{personalStats.kills}</div>
              <div class="results-personal-label">Убийства</div>
            </div>
          </div>
        )}

        {/* Кнопки */}
        <div class="results-buttons">
          <button
            class={`results-button ${matchTimer.value.timeLeft > 0 ? 'primary' : 'play'}`}
            onClick={handlePlayAgain}
            disabled={matchTimer.value.timeLeft > 0}
          >
            {matchTimer.value.timeLeft > 0
              ? `⏳ ${Math.ceil(matchTimer.value.timeLeft)} сек`
              : '🔄 Сыграть ещё'}
          </button>
          <button class="results-button secondary" onClick={handleExit}>
            🏠 В меню
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResultsScreen;
