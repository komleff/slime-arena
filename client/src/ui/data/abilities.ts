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
