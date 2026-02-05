/**
 * SpockAI Teams Notifier
 * Sends notifications via Microsoft Teams webhooks
 */

import type {
  TeamsConfig,
  TeamsMessagePayload,
  TeamsNotificationResult,
  AdaptiveCard
} from './teams-types.js';
import type { NotificationPayload, NotificationSendResult, Notifier } from './types.js';
import { TeamsAdaptiveCardBuilder, createTeamsAdaptiveCardBuilder } from './teams-cards.js';
import { notifyLogger } from '../utils/logger.js';

/**
 * Teams Notifier
 * Sends notifications to Microsoft Teams via incoming webhooks
 */
export class TeamsNotifier implements Notifier {
  private config: TeamsConfig;
  private cardBuilder: TeamsAdaptiveCardBuilder;
  private connected: boolean = false;

  constructor(config: TeamsConfig) {
    this.config = config;
    this.cardBuilder = createTeamsAdaptiveCardBuilder();
    notifyLogger.info('Teams notifier initialized');
  }

  /**
   * Connect (verify webhook)
   */
  async connect(): Promise<void> {
    if (!this.config.webhookUrl) {
      throw new Error('Teams webhook URL not configured');
    }

    // Verify webhook URL format
    if (!this.isValidWebhookUrl(this.config.webhookUrl)) {
      throw new Error('Invalid Teams webhook URL');
    }

    this.connected = true;
    notifyLogger.info('Teams notifier connected');
  }

  /**
   * Disconnect
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    notifyLogger.info('Teams notifier disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.config.enabled;
  }

  /**
   * Send a notification
   */
  async send(payload: NotificationPayload): Promise<NotificationSendResult> {
    if (!this.isConnected()) {
      return {
        success: false,
        error: 'Teams notifier not connected',
        timestamp: new Date()
      };
    }

    try {
      const card = this.cardBuilder.buildFromPayload(payload);
      const result = await this.sendCard(card);

      notifyLogger.info('Teams notification sent', {
        type: payload.type,
        success: result.success
      });

      return {
        success: result.success,
        messageId: result.messageId,
        timestamp: new Date()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      notifyLogger.error('Teams notification failed', { error: errorMessage });

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date()
      };
    }
  }

  /**
   * Send a digest of notifications
   */
  async sendDigest(notifications: NotificationPayload[]): Promise<NotificationSendResult> {
    if (!this.isConnected()) {
      return {
        success: false,
        error: 'Teams notifier not connected',
        timestamp: new Date()
      };
    }

    if (notifications.length === 0) {
      return {
        success: true,
        timestamp: new Date()
      };
    }

    try {
      const card = this.cardBuilder.buildDigestCard(notifications);
      const result = await this.sendCard(card);

      notifyLogger.info('Teams digest sent', {
        count: notifications.length,
        success: result.success
      });

      return {
        success: result.success,
        messageId: result.messageId,
        timestamp: new Date()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      notifyLogger.error('Teams digest failed', { error: errorMessage });

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date()
      };
    }
  }

  /**
   * Send a test notification
   */
  async sendTest(): Promise<NotificationSendResult> {
    const card = this.cardBuilder.buildNotificationCard(
      'Test Notification',
      'This is a test notification from SpockAI. If you see this, Teams integration is working correctly!',
      'success'
    );

    return this.sendCard(card);
  }

  /**
   * Send an adaptive card
   */
  private async sendCard(card: AdaptiveCard): Promise<TeamsNotificationResult> {
    const payload: TeamsMessagePayload = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          contentUrl: null,
          content: card
        }
      ]
    };

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Teams API error: ${response.status} - ${errorText}`);
      }

      // Teams webhooks return 1 on success
      const result = await response.text();

      return {
        success: result === '1' || response.ok,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Validate webhook URL format
   */
  private isValidWebhookUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      // Teams webhooks should be on Microsoft domains
      return (
        parsed.protocol === 'https:' &&
        (parsed.hostname.endsWith('.office.com') ||
         parsed.hostname.endsWith('.microsoft.com') ||
         parsed.hostname.includes('webhook.office.com'))
      );
    } catch {
      return false;
    }
  }

  /**
   * Get webhook URL (masked)
   */
  getWebhookUrl(): string {
    if (!this.config.webhookUrl) return 'Not configured';
    try {
      const url = new URL(this.config.webhookUrl);
      return `${url.protocol}//${url.hostname}/...`;
    } catch {
      return 'Invalid URL';
    }
  }
}

/**
 * Create Teams notifier
 */
export function createTeamsNotifier(config: TeamsConfig): TeamsNotifier {
  return new TeamsNotifier(config);
}
