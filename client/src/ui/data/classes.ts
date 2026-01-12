/**
 * Данные классов персонажей для UI компонентов
 * Централизованное место для избежания дублирования (DRY)
 */

export interface ClassData {
  id: number;
  name: string;
  icon: string;
  cssClass: string;
  color: string;
}

export const CLASSES_DATA: ClassData[] = [
  { id: 0, name: 'Охотник', icon: '🎯', cssClass: 'hunter', color: '#4ade80' },
  { id: 1, name: 'Воин', icon: '⚔️', cssClass: 'warrior', color: '#f87171' },
  { id: 2, name: 'Собиратель', icon: '💎', cssClass: 'collector', color: '#60a5fa' },
];

export function getClassById(id: number): ClassData | undefined {
  return CLASSES_DATA.find(c => c.id === id);
}

export function getClassName(id: number): string {
  return getClassById(id)?.name ?? 'Неизвестный';
}

export function getClassColor(id: number): string {
  return getClassById(id)?.color ?? '#888888';
}
