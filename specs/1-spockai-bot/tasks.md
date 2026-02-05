# Tasks: SpockAI Personal Assistant Bot

**Input**: Design documents from /specs/1-spockai-bot/
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Branch**: 1-spockai-bot
**Date**: 2026-02-04

## User Stories (from spec.md)

| ID  | Story                        | Priority | Description                                                 |
| --- | ---------------------------- | -------- | ----------------------------------------------------------- |
| US1 | Morning Email Triage         | P1       | Multi-account email management with priority classification |
| US2 | Calendar Awareness           | P2       | Display upcoming appointments from user and shared calendars |
| US3 | Development Task Tracking    | P2       | Scan BEANS files for priority 1 items                       |
| US4 | Real-time Notifications      | P1       | Send Telegram/Teams notifications for high-priority events  |
| US5 | External Service Integration | P3       | Connect to Samanage and Monday.com                          |
| US6 | Conversational Chat Interface| P1       | Dockable chat window for configuration and interaction      |
| US7 | Teams Integration            | P2       | Microsoft Teams as alternative to Telegram                  |

## Phase 1: Setup

- [x] T001 Clone OpenClaw repository to project root
- [x] T002 Initialize pnpm workspace and install OpenClaw dependencies
- [x] T003 [P] Create SpockAI skills directory structure at ~/.openclaw/workspace/skills/spockai/
- [x] T004 [P] Configure TypeScript and ESLint for skills development
- [x] T005 [P] Create base configuration structure in ~/.openclaw/openclaw.json with spockai section

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T006 Create shared types in skills/spockai/types/index.ts
- [x] T007 Create configuration loader in skills/spockai/config/loader.ts
- [x] T008 [P] Create credential encryption utility in skills/spockai/utils/crypto.ts
- [x] T009 [P] Create logging utility in skills/spockai/utils/logger.ts
- [x] T010 Create base skill class in skills/spockai/base/skill.ts

## Phase 3: User Story 1 - Email Management [US1]

**Goal**: User can connect multiple email accounts and view prioritized emails
**Independent Test**: Send test email to connected account, verify it appears in priority list

### Models

- [x] T011 [P] [US1] Create EmailAccount interface in skills/spockai/email/types.ts
- [x] T012 [P] [US1] Create Email interface in skills/spockai/email/types.ts
- [x] T013 [P] [US1] Create PriorityRule interface in skills/spockai/email/types.ts

### Services

- [x] T014 [US1] Create IMAP client wrapper in skills/spockai/email/imap-client.ts
- [ ] T015 [US1] Create Gmail OAuth handler in skills/spockai/email/gmail-auth.ts
- [ ] T016 [US1] Create Outlook OAuth handler in skills/spockai/email/outlook-auth.ts
- [x] T017 [US1] Create EmailService with fetch/sync in skills/spockai/email/service.ts
- [x] T018 [US1] Create PriorityClassifier in skills/spockai/email/classifier.ts

### Skill Commands

- [x] T019 [US1] Create spockai-email SKILL.md definition in skills/spockai/email/SKILL.md
- [x] T020 [US1] Implement email list command in skills/spockai/email/commands/list.ts
- [x] T021 [US1] Implement email accounts command in skills/spockai/email/commands/accounts.ts
- [ ] T022 [US1] Implement email add command in skills/spockai/email/commands/add.ts
- [ ] T023 [US1] Implement email remove command in skills/spockai/email/commands/remove.ts
- [ ] T024 [US1] Implement email rules command in skills/spockai/email/commands/rules.ts

## Phase 4: User Story 4 - Telegram Notifications [US4]

**Goal**: User receives Telegram notifications for high-priority events
**Independent Test**: Trigger high-priority email, verify Telegram message received within 2 minutes

### Models

- [ ] T025 [P] [US4] Create NotificationConfig interface in skills/spockai/notify/types.ts
- [ ] T026 [P] [US4] Create NotificationRule interface in skills/spockai/notify/types.ts

### Services

- [ ] T027 [US4] Create TelegramNotifier using grammY in skills/spockai/notify/telegram.ts
- [ ] T028 [US4] Create NotificationService in skills/spockai/notify/service.ts
- [ ] T029 [US4] Create NotificationQueue with rate limiting in skills/spockai/notify/queue.ts

### Skill Commands

- [ ] T030 [US4] Create spockai-notify SKILL.md definition in skills/spockai/notify/SKILL.md
- [ ] T031 [US4] Implement notify status command in skills/spockai/notify/commands/status.ts
- [ ] T032 [US4] Implement notify enable/disable commands in skills/spockai/notify/commands/toggle.ts
- [ ] T033 [US4] Implement notify test command in skills/spockai/notify/commands/test.ts

### Integration

- [ ] T034 [US4] Wire email high-priority events to NotificationService in skills/spockai/email/service.ts
- [ ] T035 [US4] Add background polling for new emails with notification triggers

## Phase 5: User Story 2 - Calendar Integration [US2]

**Goal**: User can view upcoming appointments from personal and shared calendars
**Independent Test**: Add calendar, verify todays appointments display correctly

