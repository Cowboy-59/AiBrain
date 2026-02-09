# SpockAI Email Skill

**Name**: spockai-email
**Version**: 0.1.0
**Description**: Multi-account email management with priority classification

## Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/email list` | Show high-priority emails | `/email list [all]` |
| `/email accounts` | List connected accounts | `/email accounts` |
| `/email add` | Add email account | `/email add <name> <provider> <email>` |
| `/email remove` | Remove email account | `/email remove <name>` |
| `/email rules` | Manage priority rules | `/email rules [add|remove|list]` |
| `/email sync` | Sync emails now | `/email sync [account]` |

## Examples

```
# List high-priority emails
/email list

# List all emails
/email list all

# Add a Gmail account
/email add "Work Gmail" gmail user@gmail.com

# Add an IMAP account
/email add "Personal" imap user@domain.com

# View connected accounts
/email accounts

# Remove an account
/email remove "Personal"

# Add a VIP sender
/email rules add vip boss@company.com

# Add a priority keyword
/email rules add keyword "URGENT"

# Sync all accounts now
/email sync
```

## Configuration

Email configuration is stored in `~/.spockai/config.json`:

```json
{
  "spockai": {
    "email": {
      "accounts": [],
      "globalRules": {
        "vipSenders": ["boss@company.com"],
        "priorityKeywords": ["URGENT", "ACTION REQUIRED"]
      },
      "syncInterval": 5
    }
  }
}
```

## Priority Classification

Emails are classified as high-priority if:
1. Sender is in VIP list
2. Subject contains priority keywords
3. Matches account-specific rules

## Events Emitted

| Event | Description |
|-------|-------------|
| `email:sync_complete` | Sync finished with results |
| `email:high_priority` | New high-priority email detected |
| `email:error` | Sync or connection error |
