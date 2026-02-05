# SpockAI Services Skill

**Name**: spockai-services
**Version**: 0.1.0
**Description**: External service integrations for Samanage and Monday.com

## Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/services` | List all connected services | `/services` |
| `/services sync` | Force sync all services | `/services sync` |
| `/samanage` | List Samanage incidents | `/samanage [--status <status>]` |
| `/samanage connect` | Connect Samanage account | `/samanage connect` |
| `/monday` | List Monday.com items | `/monday [--board <id>]` |
| `/monday connect` | Connect Monday.com account | `/monday connect` |

## Supported Services

| Service | API | Features |
|---------|-----|----------|
| Samanage | REST API | Incidents, requests, assets |
| Monday.com | GraphQL | Boards, items, updates |

## Examples

```
# View connected services
/services

# Force sync all services
/services sync

# View Samanage incidents
/samanage

# Filter by status
/samanage --status open

# Connect Samanage
/samanage connect

# View Monday.com items
/monday

# Filter by board
/monday --board 1234567890

# Connect Monday.com
/monday connect
```

## Configuration

```json
{
  "spockai": {
    "services": {
      "syncInterval": 15,
      "samanage": {
        "apiToken": "YOUR_API_TOKEN",
        "subdomain": "your-company"
      },
      "monday": {
        "apiToken": "YOUR_API_TOKEN",
        "boardIds": ["1234567890"]
      }
    }
  }
}
```

## Request Statuses

| Status | Description |
|--------|-------------|
| `new` | Newly created request |
| `open` | Assigned and waiting |
| `in_progress` | Currently being worked |
| `pending` | Waiting for input |
| `on_hold` | Temporarily paused |
| `resolved` | Solution provided |
| `closed` | Completed |

## Events Emitted

| Event | Payload | Trigger |
|-------|---------|---------|
| `services:samanage` | Request details | New/updated Samanage incident |
| `services:monday` | Item details | New/updated Monday.com item |
| `services:sync` | Sync result | Sync completed |

## Priority Mapping

### Samanage
| Samanage Priority | SpockAI Priority |
|-------------------|------------------|
| Critical, High | high |
| Medium | medium |
| Low, None | low |

### Monday.com
| Monday.com Status | SpockAI Priority |
|-------------------|------------------|
| Contains "critical" or "high" | high |
| Contains "low" | low |
| Default | medium |
