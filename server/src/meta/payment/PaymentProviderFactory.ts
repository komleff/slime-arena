import { IPaymentProvider } from './IPaymentProvider';
import { TelegramStarsProvider } from './TelegramStarsProvider';
import { YandexPayProvider } from './YandexPayProvider';

/**
 * Factory for payment providers
 */
export class PaymentProviderFactory {
  private static providers: Map<string, IPaymentProvider> = new Map();

  /**
   * Initialize all available payment providers
   */
  static initialize(): void {
    const telegram = new TelegramStarsProvider();
    if (telegram.isAvailable()) {
      this.providers.set(telegram.platform, telegram);
      console.log('[Payment] TelegramStarsProvider initialized');
    }

    const yandex = new YandexPayProvider();
    if (yandex.isAvailable()) {
      this.providers.set(yandex.platform, yandex);
      console.log('[Payment] YandexPayProvider initialized');
    }

    console.log(`[Payment] ${this.providers.size} payment provider(s) available`);
  }

  /**
   * Get provider by platform name
   */
  static getProvider(platform: string): IPaymentProvider | null {
    return this.providers.get(platform) || null;
  }

  /**
   * Get all available providers
   */
  static getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if any payment provider is available
   */
  static hasAnyProvider(): boolean {
    return this.providers.size > 0;
  }
}
