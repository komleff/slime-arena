/**
 * HUD компонент — игровой интерфейс во время матча
 * Оптимизирован: обновления throttled до 10 Hz
 */

import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
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
    gap: 8px;
    margin-bottom: 6px;
  }

  .hud-level-text {
    font-weight: 600;
    color: #9be070;
    min-width: 50px;
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
    background: linear-gradient(90deg, #4ade80, #22c55e);
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

/**
 * Вычисляет прогресс до следующего уровня (0-100%)
 * Использует levelThresholds сигнал для поддержки runtime config updates
 */
function getLevelProgress(mass: number, level: number): number {
  const thresholds = levelThresholds.value;
  const currentThreshold = thresholds[level] ?? thresholds[6] * Math.pow(1.5, level - 6);
  const nextThreshold = thresholds[level + 1] ?? currentThreshold * 1.5;
  const progress = ((mass - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
  return Math.max(0, Math.min(100, progress));
}

// ========== Компоненты ==========

function PlayerStats() {
  const player = localPlayer.value;
  if (!player) return null;

  const progress = getLevelProgress(player.mass, player.level);

  return (
    <div class="hud-stats">
      {/* Уровень с прогресс-баром */}
      <div class="hud-level-row">
        <span class="hud-level-text">Ур. {player.level}</span>
        <div class="hud-xp-bar">
          <div class="hud-xp-fill" style={{ width: `${progress}%` }}></div>
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
  // Throttled обновления (10 Hz) через setInterval для точного throttling
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    injectStyles(STYLES_ID, styles);

    const intervalId = window.setInterval(() => {
      forceUpdate(n => n + 1);
    }, 100); // 10 Hz

    return () => clearInterval(intervalId);
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
