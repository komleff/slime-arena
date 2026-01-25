/**
 * Генератор случайных скинов для новых игроков.
 * Использует конфигурацию из config/skins.json.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Rng } from '../rng.js';

interface Skin {
  id: string;
  name: string;
  tier: 'basic' | 'rare' | 'epic' | 'legendary';
  price: number;
  color: string;
}

interface SkinsConfig {
  skins: Skin[];
}

let skinsConfig: SkinsConfig | null = null;

/**
 * Загружает конфигурацию скинов из config/skins.json.
 * Результат кешируется для последующих вызовов.
 */
function loadSkinsConfig(): SkinsConfig {
  if (skinsConfig === null) {
    const configPath = join(__dirname, '../../../../config', 'skins.json');
    const configData = readFileSync(configPath, 'utf-8');
    skinsConfig = JSON.parse(configData) as SkinsConfig;
  }
  return skinsConfig!;
}

/**
 * Возвращает список всех базовых скинов (tier: basic).
 */
export function getBasicSkins(): Skin[] {
  const config = loadSkinsConfig();
  return config.skins.filter(skin => skin.tier === 'basic');
}

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

/**
 * Генерирует детерминированный базовый скин на основе seed.
 * Использует детерминированный генератор Rng.
 *
 * @param seed - число для инициализации генератора
 * @returns skinId базового скина
 */
export function generateBasicSkin(seed: number): string {
  const basicSkins = getBasicSkins();

  if (basicSkins.length === 0) {
    throw new Error('No basic skins found in config/skins.json');
  }

  const rng = new Rng(seed);
  const randomValue = rng.next();
  const index = Math.floor(randomValue * basicSkins.length);
  return basicSkins[index].id;
}

/**
 * Проверяет, существует ли скин с указанным ID.
 *
 * @param skinId - идентификатор скина
 * @returns true если скин существует, false иначе
 */
export function skinExists(skinId: string): boolean {
  const config = loadSkinsConfig();
  return config.skins.some(skin => skin.id === skinId);
}

/**
 * Получает информацию о скине по ID.
 *
 * @param skinId - идентификатор скина
 * @returns объект скина или null если не найден
 */
export function getSkinById(skinId: string): Skin | null {
  const config = loadSkinsConfig();
  return config.skins.find(skin => skin.id === skinId) || null;
}
