# SpockAI Quickstart Guide

**Date**: 2026-02-04
**Branch**: 1-spockai-bot

## Prerequisites

- Node.js ≥22 installed
- pnpm installed (`npm install -g pnpm`)
- Telegram account with a bot created via @BotFather
- Email accounts with IMAP enabled or OAuth configured

## Installation

### 1. Install OpenClaw

```bash
# Clone OpenClaw
git clone https://github.com/openclaw/openclaw.git
cd openclaw

# Install dependencies
pnpm install

# Start OpenClaw (first time setup)
pnpm start
```

### 2. Install SpockAI Skills

```bash
# Navigate to OpenClaw workspace skills directory
cd ~/.openclaw/workspace/skills

# Clone SpockAI skills
git clone https://github.com/[your-org]/spockai-skills.git spockai

# Or install individual skills
mkdir -p spockai-email spockai-calendar spockai-beans spockai-services spockai-notify
```

### 3. Configure Telegram Bot

1. Open Telegram and message @BotFather
2. Send `/newbot` and follow prompts
3. Copy the bot token
4. Get your chat ID by messaging @userinfobot
5. Add to configuration:

```bash
# Edit OpenClaw config
nano ~/.openclaw/openclaw.json
```

Add SpockAI configuration:

```json
{
  "agent": {
    "model": "anthropic/claude-sonnet"
  },
  "spockai": {
    "telegram": {
      "botToken": "YOUR_BOT_TOKEN",
      "chatId": "YOUR_CHAT_ID"
    }
  }
}
```

## Quick Configuration

### Add Email Account (Gmail)

```
/email add "Work Gmail" gmail work@gmail.com
```

Follow the OAuth prompts in your browser.

### Add Email Account (IMAP)

```
/email add "Personal" imap me@domain.com
```

Then configure IMAP settings when prompted.

### Add Calendar

```
/calendar add google
```

Follow OAuth prompts to connect Google Calendar.

### Configure BEANS Scanning

```
/beans path add ~/AI_development
```

### Enable Notifications

```
/notify enable high_priority_email
/notify enable calendar_reminder
/notify enable beans_priority_1
```

## Verification

### Test Email Integration

```
/email list
```

Should show your recent high-priority emails.

### Test Calendar Integration

```
/calendar today
```

Should show today's appointments.

### Test BEANS Scanning

```
/beans scan
/beans
```

Should show priority 1 items from your BEANS files.

### Test Notifications

```
/notify test
```

Should receive a test message in Telegram.

## Running as Background Service

### Linux/macOS (systemd)

Create service file at `/etc/systemd/system/openclaw.service`:

```ini
[Unit]
Description=OpenClaw Personal AI Assistant
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username/openclaw
ExecStart=/usr/bin/node ./dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable openclaw
sudo systemctl start openclaw
```

### Windows (Task Scheduler)

1. Open Task Scheduler
2. Create Basic Task: "OpenClaw"
3. Trigger: At startup
4. Action: Start a program
5. Program: `node`
6. Arguments: `C:\path\to\openclaw\dist\index.js`
7. Start in: `C:\path\to\openclaw`

## Common Commands Reference

| Command | Description |
| ------- | ----------- |
| `/email list` | Show high-priority emails |
| `/email list all` | Show all emails |
| `/calendar` | Show today's appointments |
| `/calendar week` | Show this week's appointments |
| `/beans` | Show priority 1 tasks |
| `/services` | Show connected services |
| `/notify status` | Show notification settings |
| `/config show` | Show configuration summary |

## Troubleshooting

### Email Not Syncing

1. Check account status: `/email accounts`
2. Verify IMAP is enabled (Gmail: Settings > Forwarding and POP/IMAP)
3. Check credentials: `/email remove <name>` and re-add

### Calendar Not Showing Events

1. Check calendar status: `/calendar accounts`
2. Re-authenticate: `/calendar remove <name>` and re-add
3. Verify calendar permissions

### Notifications Not Working

1. Test notification: `/notify test`
2. Verify bot token and chat ID in config
3. Ensure you've started a conversation with your bot

### OpenClaw Won't Start

1. Check Node.js version: `node --version` (must be ≥22)
2. Reinstall dependencies: `pnpm install`
3. Check logs: `~/.openclaw/logs/`
