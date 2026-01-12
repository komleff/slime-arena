/**
 * Сервис конфигурации.
 * Загружает RuntimeConfig с MetaServer и применяет к игре.
 */

import { signal } from '@preact/signals';
import { metaServerClient } from '../api/metaServerClient';
import { DEFAULT_RUNTIME_CONFIG } from './defaultRuntimeConfig';

// ========== Типы ==========

export interface RuntimeConfig {
  configVersion: string;
  economy: EconomyConfig;
  shop?: ShopConfig;
  ads?: AdsConfig;
  battlepass?: unknown;
  achievements?: unknown;
  leaderboards?: unknown;
  matchmaking?: MatchmakingConfig;
  resilience?: ResilienceConfig;
  features: FeaturesConfig;
  abtests?: ABTestConfig[];
}

interface EconomyConfig {
  softCurrency?: {
    name: string;
    icon: string;
  };
  hardCurrency?: {
    name: string;
    icon: string;
  };
  matchRewards?: {
    win: number;
    loss: number;
    perKill: number;
  };
}

interface ShopConfig {
  offers?: ShopOffer[];
}

interface ShopOffer {
  id: string;
  type: string;
  itemId?: string;
  amount?: number;
  price: {
    currency: 'soft' | 'hard';
    amount: number;
  };
  metadata?: Record<string, unknown>;
}

interface AdsConfig {
  rewards?: Record<string, AdRewardConfig>;
}

interface AdRewardConfig {
  type: 'soft_currency' | 'hard_currency' | 'item';
  amount?: number;
  itemId?: string;
}

interface MatchmakingConfig {
  allowBots?: boolean;
  botsPerMatch?: number;
  botRatingStrategy?: string;
  botsAffectRating?: boolean;
  minPlayers?: number;
  maxPlayers?: number;
  queueTimeoutSec?: number;
}

interface ResilienceConfig {
  reconnectWindowMs?: number;
  summaryTTL?: number;
}

interface FeaturesConfig {
  paymentsEnabled: boolean;
  adsRewardEnabled: boolean;
  matchmakingEnabled: boolean;
}

interface ABTestConfig {
  testId: string;
  name: string;
  variants: ABTestVariant[];
  allocation: number[];
  startDate?: string;
  endDate?: string;
  enabled: boolean;
}

interface ABTestVariant {
  id: string;
  name: string;
  config: Record<string, unknown>;
}

// ========== Constants ==========

const CONFIG_CACHE_KEY = 'runtime_config';
// 5 минут: конфиг меняется редко, достаточно хранить кэш столько же
const CONFIG_CACHE_TTL = 5 * 60 * 1000;
// 5 минут: баланс между актуальностью конфигурации и нагрузкой на MetaServer
const CONFIG_POLL_INTERVAL = 5 * 60 * 1000;

// ========== State ==========

export const runtimeConfig = signal<RuntimeConfig>(DEFAULT_RUNTIME_CONFIG);
export const configLoading = signal(false);
export const configError = signal<string | null>(null);

// ========== Service ==========

class ConfigService {
  private pollIntervalId: number | null = null;
  private onConfigApplied: ((config: RuntimeConfig) => void) | null = null;

