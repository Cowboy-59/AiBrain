# Email, Calendar & Beads Enhancement

## Overview

Full CRUD control for Gmail, Outlook email, Google Calendar, Outlook Calendar, and enhanced beads task creation.

## Gmail (Full Control)

### Prerequisites
- Google Cloud project with Gmail API enabled
- OAuth credentials (clientId, clientSecret) in `~/.spockai/config.json`
- **Scopes required**: `gmail.readonly`, `gmail.send`, `gmail.modify`, `gmail.labels`, `calendar`
- Use `reauthorize_google` tool to upgrade scopes if getting 403 errors

### Tools

| Tool | Purpose |
|------|---------|
| `get_emails` | Query inbox (unread, important, starred, all) |
| `read_email` | Full email body, headers, attachments by messageId |
| `reply_to_email` | Reply in thread (maintains threading via In-Reply-To/References) |
| `forward_email` | Forward with optional comment |
| `send_email` | Compose and send new email |
| `modify_email` | Mark read/unread, star/unstar, archive, trash, spam |
| `search_emails` | Gmail search syntax (from:, subject:, has:attachment, dates) |
| `list_email_labels` | List all system + user labels |
| `apply_email_label` | Add/remove labels from messages |
| `triage_emails` | Run triage rules on unread emails |
| `reauthorize_google` | Re-authorize with expanded scopes |

### Gmail Search Syntax Examples
```
from:pete subject:meeting
has:attachment after:2024/01/01
is:starred label:work
from:boss is:unread
```

## Microsoft Outlook Email (via Graph API)

### Prerequisites
- Azure AD App Registration
- Redirect URI: `http://localhost:39848/callback`
- Delegated permissions: `Mail.ReadWrite`, `Mail.Send`, `Calendars.ReadWrite`
- Config in `~/.spockai/config.json`:
  ```json
  "outlook": {
    "enabled": true,
    "tenantId": "...",
    "clientId": "...",
    "clientSecret": "...",
    "refreshToken": ""
  }
  ```
- Run `reauthorize_microsoft` to obtain refresh token via browser OAuth

### Tools

| Tool | Purpose |
|------|---------|
| `query_outlook_emails` | Query inbox (unread, flagged, important, all) |
| `read_outlook_email` | Full email body, headers, attachments |
| `send_outlook_email` | Send email (with cc/bcc support) |
| `reply_outlook_email` | Reply to email |
| `modify_outlook_email` | Mark read/unread, flag/unflag, archive, delete |
| `reauthorize_microsoft` | OAuth authorization flow |

## Google Calendar (Full Control)

### Tools

| Tool | Purpose |
|------|---------|
| `get_calendar_events` | Query events (today, tomorrow, week) |
| `create_calendar_event` | Create event with attendees and calendar selection |
| `update_calendar_event` | Update title, time, location, description, attendees |
| `delete_calendar_event` | Delete event |
| `rsvp_calendar_event` | Accept/decline/tentative for invitations |
| `search_calendar_events` | Search across all calendars by text and date range |
| `create_recurring_event` | Create with recurrence (daily, weekly, biweekly, monthly, RRULE) |
| `list_calendars` | List all accessible calendars with IDs |

### Recurrence Patterns
- Simple: `daily`, `weekly`, `biweekly`, `monthly`, `yearly`
- Day-specific: `every monday`, `every tuesday and thursday`
- RRULE: `RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR`

## Microsoft Outlook Calendar (via Graph API)

Reuses Microsoft OAuth from Outlook email. Same prerequisites.

### Tools

| Tool | Purpose |
|------|---------|
| `query_outlook_calendar` | Query events (today, tomorrow, week) |
| `create_outlook_event` | Create event with attendees |
| `update_outlook_event` | Update event fields |
| `delete_outlook_event` | Delete event |

## Beads Enhancement

### New Tools

| Tool | Purpose |
|------|---------|
| `batch_create_beads` | Create multiple beads in one call |
| `auto_create_bead` | Proactively create P1/P2 beads with trigger reason |

### Auto-Create Behavior
SpockAI's system prompt instructs the AI to proactively suggest creating beads when it detects:
- Deadlines mentioned in conversation
- Blocking issues identified
- Critical items requiring follow-up
- Multiple related tasks that need tracking

Each auto-created bead logs the trigger reason to the daily log for audit trail.

### Batch Create Example
```json
{
  "items": [
    { "title": "Design auth migration", "type": "task", "priority": 1 },
    { "title": "Write migration tests", "type": "task", "priority": 2 },
    { "title": "Update API docs", "type": "task", "priority": 2 }
  ]
}
```

## Files Modified

| File | Changes |
|------|---------|
| `tray/main.js` | +26 functions, +26 tools, modified 5 existing functions |

## OAuth Ports

| Service | Port | Redirect URI |
|---------|------|-------------|
| Google | 39847 | `http://localhost:39847/callback` |
| Microsoft | 39848 | `http://localhost:39848/callback` |
