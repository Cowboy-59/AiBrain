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

Configuration for BEANS file scanning.

```typescript
interface BeansConfig {
  scanPaths: string[];       // Directories to scan
  scanInterval: number;      // Minutes between scans (default: 5)
  enabled: boolean;
}
```

### PriorityItem (Runtime)

Represents a priority item extracted from BEANS files.

```typescript
interface PriorityItem {
  id: string;
  sourceFile: string;        // Full path to BEANS file
  description: string;
  priority: number;          // 1 = highest
  extractedAt: Date;
}
```

### NotificationConfig

Configuration for Telegram notifications.

```typescript
interface NotificationConfig {
  telegram: {
    botToken: string;        // Telegram bot token
    chatId: string;          // User's chat ID
  };
  rules: NotificationRule[];
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
