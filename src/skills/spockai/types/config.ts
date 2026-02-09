/**
 * SpockAI Configuration Types
 * Type definitions for all configuration structures
 */

import type {
  NotificationChannel,
  EmailProvider,
  CalendarProvider,
  Priority,
  NotificationEventType
} from './index.js';

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
export interface NotificationRule {
  id: string;
  eventType: NotificationEventType;
  enabled: boolean;
  options?: {
    leadTime?: number;
    minPriority?: Priority;
  };
}

// Notification configuration
export interface NotificationConfig {
  channel: NotificationChannel;
  telegram?: TelegramConfig;
  teams?: TeamsConfig;
  digestInterval: number;
  rules: NotificationRule[];
}

// Email credentials
export interface EmailCredentials {
  imapHost?: string;
  imapPort?: number;
  username?: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
}

// Priority rule condition
export interface RuleCondition {
  type: 'sender' | 'domain' | 'subject' | 'label';
  operator: 'equals' | 'contains' | 'matches';
  value: string;
}

// Priority rule
export interface PriorityRule {
  id: string;
  name: string;
  condition: RuleCondition;
  priority: Priority;
  order: number;
}

// Email account configuration
export interface EmailAccountConfig {
  id: string;
  name: string;
  provider: EmailProvider;
  email: string;
  credentials: EmailCredentials;
  syncInterval: number;
  enabled: boolean;
  priorityRules: PriorityRule[];
  lastSync?: Date;
}

// Global email rules
export interface GlobalEmailRules {
  vipSenders: string[];
  priorityKeywords: string[];
}

// Email configuration
export interface EmailConfig {
  accounts: EmailAccountConfig[];
  globalRules: GlobalEmailRules;
  syncInterval: number;
}

// Calendar source configuration
export interface CalendarSourceConfig {
  id: string;
  name: string;
  provider: CalendarProvider;
  calendarId: string;
  isShared: boolean;
  ownerEmail?: string;
  enabled: boolean;
  color?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
}

// Calendar configuration
export interface CalendarConfig {
  sources: CalendarSourceConfig[];
  defaultWindow: 'today' | 'week' | 'month';
}

// BEANS configuration
export interface BeansConfig {
  scanPaths: string[];
  scanInterval: number;
  enabled: boolean;
}

// Samanage service configuration
export interface SamanageConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
}

// Monday.com service configuration
export interface MondayConfig {
  enabled: boolean;
  apiToken: string;
}

// External services configuration
export interface ServicesConfig {
  samanage?: SamanageConfig;
  monday?: MondayConfig;
  syncInterval: number;  // Minutes between syncs
}

// Root SpockAI configuration
export interface SpockAIConfig {
  notifications: NotificationConfig;
  email: EmailConfig;
  calendar: CalendarConfig;
  beans: BeansConfig;
  services: ServicesConfig;
}

// Full OpenClaw config with SpockAI section
export interface OpenClawConfig {
  spockai: SpockAIConfig;
  [key: string]: unknown;
}
