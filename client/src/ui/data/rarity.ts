/**
 * Данные редкости для UI компонентов
 * Централизованное место для избежания дублирования (DRY)
 */

export interface RarityData {
  id: number;
  name: string;
  color: string;
}

export const RARITY_DATA: RarityData[] = [
  { id: 0, name: 'Обычный', color: '#6b7280' },
  { id: 1, name: 'Редкий', color: '#3b82f6' },
  { id: 2, name: 'Эпический', color: '#a855f7' },
];

export function getRarityById(id: number): RarityData | undefined {
  return RARITY_DATA.find(r => r.id === id);
}

export function getRarityName(id: number): string {
  return getRarityById(id)?.name ?? 'Неизвестный';
}

export function getRarityColor(id: number): string {
  return getRarityById(id)?.color ?? '#888888';
}
