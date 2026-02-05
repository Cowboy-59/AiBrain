# SpockAI Chat Skill

**Name**: spockai-chat
**Version**: 0.1.0
**Description**: Conversational chat interface for SpockAI configuration and queries

## Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/chat open` | Open chat window | `/chat open` |
| `/chat close` | Close chat window | `/chat close` |
| `/chat status` | Show chat status | `/chat status` |

## Natural Language Interface

The chat window supports natural language configuration. Simply describe what you want to do:

### Email Setup
- "Add my email account"
- "Connect my Gmail"
- "Set up Outlook email"

### Calendar Setup
- "Add my calendar"
- "Connect Google Calendar"

### BEANS Configuration
- "Scan this folder for tasks"
- "Add a BEANS path"

### Service Connections
- "Connect Samanage"
- "Set up Monday.com"

### Notifications
- "Enable calendar reminders"
- "Disable email alerts"
- "Configure notifications"

## Examples

```
# Open chat window
/chat open

# In chat window:
> Add my Gmail account
< I understand you want to set up a new email account. Let me help you with that.
< Which email provider would you like to connect? (google/microsoft)
> google
< What is your email address?
> john@gmail.com
< Give this account a name (e.g., "Personal" or "Work"):
> Personal
< ✅ Great! I'll set up your google email account (john@gmail.com) as "Personal".
```

## Configuration

```json
{
  "spockai": {
    "chat": {
      "maxHistoryLength": 50,
      "responseTimeout": 30000
    }
  }
}
```

## Window Features

### Docking
The chat window can snap to screen edges:
- Drag to edge to dock
- Double-click title bar to undock
- Resize by dragging corners

### System Tray
- Right-click tray icon for quick actions
- Left-click to toggle window
- Shows notification count badge

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Send message |
| `Escape` | Minimize window |
| `Ctrl+L` | Clear history |
| `Ctrl+Q` | Close window |

## Events Emitted

| Event | Payload | Trigger |
|-------|---------|---------|
| `chat:message` | Message content | New message sent |
| `chat:intent` | Intent detected | Configuration intent recognized |
| `chat:config_complete` | Config data | Configuration wizard completed |