### Models

- [ ] T036 [P] [US2] Create CalendarSource interface in skills/spockai/calendar/types.ts
- [ ] T037 [P] [US2] Create Appointment interface in skills/spockai/calendar/types.ts

### Services

- [ ] T038 [US2] Create Google Calendar client in skills/spockai/calendar/google-client.ts
- [ ] T039 [US2] Create Microsoft Graph client in skills/spockai/calendar/microsoft-client.ts
- [ ] T040 [US2] Create CalendarService with fetch/sync in skills/spockai/calendar/service.ts

### Skill Commands

- [ ] T041 [US2] Create spockai-calendar SKILL.md definition in skills/spockai/calendar/SKILL.md
- [ ] T042 [US2] Implement calendar command in skills/spockai/calendar/commands/list.ts
- [ ] T043 [US2] Implement calendar accounts command in skills/spockai/calendar/commands/accounts.ts
- [ ] T044 [US2] Implement calendar add/remove commands in skills/spockai/calendar/commands/manage.ts

### Integration

- [ ] T045 [US2] Wire calendar reminders to NotificationService

## Phase 6: User Story 3 - BEANS File Scanning [US3]

**Goal**: User can view priority 1 items from BEANS files in AI_development
**Independent Test**: Create test BEANS file with priority 1 item, verify it appears in scan results

### Models

- [ ] T046 [P] [US3] Create BeansConfig interface in skills/spockai/beans/types.ts
- [ ] T047 [P] [US3] Create Bean interface (hmans/beans YAML frontmatter format) in skills/spockai/beans/types.ts

### Services

- [ ] T048 [US3] Create BeansParser with YAML frontmatter support using gray-matter in skills/spockai/beans/parser.ts
- [ ] T049 [US3] Create BeansScanner with directory watching in skills/spockai/beans/scanner.ts
- [ ] T050 [US3] Create BeansService in skills/spockai/beans/service.ts

### Skill Commands

- [ ] T051 [US3] Create spockai-beans SKILL.md definition in skills/spockai/beans/SKILL.md
- [ ] T052 [US3] Implement beans command in skills/spockai/beans/commands/list.ts
- [ ] T053 [US3] Implement beans scan command in skills/spockai/beans/commands/scan.ts
- [ ] T054 [US3] Implement beans paths command in skills/spockai/beans/commands/paths.ts

### Integration

- [ ] T055 [US3] Wire beans priority 1 items to NotificationService

## Phase 7: User Story 5 - External Services [US5]

**Goal**: User can connect and view data from Samanage and Monday.com
**Independent Test**: Connect test account, verify service requests/items display

### Models

- [ ] T056 [P] [US5] Create ExternalService interface in skills/spockai/services/types.ts
- [ ] T057 [P] [US5] Create ServiceRequest interface in skills/spockai/services/types.ts

### Services

- [ ] T058 [US5] Create SamanageClient in skills/spockai/services/samanage-client.ts
- [ ] T059 [US5] Create MondayClient in skills/spockai/services/monday-client.ts
- [ ] T060 [US5] Create ExternalServicesService in skills/spockai/services/service.ts

### Skill Commands

- [ ] T061 [US5] Create spockai-services SKILL.md definition in skills/spockai/services/SKILL.md
- [ ] T062 [US5] Implement services command in skills/spockai/services/commands/list.ts
- [ ] T063 [US5] Implement samanage command in skills/spockai/services/commands/samanage.ts
- [ ] T064 [US5] Implement monday command in skills/spockai/services/commands/monday.ts

### Integration

- [ ] T065 [US5] Wire external service updates to NotificationService

## Phase 8: User Story 6 - Conversational Chat Interface [US6]

**Goal**: User interacts with SpockAI through a dockable chat window for configuration and queries
**Independent Test**: Open chat window, configure email account through conversation, verify account added

### Models

- [ ] T066 [P] [US6] Create ChatMessage interface in skills/spockai/chat/types.ts
- [ ] T067 [P] [US6] Create ConversationContext interface in skills/spockai/chat/types.ts
- [ ] T068 [P] [US6] Create ConfigurationIntent interface in skills/spockai/chat/types.ts

### Services

- [ ] T069 [US6] Create ConversationEngine for natural language config in skills/spockai/chat/engine.ts
- [ ] T070 [US6] Create IntentParser for detecting config requests in skills/spockai/chat/intent-parser.ts
- [ ] T071 [US6] Create ConfigurationWizard for guided setup in skills/spockai/chat/wizard.ts
- [ ] T072 [US6] Create ResponseFormatter for conversational output in skills/spockai/chat/formatter.ts

### UI Components

- [ ] T073 [US6] Create Electron shell for dockable window in skills/spockai/chat/ui/app.ts
- [ ] T074 [US6] Implement window docking (snap to screen edges) in skills/spockai/chat/ui/docking.ts
- [ ] T075 [US6] Create chat message display component in skills/spockai/chat/ui/messages.tsx
- [ ] T076 [US6] Create input field with send button in skills/spockai/chat/ui/input.tsx
- [ ] T077 [US6] Implement system tray icon with quick actions in skills/spockai/chat/ui/tray.ts

