/**
 * SpockAI Shared Types
 * Core type definitions used across all SpockAI skills
 */

// Priority types
export type Priority = 'high' | 'medium' | 'low';

// Notification channel types
export type NotificationChannel = 'telegram' | 'teams';

// Email provider types
export type EmailProvider = 'gmail' | 'outlook' | 'imap';

// Calendar provider types
export type CalendarProvider = 'google' | 'microsoft';

// External service types
export type ServiceType = 'samanage' | 'monday';

// Bean status types (hmans/beans format)
export type BeanStatus = 'todo' | 'in_progress' | 'completed' | 'archived';
export type BeanType = 'task' | 'bug' | 'feature' | 'epic';

// Chat types
export type ChatSender = 'user' | 'system';

// Base credentials interface
export interface OAuthCredentials {
  accessToken: string;
  refreshToken: string;
  tokenExpiry: Date;
}

// Notification event types
export type NotificationEventType =
  | 'high_priority_email'
  | 'calendar_reminder'
  | 'beans_priority_1'
  | 'samanage_new_request'
  | 'monday_update';

// Skill metadata interface
export interface SkillMetadata {
  name: string;
  version: string;
  description: string;
  commands: string[];
}

// Command result interface
export interface CommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Configuration validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Base entity with ID
export interface BaseEntity {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Paginated response
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Event emitter types for skill communication
export interface SkillEvent {
  type: string;
  source: string;
  timestamp: Date;
  data: unknown;
}

// Re-export for convenience
export * from './config.js';
