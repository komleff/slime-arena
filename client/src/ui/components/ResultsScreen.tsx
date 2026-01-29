/**
 * ResultsScreen — экран результатов матча
 * Отображает результаты, награды и предлагает сохранить прогресс гостям.
 *
 * Архитектура:
 * - Награды (XP, coins) начисляются сервером автоматически при завершении матча
 * - Клиент вычисляет награды локально для мгновенного отображения в UI
 * - claimToken запрашивается только для гостей (используется в upgrade flow)
 */

// JSX runtime imported automatically via jsxImportSource
import { useCallback, useState, useEffect, useRef } from 'preact/hooks';
import { injectStyles } from '../utils/injectStyles';
import { CLASSES_DATA } from '../data/classes';
import {
  matchResults,
  resultsWaitTime,
  selectedClassId,
  resetGameState,
  matchAssignment,
  currentRoomId,
} from '../signals/gameState';
import {
  matchResultsService,
  claimStatus,
  claimRewards,
} from '../../services/matchResultsService';
import { authService } from '../../services/authService';
import { RegistrationPromptModal } from './RegistrationPromptModal';

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
    overflow-y: auto;
    padding: 20px 0;
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

  /* Награды */
  .results-rewards {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 8px;
    padding: 12px;
    animation: rewardsSlideIn 400ms ease-out;
  }

  @keyframes rewardsSlideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .results-rewards-title {
    font-size: 14px;
    color: #9be070;
    margin-bottom: 8px;
    font-weight: 600;
  }

  .results-rewards-items {
    display: flex;
    justify-content: center;
    gap: 20px;
    flex-wrap: wrap;
  }

  .results-reward-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
  }

  .results-reward-value {
    font-weight: 700;
  }

  .results-reward-value.positive {
    color: #9be070;
  }

  .results-reward-value.negative {
    color: #ff6b6b;
  }

  .results-reward-label {
    color: #8aa4c8;
    font-size: 12px;
  }

  .results-level-up {
    background: rgba(255, 200, 87, 0.15);
    border: 1px solid rgba(255, 200, 87, 0.4);
    border-radius: 8px;
    padding: 10px;
    margin-top: 8px;
    animation: levelUpPulse 600ms ease-out;
  }

  @keyframes levelUpPulse {
    0% { transform: scale(0.95); opacity: 0; }
    50% { transform: scale(1.02); }
    100% { transform: scale(1); opacity: 1; }
  }

  .results-level-up-text {
    color: #ffc857;
    font-weight: 700;
    font-size: 16px;
  }

  /* Состояния claim */
  .results-claim-status {
    font-size: 12px;
    padding: 8px;
    border-radius: 6px;
    text-align: center;
  }

  .results-claim-status.claiming {
    background: rgba(111, 214, 255, 0.1);
    color: #6fd6ff;
  }

  .results-claim-status.error {
    background: rgba(255, 77, 77, 0.1);
    color: #ff4d4d;
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
    flex-wrap: wrap;
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

  .results-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
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

  .results-button.save-progress {
    background: linear-gradient(135deg, #ffc857, #e6a03a);
    color: #1a1a2e;
  }

  /* Ссылка "Сохранить прогресс" */
  .results-save-prompt {
    margin-top: 8px;
    font-size: 13px;
    color: #8aa4c8;
  }

  .results-save-link {
    color: #ffc857;
    cursor: pointer;
    text-decoration: underline;
    transition: color 150ms;
  }

  .results-save-link:hover {
    color: #ffe08a;
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
  const status = claimStatus.value;
  const rewards = claimRewards.value;

  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  // Copilot P1: Используем matchId для отслеживания, а не boolean флаг
  // Это позволяет корректно обрабатывать повторные матчи
  const lastClaimedMatchRef = useRef<string | null>(null);

  const isAnonymous = authService.isAnonymous();
  // Используем matchId из matchmaking или roomId для прямого подключения
  const currentMatchId = matchAssignment.value?.matchId || currentRoomId.value;

  // Вычисляем награды локально и запрашиваем claimToken для гостей
  useEffect(() => {

    // Проверяем по matchId, а не по boolean флагу
    if (!results || !currentMatchId || lastClaimedMatchRef.current === currentMatchId) return;

    // Вычисляем place из finalLeaderboard
    // slime-arena-isf: Если игрок не в топ-10, place неизвестен (null).
    // Для наград используем 99 (нет бонуса за место), для UI — "—".
    const localEntry = results.finalLeaderboard.find(e => e.isLocal);
    const place = localEntry?.place ?? null;

    // Получаем данные из personalStats
    const stats = results.personalStats;
    if (!stats) {
      console.warn('[ResultsScreen] No personalStats available');
      return;
    }

    // Помечаем этот матч как обработанный
    lastClaimedMatchRef.current = currentMatchId;

    // Сбрасываем состояние сервиса для нового матча (Copilot P2)
    matchResultsService.reset();

    // Вычисляем награды локально для мгновенного отображения
    // Серверные награды начисляются автоматически через /match-results/submit
    // Если место неизвестно (null), используем 99 — нет бонуса за место
    matchResultsService.setLocalRewards(place ?? 99, stats.kills);
    console.log('[ResultsScreen] setLocalRewards called, status should be success now');

    // Для гостей запрашиваем claimToken (используется в upgrade flow)
    if (isAnonymous && currentMatchId) {
      matchResultsService.getClaimToken(currentMatchId).catch((err) => {
        console.warn('[ResultsScreen] Failed to get claim token:', err);
      });
    }
  }, [results, isAnonymous, currentMatchId]);

  const handlePlayAgain = useCallback(() => {
    onPlayAgain(currentClassId);
  }, [onPlayAgain, currentClassId]);

  const handleExit = useCallback(() => {
    resetGameState();
    onExit();
  }, [onExit]);

  const handleShowRegistration = useCallback(() => {
    setShowRegistrationModal(true);
  }, []);

  const handleCloseRegistration = useCallback(() => {
    setShowRegistrationModal(false);
  }, []);

  if (!results) {
    return null;
  }

  const { winner, finalLeaderboard, personalStats } = results;
  const waitTime = resultsWaitTime.value;
  const canPlay = waitTime <= 0 && status !== 'claiming';

  const playAgainText = 'Играть снова';

  return (
    <div class="results-overlay">
      <div class="results-content">
        <h1 class="results-title">Матч завершен!</h1>

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
              <span class="results-name">
                {CLASSES_DATA[entry.classId ?? 0]?.icon ?? '?'} {entry.name}
              </span>
              <div class="results-stats">
                <span class="results-stat mass">{Math.floor(entry.mass)} кг</span>
                <span class="results-stat kills">{entry.kills}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Личная статистика */}
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

        {/* Статус отправки результата */}
        {status === 'claiming' && (
          <div class="results-claim-status claiming">
            Сохранение результата...
          </div>
        )}

        {/* Ошибка claimToken не показывается — это некритичная ошибка, не влияющая на геймплей */}

        {/* Награды (локальный расчёт, серверное начисление происходит автоматически) */}
        {/* Показываем независимо от status - ошибка claimToken не должна блокировать награды */}
        {rewards && (
          <div class="results-rewards">
            <div class="results-rewards-title">Награды</div>
            <div class="results-rewards-items">
              <div class="results-reward-item">
                {/* Copilot P2: Условный + для корректного отображения отрицательных значений */}
                <span class={`results-reward-value ${rewards.xpGained >= 0 ? 'positive' : 'negative'}`}>
                  {rewards.xpGained >= 0 ? '+' : ''}{rewards.xpGained}
                </span>
                <span class="results-reward-label">XP</span>
              </div>
              <div class="results-reward-item">
                <span class={`results-reward-value ${rewards.coinsGained >= 0 ? 'positive' : 'negative'}`}>
                  {rewards.coinsGained >= 0 ? '+' : ''}{rewards.coinsGained}
                </span>
                <span class="results-reward-label">монет</span>
              </div>
              <div class="results-reward-item">
                <span class={`results-reward-value ${rewards.ratingChange >= 0 ? 'positive' : 'negative'}`}>
                  {rewards.ratingChange >= 0 ? '+' : ''}{rewards.ratingChange}
                </span>
                <span class="results-reward-label">рейтинг</span>
              </div>
            </div>
          </div>
        )}

        {/* Copilot P2: Предложение сохранить прогресс для гостей только при finalMass >= 200 */}
        {/* Показываем независимо от status claimToken - ошибка сервера не должна блокировать UI */}
        {isAnonymous && (personalStats?.maxMass ?? 0) >= 200 && (
          <div class="results-save-prompt">
            Играете как гость.{' '}
            <span class="results-save-link" onClick={handleShowRegistration}>
              Сохранить прогресс
            </span>
          </div>
        )}

        {/* Кнопки */}
        <div class="results-buttons">
          <button
            class={`results-button ${canPlay ? 'play' : 'primary'}`}
            onClick={handlePlayAgain}
            disabled={!canPlay}
          >
            {waitTime > 0
              ? `${Math.ceil(waitTime)} сек`
              : status === 'claiming'
                ? 'Подождите...'
                : playAgainText}
          </button>
          <button class="results-button secondary" onClick={handleExit}>
            На главную
          </button>
        </div>
      </div>

      {/* Модал регистрации */}
      {showRegistrationModal && (
        <RegistrationPromptModal onClose={handleCloseRegistration} />
      )}
    </div>
  );
}

export default ResultsScreen;
