import { IAuthProvider } from "./IAuthProvider";
import { DevAuthProvider } from "./DevAuthProvider";
import { TelegramAuthProvider } from "./TelegramAuthProvider";
import { YandexAuthProvider } from "./YandexAuthProvider";
import { PokiAuthProvider } from "./PokiAuthProvider";
import { CrazyGamesAuthProvider } from "./CrazyGamesAuthProvider";
import { GameDistributionAuthProvider } from "./GameDistributionAuthProvider";

/**
 * Фабрика для создания платформенных провайдеров авторизации
 */
export class AuthProviderFactory {
  private static providers: Map<string, IAuthProvider> = new Map();

  /**
   * Инициализирует провайдеры на основе environment variables
   */
  static initialize(): void {
    // Dev provider (всегда доступен)
    this.providers.set("dev", new DevAuthProvider());

    // Telegram (если указан BOT_TOKEN)
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    if (telegramBotToken) {
      this.providers.set("telegram", new TelegramAuthProvider(telegramBotToken));
    }

    // Yandex (если указан APP_ID)
    const yandexAppId = process.env.YANDEX_APP_ID;
    if (yandexAppId) {
      this.providers.set("yandex", new YandexAuthProvider(yandexAppId));
    }

    // Poki (всегда доступен, не требует credentials)
    this.providers.set("poki", new PokiAuthProvider());

    // CrazyGames (всегда доступен)
    this.providers.set("crazygames", new CrazyGamesAuthProvider());

    // GameDistribution (всегда доступен, гостевой режим)
    this.providers.set("gamedistribution", new GameDistributionAuthProvider());

    console.log(`[AuthProviderFactory] Initialized providers: ${Array.from(this.providers.keys()).join(", ")}`);
  }

  /**
   * Получить провайдер по имени платформы
   */
  static getProvider(platformType: string): IAuthProvider | undefined {
    return this.providers.get(platformType);
  }

  /**
   * Список доступных платформ
   */
  static getAvailablePlatforms(): string[] {
    return Array.from(this.providers.keys());
  }
}
