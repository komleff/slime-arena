import { IAuthProvider, PlatformUserData } from "./IAuthProvider";

/**
 * Dev-режим авторизации для разработки и тестирования
 * Принимает любой токен в формате "platformUserId:nickname"
 * НЕ ИСПОЛЬЗОВАТЬ В PRODUCTION!
 */
export class DevAuthProvider implements IAuthProvider {
  readonly platformName = "dev";

  async verifyToken(platformAuthToken: string): Promise<PlatformUserData> {
    // В dev-режиме токен имеет формат: "userId:nickname"
    const parts = platformAuthToken.split(":");
    if (parts.length < 2) {
      throw new Error("Invalid dev token format. Expected: userId:nickname");
    }

    const [platformUserId, ...nicknameParts] = parts;
    const nickname = nicknameParts.join(":");

    if (!platformUserId || !nickname) {
      throw new Error("Both userId and nickname are required");
    }

    return {
      platformUserId,
      nickname,
      metadata: {
        isDev: true,
      },
    };
  }
}
