import { IAuthProvider, PlatformUserData } from "./IAuthProvider";

/**
 * Poki SDK авторизация
 * Использует Poki.getPlayerData() для получения пользовательского ID
 * 
 * Документация: https://sdk.poki.com/
 */
export class PokiAuthProvider implements IAuthProvider {
  readonly platformName = "poki";

  async verifyToken(platformAuthToken: string): Promise<PlatformUserData> {
    // Poki не предоставляет традиционную JWT авторизацию
    // platformAuthToken = "userId:nickname" от клиента

    if (!platformAuthToken || platformAuthToken.length < 5) {
      throw new Error("Invalid Poki token");
    }

    // Парсим формат "userId:nickname"
    // Используем indexOf для корректной обработки nickname с ':'
    const colonIndex = platformAuthToken.indexOf(":");

    let userId: string;
    let nickname: string;

    if (colonIndex === -1) {
      // Обратная совместимость: если нет ':', используем весь токен как userId
      userId = platformAuthToken;
      nickname = `PokiPlayer${platformAuthToken.substring(0, 8)}`;
    } else {
      userId = platformAuthToken.substring(0, colonIndex).trim();
      nickname = platformAuthToken.substring(colonIndex + 1).trim() || `PokiPlayer${userId.substring(0, 8)}`;
    }

    if (!userId || userId.length < 5) {
      throw new Error("Invalid Poki userId");
    }

    return {
      platformUserId: userId,
      nickname,
      metadata: {
        platform: "poki",
      },
    };
  }
}
