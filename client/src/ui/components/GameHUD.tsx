/**
 * HUD компонент — игровой интерфейс во время матча
 * Обновления через Preact Signals (реактивные)
 */

import { Fragment } from 'preact';
import { useEffect } from 'preact/hooks';
import { injectStyles } from '../utils/injectStyles';
import {
  localPlayer,
  matchTimer,
  leaderboard,
  activeBoost,
  showHud,
  isPlayerDead,
  gamePhase,
  levelThresholds,
  minSlimeMass,
} from '../signals/gameState';

// ========== Стили ==========

const styles = `
  .game-hud {
    position: fixed;
    pointer-events: none;
    z-index: 50;
    font-family: "IBM Plex Mono", "Courier New", monospace;
    color: #e6f3ff;
  }

  .hud-top-left {
    top: calc(12px + env(safe-area-inset-top, 0px));
    left: calc(12px + env(safe-area-inset-left, 0px));
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    font-size: 13px;
    line-height: 1.5;
    min-width: 200px;
  }

  .hud-top-center {
    position: fixed;
    top: calc(12px + env(safe-area-inset-top, 0px));
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
  }

  .hud-timer {
    font-size: 24px;
    font-weight: bold;
    color: #fff;
  }

  .hud-phase {
    font-size: 14px;
    color: #6fd6ff;
    margin-top: 4px;
  }

  .hud-kills {
    font-size: 16px;
    color: #ff4d4d;
    font-weight: bold;
    margin-top: 4px;
  }

  .hud-boost-panel {
    position: fixed;
    top: calc(12px + env(safe-area-inset-top, 0px));
    left: calc(260px + env(safe-area-inset-left, 0px));
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    font-size: 12px;
  }

  .boost-icon {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
  }

  .hud-stat-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .hud-stat-label {
    color: #8aa4c8;
  }

  .hud-stat-value {
    font-weight: 600;
  }

  .hud-level-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }

  .hud-level-star {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: #1a1a2e;
    background: linear-gradient(135deg, #ffd700, #ffaa00);
    border-radius: 50%;
    width: 20px;
    height: 20px;
    box-shadow: 0 0 4px rgba(255, 215, 0, 0.5);
    flex-shrink: 0;
  }

  .hud-xp-bar {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .hud-xp-fill {
    height: 100%;
    background: linear-gradient(90deg, #ffd700, #ffaa00);
    transition: width 0.3s ease;
  }

  .hud-leaderboard {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .leaderboard-entry {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
    font-size: 12px;
  }

  .leaderboard-entry.is-local {
    color: #9be070;
    font-weight: 600;
  }

  .leaderboard-place {
    width: 20px;
    color: #ffc857;
  }

  .leaderboard-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-right: 8px;
  }

  .leaderboard-mass {
    min-width: 50px;
    text-align: right;
  }

  .death-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(10, 10, 20, 0.85);
    z-index: 80;
    pointer-events: auto;
  }

  .death-title {
    font-size: 36px;
    font-weight: 700;
    color: #ff4d4d;
    text-shadow: 0 0 20px rgba(255, 77, 77, 0.5);
    margin-bottom: 16px;
  }

  .death-respawn {
    font-size: 18px;
    color: #6fd6ff;
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* === MOBILE: компактный HUD === */
  @media (max-width: 768px) {
    .hud-top-left {
      padding: 8px 10px;
      font-size: 11px;
      min-width: 160px;
      border-radius: 8px;
    }

    .hud-top-center {
      top: calc(8px + env(safe-area-inset-top, 0px));
    }

    .hud-timer {
      font-size: 18px;
    }

    .hud-phase {
      font-size: 11px;
    }

    .hud-boost-panel {
      left: auto;
      right: calc(12px + env(safe-area-inset-right, 0px));
      top: auto;
      bottom: calc(80px + env(safe-area-inset-bottom, 0px));
      padding: 4px 8px;
      font-size: 10px;
    }

    .boost-icon {
      width: 22px;
      height: 22px;
      font-size: 12px;
    }

    .hud-level-row {
      gap: 4px;
      margin-bottom: 4px;
    }

    .hud-level-star {
      width: 18px;
      height: 18px;
      font-size: 10px;
    }

    .hud-xp-bar {
      height: 5px;
    }

    .hud-stat-row {
      margin-bottom: 2px;
    }

    .leaderboard-entry {
      font-size: 10px;
    }

    .leaderboard-place {
      width: 16px;
    }

    .leaderboard-mass {
      min-width: 40px;
    }

    .death-title {
      font-size: 28px;
    }

    .death-respawn {
      font-size: 14px;
    }
  }

  /* === PORTRAIT: убираем лидерборд === */
  @media (max-width: 480px) and (orientation: portrait) {
    .hud-top-left {
      min-width: 140px;
      font-size: 10px;
    }

    .hud-leaderboard {
      display: none;
    }

    .hud-boost-panel {
      bottom: calc(200px + env(safe-area-inset-bottom, 0px));
    }
  }
`;

const STYLES_ID = 'hud-styles';

// ========== Утилиты ==========

