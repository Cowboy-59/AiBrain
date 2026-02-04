# Data Model: SpockAI Personal Assistant Bot

**Date**: 2026-02-04
**Branch**: 1-spockai-bot

## Overview

SpockAI data is primarily configuration-based, stored in OpenClaw's JSON configuration at `~/.openclaw/openclaw.json`. Runtime data (emails, appointments, tasks) is ephemeral and fetched on demand.

## Core Entities

### EmailAccount

Represents a connected email account for monitoring.

```typescript
interface EmailAccount {
  id: string;                    // Unique identifier (UUID)
  name: string;                  // Display name (e.g., "Work Gmail")
  provider: EmailProvider;       // 'gmail' | 'outlook' | 'imap'
  email: string;                 // Email address
  credentials: EmailCredentials; // Provider-specific auth
  syncInterval: number;          // Sync interval in minutes (default: 5)
  enabled: boolean;              // Whether to monitor this account
  priorityRules: PriorityRule[]; // Account-specific priority rules
  lastSync?: Date;               // Last successful sync timestamp
}

type EmailProvider = 'gmail' | 'outlook' | 'imap';

interface EmailCredentials {
  // For IMAP
  imapHost?: string;
  imapPort?: number;
  username?: string;
  password?: string;  // Encrypted at rest
  
  // For OAuth (Gmail, Outlook)
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
}
```

### Email (Runtime)

Represents an email message fetched from an account.

```typescript
interface Email {
  id: string;              // Message ID from provider
  accountId: string;       // Reference to EmailAccount
  subject: string;
  sender: string;
  senderEmail: string;
  receivedAt: Date;
  priority: Priority;      // Computed from rules
  isRead: boolean;
  snippet?: string;        // Preview text
  labels?: string[];       // Provider labels/folders
}

type Priority = 'high' | 'medium' | 'low';
```

### PriorityRule

Defines rules for automatic email priority classification.

```typescript
interface PriorityRule {
  id: string;
  name: string;
  condition: RuleCondition;
  priority: Priority;
  order: number;           // Evaluation order (lower = first)
}

interface RuleCondition {
  type: 'sender' | 'domain' | 'subject' | 'label';
  operator: 'equals' | 'contains' | 'matches';  // matches = regex
  value: string;
}
```

### CalendarSource

Represents a connected calendar.

```typescript
interface CalendarSource {
  id: string;
  name: string;
  provider: CalendarProvider;
  calendarId: string;        // Provider-specific calendar ID
  credentials: OAuthCredentials;
  isShared: boolean;         // True if delegated/shared calendar
  ownerEmail?: string;       // For shared calendars
  enabled: boolean;
  color?: string;            // Display color
}

type CalendarProvider = 'google' | 'microsoft';

interface OAuthCredentials {
  accessToken: string;
  refreshToken: string;
  tokenExpiry: Date;
}
```

### Appointment (Runtime)

Represents a calendar event.

```typescript
interface Appointment {
  id: string;
  calendarId: string;        // Reference to CalendarSource
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  isAllDay: boolean;
  attendees: Attendee[];
  reminderSent: boolean;     // Track if notification sent
}

interface Attendee {
  email: string;
  name?: string;
  responseStatus: 'accepted' | 'declined' | 'tentative' | 'needsAction';
}
```

### BeansConfig

