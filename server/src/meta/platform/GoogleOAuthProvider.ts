/**
 * Google OAuth Provider
 * Exchanges authorization code for user info via Google Identity API
 */

export interface GoogleUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export class GoogleOAuthProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/oauth/callback';

    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
    }

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  /**
   * Exchange authorization code for user info
   */
  async exchangeCode(code: string): Promise<GoogleUserInfo> {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Google token exchange failed: ${error}`);
    }

    const tokens = await tokenResponse.json() as { access_token: string };

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch Google user info');
    }

    const userInfo = await userResponse.json() as GoogleUserInfo;

    if (!userInfo.id) {
      throw new Error('Invalid Google user response: missing id');
    }

    return userInfo;
  }
}

// Lazy singleton
let instance: GoogleOAuthProvider | null = null;

export function getGoogleOAuthProvider(): GoogleOAuthProvider {
  if (!instance) {
    instance = new GoogleOAuthProvider();
  }
  return instance;
}
