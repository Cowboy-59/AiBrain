/**
 * SpockAI Outlook OAuth Handler
 * Handles Microsoft OAuth2 authentication for Outlook/Exchange
 */

import type { OAuthTokenResponse } from './types.js';
import { emailLogger } from '../utils/logger.js';

// Microsoft Graph scopes for mail
const OUTLOOK_SCOPES = [
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/User.Read',
  'offline_access'
];

export interface OutlookAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tenantId?: string; // 'common' for multi-tenant, or specific tenant ID
}

/**
 * Outlook/Microsoft OAuth Handler
 */
export class OutlookAuthHandler {
  private config: OutlookAuthConfig;
  private tokenEndpoint: string;
  private authEndpoint: string;

  constructor(config: OutlookAuthConfig) {
    this.config = config;
    const tenant = config.tenantId ?? 'common';
    this.tokenEndpoint = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
    this.authEndpoint = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: OUTLOOK_SCOPES.join(' '),
      response_mode: 'query',
      prompt: 'consent'
    });

    if (state) {
      params.set('state', state);
    }

    return `${this.authEndpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<OAuthTokenResponse> {
    try {
      const response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: this.config.redirectUri,
          grant_type: 'authorization_code',
          scope: OUTLOOK_SCOPES.join(' ')
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const data = await response.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        token_type: string;
        scope?: string;
      };

      emailLogger.info('Outlook OAuth tokens obtained');

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope
      };
    } catch (error) {
      emailLogger.error('Failed to exchange Outlook OAuth code', { error });
      throw new Error('Outlook authentication failed');
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<OAuthTokenResponse> {
    try {
      const response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          scope: OUTLOOK_SCOPES.join(' ')
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
      }

      const data = await response.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        token_type: string;
      };

      emailLogger.info('Outlook OAuth token refreshed');

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? refreshToken,
        expiresIn: data.expires_in,
        tokenType: data.token_type
      };
    } catch (error) {
      emailLogger.error('Failed to refresh Outlook token', { error });
      throw new Error('Outlook token refresh failed');
    }
  }

  /**
   * Verify token is still valid by calling Graph API
   */
  async verifyToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get user profile from Microsoft Graph
   */
  async getUserProfile(accessToken: string): Promise<{ email: string; displayName: string } | null> {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as {
        mail?: string;
        userPrincipalName: string;
        displayName: string;
      };

      return {
        email: data.mail ?? data.userPrincipalName,
        displayName: data.displayName
      };
    } catch {
      return null;
    }
  }
}

/**
 * Create Outlook auth handler from environment
 */
export function createOutlookAuthHandler(): OutlookAuthHandler | null {
  const clientId = process.env['OUTLOOK_CLIENT_ID'];
  const clientSecret = process.env['OUTLOOK_CLIENT_SECRET'];
  const redirectUri = process.env['OUTLOOK_REDIRECT_URI'] ?? 'http://localhost:3000/oauth/outlook/callback';
  const tenantId = process.env['OUTLOOK_TENANT_ID'];

  if (!clientId || !clientSecret) {
    emailLogger.warn('Outlook OAuth not configured - missing OUTLOOK_CLIENT_ID or OUTLOOK_CLIENT_SECRET');
    return null;
  }

  return new OutlookAuthHandler({
    clientId,
    clientSecret,
    redirectUri,
    tenantId
  });
}
