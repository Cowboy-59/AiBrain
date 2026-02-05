# Research: SpockAI Implementation

**Date**: 2026-02-04
**Feature**: SpockAI Personal Assistant Bot
**Branch**: 1-spockai-bot

## OpenClaw Framework Analysis

### Decision: Use OpenClaw as Foundation
**Rationale**: OpenClaw provides a mature, extensible personal AI assistant framework with built-in support for Telegram, background service operation, and a skills/plugin architecture that aligns perfectly with SpockAI's requirements.

**Alternatives Considered**:
- Building from scratch: Rejected - would duplicate significant infrastructure work
- Using a simpler bot framework: Rejected - lacks the LLM integration and skills architecture

### Technical Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Runtime | Node.js ≥22 | OpenClaw requirement |
| Language | TypeScript | OpenClaw native language |
| Package Manager | pnpm | OpenClaw standard |
| Telegram Library | grammY | Built into OpenClaw |
| Configuration | JSON (~/.openclaw/openclaw.json) | OpenClaw pattern |

### Skills Architecture

OpenClaw skills are stored at `~/.openclaw/workspace/skills/<skill>/SKILL.md`. Each SpockAI capability will be implemented as a separate skill:

| Skill | Purpose | Key Dependencies |
|-------|---------|------------------|
| spockai-email | Multi-account email management | IMAP/SMTP libraries |
| spockai-calendar | Calendar integration | Google Calendar/Microsoft Graph APIs |
| spockai-beans | BEANS file scanning | File system access |
| spockai-samanage | Samanage integration | Samanage REST API |
| spockai-monday | Monday.com integration | Monday.com GraphQL API |

### Gateway Architecture

OpenClaw uses a WebSocket gateway at `ws://127.0.0.1:18789` for channel communication. SpockAI will primarily use the built-in Telegram channel.

## Email Integration Research

### Decision: Use IMAP with node-imap or better-imap
**Rationale**: IMAP provides read access to multiple email providers with minimal provider-specific code.

**Providers to Support**:
- Gmail (IMAP enabled)
- Outlook/Office 365 (IMAP or Microsoft Graph)
- Generic IMAP servers

### Priority Classification Approach

**Decision**: Rule-based classification with user-configurable rules
**Rules**:
- VIP senders (configurable list) → High priority
- Keywords in subject (configurable) → High/Medium priority
- Domain patterns → Adjustable priority
- Default → Low priority

## Calendar Integration Research

### Decision: Support Google Calendar and Microsoft Graph APIs
**Rationale**: Covers the two most common calendar providers.

**Approach**:
- Google Calendar: OAuth2 + Google Calendar API
- Microsoft: OAuth2 + Microsoft Graph API
- Store OAuth tokens securely in config

## BEANS File Format Research

### Decision: Need to analyze existing BEANS files for format
**Action Required**: Examine sample BEANS files in AI_development to understand structure.

**Assumed Format** (to be verified):
```
Priority: 1
Description: Task description
Source: filename.beans
```

## External Services Research

### Samanage Integration
- REST API with API key authentication
- Endpoints for tickets, incidents, changes

### Monday.com Integration
- GraphQL API with API key
- Query boards, items, updates

## Configuration Structure

### Decision: Extend OpenClaw config with SpockAI-specific section

```json
{
  "agent": { ... },
  "spockai": {
    "email": {
      "accounts": [...],
      "priority_rules": {...}
    },
    "calendar": {
      "google": {...},
      "microsoft": {...}
    },
    "beans": {
      "scan_paths": [...],
      "scan_interval": "5m"
    },
    "notifications": {
      "telegram": {
        "high_priority_emails": true,
        "calendar_reminders": true,
        "reminder_lead_time": "15m"
      }
    },
    "integrations": {
      "samanage": {...},
      "monday": {...}
    }
  }
}
```

## Resolved Unknowns

| Unknown | Resolution |
|---------|------------|
| Language/Version | TypeScript on Node.js ≥22 |
| Primary Dependencies | OpenClaw, grammY, node-imap, googleapis, @microsoft/microsoft-graph-client |
| Storage | OpenClaw's built-in storage + JSON config |
| Testing | Jest (Node.js standard) |
| Target Platform | Any platform supporting Node.js ≥22 |
| Project Type | Single project (OpenClaw skills) |
| Performance Goals | <2 min notification delivery, <5 min email sync |
| Constraints | Must run as background service |
| Scale/Scope | Single user, multiple accounts |

## Next Steps

1. Clone OpenClaw repository
2. Create skill scaffolds for each capability
3. Implement email skill first (core functionality)
4. Add calendar integration
5. Add BEANS scanning
6. Add external service integrations
7. Configure Telegram notifications
