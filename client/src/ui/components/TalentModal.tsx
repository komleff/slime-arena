/**
 * TalentModal — модальное окно выбора талантов
 */

// JSX runtime imported automatically via jsxImportSource
import { useCallback } from 'preact/hooks';
import { injectStyles } from '../utils/injectStyles';
import {
  talentChoices,
  talentQueueSize,
  talentTimerSeconds,
  showTalentModal,
  type TalentChoice,
} from '../signals/gameState';
import { getRarityName } from '../data/rarity';

// ========== Стили ==========

const styles = `
  .talent-modal {
    position: fixed;
    left: 20px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 120;
    pointer-events: auto;
    font-family: "IBM Plex Mono", "Courier New", monospace;
  }

  .talent-card {
    width: min(420px, 44vw);
    max-height: 70vh;
    overflow-y: auto;
    background: linear-gradient(160deg, rgba(16, 23, 33, 0.6), rgba(12, 15, 20, 0.6));
    border: 1px solid #2a3c55;
    border-radius: 16px;
    padding: 20px;
    color: #e6f3ff;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
  }

  .talent-header {
    margin-bottom: 12px;
  }

  .talent-title {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.5px;
    margin: 0 0 8px 0;
  }

  .talent-timer {
    font-size: 13px;
    color: #fbbf24;
    font-weight: 600;
  }

  .talent-queue {
    font-size: 12px;
    color: #6fd6ff;
    margin-top: 4px;
  }

  .talent-buttons {
    display: grid;
    gap: 10px;
    margin-top: 12px;
  }

  .talent-button {
    display: flex;
    gap: 12px;
    padding: 14px 16px;
    background: rgba(17, 27, 42, 0.5);
    border: 2px solid #2d4a6d;
    border-radius: 12px;
    color: #e6f3ff;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease, border-color 120ms ease;
    font-family: inherit;
  }

  .talent-button:hover:not(:disabled) {
    transform: translateY(-2px);
    background: rgba(27, 44, 69, 0.6);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
  }

  .talent-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .talent-button.rarity-0 { border-color: #6b7280; }
  .talent-button.rarity-1 { border-color: #3b82f6; }
  .talent-button.rarity-2 { border-color: #a855f7; }

  .talent-icon {
    font-size: 28px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .talent-info {
    flex: 1;
    min-width: 0;
  }

  .talent-name {
    font-weight: 600;
    font-size: 15px;
    margin-bottom: 4px;
  }

  .talent-desc {
    font-size: 12px;
    color: #8aa4c8;
    line-height: 1.3;
  }

  .talent-rarity {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 4px;
  }

  .talent-rarity.rarity-0 { color: #6b7280; }
  .talent-rarity.rarity-1 { color: #3b82f6; }
  .talent-rarity.rarity-2 { color: #a855f7; }

  .talent-hint {
    font-size: 11px;
    color: #6a8099;
    text-align: center;
    margin-top: 12px;
  }
`;

const STYLES_ID = 'talent-modal-styles';
injectStyles(STYLES_ID, styles);

interface TalentModalProps {
  onSelectTalent: (talentId: string, index: number) => void;
}

export function TalentModal({ onSelectTalent }: TalentModalProps) {
  const choices = talentChoices.value;
  const queueSize = talentQueueSize.value;
  const timerSeconds = talentTimerSeconds.value;
  const visible = showTalentModal.value;

  const handleSelect = useCallback((talent: TalentChoice, index: number) => {
    onSelectTalent(talent.id, index);
  }, [onSelectTalent]);

  if (!visible || choices.length === 0) {
    return null;
  }

  return (
    <div class="talent-modal">
      <div class="talent-card">
        <div class="talent-header">
          <h3 class="talent-title">Выбери талант</h3>
          <div class="talent-timer">⏱ {Math.ceil(timerSeconds)} сек</div>
          {queueSize > 1 && (
            <div class="talent-queue">+{queueSize - 1} в очереди</div>
          )}
        </div>

        <div class="talent-buttons">
          {choices.map((talent, idx) => (
            <button
              key={talent.id}
              class={`talent-button rarity-${talent.rarity}`}
              onClick={() => handleSelect(talent, idx)}
            >
              <div class="talent-icon">{talent.icon}</div>
              <div class="talent-info">
                <div class="talent-name">{talent.name}</div>
                <div class="talent-desc">{talent.description}</div>
                <div class={`talent-rarity rarity-${talent.rarity}`}>
                  {getRarityName(talent.rarity)}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div class="talent-hint">
          Клик или клавиши 7 / 8 / 9
        </div>
      </div>
    </div>
  );
}

export default TalentModal;
