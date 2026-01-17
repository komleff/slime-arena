/**
 * BootScreen — экран загрузки приложения
 *
 * Отображает прогресс инициализации:
 * - initializing → authenticating → loadingConfig → ready/error
 */

import { bootState } from '../signals/gameState';
import { injectStyles } from '../utils/injectStyles';
import { useEffect } from 'preact/hooks';

const STYLES_ID = 'boot-screen-styles';

const styles = `
  .boot-screen {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-image: url('/backgrounds/bg_loading_screen.png');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    z-index: 1000;
  }

  .boot-progress-container {
    position: absolute;
    bottom: 15%;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  /* Прогресс-бар в стиле печенья */
  .boot-progress-track {
    width: 280px;
    height: 32px;
    background: linear-gradient(180deg, #8B5A2B 0%, #6B4423 50%, #5D3A1A 100%);
    border-radius: 16px;
    border: 3px solid #4A2C17;
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.4),
      0 4px 8px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    position: relative;
  }

  /* Внутренняя часть (углубление) */
  .boot-progress-inner {
    position: absolute;
    inset: 3px;
    background: linear-gradient(180deg, #3E2723 0%, #5D4037 100%);
    border-radius: 12px;
    overflow: hidden;
  }

  /* Заполнение кремом */
  .boot-progress-fill {
    height: 100%;
    background: linear-gradient(180deg,
      #FFF8E1 0%,
      #FFE0B2 30%,
      #FFCC80 70%,
      #FFB74D 100%
    );
    border-radius: 10px;
    transition: width 0.3s ease-out;
    position: relative;
    box-shadow:
      inset 0 2px 4px rgba(255, 255, 255, 0.6),
      inset 0 -2px 4px rgba(0, 0, 0, 0.1);
  }

  /* Блик на креме */
  .boot-progress-fill::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 8px;
    right: 8px;
    height: 6px;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.7) 20%,
      rgba(255, 255, 255, 0.7) 80%,
      transparent 100%
    );
    border-radius: 3px;
  }

  /* Текст загрузки */
  .boot-text {
    font-family: 'Titan One', Impact, 'Arial Black', sans-serif;
    font-size: 20px;
    color: #FFF8E1;
    text-shadow:
      0 2px 0 #3E2723,
      0 4px 8px rgba(0, 0, 0, 0.5);
    letter-spacing: 3px;
    text-transform: uppercase;
  }

  /* Анимация точек */
  .boot-dots {
    display: inline-block;
    width: 24px;
    text-align: left;
  }

  .boot-dots::after {
    content: '';
    animation: bootDots 1.5s infinite;
  }

  @keyframes bootDots {
    0%, 20% { content: '.'; }
    40% { content: '..'; }
    60%, 100% { content: '...'; }
  }

  /* Ошибка */
  .boot-error {
    color: #FF6B6B;
    font-size: 14px;
    text-align: center;
    max-width: 280px;
    margin-top: 8px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .boot-retry-btn {
    margin-top: 12px;
    padding: 8px 24px;
    background: linear-gradient(180deg, #FFB74D 0%, #FF9800 100%);
    border: 2px solid #E65100;
    border-radius: 20px;
    color: white;
    font-family: 'Titan One', Impact, 'Arial Black', sans-serif;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 3px 0 #BF360C;
    transition: transform 0.1s, box-shadow 0.1s;
  }

  .boot-retry-btn:active {
    transform: translateY(2px);
    box-shadow: 0 1px 0 #BF360C;
  }
`;

interface BootScreenProps {
  onRetry?: () => void;
}

export function BootScreen({ onRetry }: BootScreenProps) {
  const state = bootState.value;

  useEffect(() => {
    injectStyles(STYLES_ID, styles);
  }, []);

  const stageLabels: Record<string, string> = {
    initializing: 'Инициализация',
    authenticating: 'Авторизация',
    loadingConfig: 'Загрузка',
    ready: 'Готово',
    error: 'Ошибка',
  };

  const label = stageLabels[state.stage] || 'Загрузка';
  const isError = state.stage === 'error';

  return (
    <div class="boot-screen">
      <div class="boot-progress-container">
        <div class="boot-progress-track">
          <div class="boot-progress-inner">
            <div
              class="boot-progress-fill"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>

        <div class="boot-text">
          {label}
          {!isError && <span class="boot-dots" />}
        </div>

        {isError && state.error && (
          <div class="boot-error">{state.error}</div>
        )}

        {isError && onRetry && (
          <button class="boot-retry-btn" onClick={onRetry}>
            Повторить
          </button>
        )}
      </div>
    </div>
  );
}
