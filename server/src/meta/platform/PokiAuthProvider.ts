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
    // platformAuthToken содержит player_id от Poki SDK
    
    if (!platformAuthToken || platformAuthToken.length < 5) {
      throw new Error("Invalid Poki player ID");
    }

    // Poki предоставляет только player_id, нет никнеймов или аватаров
    // Генерируем дефолтный никнейм
    const shortId = platformAuthToken.substring(0, 8);

    return {
      platformUserId: platformAuthToken,
      nickname: `PokiPlayer${shortId}`,
      metadata: {
        platform: "poki",
      },
    };
  }
}