Configuration for BEANS file scanning. Uses [hmans/beans](https://github.com/hmans/beans) format.

```typescript
interface BeansConfig {
  scanPaths: string[];       // Directories containing .beans/ folders
  scanInterval: number;      // Minutes between scans (default: 5)
  enabled: boolean;
}
```

### Bean (Runtime)

Represents a task/issue from BEANS files (hmans/beans YAML frontmatter format).

```typescript
interface Bean {
  id: string;                // NanoID from filename (e.g., "beans-0ajg")
  slug?: string;             // Optional slug from filename
  title: string;             // Task title from frontmatter
  status: BeanStatus;        // Task status
  type?: BeanType;           // Task type
  priority?: string | number; // Priority (1 = highest, or string like "high")
  tags?: string[];           // Optional tags
  createdAt?: Date;
  updatedAt?: Date;
  parent?: string;           // Parent bean ID for hierarchies
  blocking?: string[];       // IDs this bean blocks
  blockedBy?: string[];      // IDs blocking this bean
  body: string;              // Markdown content
  sourceFile: string;        // Full path to BEANS file
}

type BeanStatus = 'todo' | 'in_progress' | 'completed' | 'archived';
type BeanType = 'task' | 'bug' | 'feature' | 'epic';
```

### PriorityItem (Runtime, Filtered View)

Simplified view of high-priority beans for display.

```typescript
interface PriorityItem {
  id: string;
  sourceFile: string;        // Full path to BEANS file
  title: string;
  description: string;       // Body excerpt
  priority: number | string; // 1 = highest
  status: BeanStatus;
  extractedAt: Date;
}
```

### NotificationConfig

Configuration for notifications (Telegram or Teams).

```typescript
interface NotificationConfig {
  channel: NotificationChannel;
  telegram?: TelegramConfig;
  teams?: TeamsConfig;
  digestInterval: number;    // Minutes between digest messages (default: 5)
  rules: NotificationRule[];
}

type NotificationChannel = 'telegram' | 'teams';

interface TelegramConfig {
  botToken: string;          // Telegram bot token
  chatId: string;            // User's chat ID
}

interface TeamsConfig {
  webhookUrl: string;        // Incoming webhook URL
  channelId?: string;        // Teams channel ID (for bot interaction)
  tenantId?: string;         // Azure AD tenant ID (for bot auth)
  botAppId?: string;         // Bot application ID (for bidirectional)
  botAppSecret?: string;     // Bot secret (encrypted at rest)
}

interface NotificationRule {
  id: string;
  eventType: NotificationEventType;
  enabled: boolean;
  options?: {
    leadTime?: number;       // Minutes before (for calendar)
    minPriority?: Priority;  // Minimum priority (for emails)
  };
}

type NotificationEventType = 
  | 'high_priority_email'
  | 'calendar_reminder'
  | 'beans_priority_1'
  | 'samanage_new_request'
  | 'monday_update';
```

### ExternalService

Configuration for external service integrations.

```typescript
interface ExternalService {
  id: string;
  type: ServiceType;
  name: string;
  baseUrl: string;
  credentials: ServiceCredentials;
  enabled: boolean;
  syncInterval: number;      // Minutes
}

type ServiceType = 'samanage' | 'monday';

interface ServiceCredentials {
  apiKey?: string;
  apiToken?: string;
  // Additional provider-specific fields
}
```

### ChatMessage

Represents a message in the conversational chat interface.

```typescript
interface ChatMessage {
  id: string;
  content: string;
  sender: ChatSender;
  timestamp: Date;
  intent?: ConfigurationIntent;  // Detected intent (if any)
  relatedEntityId?: string;      // Reference to configured entity
}

type ChatSender = 'user' | 'system';
```

### ConversationContext

Tracks state during multi-step configuration conversations.

```typescript
interface ConversationContext {
  id: string;
  wizardType?: WizardType;       // Current wizard (if in guided setup)
  currentStep: number;
  collectedValues: Record<string, unknown>;
  pendingQuestion?: string;
  startedAt: Date;
  lastActivity: Date;
}

type WizardType =
  | 'add_email_account'
  | 'add_calendar'
  | 'configure_notifications'
  | 'add_external_service'
  | 'configure_beans';
```

### ConfigurationIntent

Detected intent from user's natural language input.

```typescript
interface ConfigurationIntent {
  type: IntentType;
  confidence: number;            // 0-1 confidence score
  entities: Record<string, string>;  // Extracted entities
  rawInput: string;
}

type IntentType =
  | 'add_email'
  | 'remove_email'
  | 'list_emails'
  | 'show_calendar'
  | 'add_calendar'
  | 'show_priority'
  | 'configure_notifications'
  | 'show_status'
  | 'help'
  | 'unknown';
```

## Entity Relationships

```
EmailAccount 1--* Email (runtime)
EmailAccount 1--* PriorityRule
CalendarSource 1--* Appointment (runtime)
BeansConfig --> PriorityItem (runtime, via scanning)
ExternalService --> ServiceData (runtime, via API)
NotificationConfig --> NotificationRule
```

## State Transitions

### Email Priority State

```
New Email Received
    ↓
Apply Priority Rules (in order)
    ↓
[First matching rule] → Set Priority
    ↓
[No match] → Set Low Priority
    ↓
[If High Priority] → Queue Notification
```

### Notification State

```
Event Triggered (email/calendar/beans)
    ↓
Check NotificationRule.enabled
    ↓
[Enabled] → Check conditions (leadTime, minPriority)
    ↓
[Conditions met] → Send Telegram Message
    ↓
Mark as notified (prevent duplicates)
```

## Validation Rules

| Entity | Field | Validation |
| ------ | ----- | ---------- |
| EmailAccount | email | Valid email format |
| EmailAccount | syncInterval | 1-60 minutes |
| PriorityRule | order | Unique within account |
| CalendarSource | calendarId | Non-empty string |
| NotificationConfig | telegram.botToken | Valid Telegram bot token format |
| NotificationConfig | telegram.chatId | Valid Telegram chat ID |
| ExternalService | baseUrl | Valid URL format |
