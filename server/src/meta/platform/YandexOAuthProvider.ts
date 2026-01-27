/**
 * Yandex OAuth Provider
 * Exchanges authorization code for user info via Yandex OAuth API
 *
 * TODO: Implement OAuth state parameter for CSRF protection (P2)
 * - Generate random state on auth URL creation
 * - Store state in Redis/memory with TTL 10 min
 * - Verify state on callback before exchanging code
 */

export interface YandexUserInfo {
  id: string;
  login: string;
  display_name?: string;
  default_avatar_id?: string;
}

export class YandexOAuthProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor() {
    const clientId = process.env.YANDEX_CLIENT_ID;
    const clientSecret = process.env.YANDEX_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('YANDEX_CLIENT_ID and YANDEX_CLIENT_SECRET must be set');
    }

    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Exchange authorization code for user info
   */
  async exchangeCode(code: string): Promise<YandexUserInfo> {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Yandex token exchange failed: ${error}`);
    }

    const tokens = await tokenResponse.json() as { access_token: string };

    // Get user info
    const userResponse = await fetch('https://login.yandex.ru/info?format=json', {
      headers: {
        Authorization: `OAuth ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch Yandex user info');
    }

    const userInfo = await userResponse.json() as YandexUserInfo;

    if (!userInfo.id) {
      throw new Error('Invalid Yandex user response: missing id');
    }

    return userInfo;
  }

  /**
   * Build avatar URL from avatar ID
   */
  static getAvatarUrl(avatarId?: string): string | undefined {
    if (!avatarId) return undefined;
    return `https://avatars.yandex.net/get-yapic/${avatarId}/islands-200`;
  }
}

// Lazy singleton
let instance: YandexOAuthProvider | null = null;

export function getYandexOAuthProvider(): YandexOAuthProvider {
  if (!instance) {
    instance = new YandexOAuthProvider();
  }
  return instance;
}
