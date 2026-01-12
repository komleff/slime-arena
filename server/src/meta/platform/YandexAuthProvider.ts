import { IAuthProvider, PlatformUserData } from "./IAuthProvider";

/**
 * Yandex Games SDK авторизация
 * Верифицирует JWT токен от Yandex Games
 * 
 * Документация: https://yandex.ru/dev/games/doc/dg/sdk/sdk-player.html
 */
export class YandexAuthProvider implements IAuthProvider {
  readonly platformName = "yandex";
  private readonly appId: string;

  constructor(appId: string) {
    if (!appId) {
      throw new Error("Yandex app ID is required");
    }
    this.appId = appId;
  }

  async verifyToken(platformAuthToken: string): Promise<PlatformUserData> {
    // platformAuthToken = JWT от Yandex Games Player.getIDPerGame()
    
    // TODO: Для production нужно верифицировать JWT через Yandex API
    // Пока упрощенная проверка для Stage B
    
    if (!platformAuthToken || platformAuthToken.length < 10) {
      throw new Error("Invalid Yandex token");
    }

    // В реальности нужно:
    // 1. Декодировать JWT
    // 2. Проверить signature через публичный ключ Yandex
    // 3. Проверить exp, aud, iss
    // 4. Извлечь user_id и другие данные
    
    // Для Stage B: минимальная проверка + placeholder данные
    try {
      const parts = platformAuthToken.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid JWT format");
      }

      // Декодируем payload (base64url)
      const payload = JSON.parse(
        Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
      );

      if (!payload.sub) {
        throw new Error("Missing sub (user_id) in Yandex JWT");
      }

      return {
        platformUserId: String(payload.sub),
        nickname: payload.name || `YandexUser${payload.sub}`,
        avatarUrl: payload.picture,
        metadata: {
          locale: payload.locale,
          country: payload.country,
        },
      };
    } catch (error) {
      throw new Error(`Failed to verify Yandex token: ${error}`);
    }
  }
}
