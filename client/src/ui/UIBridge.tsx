/**
 * UIBridge — мост между Canvas игрой и Preact UI
 * Обеспечивает синхронизацию состояния без изменения основного game loop
 */

import { render, Fragment } from 'preact';
import { batch } from '@preact/signals';
import {
  // State
  gamePhase,
  showTalentModal,
  activeBoost,
  selectedClassId,
  playerName,
  isConnected,
  connectionError,
  hudVisible,
  
  // Actions
  setGamePhase,
  updateLocalPlayer,
  updateLeaderboard,
  updateMatchTimer,
  setTalentChoices,
  clearTalentChoices,
  updateAbilityCooldown,
  setMatchResults,
  resetGameState,
  initMobileDetection,
  
  // Types
  type GamePhase,
  type PlayerStats,
  type LeaderboardEntry,
  type TalentChoice,
  type MatchTimerState,
  type BoostState,
} from './signals/gameState';

// Components
import { GameHUD } from './components/GameHUD';
import { TalentModal } from './components/TalentModal';
import { ResultsScreen } from './components/ResultsScreen';
import { AbilityButtons } from './components/AbilityButtons';
import { MainMenu } from './components/MainMenu';

// ========== Типы для колбеков ==========

export interface UICallbacks {
  onPlay: (name: string, classId: number) => void;
  onSelectTalent: (talentId: string, index: number) => void;
  onActivateAbility: (slot: number) => void;
  onPlayAgain: (classId: number) => void;
  onExit: () => void;
}

// ========== Контейнер UI ==========

let uiContainer: HTMLElement | null = null;
let callbacks: UICallbacks | null = null;
let isConnecting = false;
let cleanupMobileDetection: (() => void) | null = null;

function UIRoot() {
  const phase = gamePhase.value;

  return (
    <Fragment>
      {/* Main Menu */}
      {phase === 'menu' && callbacks && (
        <MainMenu 
          onPlay={callbacks.onPlay} 
          isConnecting={isConnecting}
        />
      )}

      {/* Game HUD */}
      {(phase === 'playing' || phase === 'waiting') && (
        <Fragment>
          <GameHUD />
          {callbacks && (
            <AbilityButtons onActivateAbility={callbacks.onActivateAbility} />
          )}
        </Fragment>
      )}

      {/* Talent Modal */}
      {showTalentModal.value && callbacks && (
        <TalentModal onSelectTalent={callbacks.onSelectTalent} />
      )}

      {/* Results Screen */}
      {phase === 'results' && callbacks && (
        <ResultsScreen 
          onPlayAgain={callbacks.onPlayAgain}
          onExit={callbacks.onExit}
        />
      )}
    </Fragment>
  );
}

// ========== Публичный API ==========

/**
 * Инициализация UI системы
 */
export function initUI(container: HTMLElement, cbs: UICallbacks): void {
  uiContainer = container;
  callbacks = cbs;

  // Инициализируем детекцию мобильных и сохраняем cleanup
  cleanupMobileDetection = initMobileDetection();

  // Первый рендер
  renderUI();
}

/**
 * Рендер UI (вызывается при изменении состояния)
 */
export function renderUI(): void {
  if (!uiContainer) return;
  render(<UIRoot />, uiContainer);
}

/**
 * Размонтирование UI
 */
export function destroyUI(): void {
  // Очистка event listeners от mobile detection
  if (cleanupMobileDetection) {
    cleanupMobileDetection();
    cleanupMobileDetection = null;
  }

  if (uiContainer) {
    render(null, uiContainer);
    uiContainer = null;
  }
  callbacks = null;
}

// ========== Синхронизация состояния ==========

/**
 * Обновление состояния игрока из game loop
 * Вызывается из main.ts на каждом HUD-тике (10 Hz)
 */
export function syncPlayerState(stats: PlayerStats | null | undefined): void {
  if (!stats) return;
  updateLocalPlayer(stats);
}

/**
 * Обновление таблицы лидеров
 */
export function syncLeaderboard(entries: LeaderboardEntry[] | null | undefined): void {
  if (!entries || !Array.isArray(entries)) return;
  updateLeaderboard(entries);
}

/**
 * Обновление таймера матча
 */
export function syncMatchTimer(timer: MatchTimerState | null | undefined): void {
  if (!timer) return;
  updateMatchTimer(timer);
}

/**
 * Показать выбор талантов
 */
export function showTalentChoices(
  choices: TalentChoice[] | null | undefined,
  queueSize: number,
  timerSeconds: number
): void {
  if (!choices || !Array.isArray(choices)) return;
  setTalentChoices(choices, queueSize, timerSeconds);
}

/**
 * Скрыть выбор талантов
 */
export function hideTalentChoices(): void {
  clearTalentChoices();
}

/**
 * Обновить кулдаун способности
 */
export function syncAbilityCooldown(slot: number, remaining: number, total: number): void {
  if (typeof slot !== 'number' || slot < 0 || slot > 2) return;
  updateAbilityCooldown(slot, remaining, total);
}

/**
 * Установить активный буст
 */
export function syncBoost(boost: BoostState | null): void {
  activeBoost.value = boost;
}

/**
 * Установить фазу игры
 */
export function setPhase(phase: GamePhase): void {
  setGamePhase(phase);
}

/**
 * Установить статус подключения
 */
export function setConnected(connected: boolean, error?: string): void {
  batch(() => {
    isConnected.value = connected;
    connectionError.value = error || null;
    isConnecting = false;
  });
}

/**
 * Установить статус "подключаемся"
 */
export function setConnecting(connecting: boolean): void {
  isConnecting = connecting;
  renderUI();
}

/**
 * Показать результаты матча
 */
export function showResults(results: {
  winner: string;
  finalLeaderboard: LeaderboardEntry[];
  personalStats: PlayerStats | null;
  nextMatchTimer: number;
}): void {
  setMatchResults(results);
}

/**
 * Скрыть/показать HUD
 */
export function setHudVisible(visible: boolean): void {
  hudVisible.value = visible;
}

/**
 * Сброс состояния игры
 */
export function resetUI(): void {
  resetGameState();
}

/**
 * Получить выбранный класс
 */
export function getSelectedClass(): number {
  return selectedClassId.value;
}

/**
 * Получить имя игрока
 */
export function getPlayerName(): string {
  return playerName.value;
}

// ========== Экспорт типов ==========

export type {
  GamePhase,
  PlayerStats,
  LeaderboardEntry,
  TalentChoice,
  MatchTimerState,
  BoostState,
};
