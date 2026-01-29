/**
 * Адаптер авторизации для CrazyGames.
 * Использует CrazyGames SDK для получения данных игрока и JWT-токена.
 */

import type { IAuthAdapter, PlatformCredentials, PlatformType } from './IAuthAdapter';

// Типы CrazyGames SDK
export interface CrazyGamesUser {
  username: string;
  profilePictureUrl?: string;
}

export interface CrazyGamesAdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: string) => void;
}

export interface CrazyGamesSDK {
  init(): Promise<void>;
  user: {
    getUser(): CrazyGamesUser | null;
    getUserToken(): Promise<string>;
    showAuthPrompt(): Promise<CrazyGamesUser | null>;
    isUserAccountAvailable(): boolean;
  };
  ad: {
    requestAd(type: 'midgame' | 'rewarded', callbacks: CrazyGamesAdCallbacks): void;
  };
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    happyTime(): void;
  };
  getEnvironment(): 'local' | 'crazygames' | 'disabled';
}

declare global {
  interface Window {
    CrazyGames?: {
      SDK: CrazyGamesSDK;
    };
  }
}

export class CrazyGamesAdapter implements IAuthAdapter {
  private sdk: CrazyGamesSDK | null = null;
  private user: CrazyGamesUser | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.CrazyGames?.SDK) {
      this.sdk = window.CrazyGames.SDK;
      this.initPromise = this.initializeSDK();
    }
  }

  /**
   * Асинхронная инициализация SDK и данных пользователя.
   */
  private async initializeSDK(): Promise<void> {
    if (!this.sdk) return;

    try {
      await this.sdk.init();
      this.user = this.sdk.user.getUser();
      const env = this.sdk.getEnvironment();
      console.log('[CrazyGamesAdapter] SDK initialized:', {
        environment: env,
        username: this.user?.username,
        accountAvailable: this.sdk.user.isUserAccountAvailable(),
      });
    } catch (error) {
      console.error('[CrazyGamesAdapter] Failed to initialize SDK:', error);
    }
  }

  getPlatformType(): PlatformType {
    return 'crazygames';
  }

  isAvailable(): boolean {
    return !!(typeof window !== 'undefined' && window.CrazyGames?.SDK);
  }

  async getCredentials(): Promise<PlatformCredentials> {
    // Ждём завершения инициализации
    if (this.initPromise) {
      await this.initPromise;
    }

    if (!this.sdk) {
      throw new Error('CrazyGames SDK: SDK не инициализирован');
    }

    // Получаем JWT-токен для верификации на сервере
    const token = await this.sdk.user.getUserToken();
    if (!token) {
      throw new Error('CrazyGames SDK: не удалось получить токен пользователя');
    }

    // Обновляем данные пользователя
    this.user = this.sdk.user.getUser();
    const username = this.user?.username || 'CrazyPlayer';

    // Формат platformData: "token:username"
    return {
      platformType: 'crazygames',
      platformData: `${token}:${username}`,
      nickname: username,
    };
  }

  getNickname(): string | null {
    return this.user?.username || null;
  }

  /**
   * Запросить авторизацию через CrazyGames.
   * Показывает диалог авторизации CrazyGames.
   *
   * @returns true если авторизация успешна, false если отклонена/недоступна
   */
  async requestAuth(): Promise<boolean> {
    if (!this.sdk) {
      return false;
    }

    // Проверяем, доступна ли авторизация
    if (!this.sdk.user.isUserAccountAvailable()) {
      console.log('[CrazyGamesAdapter] User account not available');
      return false;
    }

    try {
      const user = await this.sdk.user.showAuthPrompt();
      if (user) {
        this.user = user;
        console.log('[CrazyGamesAdapter] Auth successful:', user.username);
        return true;
      }
      console.log('[CrazyGamesAdapter] Auth declined by user');
      return false;
    } catch (error) {
      console.error('[CrazyGamesAdapter] Auth request failed:', error);
      return false;
    }
  }

  /**
   * Уведомить CrazyGames о начале геймплея.
   * Вызывать при входе в матч.
   */
  notifyGameplayStart(): void {
    if (this.sdk) {
      this.sdk.game.gameplayStart();
      console.log('[CrazyGamesAdapter] gameplayStart() called');
    }
  }

  /**
   * Уведомить CrazyGames о завершении геймплея.
   * Вызывать при выходе из матча или показе меню.
   */
  notifyGameplayStop(): void {
    if (this.sdk) {
      this.sdk.game.gameplayStop();
      console.log('[CrazyGamesAdapter] gameplayStop() called');
    }
  }

  /**
   * Вызвать happyTime (при победе/достижении).
   */
  happyTime(): void {
    if (this.sdk) {
      this.sdk.game.happyTime();
      console.log('[CrazyGamesAdapter] happyTime() called');
    }
  }

  /**
   * Получить текущее окружение SDK.
   */
  getEnvironment(): 'local' | 'crazygames' | 'disabled' | null {
    return this.sdk?.getEnvironment() || null;
  }
}
