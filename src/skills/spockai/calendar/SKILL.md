# SpockAI Calendar Skill

**Name**: spockai-calendar
**Version**: 0.1.0
**Description**: Calendar integration for Google and Microsoft calendars

## Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/calendar` | List upcoming appointments | `/calendar [today|tomorrow|week|month]` |
| `/calendar accounts` | Show connected calendars | `/calendar accounts` |
| `/calendar add` | Add a calendar source | `/calendar add <provider>` |
| `/calendar remove` | Remove a calendar source | `/calendar remove <id>` |
| `/calendar sync` | Force sync all calendars | `/calendar sync` |

## Supported Providers

| Provider | Auth Method | Features |
|----------|-------------|----------|
| Google Calendar | OAuth2 | Personal & shared calendars |
| Microsoft 365 | OAuth2 | Personal & shared calendars |

## Examples

```
# View today's appointments
/calendar today

# View next 7 days
/calendar week

# Check connected calendars
/calendar accounts

# Add Google Calendar
/calendar add google

# Remove a calendar
/calendar remove abc123

# Force sync
/calendar sync
```

## Configuration

```json
{
  "spockai": {
    "calendar": {
      "defaultWindow": "today",
      "reminderLeadTime": 15,
      "sources": [
        {
          "name": "Personal",
          "provider": "google",
          "calendarId": "primary",
          "isShared": false,
          "enabled": true
        },
        {
          "name": "Team Calendar",
          "provider": "microsoft",
          "calendarId": "team-calendar-id",
          "isShared": true,
          "enabled": true
        }
      ]
    }
  }
}
```

## Events Emitted

| Event | Payload | Trigger |
|-------|---------|---------|
| `calendar:reminder` | Appointment details | Event starting within reminder lead time |
| `calendar:sync` | Sync result | Calendar sync completed |

## Integration

Calendar reminders are automatically sent to the configured notification channel (Telegram/Teams) when events are approaching.