function formatTime(seconds: number): string {
  // Math.ceil чтобы таймер показывал 0:01 при 0 < seconds <= 1
  // При seconds = 0 показывает 0:00
  const totalSeconds = Math.ceil(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatMass(mass: number): string {
  if (mass >= 10000) {
    return `${(mass / 1000).toFixed(1)}k`;
  }
  return Math.floor(mass).toString();
}

// ========== Компоненты ==========

/**
 * Вычисляет прогресс до следующего уровня.
 * Формула: (масса - minMass) / (nextThreshold - minMass) * 100%
 * minMass берётся из сигнала minSlimeMass (physics.minSlimeMass)
 *
 * При достижении порога масса = nextThreshold → прогресс = 100%
 */
function getLevelProgress(level: number, mass: number): number {
  const thresholds = levelThresholds.value;
  // thresholds = [minMass, threshold1, threshold2, ...]
  // thresholds = [50, 100, 180, 300, 500, 800, 1200]
  if (!thresholds || thresholds.length < 2) return 0;

  const minMass = minSlimeMass.value;

  // Порог следующего уровня
  // level 1 → thresholds[2] = 180
  // level 2 → thresholds[3] = 300
  const nextThreshold = thresholds[level + 1];

  // Максимальный уровень — прогресс 100%
  if (!nextThreshold) {
    return 100;
  }

  // Правильная формула: прогресс от minMass до nextThreshold
  // При mass = minMass → 0%, при mass = nextThreshold → 100%
  const range = nextThreshold - minMass;
  if (range <= 0) return 100;

  const progress = ((mass - minMass) / range) * 100;
  return Math.min(100, Math.max(0, progress));
}

function PlayerStats() {
  const player = localPlayer.value;
  if (!player) return null;

  const levelProgress = getLevelProgress(player.level, player.mass);

  return (
    <div class="hud-stats">
      {/* Уровень со звёздочкой и прогресс-баром */}
      <div class="hud-level-row">
        <span class="hud-level-star">{player.level}</span>
        <div class="hud-xp-bar">
          <div class="hud-xp-fill" style={{ width: `${levelProgress}%` }} />
        </div>
      </div>
      {/* Масса */}
      <div class="hud-stat-row">
        <span class="hud-stat-label">Масса:</span>
        <span class="hud-stat-value">{formatMass(player.mass)} кг</span>
      </div>
      {/* Убийства */}
      <div class="hud-stat-row">
        <span class="hud-stat-label">Убийства:</span>
        <span class="hud-stat-value" style={{ color: '#ff4d4d' }}>{player.kills}</span>
      </div>
    </div>
  );
}

function Leaderboard() {
  const entries = leaderboard.value.slice(0, 5);
  if (entries.length === 0) return null;

  return (
    <div class="hud-leaderboard">
      {entries.map((entry) => (
        <div key={entry.place} class={`leaderboard-entry ${entry.isLocal ? 'is-local' : ''}`}>
          <span class="leaderboard-place">{entry.place}.</span>
          <span class="leaderboard-name">{entry.name}</span>
          <span class="leaderboard-mass">{formatMass(entry.mass)}</span>
        </div>
      ))}
    </div>
  );
}

function BoostPanel() {
  const boost = activeBoost.value;
  if (!boost || !boost.active) return null;

  // Для charge-based бустов (guard/greed) показываем заряды, иначе секунды
  const displayValue = boost.isChargeBased
    ? `×${Math.max(0, Math.floor(boost.timeLeft))}`
    : `${Math.ceil(boost.timeLeft)}с`;

  return (
    <div class="hud-boost-panel">
      <div class="boost-icon" style={{ background: boost.color, color: '#0b0f14' }}>
        {boost.icon}
      </div>
      <div>
        <div style={{ fontWeight: 600 }}>{boost.type}</div>
        <div style={{ color: '#8aa4c8' }}>{displayValue}</div>
      </div>
    </div>
  );
}

function MatchTimer() {
  const timer = matchTimer.value;

  return (
    <div class="hud-top-center game-hud">
      <div class="hud-timer">{formatTime(timer.timeLeft)}</div>
      {timer.phase && <div class="hud-phase">{timer.phase}</div>}
    </div>
  );
}

function DeathOverlay() {
  // Показываем только если:
  // 1. Игрок мёртв (FLAG_IS_DEAD)
  // 2. Фаза матча = "playing" (не показываем в waiting/results)
  if (!isPlayerDead.value || gamePhase.value !== 'playing') return null;

  return (
    <div class="death-overlay">
      <div class="death-title">💀 Вы погибли</div>
      <div class="death-respawn">Возрождение...</div>
    </div>
  );
}

// ========== Главный компонент HUD ==========

export function GameHUD() {
  // Preact Signals автоматически вызывают перерендер при изменении
  // Убран forceUpdate — signals реактивны (fix slime-arena-foh)
  useEffect(() => {
    injectStyles(STYLES_ID, styles);
  }, []);

  if (!showHud.value) return null;

  return (
    <Fragment>
      {/* Top Left Panel - Stats & Leaderboard */}
      <div class="hud-top-left game-hud">
        <PlayerStats />
        <Leaderboard />
      </div>

      {/* Top Center - Timer */}
      <MatchTimer />

      {/* Boost Panel */}
      <BoostPanel />

      {/* Death Overlay */}
      <DeathOverlay />
    </Fragment>
  );
}

export default GameHUD;
