/**
 * Services module exports.
 */

export { authService } from './authService';
export { configService, runtimeConfig, configLoading, configError, type RuntimeConfig } from './configService';
export { matchmakingService } from './matchmakingService';
export { adsService, type AdsShowResult, type AdsFlowState } from './adsService';
export {
  matchResultsService,
  claimStatus,
  claimError,
  claimRewards,
  claimToken,
  calculateLocalRewards,
  type ClaimTokenResponse,
  type MatchRewards,
  type ClaimStatus,
} from './matchResultsService';
export {
  leaderboardService,
  leaderboardMode,
  leaderboardEntries,
  leaderboardUserEntry,
  leaderboardLoadStatus,
  leaderboardError,
  leaderboardUpdatedAt,
  type LeaderboardMode,
  type GlobalLeaderboardEntry,
  type LeaderboardResponse,
  type LeaderboardLoadStatus,
} from './leaderboardService';
