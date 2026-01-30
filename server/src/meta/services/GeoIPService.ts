/**
 * GeoIP Service — определение региона по IP-адресу
 *
 * Используется для региональной фильтрации OAuth провайдеров.
 * По ТЗ: Google недоступен для RU и UNKNOWN регионов.
 *
 * Приоритет определения:
 * 1. GeoIP по IP-адресу (основной)
 * 2. Accept-Language (резервный, если strict=false)
 * 3. Часовой пояс (дополнительный сигнал)
 *
 * @see docs/meta-min/TZ-StandaloneAdapter-OAuth-v1.9.md раздел 3.2
 */

export type OAuthRegion = 'RU' | 'CIS' | 'GLOBAL' | 'UNKNOWN';

interface GeoIPResult {
  region: OAuthRegion;
  countryCode: string | null;
  source: 'geoip' | 'accept-language' | 'fallback';
}

// Страны СНГ (без России)
const CIS_COUNTRIES = new Set([
  'BY', // Беларусь
  'KZ', // Казахстан
  'UZ', // Узбекистан
  'UA', // Украина
  'AM', // Армения
  'AZ', // Азербайджан
  'GE', // Грузия
  'KG', // Киргизия
  'MD', // Молдова
  'TJ', // Таджикистан
  'TM', // Туркменистан
]);

// Русскоязычные локали для fallback
const RU_LOCALES = new Set(['ru', 'ru-RU', 'ru-BY', 'ru-KZ', 'ru-UA']);

export class GeoIPService {
  private readonly strictMode: boolean;
  private readonly geoipApiUrl: string;
  private readonly geoipTimeout: number;

  constructor() {
    // Строгий режим по умолчанию включён
    this.strictMode = process.env.OAUTH_REGION_DETECTION_STRICT !== 'false';
    // Используем бесплатный ip-api.com (100 req/min без ключа)
    this.geoipApiUrl = process.env.GEOIP_API_URL || 'http://ip-api.com/json';
    this.geoipTimeout = parseInt(process.env.GEOIP_TIMEOUT_MS || '3000', 10);
  }

  /**
   * Определить регион по IP-адресу
   *
   * @param ip - IP-адрес клиента
   * @param acceptLanguage - Заголовок Accept-Language (опционально)
   * @returns Результат с регионом и источником определения
   */
  async detectRegion(ip: string, acceptLanguage?: string): Promise<GeoIPResult> {
    // Локальные адреса → GLOBAL (для разработки)
    if (this.isLocalAddress(ip)) {
      console.log(`[GeoIPService] Local address ${ip} → GLOBAL (dev mode)`);
      return { region: 'GLOBAL', countryCode: null, source: 'fallback' };
    }

    // Пробуем GeoIP
    try {
      const geoResult = await this.fetchGeoIP(ip);
      if (geoResult) {
        const region = this.countryToRegion(geoResult.countryCode);
        console.log(`[GeoIPService] IP ${ip} → ${geoResult.countryCode} → ${region}`);
        return { region, countryCode: geoResult.countryCode, source: 'geoip' };
      }
    } catch (error) {
      console.warn(`[GeoIPService] GeoIP failed for ${ip}:`, error);
    }

    // GeoIP недоступен
    if (this.strictMode) {
      // Строгий режим: возвращаем UNKNOWN
      console.log(`[GeoIPService] Strict mode: GeoIP unavailable → UNKNOWN`);
      return { region: 'UNKNOWN', countryCode: null, source: 'fallback' };
    }

    // Нестрогий режим: пробуем Accept-Language
    if (acceptLanguage) {
      const langRegion = this.detectRegionFromLanguage(acceptLanguage);
      if (langRegion) {
        console.log(`[GeoIPService] Accept-Language fallback: ${acceptLanguage} → ${langRegion}`);
        return { region: langRegion, countryCode: null, source: 'accept-language' };
      }
    }

    // Ничего не сработало → GLOBAL (нестрогий режим)
    console.log(`[GeoIPService] No detection method worked → GLOBAL (non-strict)`);
    return { region: 'GLOBAL', countryCode: null, source: 'fallback' };
  }

  /**
   * Получить данные GeoIP от внешнего API
   */
  private async fetchGeoIP(ip: string): Promise<{ countryCode: string } | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.geoipTimeout);

    try {
      const response = await fetch(`${this.geoipApiUrl}/${ip}?fields=countryCode,status`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as { status: string; countryCode?: string };

      if (data.status !== 'success' || !data.countryCode) {
        return null;
      }

      return { countryCode: data.countryCode };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Преобразовать код страны в регион
   */
  private countryToRegion(countryCode: string): OAuthRegion {
    if (countryCode === 'RU') {
      return 'RU';
    }

    if (CIS_COUNTRIES.has(countryCode)) {
      return 'CIS';
    }

    return 'GLOBAL';
  }

  /**
   * Определить регион по Accept-Language
   * Используется только в нестрогом режиме
   */
  private detectRegionFromLanguage(acceptLanguage: string): OAuthRegion | null {
    // Парсим первую локаль
    const primaryLocale = acceptLanguage.split(',')[0]?.trim();
    if (!primaryLocale) {
      return null;
    }

    // Извлекаем язык (например, "ru-RU" → "ru-RU", "ru" → "ru")
    const locale = primaryLocale.split(';')[0]?.trim();
    if (!locale) {
      return null;
    }

    if (RU_LOCALES.has(locale)) {
      // Русский язык → CIS (не RU, чтобы не блокировать Google)
      // Это безопаснее, чем назначать RU по языку
      return 'CIS';
    }

    return null;
  }

  /**
   * Проверить, является ли адрес локальным
   */
  private isLocalAddress(ip: string): boolean {
    return (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip === 'localhost' ||
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      ip.startsWith('172.16.') ||
      ip.startsWith('172.17.') ||
      ip.startsWith('172.18.') ||
      ip.startsWith('172.19.') ||
      ip.startsWith('172.20.') ||
      ip.startsWith('172.21.') ||
      ip.startsWith('172.22.') ||
      ip.startsWith('172.23.') ||
      ip.startsWith('172.24.') ||
      ip.startsWith('172.25.') ||
      ip.startsWith('172.26.') ||
      ip.startsWith('172.27.') ||
      ip.startsWith('172.28.') ||
      ip.startsWith('172.29.') ||
      ip.startsWith('172.30.') ||
      ip.startsWith('172.31.')
    );
  }

  /**
   * Проверить, включён ли строгий режим
   */
  isStrictMode(): boolean {
    return this.strictMode;
  }
}

// Lazy singleton
let instance: GeoIPService | null = null;

export function getGeoIPService(): GeoIPService {
  if (!instance) {
    instance = new GeoIPService();
  }
  return instance;
}
