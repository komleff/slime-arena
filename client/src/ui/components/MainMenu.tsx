/**
 * MainMenu — главное меню игры
 */

// JSX runtime imported automatically via jsxImportSource
import type { JSX } from 'preact';
import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import { generateRandomName } from '@slime-arena/shared';
import { injectStyles } from '../utils/injectStyles';
import { CLASSES_DATA } from '../data/classes';
import {
  playerName,
  selectedClassId,
  connectionError,
  isAuthenticated,
  isAuthenticating,
  authError,
  currentUser,
  matchmakingStatus,
  queuePosition,
  matchmakingError,
  matchTimer,
} from '../signals/gameState';

// ========== Стили ==========

const styles = `
  .main-menu {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at 30% 30%, #10141d, #090b10 60%);
    font-family: "IBM Plex Mono", "Courier New", monospace;
    color: #e6f3ff;
    padding: 20px;
    z-index: 10;
  }

  .menu-logo {
    font-size: 48px;
    font-weight: 900;
    background: linear-gradient(135deg, #9be070, #4ade80);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: none;
    margin-bottom: 8px;
    letter-spacing: 2px;
  }

  .menu-subtitle {
    font-size: 16px;
    color: #6fd6ff;
    margin-bottom: 32px;
  }

  .menu-card {
    width: min(400px, 90vw);
    background: linear-gradient(160deg, #101721, #0c0f14);
    border: 1px solid #2a3c55;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .menu-section {
    margin-bottom: 20px;
  }

  .menu-section:last-child {
    margin-bottom: 0;
  }

  .menu-label {
    font-size: 12px;
    color: #8aa4c8;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
  }

  .menu-name-row {
    display: flex;
    gap: 8px;
  }

  .menu-input {
    flex: 1;
    min-width: 0;
    padding: 12px 16px;
    background: #0a0f18;
    border: 2px solid #2d4a6d;
    border-radius: 8px;
    color: #e6f3ff;
    font-size: 16px;
    font-family: inherit;
    transition: border-color 200ms;
  }

  .menu-input:focus {
    outline: none;
    border-color: #4a90c2;
  }

  .menu-input::placeholder {
    color: #4a6080;
  }

  .menu-random-button {
    padding: 12px 16px;
    font-size: 18px;
    background: #1b2c45;
    border: 2px solid #2d4a6d;
    border-radius: 8px;
    cursor: pointer;
    transition: background 150ms, border-color 150ms;
  }

  .menu-random-button:hover {
    background: #2a3f5f;
    border-color: #4a90c2;
  }

  .menu-random-button:active {
    background: #1a2a40;
  }

  .class-selector {
    display: flex;
    gap: 8px;
  }

  .class-option {
    flex: 1;
    padding: 12px 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid transparent;
    border-radius: 10px;
    cursor: pointer;
    transition: all 200ms;
    text-align: center;
    font-family: inherit;
    color: #e6f3ff;
  }

  .class-option:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .class-option.selected {
    border-color: currentColor;
    background: rgba(255, 255, 255, 0.1);
  }

  .class-option.hunter { color: #4ade80; }
  .class-option.warrior { color: #f87171; }
  .class-option.collector { color: #60a5fa; }

  .class-icon {
    font-size: 24px;
    display: block;
    margin-bottom: 4px;
  }

  .class-name {
    font-size: 12px;
    font-weight: 600;
  }

  .play-button {
    width: 100%;
    padding: 16px;
    background: linear-gradient(135deg, #4ade80, #22c55e);
    border: none;
    border-radius: 10px;
    color: #0a0f18;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 200ms, box-shadow 200ms;
    font-family: inherit;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .play-button:hover {
    transform: scale(1.02);
    box-shadow: 0 8px 30px rgba(74, 222, 128, 0.4);
  }

  .play-button:active {
    transform: scale(0.98);
  }

  .play-button:disabled {
    background: #4a6080;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .menu-error {
    margin-top: 12px;
    padding: 10px;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #f87171;
    font-size: 13px;
    text-align: center;
  }

  .menu-footer {
    margin-top: 24px;
    font-size: 12px;
    color: #4a6080;
  }

  .menu-footer a {
    color: #6fd6ff;
    text-decoration: none;
  }

  .menu-footer a:hover {
    text-decoration: underline;
  }

  .menu-auth-status {
    font-size: 12px;
    color: #6fd6ff;
    margin-bottom: 16px;
    text-align: center;
  }

  .menu-auth-status.error {
    color: #f87171;
  }

  .matchmaking-status {
    margin-top: 12px;
    padding: 12px;
    background: rgba(96, 165, 250, 0.1);
    border: 1px solid rgba(96, 165, 250, 0.3);
    border-radius: 8px;
    text-align: center;
  }

  .matchmaking-status.searching {
    animation: pulse 2s infinite;
  }

  .matchmaking-status.error {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  .matchmaking-status .status-text {
    font-size: 14px;
    color: #60a5fa;
  }

  .matchmaking-status .queue-position {
    font-size: 12px;
    color: #8aa4c8;
    margin-top: 4px;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .cancel-button {
    margin-top: 8px;
    padding: 8px 16px;
    background: transparent;
    border: 1px solid #4a6080;
    border-radius: 6px;
    color: #8aa4c8;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  }

  .cancel-button:hover {
    border-color: #f87171;
    color: #f87171;
  }

  .waiting-timer {
    width: 100%;
    padding: 16px;
    background: rgba(111, 214, 255, 0.15);
    border: 2px solid rgba(111, 214, 255, 0.3);
    border-radius: 10px;
    color: #6fd6ff;
    font-size: 16px;
    font-weight: 600;
    text-align: center;
    font-family: inherit;
    animation: pulse 2s infinite;
  }
`;

