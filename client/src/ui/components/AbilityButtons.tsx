/**
 * AbilityButtons — кнопки способностей с визуализацией кулдауна
 */

// JSX runtime imported automatically via jsxImportSource
import { useCallback, useMemo } from 'preact/hooks';
import { injectStyles } from '../utils/injectStyles';
import { abilityCooldowns, type AbilityCooldown } from '../signals/gameState';

// ========== Стили ==========

const styles = `
  .ability-buttons {
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: flex;
    gap: 10px;
    z-index: 50;
    pointer-events: auto;
  }

  .ability-button {
    position: relative;
    width: 70px;
    height: 70px;
    border-radius: 50%;
    border: 3px solid #4a90c2;
    background: linear-gradient(135deg, #2d4a6d, #1b2c45);
    color: #e6f3ff;
    font-size: 28px;
    cursor: pointer;
    transition: transform 150ms, box-shadow 150ms, opacity 150ms;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: manipulation;
    -webkit-user-select: none;
    user-select: none;
  }

  .ability-button.small {
    width: 60px;
    height: 60px;
    font-size: 24px;
  }

  .ability-button:active:not(:disabled) {
    transform: scale(0.95);
  }

  .ability-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .ability-button.ready {
    box-shadow: 0 0 15px 5px rgba(100, 220, 255, 0.7), inset 0 0 15px rgba(100, 220, 255, 0.3);
    border-color: #64dcff;
    animation: abilityPulse 1.5s ease-in-out infinite;
  }

  @keyframes abilityPulse {
    0%, 100% { box-shadow: 0 0 15px 5px rgba(100, 220, 255, 0.7); }
    50% { box-shadow: 0 0 20px 8px rgba(100, 220, 255, 0.9); }
  }

  .ability-button.slot-1 {
    background: linear-gradient(135deg, #4a2d6d, #2b1b45);
    border-color: #9a4ac2;
  }

  .ability-button.slot-1.ready {
    border-color: #c74ff7;
    box-shadow: 0 0 15px 5px rgba(199, 79, 247, 0.7);
  }

  .ability-button.slot-2 {
    background: linear-gradient(135deg, #6d4a2d, #452b1b);
    border-color: #c29a4a;
  }

  .ability-button.slot-2.ready {
    border-color: #f7c74f;
    box-shadow: 0 0 15px 5px rgba(247, 199, 79, 0.7);
  }

  .ability-icon {
    font-size: inherit;
    pointer-events: none;
    z-index: 1;
  }

  .ability-label {
    position: absolute;
    bottom: 2px;
    right: 6px;
    font-size: 14px;
    font-weight: bold;
    color: #fff;
    text-shadow: 0 0 4px #000, 0 0 8px #000;
    pointer-events: none;
  }

  .ability-cooldown-overlay {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.75);
    pointer-events: none;
  }

  .ability-progress {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
    pointer-events: none;
  }

  .ability-progress circle {
    fill: none;
    stroke-width: 6;
    stroke-linecap: round;
  }

  .ability-timer {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 16px;
    font-weight: bold;
    color: #fff;
    text-shadow: 0 0 4px #000;
    pointer-events: none;
    z-index: 2;
  }
`;

const STYLES_ID = 'ability-buttons-styles';

if (typeof window !== 'undefined') {
  injectStyles(STYLES_ID, styles);
}

// ========== Данные способностей ==========

const abilityData = [
  { slot: 0, icon: '⚡', label: '1', color: '#4fc3f7' },
  { slot: 1, icon: '💥', label: '2', color: '#c74ff7' },
  { slot: 2, icon: '🛡️', label: '3', color: '#f7c74f' },
];

// ========== Компонент кнопки ==========

interface AbilityButtonProps {
  slot: number;
  icon: string;
  label: string;
  color: string;
  cooldown: AbilityCooldown;
  onClick: (slot: number) => void;
  small?: boolean;
}

function AbilityButton({ slot, icon, label, color, cooldown, onClick, small }: AbilityButtonProps) {
  const handleClick = useCallback(() => {
    if (cooldown.ready) {
      onClick(slot);
    }
  }, [slot, cooldown.ready, onClick]);

  // useMemo для кэширования вычислений при частых ре-рендерах
  const { circumference, strokeDashoffset, displayTime } = useMemo(() => {
    const prog = cooldown.total > 0 
      ? Math.max(0, Math.min(1, cooldown.remaining / cooldown.total))
      : 0;
    const circ = 2 * Math.PI * 45;
    const offset = circ * (1 - prog);
    // Math.ceil для последней секунды, toFixed для остальных
    const display = cooldown.remaining < 1 
      ? Math.ceil(cooldown.remaining * 10) / 10  // 0.1 precision
      : cooldown.remaining.toFixed(1);
    return { circumference: circ, strokeDashoffset: offset, displayTime: display };
  }, [cooldown.remaining, cooldown.total]);

  const isOnCooldown = cooldown.remaining > 0;

  return (
    <button
      class={`ability-button slot-${slot} ${cooldown.ready ? 'ready' : ''} ${small ? 'small' : ''}`}
      onClick={handleClick}
      disabled={isOnCooldown}
    >
      <span class="ability-icon">{icon}</span>
      <span class="ability-label">{label}</span>

      {isOnCooldown && (
        <>
          <div class="ability-cooldown-overlay" />
          
          <svg class="ability-progress" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke={color}
              stroke-dasharray={circumference}
              stroke-dashoffset={strokeDashoffset}
              style={{ filter: `drop-shadow(0 0 4px ${color})` }}
            />
          </svg>

          <span class="ability-timer">
            {displayTime}
          </span>
        </>
      )}
    </button>
  );
}

// ========== Главный компонент ==========

interface AbilityButtonsProps {
  onActivateAbility: (slot: number) => void;
  visibleSlots?: number[];
}

export function AbilityButtons({ onActivateAbility, visibleSlots = [0, 1, 2] }: AbilityButtonsProps) {
  const cooldowns = abilityCooldowns.value;

  const visibleAbilities = useMemo(() => 
    abilityData.filter(a => visibleSlots.includes(a.slot)),
    [visibleSlots]
  );

  return (
    <div class="ability-buttons">
      {visibleAbilities.map(ability => {
        const cooldown = cooldowns.find(c => c.slot === ability.slot) || {
          slot: ability.slot,
          remaining: 0,
          total: 0,
          ready: true,
        };

        return (
          <AbilityButton
            key={ability.slot}
            slot={ability.slot}
            icon={ability.icon}
            label={ability.label}
            color={ability.color}
            cooldown={cooldown}
            onClick={onActivateAbility}
            small={ability.slot !== 0}
          />
        );
      })}
    </div>
  );
}

export default AbilityButtons;
