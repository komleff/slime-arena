import { IAuthProvider, PlatformUserData } from "./IAuthProvider";

/**
 * CrazyGames SDK авторизация
 * Верифицирует JWT токен от CrazyGames SDK (SDK.user.getUserToken())
 *
 * Документация: https://docs.crazygames.com/sdk/auth/
 *
 * JWT payload содержит:
 * - userId: уникальный ID игрока
 * - username: никнейм (опционально)
 * - profilePictureUrl: URL аватара (опционально)
 */
export class CrazyGamesAuthProvider implements IAuthProvider {
  readonly platformName = "crazygames";

  // TODO: Для production JWT верификации — удалить underscore и раскомментировать getPublicKey()
  // Публичный ключ CrazyGames: https://sdk.crazygames.com/publicKey.json
  private _publicKeyCache: { key: string; fetchedAt: number } | null = null;
  private readonly _PUBLIC_KEY_CACHE_TTL = 60 * 60 * 1000; // 1 hour

  async verifyToken(platformAuthToken: string): Promise<PlatformUserData> {
    // platformAuthToken = JWT от CrazyGames SDK.user.getUserToken()

    if (!platformAuthToken || platformAuthToken.length < 10) {
      throw new Error("Invalid CrazyGames token");
    }

    // Проверяем формат JWT
    const parts = platformAuthToken.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    try {
      // TODO: В production добавить верификацию подписи через публичный ключ
      // const publicKey = await this.getPublicKey();
      // jwt.verify(platformAuthToken, publicKey);

      // Декодируем payload (base64url)
      const payload = JSON.parse(
        Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
      );

      if (!payload.userId) {
        throw new Error("Missing userId in CrazyGames JWT");
      }

      return {
        platformUserId: String(payload.userId),
        nickname: payload.username || `CrazyPlayer${String(payload.userId).slice(0, 6)}`,
        avatarUrl: payload.profilePictureUrl,
        metadata: {
          platform: "crazygames",
          // CrazyGames не предоставляет locale в JWT
        },
      };
    } catch (error) {
      throw new Error(`Failed to verify CrazyGames token: ${error}`);
    }
  }

  /**
   * Получить публичный ключ CrazyGames для верификации JWT.
   * Кэшируется на 1 час.
   *
   * TODO: Реализовать для production
   */
  // private async getPublicKey(): Promise<string> {
  //   if (this.publicKeyCache &&
  //       Date.now() - this.publicKeyCache.fetchedAt < this.PUBLIC_KEY_CACHE_TTL) {
  //     return this.publicKeyCache.key;
  //   }
  //
  //   const response = await fetch("https://sdk.crazygames.com/publicKey.json");
  //   const data = await response.json();
  //
  //   this.publicKeyCache = {
  //     key: data.publicKey,
  //     fetchedAt: Date.now(),
  //   };
  //
  //   return this.publicKeyCache.key;
  // }
}
