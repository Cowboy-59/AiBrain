# SpockAI BEANS Skill

**Name**: spockai-beans
**Version**: 0.1.0
**Description**: Scan and display priority items from hmans/beans format files

## Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/beans` | List priority 1 items | `/beans [--all]` |
| `/beans scan` | Scan configured paths | `/beans scan` |
| `/beans paths` | Manage scan paths | `/beans paths [add|remove] <path>` |
| `/beans show` | Show bean details | `/beans show <id>` |

## BEANS Format

BEANS files follow the [hmans/beans](https://github.com/hmans/beans) format:

```markdown
---
title: Implement user authentication
status: in_progress
type: feature
priority: 1
tags: [auth, security]
blocked_by: [abc123]
---

Full description of the task with any relevant details...
```

### Filename Pattern

- `beans-{nanoid}.md` - Standard format
- `beans-{nanoid}-{slug}.md` - With optional slug

### Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Task title (required) |
| `status` | string | todo, in_progress, completed, archived |
| `type` | string | task, bug, feature, epic |
| `priority` | number/string | 1 (highest) to 4 (lowest) |
| `tags` | string[] | Optional categorization |
| `parent` | string | Parent bean ID for hierarchies |
| `blocking` | string[] | IDs this bean blocks |
| `blocked_by` | string[] | IDs blocking this bean |

## Examples

```
# Show priority 1 items (default)
/beans

# Show all beans regardless of priority
/beans --all

# Scan all configured paths
/beans scan

# View scan paths
/beans paths

# Add a new scan path
/beans paths add ~/projects/myapp

# Remove a scan path
/beans paths remove ~/projects/old

# Show bean details
/beans show abc123
```

## Configuration

```json
{
  "spockai": {
    "beans": {
      "scanPaths": [
        "E:/AI_Development",
        "~/projects"
      ],
      "scanInterval": 30,
      "enabled": true
    }
  }
}
```

## Events Emitted

| Event | Payload | Trigger |
|-------|---------|---------|
| `beans:priority_1` | Bean details | New priority 1 item detected |
| `beans:scan_complete` | Scan result | Scan completed |

## Integration

Priority 1 items are automatically sent to the configured notification channel (Telegram/Teams) when detected during scans.
