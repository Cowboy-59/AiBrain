/**
 * SpockAI Notification Types
 * Type definitions for notification system
 */

import type { Priority, BaseEntity, NotificationEventType } from '../types/index.js';

// Notification channel types
export type NotificationChannel = 'telegram' | 'teams';

// Telegram configuration
export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

// Teams configuration (including bidirectional support)
export interface TeamsConfig {
  webhookUrl: string;
  channelId?: string;
  tenantId?: string;
  botAppId?: string;
  botAppSecret?: string;
  enabled?: boolean;
}

// Notification rule
export interface NotificationRule extends BaseEntity {
  eventType: NotificationEventType;
  enabled: boolean;
  options?: NotificationRuleOptions;
}

export interface NotificationRuleOptions {
  leadTime?: number;      // Minutes before (for calendar)
  minPriority?: Priority; // Minimum priority (for emails)
  digestMode?: boolean;   // Bundle notifications
}

// Main notification configuration
export interface NotificationConfig {
  channel: NotificationChannel;
  telegram?: TelegramConfig;
  teams?: TeamsConfig;
  digestInterval: number;  // Minutes between digest messages
  rules: NotificationRule[];
}

// Notification payload
export interface NotificationPayload {
  type: NotificationEventType;
  title: string;
  message: string;
  priority?: Priority;
  timestamp: Date;
  sourceId?: string;
  url?: string;
  data?: Record<string, unknown>;
  actions?: NotificationAction[];
}

// Notification action (for interactive notifications)
export interface NotificationAction {
  id: string;
  label: string;
  url?: string;
  callback?: string;
}

// Notification status
export interface NotificationStatus {
  channel: NotificationChannel;
  connected: boolean;
  lastSent?: Date;
  lastError?: string;
  queueSize: number;
  rules: {
    type: NotificationEventType;
    enabled: boolean;
  }[];
}

// Queued notification
export interface QueuedNotification {
  id: string;
  payload: NotificationPayload;
  queuedAt: Date;
  attempts: number;
  lastAttempt?: Date;
  error?: string;
}

// Digest notification (bundled)
export interface DigestNotification {
  items: NotificationPayload[];
  digestStart: Date;
  digestEnd: Date;
}

// Notification send result
export interface NotificationSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}

// Event listener for notifications
export type NotificationListener = (payload: NotificationPayload) => void | Promise<void>;

// Notifier interface (implemented by Telegram, Teams)
export interface Notifier {
  send(payload: NotificationPayload): Promise<NotificationSendResult>;
  sendDigest(notifications: NotificationPayload[]): Promise<NotificationSendResult>;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
