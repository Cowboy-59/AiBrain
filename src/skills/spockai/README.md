# SpockAI

Personal AI assistant for email management, calendar scheduling, development task tracking, and notifications.

## Features

- **Email Management**: Gmail and Outlook integration with smart triage and priority detection
- **Calendar Integration**: Calendar event reminders and conflict detection
- **BEANS Task Scanning**: Parse hmans/beans-style markdown files for TODOs and priority items
- **Notifications**: Telegram bot and Microsoft Teams webhook notifications
- **External Services**: Samanage and Monday.com integration for ticket tracking
- **Configuration**: Natural language chat configuration with wizards

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Configure (interactive)
npx spockai configure

# Start
npm start
```

## Skills

| Skill | Description | Commands |
|-------|-------------|----------|
| email | Email management | `/email check`, `/email triage`, `/email urgent` |
| calendar | Calendar reminders | `/calendar today`, `/calendar upcoming`, `/calendar remind` |
| beans | Task scanning | `/beans scan`, `/beans p1`, `/beans watch` |
| notify | Notifications | `/notify test`, `/notify channel`, `/notify mute` |
| services | External services | `/services status`, `/services sync`, `/services tickets` |
| chat | Configuration | `/chat configure`, `/chat wizard`, `/chat help` |
| config | Settings | `/config show`, `/config export`, `/config backup` |

## Configuration

SpockAI uses a YAML configuration file at `~/.openclaw/skills/spockai/config.yaml`:

```yaml
email:
  provider: gmail
  credentials:
    clientId: ${GMAIL_CLIENT_ID}
    clientSecret: ${GMAIL_CLIENT_SECRET}
  polling:
    intervalMs: 60000
  triage:
    priorityKeywords:
      - urgent
      - asap
      - critical

calendar:
  provider: google
  reminders:
    - minutesBefore: 15
    - minutesBefore: 5

beans:
  scanPaths:
    - ~/projects
  patterns:
    - "*.md"
    - "*.txt"

notifications:
  channel: telegram
  telegram:
    botToken: ${TELEGRAM_BOT_TOKEN}
    chatId: ${TELEGRAM_CHAT_ID}
  # Or Teams:
  # channel: teams
  # teams:
  #   webhookUrl: ${TEAMS_WEBHOOK_URL}

services:
  samanage:
    baseUrl: https://api.samanage.com
    apiToken: ${SAMANAGE_API_TOKEN}
  monday:
    apiToken: ${MONDAY_API_TOKEN}
    boardIds:
      - "123456789"
```

## Installation as Service

### Windows

```powershell
# Install as scheduled task (runs at login)
.\scripts\install.ps1 -Action install

# Start manually
.\scripts\install.ps1 -Action start

# Check status
.\scripts\install.ps1 -Action status

# Uninstall
.\scripts\install.ps1 -Action uninstall
```

### Linux (systemd)

```bash
# Install as user service
./scripts/install.sh install

# Start
systemctl --user start spockai

# Check status
systemctl --user status spockai

# View logs
journalctl --user -u spockai -f

# Uninstall
./scripts/install.sh uninstall
```

### macOS (launchd)

```bash
# Install as launch agent
./scripts/install.sh install

# Start
launchctl start com.spockai.agent

# View logs
tail -f ~/.openclaw/logs/spockai.log

# Uninstall
./scripts/install.sh uninstall
```

## Architecture

```
spockai/
├── base/           # BaseSkill framework
├── email/          # Email integration
├── calendar/       # Calendar integration
├── beans/          # BEANS task scanner
├── notify/         # Notification dispatching
├── services/       # External service clients
├── chat/           # Conversational configuration
├── config/         # Configuration management
├── core/           # Health, recovery, monitoring
├── utils/          # Logging, encryption
└── scripts/        # Installation scripts
```

## Requirements

- Node.js >= 22
- TypeScript >= 5.0
- For Gmail: Google Cloud project with Gmail API enabled
- For Outlook: Azure AD app registration
- For Telegram: Bot token from @BotFather
- For Teams: Incoming Webhook connector

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Memory usage | < 100 MB |
| CPU usage | < 5% idle |
| Email check latency | < 2s |
| Notification delivery | < 500ms |
| Uptime | 99.9% |

## Development

```bash
# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build
```

## License

MIT
