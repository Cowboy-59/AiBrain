/**
 * SpockAI Chat Types
 * Type definitions for conversational chat interface
 */

import type { BaseEntity } from '../types/index.js';

// Message role
export type MessageRole = 'user' | 'assistant' | 'system';

// Chat message
export interface ChatMessage extends BaseEntity {
  role: MessageRole;
  content: string;
  timestamp: Date;
  metadata?: MessageMetadata;
}

// Message metadata
export interface MessageMetadata {
  intent?: string;
  entities?: Record<string, unknown>;
  confidence?: number;
  sourceSkill?: string;
  actionTaken?: string;
}

// Conversation context
export interface ConversationContext {
  conversationId: string;
  messages: ChatMessage[];
  activeIntent?: ConfigurationIntent;
  pendingQuestions: string[];
  collectedData: Record<string, unknown>;
  startedAt: Date;
  lastActivityAt: Date;
}

// Configuration intent types
export type IntentType =
  | 'add_email_account'
  | 'remove_email_account'
  | 'configure_notifications'
  | 'add_calendar'
  | 'remove_calendar'
  | 'add_beans_path'
  | 'remove_beans_path'
  | 'connect_samanage'
  | 'connect_monday'
  | 'help'
  | 'status'
  | 'unknown';

// Configuration intent
export interface ConfigurationIntent {
  type: IntentType;
  confidence: number;
  entities: IntentEntities;
  requiredFields: string[];
  collectedFields: string[];
  complete: boolean;
}

// Extracted entities from user input
export interface IntentEntities {
  provider?: string;       // google, microsoft, telegram, teams
  email?: string;
  accountName?: string;
  path?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

// Wizard step
export interface WizardStep {
  id: string;
  prompt: string;
  field: string;
  type: 'text' | 'email' | 'boolean' | 'choice';
  choices?: string[];
  validation?: (value: string) => boolean;
  transform?: (value: string) => unknown;
}

// Wizard definition
export interface WizardDefinition {
  intentType: IntentType;
  steps: WizardStep[];
  onComplete: (data: Record<string, unknown>) => Promise<string>;
}

// Chat configuration
export interface ChatConfig {
  maxHistoryLength: number;
  systemPrompt: string;
  responseTimeout: number;  // Milliseconds
}

// Chat session status
export interface ChatSessionStatus {
  active: boolean;
  conversationId?: string;
  messageCount: number;
  activeIntent?: IntentType;
  lastActivity?: Date;
}

// Window position for docking
export interface WindowPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  docked: boolean;
  dockPosition?: 'left' | 'right' | 'top' | 'bottom';
}

// Tray action
export type TrayAction = 'open' | 'close' | 'status' | 'quit';

// Quick action for tray menu
export interface QuickAction {
  label: string;
  action: TrayAction | (() => void);
  icon?: string;
  shortcut?: string;
}
