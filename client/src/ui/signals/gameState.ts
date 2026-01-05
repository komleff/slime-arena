/**
 * Глобальное состояние игры через Preact Signals
 * Обеспечивает реактивные обновления UI без лишних рендеров
 */

import { signal, computed, batch } from '@preact/signals';
import { FLAG_IS_DEAD } from '@slime-arena/shared';

// ========== Типы ==========

export type GamePhase = 'menu' | 'connecting' | 'waiting' | 'playing' | 'results';
export type ScreenType = 'main-menu' | 'lobby' | 'game' | 'results' | 'settings' | 'shop' | 'profile';
export type ModalType = 'talent' | 'pause' | 'confirm-exit' | 'settings';

export interface PlayerStats {
  name: string;
  mass: number;
  kills: number;
  maxMass: number;
  level: number;
  xp: number;
  classId: number;
  flags: number;
}

export interface LeaderboardEntry {
  name: string;
  mass: number;
  kills: number;
  isLocal: boolean;
  place: number;
}

export interface TalentChoice {
  id: string;
  name: string;
  icon: string;
  description: string;
  rarity: number;
}

export interface AbilityCooldown {
  slot: number;
  remaining: number;
  total: number;
  ready: boolean;
}

export interface MatchTimerState {
  phase: string;
  timeLeft: number;
  totalTime: number;
}

export interface BoostState {
  active: boolean;
  type: string;
  icon: string;
  color: string;
  timeLeft: number;
}

// ========== Сигналы состояния ==========

// Фаза игры
export const gamePhase = signal<GamePhase>('menu');

// Текущий экран и модальное окно
export const currentScreen = signal<ScreenType>('main-menu');
export const activeModal = signal<ModalType | null>(null);
export const screenStack = signal<ScreenType[]>(['main-menu']);

// Подключение
export const isConnected = signal(false);
export const isConnecting = signal(false);
export const connectionError = signal<string | null>(null);
export const serverUrl = signal('');

// Константы
export const MAX_ABILITY_SLOTS = 3;

// Игрок
export const localPlayer = signal<PlayerStats | null>(null);
export const selectedClassId = signal(0);
export const playerName = signal('');

// Матч
export const matchTimer = signal<MatchTimerState>({ phase: '', timeLeft: 0, totalTime: 0 });
export const leaderboard = signal<LeaderboardEntry[]>([]);
export const playerCount = signal(0);

// Таланты
export const talentChoices = signal<TalentChoice[]>([]);
export const talentQueueSize = signal(0);
export const talentTimerSeconds = signal(0);
export const showTalentModal = signal(false);

// Способности
export const abilityCooldowns = signal<AbilityCooldown[]>([
  { slot: 0, remaining: 0, total: 0, ready: true },
  { slot: 1, remaining: 0, total: 0, ready: true },
  { slot: 2, remaining: 0, total: 0, ready: true },
]);

// Буст
export const activeBoost = signal<BoostState | null>(null);

// Результаты матча
export const matchResults = signal<{
  winner: string;
  finalLeaderboard: LeaderboardEntry[];
  personalStats: PlayerStats | null;
  nextMatchTimer: number;
} | null>(null);

// UI состояние
export const hudVisible = signal(true);
export const isMobile = signal(false);
export const safeAreaInsets = signal({ top: 0, bottom: 0, left: 0, right: 0 });

// ========== Вычисляемые значения ==========

export const isInGame = computed(() => 
  gamePhase.value === 'playing' || gamePhase.value === 'waiting'
);

export const showHud = computed(() => 
  isInGame.value && hudVisible.value && localPlayer.value !== null
);

export const isPlayerDead = computed(() => {
  const player = localPlayer.value;
  if (!player) return false;
  return (player.flags & FLAG_IS_DEAD) !== 0;
});

export const hasTalentPending = computed(() => 
  talentChoices.value.length > 0 && talentQueueSize.value > 0
);

export const currentPlace = computed(() => {
  const player = localPlayer.value;
  if (!player) return 0;
  const entry = leaderboard.value.find(e => e.isLocal);
  return entry?.place ?? 0;
});

// ========== Действия ==========

export function setGamePhase(phase: GamePhase) {
  batch(() => {
    gamePhase.value = phase;

    // Автоматически переключаем экраны при смене фазы
    switch (phase) {
      case 'menu':
        currentScreen.value = 'main-menu';
        screenStack.value = ['main-menu'];
        break;
      case 'connecting':
      case 'waiting':
        currentScreen.value = 'lobby';
        break;
      case 'playing':
        currentScreen.value = 'game';
        break;
      case 'results':
        currentScreen.value = 'results';
        break;
    }
  });
}

