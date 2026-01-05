/**
 * Интерфейс для платформенной авторизации
 * Каждая платформа (Telegram, Yandex, Poki) реализует свою логику верификации
 */
export interface IAuthProvider {
  /**
   * Имя платформы (telegram, yandex, poki, dev)
   */
  readonly platformName: string;

  /**
   * Верифицирует токен платформы и возвращает данные пользователя
   * @param platformAuthToken - Токен от платформы
   * @returns Данные пользователя (platformUserId, nickname, avatar)
   * @throws Error если токен невалиден
   */
  verifyToken(platformAuthToken: string): Promise<PlatformUserData>;
}

export interface PlatformUserData {
  /**
   * Уникальный ID пользователя на платформе
   */
  platformUserId: string;

  /**
   * Никнейм пользователя (может быть пустым)
   */
  nickname: string;

  /**
   * URL аватара (опционально)
   */
  avatarUrl?: string;

  /**
   * Дополнительные данные платформы (например, язык, страна)
   */
  metadata?: Record<string, unknown>;
}
