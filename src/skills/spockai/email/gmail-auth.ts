/**
 * SpockAI Gmail OAuth Handler
 * Handles Gmail OAuth2 authentication flow
 */

import { google } from 'googleapis';
import type { OAuthTokenResponse } from './types.js';
import { emailLogger } from '../utils/logger.js';

// Gmail OAuth scopes
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.labels'
];

export interface GmailAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Gmail OAuth Handler
 */
export class GmailAuthHandler {
  private oauth2Client: ReturnType<typeof google.auth.OAuth2.prototype.constructor>;
  private config: GmailAuthConfig;

  constructor(config: GmailAuthConfig) {
    this.config = config;
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GMAIL_SCOPES,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<OAuthTokenResponse> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token) {
        throw new Error('No access token received');
      }

      emailLogger.info('Gmail OAuth tokens obtained');

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expiry_date
          ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
          : 3600,
        tokenType: tokens.token_type ?? 'Bearer',
        scope: tokens.scope
      };
    } catch (error) {
      emailLogger.error('Failed to exchange Gmail OAuth code', { error });
      throw new Error('Gmail authentication failed');
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<OAuthTokenResponse> {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('Failed to refresh token');
      }

      emailLogger.info('Gmail OAuth token refreshed');

      return {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token ?? refreshToken,
        expiresIn: credentials.expiry_date
          ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
          : 3600,
        tokenType: credentials.token_type ?? 'Bearer'
      };
    } catch (error) {
      emailLogger.error('Failed to refresh Gmail token', { error });
      throw new Error('Gmail token refresh failed');
    }
  }

  /**
   * Get authenticated Gmail client
   */
  getGmailClient(accessToken: string, refreshToken?: string): ReturnType<typeof google.gmail> {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    return google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * Verify token is still valid
   */
  async verifyToken(accessToken: string): Promise<boolean> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      await this.oauth2Client.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create Gmail auth handler from environment
 */
export function createGmailAuthHandler(): GmailAuthHandler | null {
  const clientId = process.env['GMAIL_CLIENT_ID'];
  const clientSecret = process.env['GMAIL_CLIENT_SECRET'];
  const redirectUri = process.env['GMAIL_REDIRECT_URI'] ?? 'http://localhost:3000/oauth/gmail/callback';

  if (!clientId || !clientSecret) {
    emailLogger.warn('Gmail OAuth not configured - missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET');
    return null;
  }

  return new GmailAuthHandler({
    clientId,
    clientSecret,
    redirectUri
  });
}