const STYLES_ID = 'main-menu-styles';
injectStyles(STYLES_ID, styles);

// ========== Helpers ==========

function getPlayButtonText(authenticating: boolean, isSearching: boolean, isConnecting: boolean): string {
  if (authenticating) return '⏳ Авторизация...';
  if (isSearching) return '🔍 Поиск...';
  if (isConnecting) return '⏳ Подключение...';
  return '▶ Играть';
}

// ========== Компонент ==========

interface MainMenuProps {
  onPlay: (name: string, classId: number) => void;
  onCancelMatchmaking?: () => void;
  isConnecting?: boolean;
}

export function MainMenu({ onPlay, onCancelMatchmaking, isConnecting = false }: MainMenuProps) {
  const [name, setName] = useState(playerName.value || '');
  const [classId, setClassId] = useState(selectedClassId.value);
  const error = connectionError.value;

  // Auth state (используются в будущих версиях)
  const _authenticated = isAuthenticated.value;
  const authenticating = isAuthenticating.value;
  const authErrorMsg = authError.value;
  const _user = currentUser.value;
  void _authenticated; // suppress unused warning
  void _user; // suppress unused warning

  // Matchmaking state
  const mmStatus = matchmakingStatus.value;
  const mmPosition = queuePosition.value;
  const mmError = matchmakingError.value;

  const isSearching = mmStatus === 'searching' || mmStatus === 'found';
  const hasMatchmakingError = mmStatus === 'error';
  const isLoading = isConnecting || authenticating || isSearching;

  // Сохраняем начальное имя при mount для отслеживания изменений
  const initialNameRef = useRef(playerName.value);

  // Генерируем случайное имя при первом монтировании, если имя пустое
  // Используем playerName.value (signal) вместо name (closure), чтобы не перезаписать
  // имя, которое пользователь начал вводить до срабатывания эффекта
  useEffect(() => {
    const currentName = playerName.value;
    if (!currentName || currentName.trim() === '') {
      const newName = generateRandomName();
      setName(newName);
      playerName.value = newName;
      initialNameRef.current = newName;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNameChange = useCallback((e: JSX.TargetedEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    setName(value);
    playerName.value = value;

    // Если имя изменилось относительно начального — случайный скин
    if (value !== initialNameRef.current && value.trim() !== '') {
      const randomClass = Math.floor(Math.random() * CLASSES_DATA.length);
      setClassId(randomClass);
      selectedClassId.value = randomClass;
    }
  }, []);

  const handleRandomize = useCallback(() => {
    const newName = generateRandomName();
    setName(newName);
    playerName.value = newName;
  }, []);

  const handleClassSelect = useCallback((id: number) => {
    setClassId(id);
    selectedClassId.value = id;
  }, []);

  const handlePlay = useCallback(() => {
    if (name.trim()) {
      onPlay(name.trim(), classId);
    }
  }, [name, classId, onPlay]);

  // Проверка e.target для предотвращения конфликтов с другими элементами формы
  const handleKeyDown = useCallback((e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && name.trim()) {
      handlePlay();
    }
  }, [name, handlePlay]);

  return (
    <div class="main-menu">
      <h1 class="menu-logo">SLIME ARENA</h1>
      <p class="menu-subtitle">Съешь или будь съеден</p>

      <div class="menu-card">
        <div class="menu-section">
          <div class="menu-label">Твоё имя</div>
          <div class="menu-name-row">
            <input
              class="menu-input"
              type="text"
              placeholder="Введи имя..."
              value={name}
              onInput={handleNameChange}
              onKeyDown={handleKeyDown}
              maxLength={20}
              autoFocus
            />
            <button
              type="button"
              class="menu-random-button"
              onClick={handleRandomize}
              title="Случайное имя"
            >
              🎲
            </button>
          </div>
        </div>

        <div class="menu-section">
          <div class="menu-label">Выбери класс</div>
          <div class="class-selector">
            {CLASSES_DATA.map(cls => (
              <button
                key={cls.id}
                class={`class-option ${cls.cssClass} ${classId === cls.id ? 'selected' : ''}`}
                onClick={() => handleClassSelect(cls.id)}
              >
                <span class="class-icon">{cls.icon}</span>
                <span class="class-name">{cls.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div class="menu-section">
          {matchTimer.value.phase === 'Results' ? (
            <div class="waiting-timer">
              ⏳ Новый матч через {Math.ceil(matchTimer.value.timeLeft)} сек
            </div>
          ) : (
            <button
              class="play-button"
              onClick={handlePlay}
              disabled={!name.trim() || isLoading}
            >
              {getPlayButtonText(authenticating, isSearching, isConnecting)}
            </button>
          )}

          {(isSearching || hasMatchmakingError) && onCancelMatchmaking && (
            <div class={`matchmaking-status ${hasMatchmakingError ? 'error' : 'searching'}`}>
              <div class="status-text">
                {hasMatchmakingError
                  ? '❌ Ошибка поиска'
                  : mmStatus === 'found'
                    ? '🎮 Матч найден!'
                    : '🔍 Поиск игры...'}
              </div>
              {mmPosition !== null && mmPosition > 0 && (
                <div class="queue-position">Позиция в очереди: {mmPosition}</div>
              )}
              <button type="button" class="cancel-button" onClick={onCancelMatchmaking}>
                {hasMatchmakingError ? 'Закрыть' : 'Отмена'}
              </button>
            </div>
          )}
        </div>

        {(error || authErrorMsg || mmError) && (
          <div class="menu-error">
            ⚠️ {[error, authErrorMsg, mmError].filter(Boolean).join(' • ')}
          </div>
        )}
      </div>

      <div class="menu-footer">
        Slime Arena v0.3.3 • <a href="https://github.com/komleff/slime-arena" target="_blank" rel="noopener noreferrer">GitHub</a>
      </div>
    </div>
  );
}

export default MainMenu;
