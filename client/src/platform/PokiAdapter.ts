/**
 * Адаптер авторизации для Poki.
 * Poki не предоставляет авторизацию пользователей — используем localStorage.
 */

import type { IAuthAdapter, PlatformCredentials, PlatformType } from './IAuthAdapter';

const STORAGE_KEY_USER_ID = 'poki_user_id';
const STORAGE_KEY_NICKNAME = 'poki_nickname';

// Расширение типов Poki SDK
declare global {
  interface Window {
    PokiSDK?: {
      rewardedBreak: () => Promise<boolean>;
      isAdBlocked: () => Promise<boolean>;
      gameLoadingFinished: () => void;
      commercialBreak: () => Promise<void>;
      happyTime: (intensity?: number) => void;
    };
  }
}

export class PokiAdapter implements IAuthAdapter {
  private userId: string;
  private nickname: string | null;

  constructor() {
    // Загружаем или генерируем userId
    let storedUserId: string | null = null;
    try {
      storedUserId = localStorage.getItem(STORAGE_KEY_USER_ID);
    } catch (err) {
      console.warn('[PokiAdapter] localStorage недоступен:', err);
    }

    if (!storedUserId) {
      storedUserId = this.generateUserId();
      try {
        localStorage.setItem(STORAGE_KEY_USER_ID, storedUserId);
      } catch (err) {
        console.warn('[PokiAdapter] Не удалось сохранить userId:', err);
      }
    }
    this.userId = storedUserId;

    // Загружаем nickname
    try {
      this.nickname = localStorage.getItem(STORAGE_KEY_NICKNAME);
    } catch (err) {
      console.warn('[PokiAdapter] Не удалось загрузить nickname:', err);
      this.nickname = null;
    }
  }

  getPlatformType(): PlatformType {
    return 'poki';
  }

  isAvailable(): boolean {
    return !!(typeof window !== 'undefined' && window.PokiSDK);
  }

  async getCredentials(): Promise<PlatformCredentials> {
    // Формат: "userId:nickname" (аналогично StandaloneAdapter)
    const nickname = this.nickname?.trim() || 'PokiPlayer';
    const platformData = `${this.userId}:${nickname}`;

    return {
      platformType: 'poki',
      platformData,
      nickname,
    };
  }

  getNickname(): string | null {
    return this.nickname;
  }

  /**
   * Установить nickname (сохраняется в localStorage).
   */
  setNickname(nickname: string): void {
    this.nickname = nickname;
    try {
      localStorage.setItem(STORAGE_KEY_NICKNAME, nickname);
    } catch (err) {
      console.warn('[PokiAdapter] Не удалось сохранить nickname:', err);
    }
  }

  /**
   * Получить userId.
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Сгенерировать уникальный userId.
   */
  private generateUserId(): string {
    // Формат: poki_<timestamp>_<random>
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `poki_${timestamp}_${random}`;
  }

  /**
   * Запросить интерактивную авторизацию.
   * Poki не поддерживает авторизацию пользователей.
   *
   * @returns false — интерактивная авторизация недоступна
   */
  async requestAuth(): Promise<boolean> {
    // Poki не предоставляет авторизацию пользователей
    return false;
  }

  /**
   * Уведомить Poki о завершении загрузки игры.
   * Вызывать после полной инициализации игры (загрузка ассетов, состояния).
   *
   * P1: Вынесено из конструктора — gameLoadingFinished() должен
   * вызываться когда игра полностью готова к игре.
   */
  notifyGameLoaded(): void {
    if (this.isAvailable() && window.PokiSDK) {
      window.PokiSDK.gameLoadingFinished();
      console.log('[PokiAdapter] gameLoadingFinished() called');
    }
  }

  /**
   * Вызвать happyTime для Poki (при победе/достижении).
   */
  happyTime(intensity: number = 1): void {
    if (this.isAvailable() && window.PokiSDK) {
      window.PokiSDK.happyTime(intensity);
    }
  }
}
