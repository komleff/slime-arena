import { IAuthProvider, PlatformUserData } from "./IAuthProvider";

/**
 * GameDistribution авторизация
 * GameDistribution НЕ предоставляет авторизацию пользователей.
 * Используется гостевой режим с localStorage на клиенте.
 *
 * Формат platformAuthToken: "userId:nickname"
 * - userId: сгенерированный клиентом ID (gd_<timestamp>_<random>)
 * - nickname: никнейм (может содержать любые символы кроме :)
 *
 * Документация: https://gamedistribution.com/sdk
 */
export class GameDistributionAuthProvider implements IAuthProvider {
  readonly platformName = "gamedistribution";

  async verifyToken(platformAuthToken: string): Promise<PlatformUserData> {
    // platformAuthToken = "userId:nickname" от клиента

    if (!platformAuthToken || platformAuthToken.length < 5) {
      throw new Error("Invalid GameDistribution token");
    }

    // Парсим формат "userId:nickname"
    // Используем indexOf для корректной обработки nickname с ':'
    const colonIndex = platformAuthToken.indexOf(":");
    if (colonIndex === -1) {
      throw new Error("Invalid GameDistribution token format: expected userId:nickname");
    }

    const userId = platformAuthToken.substring(0, colonIndex).trim();
    const nickname = platformAuthToken.substring(colonIndex + 1).trim();

    if (!userId || userId.length < 5) {
      throw new Error("Invalid GameDistribution userId");
    }

    // Проверяем формат userId (должен начинаться с gd_)
    if (!userId.startsWith("gd_")) {
      throw new Error("Invalid GameDistribution userId format: must start with gd_");
    }

    return {
      platformUserId: userId,
      nickname: nickname || `GDPlayer${userId.slice(3, 11)}`,
      metadata: {
        platform: "gamedistribution",
      },
    };
  }
}
