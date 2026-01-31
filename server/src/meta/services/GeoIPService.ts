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

// Copilot P2: In-memory кеш результатов GeoIP с TTL 1 час
interface CacheEntry {
  result: GeoIPResult;
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 час
const geoipCache = new Map<string, CacheEntry>();

// Copilot P2: Очистка устаревших записей из кеша
function cleanupCache(): void {
  const now = Date.now();
  for (const [key, entry] of geoipCache.entries()) {
    if (entry.expiresAt < now) {
      geoipCache.delete(key);
    }
  }
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

    // Copilot P2: Проверяем кеш
    const cached = geoipCache.get(ip);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[GeoIPService] Cache hit for ${ip} → ${cached.result.region}`);
      return cached.result;
    }

    // Периодическая очистка кеша (каждые 100 запросов)
    if (geoipCache.size > 0 && geoipCache.size % 100 === 0) {
      cleanupCache();
    }

    // Пробуем GeoIP
    try {
      const geoResult = await this.fetchGeoIP(ip);
      if (geoResult) {
        const region = this.countryToRegion(geoResult.countryCode);
        console.log(`[GeoIPService] IP ${ip} → ${geoResult.countryCode} → ${region}`);
        const result: GeoIPResult = { region, countryCode: geoResult.countryCode, source: 'geoip' };

        // Copilot P2: Сохраняем в кеш
        geoipCache.set(ip, {
          result,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });

        return result;
      }
    } catch (error) {
      console.warn(`[GeoIPService] GeoIP failed for ${ip}:`, error);
    }

    // GeoIP недоступен
    let result: GeoIPResult;

    if (this.strictMode) {
      // Строгий режим: возвращаем UNKNOWN
      console.log(`[GeoIPService] Strict mode: GeoIP unavailable → UNKNOWN`);
      result = { region: 'UNKNOWN', countryCode: null, source: 'fallback' };
    } else if (acceptLanguage) {
      // Нестрогий режим: пробуем Accept-Language
      const langRegion = this.detectRegionFromLanguage(acceptLanguage);
      if (langRegion) {
        console.log(`[GeoIPService] Accept-Language fallback: ${acceptLanguage} → ${langRegion}`);
        result = { region: langRegion, countryCode: null, source: 'accept-language' };
      } else {
        console.log(`[GeoIPService] No detection method worked → GLOBAL (non-strict)`);
        result = { region: 'GLOBAL', countryCode: null, source: 'fallback' };
      }
    } else {
      // Ничего не сработало → GLOBAL (нестрогий режим)
      console.log(`[GeoIPService] No detection method worked → GLOBAL (non-strict)`);
      result = { region: 'GLOBAL', countryCode: null, source: 'fallback' };
    }

    // Copilot P2: Кешируем fallback-результаты тоже (меньший TTL - 10 минут)
    geoipCache.set(ip, {
      result,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 минут для fallback
    });

    return result;
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
   *
   * Copilot P2: Точная проверка CIDR диапазонов:
   * - IPv4: 10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12, 127.0.0.0/8
   * - IPv6: ::1 (loopback), fc00::/7 (ULA), fe80::/10 (link-local)
   */
  private isLocalAddress(ip: string): boolean {
    // Проверка localhost
    if (ip === 'localhost') {
      return true;
    }

    // IPv6 проверка
    if (ip.includes(':')) {
      return this.isLocalIPv6(ip);
    }

    // IPv4 проверка
    return this.isLocalIPv4(ip);
  }

  /**
   * Copilot P2: Проверка локального IPv4 адреса с точным CIDR
   */
  private isLocalIPv4(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length !== 4) {
      return false;
    }

    const octets = parts.map(p => parseInt(p, 10));
    if (octets.some(o => isNaN(o) || o < 0 || o > 255)) {
      return false;
    }

    const [a, b] = octets;

    // 127.0.0.0/8 (loopback)
    if (a === 127) {
      return true;
    }

    // 10.0.0.0/8 (Class A private)
    if (a === 10) {
      return true;
    }

    // 192.168.0.0/16 (Class C private)
    if (a === 192 && b === 168) {
      return true;
    }

    // 172.16.0.0/12 (Class B private) — диапазон 172.16.x.x - 172.31.x.x
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }

    return false;
  }

  /**
   * Copilot P2: Проверка локального IPv6 адреса
   * - ::1 (loopback)
   * - fc00::/7 (Unique Local Address, ULA) — fc00:: до fdff::
   * - fe80::/10 (link-local) — fe80:: до febf::
   */
  private isLocalIPv6(ip: string): boolean {
    // Нормализуем IPv6
    const normalized = ip.toLowerCase();

    // ::1 (loopback)
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') {
      return true;
    }

    // Получаем первый компонент для проверки prefix
    const firstGroup = normalized.split(':')[0];
    if (!firstGroup) {
      return false;
    }

    const firstValue = parseInt(firstGroup, 16);
    if (isNaN(firstValue)) {
      return false;
    }

    // fc00::/7 (ULA) — первый байт fc или fd (0xfc00 - 0xfdff)
    // Проверяем первые 7 бит = 1111110x
    if ((firstValue & 0xfe00) === 0xfc00) {
      return true;
    }

    // fe80::/10 (link-local) — первые 10 бит = 1111111010
    // Диапазон fe80:: - febf::
    if ((firstValue & 0xffc0) === 0xfe80) {
      return true;
    }

    return false;
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
