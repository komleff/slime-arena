/**
 * Адаптер авторизации для GameDistribution.
 * GameDistribution не предоставляет авторизацию пользователей — используем localStorage.
 */

import type { IAuthAdapter, PlatformCredentials, PlatformType } from './IAuthAdapter';

const STORAGE_KEY_USER_ID = 'gd_user_id';
const STORAGE_KEY_NICKNAME = 'gd_nickname';

// Расширение типов GameDistribution SDK
declare global {
  interface Window {
    gdsdk?: {
      showAd(type: 'interstitial' | 'rewarded'): Promise<void>;
      preloadAd(type: 'rewarded'): Promise<void>;
    };
    GD_OPTIONS?: {
      gameId: string;
      onEvent: (event: { name: string; message?: string }) => void;
    };
  }
}

export class GameDistributionAdapter implements IAuthAdapter {
  private userId: string;
  private nickname: string | null;

  constructor() {
    // Загружаем или генерируем userId
    let storedUserId: string | null = null;
    try {
      storedUserId = localStorage.getItem(STORAGE_KEY_USER_ID);
    } catch (err) {
      console.warn('[GameDistributionAdapter] localStorage недоступен:', err);
    }

    if (!storedUserId) {
      storedUserId = this.generateUserId();
      try {
        localStorage.setItem(STORAGE_KEY_USER_ID, storedUserId);
      } catch (err) {
        console.warn('[GameDistributionAdapter] Не удалось сохранить userId:', err);
      }
    }
    this.userId = storedUserId;

    // Загружаем nickname
    try {
      this.nickname = localStorage.getItem(STORAGE_KEY_NICKNAME);
    } catch (err) {
      console.warn('[GameDistributionAdapter] Не удалось загрузить nickname:', err);
      this.nickname = null;
    }
  }

  getPlatformType(): PlatformType {
    return 'gamedistribution';
  }

  isAvailable(): boolean {
    return !!(typeof window !== 'undefined' && (window.gdsdk || window.GD_OPTIONS));
  }

  async getCredentials(): Promise<PlatformCredentials> {
    // Формат: "userId:nickname" (аналогично StandaloneAdapter/PokiAdapter)
    const nickname = this.nickname?.trim() || 'GDPlayer';
    const platformData = `${this.userId}:${nickname}`;

    return {
      platformType: 'gamedistribution',
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
      console.warn('[GameDistributionAdapter] Не удалось сохранить nickname:', err);
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
   * Примечание: Math.random() используется только для генерации идентификатора,
   * а не для игровой симуляции, поэтому детерминизм не нарушается.
   */
  private generateUserId(): string {
    // Формат: gd_<timestamp>_<random>
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `gd_${timestamp}_${random}`;
  }

  /**
   * Запросить интерактивную авторизацию.
   * GameDistribution не поддерживает авторизацию пользователей.
   *
   * @returns false — интерактивная авторизация недоступна
   */
  async requestAuth(): Promise<boolean> {
    // GameDistribution не предоставляет авторизацию пользователей
    return false;
  }
}
