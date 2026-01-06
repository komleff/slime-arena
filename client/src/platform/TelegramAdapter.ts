/**
 * Адаптер авторизации для Telegram Mini App.
 * Использует window.Telegram.WebApp.initData для получения credentials.
 */

import type { IAuthAdapter, PlatformCredentials, PlatformType } from './IAuthAdapter';

// Типы Telegram WebApp API
interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramWebAppUser;
    auth_date?: number;
    hash?: string;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export class TelegramAdapter implements IAuthAdapter {
  private webApp: TelegramWebApp | null = null;

  constructor() {
    if (this.isAvailable()) {
      this.webApp = window.Telegram!.WebApp;
      this.webApp.ready();
      this.webApp.expand();
    }
  }

  getPlatformType(): PlatformType {
    return 'telegram';
  }

  isAvailable(): boolean {
    return !!(
      typeof window !== 'undefined' &&
      window.Telegram?.WebApp?.initData &&
      window.Telegram.WebApp.initData.length > 0
    );
  }

  async getCredentials(): Promise<PlatformCredentials> {
    if (!this.webApp) {
      throw new Error('Telegram WebApp not available');
    }

    return {
      platformType: 'telegram',
      platformData: this.webApp.initData,
      nickname: this.getNickname() || undefined,
    };
  }

  getNickname(): string | null {
    if (!this.webApp?.initDataUnsafe?.user) {
      return null;
    }

    const user = this.webApp.initDataUnsafe.user;

    // Приоритет: username > first_name + last_name > first_name
    if (user.username) {
      return user.username;
    }

    if (user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }

    return user.first_name;
  }

  /**
   * Получить Telegram user ID (для отладки).
   */
  getUserId(): number | null {
    return this.webApp?.initDataUnsafe?.user?.id || null;
  }

  /**
   * Показать кнопку "Назад" в Telegram.
   */
  showBackButton(onClick: () => void): void {
    if (this.webApp) {
      this.webApp.BackButton.onClick(onClick);
      this.webApp.BackButton.show();
    }
  }

  /**
   * Скрыть кнопку "Назад" в Telegram.
   */
  hideBackButton(): void {
    this.webApp?.BackButton.hide();
  }
}
