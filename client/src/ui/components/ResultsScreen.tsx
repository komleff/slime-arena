/**
 * ResultsScreen — экран результатов матча
 */

// JSX runtime imported automatically via jsxImportSource
import type { JSX } from 'preact';
import { useCallback } from 'preact/hooks';
import { injectStyles } from '../utils/injectStyles';
import { CLASSES_DATA } from '../data/classes';
import {
  matchResults,
  matchTimer,
  selectedClassId,
  resetGameState,
} from '../signals/gameState';

// Типизированный интерфейс для CSS переменных
interface ClassButtonStyle extends JSX.CSSProperties {
  '--class-color': string;
}

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

  .results-class-selection {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 10px;
  }

  .class-button {
    padding: 12px 20px;
    border-radius: 8px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 150ms, box-shadow 150ms;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }

  .class-button:hover {
    transform: scale(1.05);
  }

  .class-button.selected {
    box-shadow: 0 0 15px currentColor;
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

  const handleClassSelect = useCallback((classId: number) => {
    selectedClassId.value = classId;
  }, []);

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
            Победитель: {winner}
          </div>
        )}

        {/* Таблица лидеров */}
        <div class="results-leaderboard">
          {finalLeaderboard.map((entry) => (
            <div key={entry.place} class={`results-entry ${entry.isLocal ? 'is-local' : ''}`}>
              <span class="results-place">{entry.place}.</span>
              <span class="results-name">{entry.name}</span>
              <div class="results-stats">
                <span class="results-stat mass">{Math.floor(entry.mass)} кг</span>
                <span class="results-stat kills">{entry.kills} 💀</span>
              </div>
            </div>
          ))}
        </div>

        {/* Личная статистика */}
        {personalStats && (
          <div class="results-personal">
            <div class="results-personal-stat">
              <div class="results-personal-value">{Math.floor(personalStats.maxMass)}</div>
              <div class="results-personal-label">Макс. масса</div>
            </div>
            <div class="results-personal-stat">
              <div class="results-personal-value">{personalStats.kills}</div>
              <div class="results-personal-label">Убийства</div>
            </div>
            <div class="results-personal-stat">
              <div class="results-personal-value">{personalStats.level}</div>
              <div class="results-personal-label">Уровень</div>
            </div>
          </div>
        )}

        {/* Выбор класса */}
        <div class="results-class-selection">
          {CLASSES_DATA.map(cls => {
            const buttonStyle: ClassButtonStyle = {
              '--class-color': cls.color,
              background: currentClassId === cls.id ? 'var(--class-color)' : 'rgba(255, 255, 255, 0.05)',
              borderColor: 'var(--class-color)',
            };
            return (
              <button
                key={cls.id}
                class={`class-button ${currentClassId === cls.id ? 'selected' : ''}`}
                style={buttonStyle}
                onClick={() => handleClassSelect(cls.id)}
              >
                {cls.icon} {cls.name}
              </button>
            );
          })}
        </div>

        {/* Таймер до следующего матча — используем signal для реактивного обновления */}
        {matchTimer.value.timeLeft > 0 && (
          <div class="results-timer">
            Следующий матч через: {Math.ceil(matchTimer.value.timeLeft)} сек
          </div>
        )}

        {/* Кнопки */}
        <div class="results-buttons">
          <button class="results-button primary" onClick={handlePlayAgain}>
            🔄 Играть снова
          </button>
          <button class="results-button secondary" onClick={handleExit}>
            Выйти в меню
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResultsScreen;
