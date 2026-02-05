# SpockAI Notify Skill

**Name**: spockai-notify
**Version**: 0.1.0
**Description**: Real-time notifications via Telegram or Microsoft Teams

## Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/notify status` | Show notification status | `/notify status` |
| `/notify enable` | Enable notification type | `/notify enable <type>` |
| `/notify disable` | Disable notification type | `/notify disable <type>` |
| `/notify test` | Send test notification | `/notify test` |
| `/notify channel` | Switch notification channel | `/notify channel <telegram|teams>` |

## Notification Types

| Type | Description | Default |
|------|-------------|---------|
| `high_priority_email` | High-priority email received | Enabled |
| `calendar_reminder` | Upcoming calendar event | Enabled |
| `beans_priority_1` | Priority 1 task detected | Enabled |
| `samanage_new_request` | New Samanage request | Disabled |
| `monday_update` | Monday.com update | Disabled |

## Examples

```
# Check notification status
/notify status

# Enable calendar reminders
/notify enable calendar_reminder

# Disable Monday.com updates
/notify disable monday_update

# Send a test notification
/notify test

# Switch to Teams notifications
/notify channel teams
```

## Configuration

```json
{
  "spockai": {
    "notifications": {
      "channel": "telegram",
      "telegram": {
        "botToken": "YOUR_BOT_TOKEN",
        "chatId": "YOUR_CHAT_ID"
      },
      "teams": {
        "webhookUrl": "YOUR_WEBHOOK_URL"
      },
      "digestInterval": 5,
      "rules": [
        { "eventType": "high_priority_email", "enabled": true },
        { "eventType": "calendar_reminder", "enabled": true }
      ]
    }
  }
}
```

## Digest Mode

Notifications are bundled into digest messages every N minutes (default: 5) to prevent notification spam. High-priority items are still delivered promptly within the digest window.

## Events Received

| Event | Source | Triggers |
|-------|--------|----------|
| `email:high_priority` | Email Skill | New high-priority email |
| `calendar:reminder` | Calendar Skill | Upcoming appointment |
| `beans:priority_1` | BEANS Skill | Priority 1 task detected |
| `services:samanage` | Services Skill | New Samanage request |
| `services:monday` | Services Skill | Monday.com update |
