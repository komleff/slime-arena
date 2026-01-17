/**
 * AbilityButtons — кнопки способностей с визуализацией кулдауна
 */

// JSX runtime imported automatically via jsxImportSource
import type { JSX } from 'preact';
import { useCallback, useMemo } from 'preact/hooks';
import { injectStyles } from '../utils/injectStyles';
import { abilityCooldowns, abilitySlots, type AbilityCooldown } from '../signals/gameState';
import { getAbilityIcon, getSlotColor } from '../data/abilities';

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

  /* === MOBILE: уменьшаем кнопки === */
  @media (max-width: 768px) {
    .ability-buttons {
      bottom: 12px;
      right: 12px;
      gap: 8px;
    }

    .ability-button {
      width: 56px;
      height: 56px;
      font-size: 22px;
      border-width: 2px;
    }

    .ability-button.small {
      width: 48px;
      height: 48px;
      font-size: 18px;
    }

    .ability-label {
      font-size: 11px;
      bottom: 1px;
      right: 4px;
    }

    .ability-timer {
      font-size: 12px;
    }
  }

  /* === PORTRAIT: вертикальное расположение === */
  @media (max-width: 480px) and (orientation: portrait) {
    .ability-buttons {
      flex-direction: column;
      bottom: auto;
      top: 50%;
      right: 8px;
      transform: translateY(-50%);
      gap: 6px;
    }

    .ability-button {
      width: 50px;
      height: 50px;
      font-size: 20px;
    }

    .ability-button.small {
      width: 44px;
      height: 44px;
      font-size: 16px;
    }
  }
`;

const STYLES_ID = 'ability-buttons-styles';

injectStyles(STYLES_ID, styles);

// ========== Компонент кнопки ==========

interface AbilityButtonProps {
  slot: number;
  icon: string;
  label: string;
  color: string;
  cooldown: AbilityCooldown;
  onActivate: (slot: number, pointerId: number) => void;
  small?: boolean;
}

function AbilityButton({ slot, icon, label, color, cooldown, onActivate, small }: AbilityButtonProps) {
  const handlePointerDown = useCallback((e: JSX.TargetedPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (cooldown.ready) {
      onActivate(slot, e.pointerId);
    }
  }, [slot, cooldown.ready, onActivate]);

  // useMemo для кэширования вычислений при частых ре-рендерах
  const { circumference, strokeDashoffset, displayTime } = useMemo(() => {
    // Early return когда нет кулдауна
    if (cooldown.remaining <= 0) {
      return { circumference: 0, strokeDashoffset: 0, displayTime: '0' };
    }
    
    const prog = cooldown.total > 0 
      ? Math.max(0, Math.min(1, cooldown.remaining / cooldown.total))
      : 0;
    const circ = 2 * Math.PI * 45;
    const offset = circ * (1 - prog);
    // Единая логика округления до одной десятой секунды
    const display = cooldown.remaining.toFixed(1);
    return { circumference: circ, strokeDashoffset: offset, displayTime: display };
  }, [cooldown.remaining, cooldown.total]);

  const isOnCooldown = cooldown.remaining > 0;

  return (
    <button
      class={`ability-button slot-${slot} ${cooldown.ready ? 'ready' : ''} ${small ? 'small' : ''}`}
      onPointerDown={handlePointerDown}
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
  onActivateAbility: (slot: number, pointerId: number) => void;
}

export function AbilityButtons({ onActivateAbility }: AbilityButtonsProps) {
  const cooldowns = abilityCooldowns.value;
  const slots = abilitySlots.value;

  // Собираем данные по слотам из сигнала abilitySlots
  const visibleAbilities = useMemo(() => {
    const abilities: { slot: number; abilityId: string; icon: string; label: string; color: string }[] = [];

    // Slot 0 — всегда есть (первичное умение)
    if (slots.slot0) {
      abilities.push({
        slot: 0,
        abilityId: slots.slot0,
        icon: getAbilityIcon(slots.slot0),
        label: '1',
        color: getSlotColor(0),
      });
    }

    // Slot 1 — появляется на уровне 3
    if (slots.slot1) {
      abilities.push({
        slot: 1,
        abilityId: slots.slot1,
        icon: getAbilityIcon(slots.slot1),
        label: '2',
        color: getSlotColor(1),
      });
    }

    // Slot 2 — появляется на уровне 5
    if (slots.slot2) {
      abilities.push({
        slot: 2,
        abilityId: slots.slot2,
        icon: getAbilityIcon(slots.slot2),
        label: '3',
        color: getSlotColor(2),
      });
    }

    return abilities;
  }, [slots.slot0, slots.slot1, slots.slot2]);

  // Не рендерим если нет умений
  if (visibleAbilities.length === 0) {
    return null;
  }

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
            onActivate={onActivateAbility}
            small={ability.slot !== 0}
          />
        );
      })}
    </div>
  );
}

export default AbilityButtons;
