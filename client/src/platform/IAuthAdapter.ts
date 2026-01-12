/**
 * Интерфейс платформенного адаптера авторизации.
 * Абстрагирует получение credentials для разных платформ.
 */

export type PlatformType = 'telegram' | 'dev' | 'yandex' | 'poki';

export interface PlatformCredentials {
  platformType: PlatformType;
  /** Данные для верификации на сервере (initData для Telegram, userId для Standalone) */
  platformData: string;
  /** Предпочтительный никнейм пользователя */
  nickname?: string;
}

export interface IAuthAdapter {
  /**
   * Тип платформы.
   */
  getPlatformType(): PlatformType;

  /**
   * Доступна ли платформа в текущем окружении.
   */
  isAvailable(): boolean;

  /**
   * Получить credentials для авторизации.
   */
  getCredentials(): Promise<PlatformCredentials>;

  /**
   * Получить никнейм пользователя (если доступен).
   */
  getNickname(): string | null;
}
