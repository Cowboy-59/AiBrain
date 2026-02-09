/**
 * SpockAI Email Types
 * Type definitions for email management functionality
 */

import type { Priority, BaseEntity } from '../types/index.js';

// Email provider types
export type EmailProvider = 'gmail' | 'outlook' | 'imap';

// Email credentials for different providers
export interface EmailCredentials {
  // For IMAP
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  username?: string;
  password?: string;

  // For OAuth (Gmail, Outlook)
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
}

// Email account configuration
export interface EmailAccount extends BaseEntity {
  name: string;
  provider: EmailProvider;
  email: string;
  credentials: EmailCredentials;
  syncInterval: number;
  enabled: boolean;
  priorityRules: PriorityRule[];
  lastSync?: Date;
  lastError?: string;
}

// Email message
export interface Email extends BaseEntity {
  accountId: string;
  messageId: string;
  subject: string;
  sender: string;
  senderName?: string;
  senderEmail: string;
  recipients: string[];
  receivedAt: Date;
  priority: Priority;
  isRead: boolean;
  isStarred: boolean;
  snippet?: string;
  bodyPreview?: string;
  labels?: string[];
  threadId?: string;
  hasAttachments: boolean;
}

// Priority rule condition
export interface RuleCondition {
  type: 'sender' | 'senderEmail' | 'domain' | 'subject' | 'label';
  operator: 'equals' | 'contains' | 'matches' | 'startsWith' | 'endsWith';
  value: string;
  caseSensitive?: boolean;
}

// Priority rule
export interface PriorityRule extends BaseEntity {
  name: string;
  condition: RuleCondition;
  priority: Priority;
  order: number;
  enabled: boolean;
}

// Global email rules
export interface GlobalEmailRules {
  vipSenders: string[];
  priorityKeywords: string[];
}

// Email sync result
export interface EmailSyncResult {
  accountId: string;
  accountName: string;
  newEmails: number;
  totalEmails: number;
  highPriority: number;
  syncedAt: Date;
  error?: string;
}

// Email filter options
export interface EmailFilterOptions {
  accountId?: string;
  priority?: Priority;
  isRead?: boolean;
  unreadOnly?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  sender?: string;
  subject?: string;
  limit?: number;
  offset?: number;
}

// Email account status
export interface EmailAccountStatus {
  id: string;
  name: string;
  email: string;
  provider: EmailProvider;
  enabled: boolean;
  lastSync?: Date;
  lastError?: string;
  emailCount: number;
  highPriorityCount: number;
}

// IMAP connection options
export interface ImapConnectionOptions {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  authTimeout?: number;
  connTimeout?: number;
}

// OAuth token response
export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope?: string;
}

// Email fetch options
export interface EmailFetchOptions {
  maxResults?: number;
  since?: Date;
  unreadOnly?: boolean;
  includeBody?: boolean;
}
