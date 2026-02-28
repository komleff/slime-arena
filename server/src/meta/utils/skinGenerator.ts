/**
 * Генератор случайных скинов для мета-сервера.
 *
 * Функции здесь используют Math.random() — это допустимо,
 * поскольку они вызываются ТОЛЬКО из мета-слоя (routes/services),
 * а НЕ из игровой симуляции.
 *
 * Детерминированные функции скинов остаются в utils/generators/skinGenerator.ts.
 */

import { getBasicSkins } from '../../utils/generators/skinGenerator.js';

/**
 * Генерирует случайный базовый скин для нового игрока.
 * Использует Math.random(), поэтому НЕ детерминирован.
 * ТОЛЬКО ДЛЯ МЕТАСЕРВЕРА - не использовать в игровой симуляции!
 *
 * @returns skinId случайного базового скина
 */
export function generateRandomBasicSkin(): string {
  const basicSkins = getBasicSkins();

  if (basicSkins.length === 0) {
    throw new Error('No basic skins found in config/skins.json');
  }

  const randomIndex = Math.floor(Math.random() * basicSkins.length);
  return basicSkins[randomIndex].id;
}
