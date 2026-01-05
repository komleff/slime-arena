import crypto from "crypto";
import { IAuthProvider, PlatformUserData } from "./IAuthProvider";

/**
 * Telegram Mini App авторизация
 * Верифицирует initData через HMAC-SHA256 signature
 * 
 * Документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export class TelegramAuthProvider implements IAuthProvider {
  readonly platformName = "telegram";
  private readonly botToken: string;

  constructor(botToken: string) {
    if (!botToken) {
      throw new Error("Telegram bot token is required");
    }
    this.botToken = botToken;
  }

  async verifyToken(platformAuthToken: string): Promise<PlatformUserData> {
    // platformAuthToken = initData от Telegram WebApp
    // Формат: query_id=...&user=...&auth_date=...&hash=...
    
    const params = new URLSearchParams(platformAuthToken);
    const hash = params.get("hash");
    
    if (!hash) {
      throw new Error("Missing hash in Telegram initData");
    }

    // Проверяем signature
    params.delete("hash");
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(this.botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (calculatedHash !== hash) {
      throw new Error("Invalid Telegram signature");
    }

    // Проверяем auth_date (не старше 24 часов)
    const authDate = parseInt(params.get("auth_date") || "0", 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      throw new Error("Telegram auth data expired");
    }

    // Парсим user data
    const userJson = params.get("user");
    if (!userJson) {
      throw new Error("Missing user data in Telegram initData");
    }

    let user: any;
    try {
      user = JSON.parse(userJson);
    } catch {
      throw new Error("Invalid user JSON in Telegram initData");
    }

    if (!user.id) {
      throw new Error("Missing user.id in Telegram data");
    }

    const nickname = user.username || user.first_name || `User${user.id}`;
    const avatarUrl = user.photo_url;

    return {
      platformUserId: String(user.id),
      nickname,
      avatarUrl,
      metadata: {
        firstName: user.first_name,
        lastName: user.last_name,
        languageCode: user.language_code,
        isPremium: user.is_premium || false,
      },
    };
  }
}
