/**
 * Platform module exports.
 */

export { platformManager } from './PlatformManager';
export { TelegramAdapter } from './TelegramAdapter';
export { StandaloneAdapter } from './StandaloneAdapter';
export type { IAuthAdapter, PlatformCredentials, PlatformType } from './IAuthAdapter';

// Ads providers
export type { IAdsProvider, AdResult, AdResultStatus, AdPlacement } from './IAdsProvider';
export { MockAdsProvider } from './MockAdsProvider';
export { TelegramAdsProvider } from './TelegramAdsProvider';
// YandexAdsProvider и PokiAdsProvider будут экспортированы когда появятся YandexAdapter/PokiAdapter
