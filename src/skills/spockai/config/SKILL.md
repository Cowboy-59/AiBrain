# SpockAI Config Skill

**Name**: spockai-config
**Version**: 0.1.0
**Description**: Configuration management for SpockAI settings

## Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/config show` | Display current configuration | `/config show [section]` |
| `/config export` | Export configuration to file | `/config export [--format json|yaml]` |
| `/config backup` | Create configuration backup | `/config backup [name]` |
| `/config restore` | Restore from backup | `/config restore <name>` |
| `/config set` | Set a configuration value | `/config set <key> <value>` |

## Configuration Sections

| Section | Description |
|---------|-------------|
| `email` | Email account settings |
| `calendar` | Calendar source settings |
| `beans` | BEANS scan path settings |
| `notifications` | Notification channel settings |
| `services` | External service settings |

## Examples

```
# Show all configuration
/config show

# Show specific section
/config show email
/config show notifications

# Export configuration
/config export
/config export --format yaml

# Create backup
/config backup
/config backup pre-migration

# Restore from backup
/config restore pre-migration

# Set value
/config set notifications.digestInterval 10
```

## Configuration File Location

SpockAI configuration is stored in:
- **Linux/macOS**: `~/.spockai/config.json`
- **Windows**: `%USERPROFILE%\.spockai\config.json`

## Configuration Structure

```json
{
  "spockai": {
    "email": {
      "accounts": [],
      "syncInterval": 5,
      "priorityRules": {}
    },
    "calendar": {
      "sources": [],
      "defaultWindow": "today",
      "reminderLeadTime": 15
    },
    "beans": {
      "scanPaths": [],
      "scanInterval": 30,
      "enabled": true
    },
    "notifications": {
      "channel": "telegram",
      "digestInterval": 5,
      "telegram": {},
      "teams": {},
      "rules": []
    },
    "services": {
      "syncInterval": 15,
      "samanage": {},
      "monday": {}
    }
  }
}
```

## Backup Storage

Backups are stored in:
- `~/.spockai/backups/spockai-{timestamp}.json`

## Security Notes

- Sensitive values (API tokens, passwords) are encrypted at rest
- Export excludes sensitive values by default
- Use `--include-secrets` flag to include encrypted values in export
