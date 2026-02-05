# SpockAI Quickstart Guide

Get SpockAI running in 5 minutes.

## Prerequisites

- Node.js 22 or later
- A Telegram bot token (get from [@BotFather](https://t.me/botfather))

## Step 1: Install

```bash
cd src/skills/spockai
npm install
npm run build
```

## Step 2: Configure Telegram

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow prompts
3. Copy your bot token
4. Get your chat ID by messaging [@userinfobot](https://t.me/userinfobot)

Create `~/.openclaw/skills/spockai/config.yaml`:

```yaml
notifications:
  channel: telegram
  telegram:
    botToken: "YOUR_BOT_TOKEN"
    chatId: "YOUR_CHAT_ID"
```

## Step 3: Test Notifications

```bash
# Start SpockAI
npm start

# In another terminal, test notifications
curl -X POST http://localhost:3000/api/notify/test
```

You should receive a test message in Telegram.

## Step 4: Add Email (Optional)

### Gmail Setup

1. Create a Google Cloud project
2. Enable Gmail API
3. Create OAuth credentials
4. Add to config:

```yaml
email:
  provider: gmail
  credentials:
    clientId: "YOUR_CLIENT_ID"
    clientSecret: "YOUR_CLIENT_SECRET"
    refreshToken: "YOUR_REFRESH_TOKEN"
  polling:
    intervalMs: 60000
```

### Outlook Setup

1. Register an Azure AD app
2. Add Mail.Read permission
3. Add to config:

```yaml
email:
  provider: outlook
  credentials:
    clientId: "YOUR_CLIENT_ID"
    clientSecret: "YOUR_CLIENT_SECRET"
    tenantId: "YOUR_TENANT_ID"
```

## Step 5: Add BEANS Scanning (Optional)

Scan your projects for TODO items:

```yaml
beans:
  scanPaths:
    - "~/projects"
    - "~/notes"
  patterns:
    - "*.md"
    - "*.txt"
  watchEnabled: true
```

## Common Commands

### Email Commands

```
/email check          # Check for new emails
/email triage         # Get email summary with priorities
/email urgent         # Show only urgent emails
```

### Calendar Commands

```
/calendar today       # Today's events
/calendar upcoming    # Next 7 days
/calendar remind 15   # Set reminder for 15 minutes before events
```

### BEANS Commands

```
/beans scan           # Scan all paths for tasks
/beans p1             # Show priority 1 items only
/beans watch start    # Start file watcher
```

### Notification Commands

```
/notify test          # Send test notification
/notify channel teams # Switch to Teams
/notify mute 1h       # Mute for 1 hour
```

### Configuration Commands

```
/config show          # Display current config
/config export json   # Export as JSON
/config backup        # Create backup
/config restore       # Restore from backup
```

## Chat Configuration

SpockAI supports natural language configuration:

```
"Set up my email"
"Configure Telegram notifications"
"Add a scan path"
"Change notification channel to Teams"
```

## Running as a Service

### Windows

```powershell
.\scripts\install.ps1 -Action install
.\scripts\install.ps1 -Action start
```

### Linux

```bash
./scripts/install.sh install
systemctl --user start spockai
```

### macOS

```bash
./scripts/install.sh install
launchctl start com.spockai.agent
```

## Troubleshooting

### Notifications not working

1. Check bot token is correct
2. Verify chat ID (message @userinfobot)
3. Ensure bot was started with `/start` in Telegram
4. Check logs: `journalctl --user -u spockai -f`

### Email authentication fails

1. Verify credentials in config
2. For Gmail: ensure refresh token is valid
3. For Outlook: check tenant ID and permissions

### High memory usage

1. Check scan paths aren't too broad
2. Reduce polling frequency
3. Disable file watching if not needed

## Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "uptime": 3600000,
  "version": "0.1.0",
  "checks": [
    {"name": "recovery", "status": "pass"},
    {"name": "resources", "status": "pass"}
  ]
}
```

## Next Steps

- Configure external services (Samanage, Monday.com)
- Set up calendar integration
- Create custom notification templates
- Configure digest schedules
