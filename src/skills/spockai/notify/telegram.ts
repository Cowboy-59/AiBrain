/**
 * SpockAI Telegram Notifier
 * Sends notifications via Telegram using grammY
 */

import { Bot } from 'grammy';
import type {
  TelegramConfig,
  NotificationPayload,
  NotificationSendResult,
  Notifier
} from './types.js';
import { notifyLogger } from '../utils/logger.js';

/**
 * Telegram Notifier using grammY
 */
export class TelegramNotifier implements Notifier {
  private bot: Bot | null = null;
  private config: TelegramConfig;
  private connected: boolean = false;

  constructor(config: TelegramConfig) {
    this.config = config;
  }

  /**
   * Connect to Telegram
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (!this.config.botToken) {
      throw new Error('Telegram bot token not configured');
    }

    try {
      this.bot = new Bot(this.config.botToken);

      // Verify bot connection
      const me = await this.bot.api.getMe();
      notifyLogger.info('Telegram bot connected', { botName: me.username });

      this.connected = true;
    } catch (error) {
      notifyLogger.error('Failed to connect Telegram bot', { error });
      throw new Error('Telegram connection failed');
    }
  }

  /**
   * Disconnect from Telegram
   */
  async disconnect(): Promise<void> {
    if (this.bot) {
      await this.bot.stop();
      this.bot = null;
    }
    this.connected = false;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.bot !== null;
  }

  /**
   * Send a notification
   */
  async send(payload: NotificationPayload): Promise<NotificationSendResult> {
    if (!this.bot || !this.connected) {
      return {
        success: false,
        error: 'Telegram not connected',
        timestamp: new Date()
      };
    }

    try {
      const message = this.formatMessage(payload);

      const result = await this.bot.api.sendMessage(this.config.chatId, message, {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true }
      });

      notifyLogger.info('Telegram notification sent', {
        messageId: result.message_id,
        type: payload.type
      });

      return {
        success: true,
        messageId: result.message_id.toString(),
        timestamp: new Date()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      notifyLogger.error('Failed to send Telegram notification', { error: errorMessage });

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date()
      };
    }
  }

  /**
   * Send a digest notification
   */
  async sendDigest(notifications: NotificationPayload[]): Promise<NotificationSendResult> {
    if (!this.bot || !this.connected) {
      return {
        success: false,
        error: 'Telegram not connected',
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
      const message = this.formatDigest(notifications);

      const result = await this.bot.api.sendMessage(this.config.chatId, message, {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true }
      });

      notifyLogger.info('Telegram digest sent', {
        messageId: result.message_id,
        itemCount: notifications.length
      });

      return {
        success: true,
        messageId: result.message_id.toString(),
        timestamp: new Date()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      notifyLogger.error('Failed to send Telegram digest', { error: errorMessage });

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date()
      };
    }
  }

  /**
   * Send a test message
   */
  async sendTest(): Promise<NotificationSendResult> {
    return this.send({
      type: 'high_priority_email',
      title: '🧪 Test Notification',
      message: 'This is a test notification from SpockAI. If you receive this, your Telegram notifications are working correctly!',
      timestamp: new Date()
    });
  }

  /**
   * Format notification payload to Telegram message
   */
  private formatMessage(payload: NotificationPayload): string {
    const icon = this.getIcon(payload.type);
    const priorityBadge = payload.priority === 'high' ? '🔴 ' : '';

    let message = `${icon} *${payload.title}*\n\n`;
    message += `${priorityBadge}${payload.message}`;

    if (payload.actions && payload.actions.length > 0) {
      message += '\n\n';
      for (const action of payload.actions) {
        if (action.url) {
          message += `[${action.label}](${action.url})\n`;
        }
      }
    }

    message += `\n\n_${this.formatTime(payload.timestamp)}_`;

    return message;
  }

  /**
   * Format digest to Telegram message
   */
  private formatDigest(notifications: NotificationPayload[]): string {
    const itemCount = notifications.length;
    const now = new Date();
    let message = `📋 *SpockAI Digest* (${itemCount} items)\n`;
    message += `_${this.formatTime(now)}_\n\n`;

    // Group by type
    const byType = new Map<string, NotificationPayload[]>();
    for (const item of notifications) {
      const existing = byType.get(item.type) ?? [];
      existing.push(item);
      byType.set(item.type, existing);
    }

    for (const [type, items] of byType) {
      const icon = this.getIcon(type as NotificationPayload['type']);
      message += `${icon} *${this.formatTypeName(type)}* (${items.length})\n`;

      for (const item of items.slice(0, 5)) {
        const priorityBadge = item.priority === 'high' ? '🔴' : '•';
        message += `${priorityBadge} ${item.title}\n`;
      }

      if (items.length > 5) {
        message += `_...and ${items.length - 5} more_\n`;
      }

      message += '\n';
    }

    return message;
  }

  /**
   * Get icon for notification type
   */
  private getIcon(type: NotificationPayload['type']): string {
    switch (type) {
      case 'high_priority_email':
        return '📧';
      case 'calendar_reminder':
        return '📅';
      case 'beans_priority_1':
        return '📝';
      case 'samanage_new_request':
        return '🎫';
      case 'monday_update':
        return '📊';
      default:
        return '🔔';
    }
  }

  /**
   * Format type name for display
   */
  private formatTypeName(type: string): string {
    const names: Record<string, string> = {
      high_priority_email: 'High-Priority Emails',
      calendar_reminder: 'Calendar Reminders',
      beans_priority_1: 'Priority Tasks',
      samanage_new_request: 'Service Requests',
      monday_update: 'Monday Updates'
    };
    return names[type] ?? type;
  }

  /**
   * Format time for display
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

/**
 * Create Telegram notifier from config
 */
export function createTelegramNotifier(config: TelegramConfig): TelegramNotifier {
  return new TelegramNotifier(config);
}
