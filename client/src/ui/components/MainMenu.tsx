/**
 * MainMenu — главное меню игры
 */

// JSX runtime imported automatically via jsxImportSource
import type { JSX } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { injectStyles } from '../utils/injectStyles';
import { CLASSES_DATA } from '../data/classes';
import {
  playerName,
  selectedClassId,
  connectionError,
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

  .menu-input {
    width: 100%;
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
`;

const STYLES_ID = 'main-menu-styles';

if (typeof window !== 'undefined') {
  injectStyles(STYLES_ID, styles);
}

// ========== Компонент ==========

interface MainMenuProps {
  onPlay: (name: string, classId: number) => void;
  isConnecting?: boolean;
}

export function MainMenu({ onPlay, isConnecting = false }: MainMenuProps) {
  const [name, setName] = useState(playerName.value || '');
  const [classId, setClassId] = useState(selectedClassId.value);
  const error = connectionError.value;

  const handleNameChange = useCallback((e: JSX.TargetedEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    setName(value);
    playerName.value = value;
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
          <button
            class="play-button"
            onClick={handlePlay}
            disabled={!name.trim() || isConnecting}
          >
            {isConnecting ? '⏳ Подключение...' : '▶ Играть'}
          </button>
        </div>

        {error && (
          <div class="menu-error">
            ⚠️ {error}
          </div>
        )}
      </div>

      <div class="menu-footer">
        Slime Arena v0.2.2 • <a href="https://github.com/komleff/slime-arena" target="_blank">GitHub</a>
      </div>
    </div>
  );
}

export default MainMenu;
