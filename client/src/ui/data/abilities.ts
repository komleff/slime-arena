/**
 * Данные способностей для UI компонентов
 * Централизованное место для избежания дублирования (DRY)
 */

export interface AbilityData {
  slot: number;
  icon: string;
  label: string;
  color: string;
}

/**
 * Маппинг abilityId → иконка.
 * Синхронизировано с abilityNames в main.ts.
 */
export const ABILITY_ICON_MAP: Record<string, string> = {
  dash: '⚡',
  shield: '🛡️',
  slow: '❄️',
  pull: '🧲',
  projectile: '💥',
  spit: '💦',
  bomb: '💣',
  push: '💨',
  mine: '💀',
};

/**
 * Цвета для слотов умений
 */
export const SLOT_COLORS: Record<number, string> = {
  0: '#4fc3f7',
  1: '#c74ff7',
  2: '#f7c74f',
};

/**
 * Получить иконку по abilityId
 */
export function getAbilityIcon(abilityId: string | undefined | null): string {
  if (!abilityId) return '❓';
  return ABILITY_ICON_MAP[abilityId] ?? '❓';
}

/**
 * Получить цвет слота
 */
export function getSlotColor(slot: number): string {
  return SLOT_COLORS[slot] ?? '#888888';
}

// Legacy — для обратной совместимости
export const ABILITIES_DATA: AbilityData[] = [
  { slot: 0, icon: '⚡', label: '1', color: '#4fc3f7' },
  { slot: 1, icon: '💥', label: '2', color: '#c74ff7' },
  { slot: 2, icon: '🛡️', label: '3', color: '#f7c74f' },
];

export function getAbilityBySlot(slot: number): AbilityData | undefined {
  return ABILITIES_DATA.find(a => a.slot === slot);
}

export function getAbilityColor(slot: number): string {
  return getAbilityBySlot(slot)?.color ?? '#888888';
}
