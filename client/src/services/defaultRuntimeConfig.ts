import type { RuntimeConfig } from './configService';

/**
 * Дефолтный RuntimeConfig для работы без MetaServer.
 * Используется как fallback при ошибке загрузки конфига.
 *
 * IMPORTANT: При изменении структуры RuntimeConfig обновите этот файл.
 */
export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  configVersion: '0.0.0-local',
  economy: {
    softCurrency: {
      name: 'Coins',
      icon: '🪙'
    },
    hardCurrency: {
      name: 'Gems',
      icon: '💎'
    },
    matchRewards: {
      win: 100,
      loss: 50,
      perKill: 10
    }
  },
  shop: {
    offers: []
  },
  ads: {
    rewards: {}
  },
  matchmaking: {
    allowBots: true,
    botsPerMatch: 3,
    botRatingStrategy: 'random',
    botsAffectRating: false,
    minPlayers: 1,
    maxPlayers: 10,
    queueTimeoutSec: 60
  },
  resilience: {
    reconnectWindowMs: 30000,
    summaryTTL: 3600
  },
  features: {
    paymentsEnabled: false,      // Отключено в offline режиме
    adsRewardEnabled: false,      // Отключено в offline режиме
    matchmakingEnabled: true      // Локальный matchmaking доступен
  },
  abtests: []
};
