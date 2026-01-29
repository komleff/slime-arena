/**
 * Адаптер авторизации для Yandex Games.
 * Использует Yandex Games SDK для получения данных игрока.
 */

import type { IAuthAdapter, PlatformCredentials, PlatformType } from './IAuthAdapter';

// Расширение типов Yandex Games SDK
interface YaPlayer {
  getIDPerGame(): string | undefined;
  getName(): string;
  getUniqueID(): string;
  getMode(): 'lite' | 'full';
}

declare global {
  interface YaGamesSDK {
    getPlayer(options?: { scopes?: boolean; signed?: boolean }): Promise<YaPlayer>;
  }
}

export class YandexAdapter implements IAuthAdapter {
  private ysdk: YaGamesSDK | null = null;
  private player: YaPlayer | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.ysdk) {
      this.ysdk = window.ysdk;
      // Начинаем загрузку данных игрока асинхронно
      this.initPromise = this.initializePlayer();
    }
  }

  /**
   * Асинхронная инициализация данных игрока.
   */
  private async initializePlayer(): Promise<void> {
    if (!this.ysdk) return;

    try {
      // Запрашиваем данные игрока без scopes (анонимно)
      this.player = await this.ysdk.getPlayer({ scopes: false });
      console.log('[YandexAdapter] Player initialized:', {
        id: this.player.getIDPerGame(),
        name: this.player.getName(),
        mode: this.player.getMode(),
      });
    } catch (error) {
      console.error('[YandexAdapter] Failed to get player:', error);
      this.player = null;
    }
  }

  getPlatformType(): PlatformType {
    return 'yandex';
  }

  isAvailable(): boolean {
    return !!(typeof window !== 'undefined' && window.ysdk);
  }

  async getCredentials(): Promise<PlatformCredentials> {
    // Ждём завершения инициализации если она ещё идёт
    if (this.initPromise) {
      await this.initPromise;
    }

    if (!this.player) {
      throw new Error('Yandex SDK: игрок не инициализирован');
    }

    // Формат platformData: "playerId:playerName"
    // Сервер YandexAuthProvider будет верифицировать через signed данные
    const rawPlayerId = this.player.getIDPerGame() || this.player.getUniqueID();
    const playerId = rawPlayerId?.trim();

    // P0: Проверка на пустой playerId
    if (!playerId) {
      throw new Error('Yandex SDK: не удалось получить ID игрока');
    }

    // P2: применяем trim() к playerName
    const playerName = this.player.getName()?.trim() || '';

    return {
      platformType: 'yandex',
      platformData: `${playerId}:${playerName}`,
      nickname: playerName || undefined,
    };
  }

  getNickname(): string | null {
    return this.player?.getName()?.trim() || null;
  }

  /**
   * Получить ID игрока (для отладки).
   */
  getPlayerId(): string | null {
    return this.player?.getIDPerGame() || this.player?.getUniqueID() || null;
  }

  /**
   * Получить режим игрока (lite = анонимный, full = авторизованный).
   */
  getPlayerMode(): 'lite' | 'full' | null {
    return this.player?.getMode() || null;
  }

  /**
   * Запросить полную авторизацию (scopes).
   * Позволяет получить доступ к дополнительным данным игрока.
   *
   * @returns true если авторизация успешна, false если отклонена/недоступна
   */
  async requestAuth(): Promise<boolean> {
    if (!this.ysdk) {
      return false;
    }

    try {
      // Запрашиваем полные данные игрока с подписью
      this.player = await this.ysdk.getPlayer({ scopes: true, signed: true });
      const mode = this.player.getMode();
      console.log('[YandexAdapter] Auth requested, mode:', mode);
      return mode === 'full';
    } catch (error) {
      console.error('[YandexAdapter] Auth request failed:', error);
      return false;
    }
  }
}