  /**
   * Загрузить конфигурацию с сервера.
   */
  async loadConfig(): Promise<RuntimeConfig> {
    try {
      configLoading.value = true;
      configError.value = null;

      // Проверяем, доступен ли MetaServer
      const metaServerUrl = import.meta.env?.VITE_META_SERVER_URL || '';

      // Если MetaServer недоступен — сразу используем дефолтный конфиг
      if (!metaServerUrl) {
        console.warn('[ConfigService] MetaServer URL not set, using default config');
        this.applyConfig(DEFAULT_RUNTIME_CONFIG);
        return DEFAULT_RUNTIME_CONFIG;
      }

      // Пробуем загрузить из кэша (только если MetaServer доступен)
      const cached = this.loadFromCache();
      if (cached) {
        this.applyConfig(cached);
        // Продолжаем загрузку с сервера в фоне
        this.fetchFromServer().catch(console.error);
        return cached;
      }

      // Загружаем с сервера
      return await this.fetchFromServer();
    } catch (err) {
      // Улучшенный type guard для ApiError и других ошибок
      let message = 'Не удалось загрузить конфигурацию';
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        message = err.message;
      }
      configError.value = message;
      console.warn('[ConfigService] Load failed, using default config:', message);

      // Применяем дефолтный конфиг
      this.applyConfig(DEFAULT_RUNTIME_CONFIG);
      return DEFAULT_RUNTIME_CONFIG;
    } finally {
      configLoading.value = false;
    }
  }

  /**
   * Загрузить конфигурацию с сервера.
   */
  private async fetchFromServer(): Promise<RuntimeConfig> {
    try {
      const config = await metaServerClient.get<RuntimeConfig>('/api/v1/config/runtime');

      // Сохраняем в кэш
      this.saveToCache(config);

      // Применяем
      this.applyConfig(config);

      console.log(`[ConfigService] Loaded config v${config.configVersion}`);
      return config;
    } catch (err) {
      console.error('[ConfigService] Fetch failed:', err);
      throw err;
    }
  }

  /**
   * Применить конфигурацию.
   */
  private applyConfig(config: RuntimeConfig): void {
    runtimeConfig.value = config;

    // Вызываем callback если установлен
    if (this.onConfigApplied) {
      this.onConfigApplied(config);
    }
  }

  /**
   * Установить callback для применения конфигурации к игре.
   * Используется для интеграции с applyBalanceConfig в main.ts.
   */
  setOnConfigApplied(callback: (config: RuntimeConfig) => void): void {
    this.onConfigApplied = callback;
  }

  /**
   * Загрузить из localStorage кэша.
   */
  private loadFromCache(): RuntimeConfig | null {
    try {
      const cached = localStorage.getItem(CONFIG_CACHE_KEY);
      if (!cached) return null;

      const data = JSON.parse(cached);
      const age = Date.now() - data.timestamp;

      if (age > CONFIG_CACHE_TTL) {
        localStorage.removeItem(CONFIG_CACHE_KEY);
        return null;
      }

      return data.config;
    } catch {
      return null;
    }
  }

  /**
   * Сохранить в localStorage кэш.
   */
  private saveToCache(config: RuntimeConfig): void {
    try {
      localStorage.setItem(
        CONFIG_CACHE_KEY,
        JSON.stringify({
          config,
          timestamp: Date.now(),
        })
      );
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Начать периодический polling конфигурации.
   */
  startPolling(): void {
    if (this.pollIntervalId !== null) return;

    this.pollIntervalId = window.setInterval(() => {
      this.fetchFromServer().catch(console.error);
    }, CONFIG_POLL_INTERVAL);
  }

  /**
   * Остановить polling.
   */
  stopPolling(): void {
    if (this.pollIntervalId !== null) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  /**
   * Получить текущую конфигурацию.
   */
  getConfig(): RuntimeConfig {
    return runtimeConfig.value;
  }

  /**
   * Проверить, включены ли платежи.
   */
  isPaymentsEnabled(): boolean {
    return runtimeConfig.value.features.paymentsEnabled;
  }

  /**
   * Проверить, включена ли реклама с наградой.
   */
  isAdsRewardEnabled(): boolean {
    return runtimeConfig.value.features.adsRewardEnabled;
  }

  /**
   * Проверить, включен ли matchmaking.
   */
  isMatchmakingEnabled(): boolean {
    return runtimeConfig.value.features.matchmakingEnabled;
  }

  /**
   * Получить офферы магазина.
   */
  getShopOffers(): ShopOffer[] {
    return runtimeConfig.value.shop?.offers ?? [];
  }

  /**
   * Очистить кэш конфигурации.
   */
  clearCache(): void {
    localStorage.removeItem(CONFIG_CACHE_KEY);
    runtimeConfig.value = DEFAULT_RUNTIME_CONFIG;
  }
}

// Экземпляр-синглтон
export const configService = new ConfigService();
