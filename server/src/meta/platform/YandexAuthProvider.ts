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
    // platformAuthToken может быть:
    // 1. JWT от getPlayer({ signed: true }) для авторизованных пользователей
    // 2. "playerId:playerName" для неавторизованных пользователей

    if (!platformAuthToken || platformAuthToken.length < 5) {
      throw new Error("Invalid Yandex token");
    }

    // Проверяем, это JWT (3 части через точку) или формат playerId:playerName
    const parts = platformAuthToken.split(".");

    if (parts.length === 3) {
      // JWT формат — декодируем payload
      try {
        const payload = JSON.parse(
          Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
        );

        if (!payload.sub) {
          throw new Error("Missing sub (user_id) in Yandex JWT");
        }

        // TODO: В production добавить верификацию подписи через Yandex API
        return {
          platformUserId: String(payload.sub),
          nickname: payload.name || `YandexUser${String(payload.sub).slice(0, 8)}`,
          avatarUrl: payload.picture,
          metadata: {
            locale: payload.locale,
            country: payload.country,
          },
        };
      } catch (error) {
        throw new Error(`Failed to verify Yandex JWT: ${error}`);
      }
    } else {
      // Формат "playerId:playerName" для неавторизованных пользователей
      const colonIndex = platformAuthToken.indexOf(":");

      if (colonIndex === -1) {
        // Только playerId без имени
        return {
          platformUserId: platformAuthToken.trim(),
          nickname: `YandexUser${platformAuthToken.trim().slice(0, 8)}`,
          metadata: {
            platform: "yandex",
          },
        };
      }

      const playerId = platformAuthToken.substring(0, colonIndex).trim();
      const playerName = platformAuthToken.substring(colonIndex + 1).trim();

      if (!playerId || playerId.length < 5) {
        throw new Error("Invalid Yandex playerId");
      }

      return {
        platformUserId: playerId,
        nickname: playerName || `YandexUser${playerId.slice(0, 8)}`,
        metadata: {
          platform: "yandex",
        },
      };
    }
  }
}
