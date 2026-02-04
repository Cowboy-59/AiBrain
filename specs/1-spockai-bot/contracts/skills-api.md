# SpockAI Skills API Contracts

**Date**: 2026-02-04
**Branch**: 1-spockai-bot

## Overview

SpockAI is implemented as a collection of OpenClaw skills. Each skill exposes commands that users can invoke via Telegram or other channels.

## Skill: spockai-email

### Commands

#### `email list [priority] [account]`
List emails, optionally filtered by priority or account.

**Input**:
- `priority` (optional): 'high' | 'medium' | 'low' | 'all' (default: 'high')
- `account` (optional): Account name filter

**Output**:
```
📧 High Priority Emails (3)

1. [Work] John Smith <john@company.com>
   Subject: Urgent: Project deadline moved
   Received: 5 minutes ago

2. [Personal] Mom <mom@email.com>
   Subject: Call me ASAP
   Received: 1 hour ago
```

#### `email accounts`
List configured email accounts.

**Output**:
```
📬 Email Accounts

1. Work Gmail (work@gmail.com) ✅ Active
   Last sync: 2 minutes ago

2. Personal (me@outlook.com) ✅ Active
   Last sync: 5 minutes ago
```

#### `email add <name> <provider> <email>`
Add a new email account (triggers OAuth flow for Gmail/Outlook).

#### `email remove <name>`
Remove an email account.

#### `email rules [account]`
List priority rules for an account.

#### `email rule add <account> <condition> <priority>`
Add a priority rule.

---

## Skill: spockai-calendar

### Commands

#### `calendar [today|week|month]`
Show upcoming appointments.

**Input**:
- Time range (default: 'today')

**Output**:
```
📅 Today's Appointments (3)

10:00 AM - 11:00 AM
  Team Standup
  📍 Zoom Meeting
  👥 5 attendees

2:00 PM - 3:00 PM
  1:1 with Manager
  📍 Office Room 301
```

#### `calendar accounts`
List connected calendars.

#### `calendar add <provider>`
Connect a new calendar (triggers OAuth).

#### `calendar remove <name>`
Disconnect a calendar.

---

## Skill: spockai-beans

### Commands

#### `beans [priority]`
Show priority items from BEANS files.

**Input**:
- `priority` (optional): Filter by priority level (default: 1)

**Output**:
```
🫘 Priority 1 Items (5)

1. [project-alpha/BEANS.md]
   Complete API documentation

2. [project-beta/BEANS.md]
   Fix authentication bug

3. [personal/BEANS.md]
   Review pull requests
```

#### `beans scan`
Force immediate scan of BEANS files.

#### `beans paths`
List configured scan paths.

#### `beans path add <path>`
Add a directory to scan.

#### `beans path remove <path>`
Remove a directory from scanning.

---

## Skill: spockai-services

### Commands

#### `services`
List connected external services.

**Output**:
```
🔗 External Services

1. Samanage ✅ Connected
   3 open requests

2. Monday.com ✅ Connected
   2 boards tracked
```

#### `samanage [requests|incidents]`
Show Samanage items.

#### `monday [board]`
Show Monday.com board items.

---

## Skill: spockai-notify

### Commands

#### `notify status`
Show notification configuration.

**Output**:
```
🔔 Notification Settings

✅ High Priority Emails
✅ Calendar Reminders (15 min before)
✅ BEANS Priority 1 Items
⬜ Samanage New Requests
⬜ Monday.com Updates
```

#### `notify enable <type>`
Enable a notification type.

#### `notify disable <type>`
Disable a notification type.

#### `notify test`
Send a test notification.

---

## Skill: spockai-config

### Commands

#### `config show`
Show current configuration summary.

#### `config export`
Export configuration (redacted credentials).

#### `config backup`
Create a configuration backup.

---

## Error Responses

All skills return errors in consistent format:

```
❌ Error: [error message]

Suggestion: [helpful suggestion if applicable]
```

## Rate Limiting

- Email sync: Minimum 1 minute between manual syncs
- Calendar sync: Minimum 1 minute between manual syncs
- BEANS scan: Minimum 30 seconds between scans
- Notifications: Maximum 10 per minute to prevent spam
