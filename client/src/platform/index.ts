/**
 * Platform module exports.
 */

export { platformManager } from './PlatformManager';
export { TelegramAdapter } from './TelegramAdapter';
export { YandexAdapter } from './YandexAdapter';
export { CrazyGamesAdapter } from './CrazyGamesAdapter';
export { GameDistributionAdapter } from './GameDistributionAdapter';
export { PokiAdapter } from './PokiAdapter';
export { StandaloneAdapter } from './StandaloneAdapter';
export type { IAuthAdapter, PlatformCredentials, PlatformType } from './IAuthAdapter';

// Ads providers
export type { IAdsProvider, AdResult, AdResultStatus, AdPlacement } from './IAdsProvider';
export { MockAdsProvider } from './MockAdsProvider';
export { TelegramAdsProvider } from './TelegramAdsProvider';
export { YandexAdsProvider } from './YandexAdsProvider';
export { CrazyGamesAdsProvider } from './CrazyGamesAdsProvider';
export { GameDistributionAdsProvider } from './GameDistributionAdsProvider';
export { PokiAdsProvider } from './PokiAdsProvider';