### Skill Commands

- [ ] T078 [US6] Create spockai-chat SKILL.md definition in skills/spockai/chat/SKILL.md
- [ ] T079 [US6] Implement chat open command to launch window in skills/spockai/chat/commands/open.ts
- [ ] T080 [US6] Implement chat close command in skills/spockai/chat/commands/close.ts

## Phase 9: User Story 7 - Teams Integration [US7]

**Goal**: User can use Microsoft Teams as alternative to Telegram for notifications and chat
**Independent Test**: Configure Teams webhook, trigger notification, verify message appears in Teams channel

### Models

- [ ] T081 [P] [US7] Create TeamsConfig interface in skills/spockai/notify/teams-types.ts
- [ ] T082 [P] [US7] Create TeamsWebhook interface in skills/spockai/notify/teams-types.ts

### Services

- [ ] T083 [US7] Create TeamsNotifier using incoming webhooks in skills/spockai/notify/teams.ts
- [ ] T084 [US7] Create TeamsAdaptiveCardBuilder for rich messages in skills/spockai/notify/teams-cards.ts
- [ ] T085 [US7] Update NotificationService to support Teams as channel in skills/spockai/notify/service.ts

### Skill Commands

- [ ] T086 [US7] Implement notify teams-setup command in skills/spockai/notify/commands/teams-setup.ts
- [ ] T087 [US7] Implement notify channel command to switch Telegram/Teams in skills/spockai/notify/commands/channel.ts
- [ ] T088 [US7] Create Teams bot listener for bidirectional queries in skills/spockai/notify/teams-bot.ts

## Phase 10: Configuration and Polish

- [ ] T089 Create spockai-config SKILL.md definition in skills/spockai/config/SKILL.md
- [ ] T090 Implement config show command in skills/spockai/config/commands/show.ts
- [ ] T091 Implement config export command in skills/spockai/config/commands/export.ts
- [ ] T092 Implement config backup command in skills/spockai/config/commands/backup.ts
- [ ] T093 [P] Create installation script for systemd/Windows service
- [ ] T094 [FR-6] Implement graceful error recovery with automatic restart in skills/spockai/core/recovery.ts
- [ ] T095 [FR-6] Add health check endpoint for uptime monitoring in skills/spockai/core/health.ts
- [ ] T096 [FR-6] Implement resource usage monitoring (memory <100MB, CPU <5%) in skills/spockai/core/monitor.ts
- [ ] T097 [P] Add comprehensive error handling across all skills
- [ ] T098 [P] Add request/response logging for debugging
- [ ] T099 [NFR] Add priority classification accuracy measurement (target >90%) in skills/spockai/core/metrics.ts
- [ ] T100 Update quickstart.md with actual tested commands
- [ ] T101 Create README.md for skills/spockai/ directory
- [ ] T102 Run full integration test: email to notification to Telegram/Teams

## Dependencies

Phase 1 (Setup) -> Phase 2 (Foundational) -> Phase 3+ (User Stories)

**User Story Dependencies**:

- US1 (Email) blocks US4 (Notifications) for email triggers
- US4 (Notifications) is needed by US2, US3, US5, US6, US7 for alert integration
- US2, US3, US5 are independent of each other
- US6 (Chat) can start after US4, enables conversational config
- US7 (Teams) can run parallel with US6, extends notification channels

**Recommended Order**:

1. Setup (T001-T005)
2. Foundational (T006-T010)
3. US1 Email (T011-T024) - Core functionality
4. US4 Notifications (T025-T035) - Enables alerts for all features
5. US2 Calendar (T036-T045) - Can run parallel with US3, US5
6. US3 BEANS (T046-T055) - Can run parallel with US2, US5
7. US5 Services (T056-T065) - Can run parallel with US2, US3
8. US6 Chat Interface (T066-T080) - Conversational UI
9. US7 Teams (T081-T088) - Can run parallel with US6
10. Polish (T089-T102)

## Implementation Strategy

**MVP Scope**: US1 (Email) + US4 (Notifications) + US6 (Chat)

- Complete Phases 1-4, 8 for functional email + notifications + chat interface
- This delivers core value: email priority awareness with conversational interaction

**Extended Scope**: Add US7 (Teams) for enterprise users

## Summary

| Metric                  | Value                   |
| ----------------------- | ----------------------- |
| **Total Tasks**         | 102                     |
| **US1 (Email)**         | 14 tasks                |
| **US2 (Calendar)**      | 10 tasks                |
| **US3 (BEANS)**         | 10 tasks                |
| **US4 (Notifications)** | 11 tasks                |
| **US5 (Services)**      | 10 tasks                |
| **US6 (Chat)**          | 15 tasks                |
| **US7 (Teams)**         | 8 tasks                 |
| **Setup/Foundational**  | 10 tasks                |
| **Polish**              | 14 tasks                |
| **Parallel [P]**        | 28 tasks                |
| **MVP Scope**           | 50 tasks (Phases 1-4,8) |
