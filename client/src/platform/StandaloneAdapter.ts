/**
 * Адаптер авторизации для Standalone режима (dev, iframe).
 * Использует localStorage для хранения userId и nickname.
 */

import type { IAuthAdapter, PlatformCredentials, PlatformType } from './IAuthAdapter';

const STORAGE_KEY_USER_ID = 'standalone_user_id';
const STORAGE_KEY_NICKNAME = 'standalone_nickname';

export class StandaloneAdapter implements IAuthAdapter {
  private userId: string;
  private nickname: string | null;

  constructor() {
    // Загружаем или генерируем userId (с защитой от incognito/iframe)
    let storedUserId: string | null = null;
    try {
      storedUserId = localStorage.getItem(STORAGE_KEY_USER_ID);
    } catch (err) {
      console.warn('[StandaloneAdapter] localStorage недоступен:', err);
    }

    if (!storedUserId) {
      storedUserId = this.generateUserId();
      try {
        localStorage.setItem(STORAGE_KEY_USER_ID, storedUserId);
      } catch (err) {
        console.warn('[StandaloneAdapter] Не удалось сохранить userId:', err);
      }
    }
    this.userId = storedUserId;

    // Загружаем nickname
    try {
      this.nickname = localStorage.getItem(STORAGE_KEY_NICKNAME);
    } catch (err) {
      console.warn('[StandaloneAdapter] Не удалось загрузить nickname:', err);
      this.nickname = null;
    }
  }

  getPlatformType(): PlatformType {
    return 'dev'; // DevAuthProvider на сервере ожидает 'dev'
  }

  isAvailable(): boolean {
    // Standalone всегда доступен как fallback
    return true;
  }

  async getCredentials(): Promise<PlatformCredentials> {
    // Формат: "userId:nickname" для DevAuthProvider на сервере
    // Если nickname нет, используем дефолтный
    const nickname = this.nickname || 'Player';
    const platformData = `${this.userId}:${nickname}`;

    return {
      platformType: 'dev',
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
      console.warn('[StandaloneAdapter] Не удалось сохранить nickname:', err);
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
    // Формат: standalone_<timestamp>_<random>
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `standalone_${timestamp}_${random}`;
  }

  /**
   * Сбросить данные пользователя (для тестирования).
   */
  reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_USER_ID);
      localStorage.removeItem(STORAGE_KEY_NICKNAME);
    } catch (err) {
      console.warn('[StandaloneAdapter] Не удалось очистить localStorage:', err);
    }
    this.userId = this.generateUserId();
    try {
      localStorage.setItem(STORAGE_KEY_USER_ID, this.userId);
    } catch (err) {
      console.warn('[StandaloneAdapter] Не удалось сохранить новый userId:', err);
    }
    this.nickname = null;
  }
}