export function pushScreen(screen: ScreenType) {
  const stack = [...screenStack.value];
  if (stack[stack.length - 1] !== screen) {
    stack.push(screen);
    screenStack.value = stack;
    currentScreen.value = screen;
  }
}

export function popScreen(): ScreenType | null {
  const stack = [...screenStack.value];
  if (stack.length > 1) {
    stack.pop();
    screenStack.value = stack;
    currentScreen.value = stack[stack.length - 1];
    return currentScreen.value;
  }
  return null;
}

export function openModal(modal: ModalType) {
  activeModal.value = modal;
}

export function closeModal() {
  activeModal.value = null;
}

export function updateLocalPlayer(stats: Partial<PlayerStats>) {
  const current = localPlayer.value;
  if (current) {
    localPlayer.value = { ...current, ...stats };
  } else {
    localPlayer.value = {
      name: '',
      mass: 100,
      kills: 0,
      maxMass: 100,
      level: 1,
      xp: 0,
      classId: 0,
      flags: 0,
      ...stats,
    };
  }
}

export function updateLeaderboard(entries: LeaderboardEntry[]) {
  leaderboard.value = entries;
}

export function updateMatchTimer(timer: MatchTimerState) {
  matchTimer.value = timer;
}

export function setTalentChoices(choices: TalentChoice[], queueSize: number, timerSeconds: number) {
  batch(() => {
    talentChoices.value = choices;
    talentQueueSize.value = queueSize;
    talentTimerSeconds.value = timerSeconds;
    showTalentModal.value = choices.length > 0;
  });
}

export function clearTalentChoices() {
  batch(() => {
    talentChoices.value = [];
    talentQueueSize.value = 0;
    talentTimerSeconds.value = 0;
    showTalentModal.value = false;
  });
}

export function updateAbilityCooldown(slot: number, remaining: number, total: number) {
  const cooldowns = [...abilityCooldowns.value];
  const idx = cooldowns.findIndex(c => c.slot === slot);
  if (idx !== -1) {
    cooldowns[idx] = { slot, remaining, total, ready: remaining <= 0 };
    abilityCooldowns.value = cooldowns;
  }
}

export function setMatchResults(results: typeof matchResults.value) {
  matchResults.value = results;
  if (results) {
    setGamePhase('results');
  }
}

export function resetGameState() {
  batch(() => {
    gamePhase.value = 'menu';
    currentScreen.value = 'main-menu';
    screenStack.value = ['main-menu'];
    activeModal.value = null;
    localPlayer.value = null;
    matchTimer.value = { phase: '', timeLeft: 0, totalTime: 0 };
    leaderboard.value = [];
    talentChoices.value = [];
    talentQueueSize.value = 0;
    abilityCooldowns.value = [
      { slot: 0, remaining: 0, total: 0, ready: true },
      { slot: 1, remaining: 0, total: 0, ready: true },
      { slot: 2, remaining: 0, total: 0, ready: true },
    ];
    activeBoost.value = null;
    matchResults.value = null;
  });
}

// ========== Инициализация ==========

/**
 * Инициализирует детекцию мобильного устройства и safe area.
 * @returns Функция очистки для удаления event listeners
 */
export function initMobileDetection(): () => void {
  const mediaQuery = window.matchMedia('(pointer: coarse)');

  const checkMobile = () => {
    isMobile.value = mediaQuery.matches;
  };

  checkMobile();
  mediaQuery.addEventListener('change', checkMobile);

  // Safe area insets через visualViewport API
  const updateSafeArea = () => {
    const viewport = window.visualViewport;
    if (viewport) {
      const dpr = window.devicePixelRatio || 1;
      const top = viewport.offsetTop;
      const left = viewport.offsetLeft;
      const rightDiff = window.innerWidth - viewport.width - viewport.offsetLeft;
      const bottomDiff = window.innerHeight - viewport.height - viewport.offsetTop;
      const right = Math.max(0, Math.round(rightDiff * dpr) / dpr);
      const bottom = Math.max(0, Math.round(bottomDiff * dpr) / dpr);
      safeAreaInsets.value = { top, bottom, left, right };
    } else {
      safeAreaInsets.value = { top: 0, bottom: 0, left: 0, right: 0 };
    }
  };

  updateSafeArea();
  window.addEventListener('resize', updateSafeArea);

  // Возвращаем cleanup функцию
  return () => {
    mediaQuery.removeEventListener('change', checkMobile);
    window.removeEventListener('resize', updateSafeArea);
  };
}
