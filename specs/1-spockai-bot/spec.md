# Feature Specification: SpockAI Personal Assistant Bot

**Status**: Draft (Clarified)
**Created**: 2026-02-04
**Last Updated**: 2026-02-04
**Clarification Round**: 1 (4 questions resolved)

## Overview

### Description

SpockAI is a personal AI assistant bot that runs as a background service to help manage and prioritize information from multiple sources. It aggregates emails from multiple accounts, calendar events, AI development task priorities, and external service requests into a unified view with intelligent prioritization and real-time notifications via Telegram or Microsoft Teams. Users interact with SpockAI through a dockable chat window that supports conversational configuration and natural language queries.

### Foundation

SpockAI will be built on top of **[OpenClaw](https://github.com/openclaw/openclaw)**, an open-source personal AI assistant framework. OpenClaw provides:

- Cross-platform background service infrastructure
- Telegram/Discord/WhatsApp messaging integration
- Skills/plugins architecture for extensibility
- Memory and context management capabilities

SpockAI extends OpenClaw with custom skills for email management, calendar integration, BEANS file scanning, and external service connections.

### Goals

- Consolidate information from multiple email accounts into a single prioritized view
- Provide instant awareness of high-priority items requiring attention
- Surface upcoming calendar appointments for the user and shared calendars
- Track and display priority AI development tasks from project files
- Deliver timely notifications through Telegram or Microsoft Teams for urgent items
- Enable management of external service integrations (ticket systems, project boards)
- Provide a conversational chat interface for configuration and interaction
- Support dockable window for quick access on Windows desktop

### Target Users

The primary user who owns and operates the system, managing personal and professional communications, calendars, and development projects across multiple platforms.

## User Scenarios & Testing

### Scenario 1: Morning Email Triage

**Given** the user has multiple email accounts connected and new emails have arrived overnight
**When** the user requests a priority summary
**Then** SpockAI displays emails ranked by priority with high-priority items at the top, showing sender, subject, and priority level

### Scenario 2: Calendar Awareness

**Given** the user has calendar events scheduled for today
**When** the user requests upcoming appointments
**Then** SpockAI shows appointments for the user and any shared calendars, including time, title, and participants

### Scenario 3: Development Task Tracking

**Given** the AI_development folder contains BEANS files with priority items
**When** SpockAI scans for priority 1 items
**Then** all priority 1 tasks are displayed with their source file and description

### Scenario 4: Real-time Notification

**Given** a high-priority email arrives or an urgent calendar reminder triggers
**When** the priority threshold is met
**Then** SpockAI sends a notification to the user's configured channel (Telegram or Teams) within 2 minutes

### Scenario 5: External Service Integration

**Given** the user has connected Samanage and Monday.com accounts
**When** new requests arrive in Samanage or updates occur in Monday.com
**Then** SpockAI retrieves and displays the relevant information

### Scenario 6: Conversational Configuration

**Given** the user opens the SpockAI chat window
**When** the user types "add my work email account"
**Then** SpockAI asks for email address, provider, and credentials through a guided conversation, then confirms successful setup

### Scenario 7: Teams Notification Channel

**Given** the user prefers Microsoft Teams over Telegram
**When** the user configures Teams as the notification channel
**Then** SpockAI sends all notifications to the configured Teams channel with rich adaptive cards

## Functional Requirements

### FR-1: Multi-Account Email Management

**Description**: Support connection and monitoring of multiple email accounts with automatic priority classification

**Priority Classification Rules** (clarified 2026-02-04):

- **VIP Sender List**: Configurable list of high-priority senders (managers, key clients, critical contacts)
- **Subject Keywords**: Match patterns like "URGENT", "ACTION REQUIRED", "CRITICAL", etc.
- **Combined Logic**: Email is high-priority if sender is VIP OR subject contains priority keywords

**Acceptance Criteria**:

- [ ] User can add, remove, and configure multiple email accounts
- [ ] System retrieves new emails at configurable intervals
- [ ] Emails are classified by priority (high/medium/low) using VIP list + keyword matching
- [ ] User can configure VIP sender list and priority keywords
- [ ] High-priority emails are immediately flagged for notification

### FR-2: Priority Email Display

**Description**: Present prioritized email list to user on demand

**Acceptance Criteria**:

- [ ] Display high-priority emails in a dedicated view
- [ ] Show sender, subject, received time, and priority level
- [ ] Allow user to mark emails as read/actioned
- [ ] Filter by account, priority, or date range

### FR-3: Calendar Integration

**Description**: Display upcoming appointments from user's calendar and shared calendars

**Calendar Discovery** (clarified 2026-02-04): Manual configuration - user explicitly adds each shared calendar by URL or ID. No auto-discovery.

**Acceptance Criteria**:

- [ ] Connect to user's primary calendar
- [ ] User can manually add shared/delegated calendars by URL or calendar ID
- [ ] Display appointments for configurable time window (today, week, etc.)
- [ ] Show appointment title, time, location, and participants

### FR-4: BEANS File Scanning

**Description**: Scan AI_development folder for BEANS files and extract priority items using [hmans/beans](https://github.com/hmans/beans) format

**BEANS File Format** (updated 2026-02-04): Markdown files with YAML frontmatter in `.beans/` directories:

```markdown
---
title: Task description here
status: todo
type: task
priority: 1
created_at: 2026-02-04T10:00:00Z
updated_at: 2026-02-04T10:00:00Z
---

Detailed task description in markdown body.
```

**Key Fields**:

- `title`: Task name
- `status`: todo, in_progress, completed
- `type`: task, bug, feature
- `priority`: 1 (highest) to 4 (lowest), or string values
- `parent`: Optional parent bean ID for hierarchies
- `blocking`/`blocked_by`: Dependency tracking

**Acceptance Criteria**:

- [ ] Automatically discover `.beans/` directories in configured paths
- [ ] Parse YAML frontmatter to extract priority field
- [ ] Filter and display items where priority = 1 (or "high")
- [ ] Display aggregated priority 1 items with source file reference
- [ ] Refresh at configurable intervals

### FR-5: Notifications (Telegram/Teams)

**Description**: Send real-time notifications to user's Telegram chat or Microsoft Teams channel

**Rate Limiting** (clarified 2026-02-04): Digest mode - bundle multiple notifications into a single message every N minutes (configurable, default 5 min) to prevent notification spam.

**Acceptance Criteria**:

- [ ] User can choose notification channel: Telegram OR Microsoft Teams
- [ ] User can configure Telegram bot token and chat ID (if Telegram selected)
- [ ] User can configure Teams incoming webhook URL (if Teams selected)
- [ ] Notifications bundled into digest messages at configurable intervals (default 5 min)
- [ ] Notifications sent for high-priority emails within digest window
- [ ] Notifications sent for calendar reminders at configured lead time
- [ ] User can enable/disable notification types individually
- [ ] Teams notifications use Adaptive Cards for rich formatting

### FR-6: Background Service Operation

**Description**: Run as a persistent background service on any machine

**Acceptance Criteria**:

- [ ] Service starts automatically on system boot (configurable)
- [ ] Service runs without requiring user interface interaction
- [ ] Service recovers gracefully from errors and restarts
- [ ] Resource usage remains within acceptable limits

### FR-7: External Service Integration

**Description**: Connect to and retrieve data from external services

**Acceptance Criteria**:

- [ ] Support Samanage integration for retrieving service requests
- [ ] Support Monday.com integration for project information and issues
- [ ] Allow user to add new integration endpoints
- [ ] Display integrated data in unified view

### FR-8: Configuration Management

**Description**: Allow user to configure all system settings

**Acceptance Criteria**:

- [ ] Add/remove email accounts and set credentials securely
- [ ] Configure priority rules for email classification
- [ ] Set notification preferences and thresholds
- [ ] Manage external service API connections

### FR-9: Conversational Chat Interface

**Description**: Provide a dockable chat window for natural language interaction and configuration

**Acceptance Criteria**:

- [ ] Small chat window launches from system tray or command
- [ ] Window can dock/snap to any edge of the Windows screen
- [ ] User can configure all settings through natural language conversation
- [ ] SpockAI asks clarifying questions when needed (guided setup wizard)
- [ ] Display information and responses in conversational format
- [ ] Support queries like "show my high priority emails" or "what's on my calendar today"
- [ ] Window remembers position and docking state between sessions
- [ ] Minimize to system tray when not in use

### FR-10: Microsoft Teams Integration

**Description**: Support Microsoft Teams as an alternative notification and interaction channel

**Acceptance Criteria**:

- [ ] User can configure Teams incoming webhook for notifications
- [ ] Notifications rendered as Adaptive Cards with action buttons
- [ ] Support Teams channel or direct message delivery
- [ ] Two-way interaction: user can query SpockAI from Teams chat
- [ ] Rich formatting for email summaries, calendar views, and priority items

## Success Criteria

| Metric                        | Target        | Measurement Method                                |
| ----------------------------- | ------------- | ------------------------------------------------- |
| Email retrieval latency       | < 5 minutes   | Time from email arrival to display in system      |
| Notification delivery time    | < 2 minutes   | Time from trigger event to Telegram message       |
| Priority classification accuracy | > 90%      | User feedback on correct prioritization           |
| System uptime                 | > 99%         | Service availability monitoring                   |
| User time saved per day       | > 30 minutes  | User survey comparing before/after workflow       |

## Key Entities

| Entity              | Description                                    | Key Attributes                                           |
| ------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| Email Account       | Connected email service account                | Provider, address, credentials, sync interval            |
| Email               | Individual email message                       | Subject, sender, received time, priority, read status    |
| Calendar            | Connected calendar source                      | Provider, owner, shared status                           |
| Appointment         | Calendar event                                 | Title, start/end time, location, participants            |
| BEANS File          | AI development priority file                   | File path, last scanned, items count                     |
| Priority Item       | Task from BEANS file                           | Description, priority level, source file                 |
| Notification Rule   | Trigger condition for alerts                   | Event type, priority threshold, channel, enabled status  |
| Notification Channel| Delivery method (Telegram or Teams)            | Channel type, webhook URL or bot token, chat ID          |
| External Service    | Third-party integration                        | Service type, API endpoint, credentials                  |
| Chat Message        | User or system message in chat window          | Content, timestamp, sender (user/system), intent         |
| Conversation Context| State of ongoing chat configuration            | Current wizard step, collected values, pending questions |

## Assumptions

- OpenClaw framework is suitable as foundation and supports required extensibility
- User has valid credentials for all email accounts to be connected
- User has either a Telegram account OR Microsoft Teams access for notifications
- BEANS files use [hmans/beans](https://github.com/hmans/beans) format with YAML frontmatter (see FR-4)
- External services (Samanage, Monday.com) provide API access
- The host machine has persistent internet connectivity
- User has appropriate permissions for shared calendars
- Windows desktop environment for dockable chat window (Electron-based)
- Teams webhook permissions available if Teams channel selected

## Out of Scope

- Composing or sending emails (read-only access)
- Creating or modifying calendar events (read-only access)
- Editing BEANS files or modifying priorities
- Two-way synchronization with external services (read-only initially)
- Mobile application (background service + desktop chat only)
- Multi-user support (single user system)
- Natural language processing for email content analysis (simple intent parsing only)
- macOS/Linux native chat window (Windows-first, cross-platform via Electron possible later)
