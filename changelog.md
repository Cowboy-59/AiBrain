# Changelog

All notable changes to the Claude Project Starter Kit will be documented here.

## Format Guide

- Entries are organized chronologically by date: `### Month Day, Year`
- Group related changes under section headings: `#### Section Name`
- Focus on key changes, new features, and functional improvements
- This is NOT a dump of git commits - document meaningful changes only

---

### February 4, 2026

- **✨ SpockAI Bot Specification** - Complete spec-driven development workflow including research, data model, contracts, and 75 implementation tasks with clarifications

### January 14, 2026

### January 14, 2026

#### GitPro Script Architecture
- **Script-based operations**: Moved gitpro from inline validation to atomic bash scripts
- **New scripts**: Added gitpro-checkpoint.sh, gitpro-commit.sh, gitpro-merge.sh
- **Pre-gitpro hook**: Added validation hook that runs before gitpro skill
- **Simplified pre-commit**: Project hook now blocks direct commits, forces GitPro usage

---

### January 9, 2026

#### Git Hooks Cleanup
- **Removed global hooks**: Deleted `~/.git-hooks/` concept - project hooks are authoritative
- **Interactive hook install**: `sync-starter-kit.sh` now prompts to install/update hooks (not just report)
- **Deleted pre-merge-commit**: Removed orphaned TODO bead detection (manual discovery preferred)

#### Logging Migration (Adze → Pino)
- **block-console-log.sh**: Updated to check for `pino` dependency instead of `adze`
- **constitution.md**: Section IV now references Pino
- **development-guidelines.md**: Updated logging examples to Pino syntax

#### GitPro Token Enforcement
- **Restored create-token.sh**: Component hook for token-based git-guard bypass
- **Added documentation**: `project-documentation/token-based-hook-enforcement.md`

---

### January 7, 2026

#### Beads Upgrade (0.37.0 → 0.46.0)
- **Switched to homebrew-core**: Changed from tap `steveyegge/beads` to `brew install beads` (avoids stale tap issues)
- **New features documented**: `--notes` on create, `--blocked-by`/`--depends-on` aliases, `--reason` on delete
- **"beads state" trigger phrase**: New skill trigger for viewing non-closed beads grouped by status
- **Fixed autonomy wording**: Changed "USER ONLY" to "requires explicit user request" (AI can do when asked)

#### GitPro Enhancements
- **Detailed merge triggers**: "merge to main", "merge from X" for clarity
- **Auto-rename wt-* branches**: First meaningful commit renames worktree branch to descriptive name
- **Beads sync post-commit**: Added post-commit beads sync step

#### Documentation
- **beads-setup.md**: Simplified install (no tap), updated daily usage commands
- **beads-update.md**: Fixed package name for version check, added sync warning for master mode

---

### January 5, 2026

#### Skills Added
- **TanStack skill**: Added mfing-bible-of-tanstack skill with comprehensive references (server-functions, routes, query, auth, api-routes, loading-states, debugging, anti-patterns)
- **Beads skill**: Added beads workflow skill

#### Rules Restructure
- **New `_claude-project/rules/` directory**: Moved rules from deprecated `airules/` location
- **Integrations subfolder**: Created `_claude-project/rules/integrations/` for tool-specific rules (ClaudeChrome, exa, ref)
- **Deleted `airules/`**: Removed deprecated rules directory

#### ClaudeChrome Update
- **Generic auth cookies**: Changed "OAuth cookies" to "Auth cookies" (removed Clerk-specific reference)

#### Sync Script Enhancements
- **Browser extension detection**: Detects ClaudeChrome via native messaging hosts
- **MCP auto-install**: Added `install_mcp()` for Ref, exa, shadcn-ui with interactive prompts
- **Interactive choices**: `[i]nstall / [r]emove / [s]kip` for missing MCP rules

#### Pull-from-project Improvement
- **Dynamic project discovery**: Lists projects with `.claude/rules/` from ~/projects via AskUserQuestion

---

### December 28, 2025

#### GitPro Bead Notes Automation
- **Auto bead notes update**: gitpro checkpoint/commit now auto-updates active-now bead notes
- **Simplified beads-workflow.md**: Notes auto-updated by gitpro, manual update rarely needed
- **New Stop hook**: `bead-comment-reminder.sh` triggers on session stop
- **New script**: `fix-claude-lsp.sh` for LSP troubleshooting

#### LSP Reminder Removal
- **Removed Section XI (LSP-First)** from constitution.md - pulled from project
- **Removed `lsp-reminder.sh` hook** from settings.json and hooks folder
- **Simplified bashtools.md** - condensed to table format, removed redundant examples

#### Beads Context Recovery Enhancement
- **New `active-now-reminder.sh` hook**: UserPromptSubmit hook reminds AI to claim a bead before code changes
- **Bug fix**: Close sequence now removes `active-now` label before closing beads (prevents impossible state)
- **Context Recovery Protocol**: Enhanced Session Recovery section with:
  - Rule: Non-trivial code changes require `active-now` bead
  - Field usage table: `design`/`acceptance` (immutable), `notes` (replace), `comments` (append)
  - Structured notes format for session recovery
  - Update triggers for maintaining current status
- **Removed stale reference**: Removed `@airules/beads.md` from sync-starter-kit template

---

### December 26, 2025

#### GitPro Beads Integration
- **Added `bd sync` to gitpro**: Pre/post-commit beads sync when `.beads/` exists
- **Removed Session Close Protocol**: Conflicted with gitpro workflow, now integrated directly
- **pull-from-project enhanced**: Now compares git hooks in addition to AIRules

#### Pre-commit Hook
- **node_modules exclusion**: Added `--glob '!**/node_modules/**'` to TypeScript validation

#### Sync Script Fix
- **Exit Code Fix**: `sync-starter-kit.sh` now exits 0 for both success cases (all synced / changes available)
- **UX Improvement**: Prevents Claude Code from showing red "Error" text on successful sync operations
- **Visual Indicators**: Added ✓ and ⚠ prefixes to distinguish outcomes

#### Beads Hook-Based Integration
- **Replaced `bd prime`**: Custom hook injection replaces upstream `bd prime` command
- **New Hook System**: `beads-inject.sh` checks for `.beads/` and injects `beads-workflow.md`
- **Deleted `airules/beads.md`**: Workflow now lives in `_claude-global/hooks/beads-workflow.md`
- **Updated beads-setup.md**: Documents hook approach, opting out, release scanning workflow
- **Workflow Improvements**: Added session close protocol, `bd close --suggest-next` (v0.37), TodoWrite clarification

---

### December 25, 2025

#### AIRules System Restructure
- **Constitution/Projectrules Split**: Separated global enforcement rules (constitution.md) from project-specific rules (projectrules.md)
- **Development Guidelines Cleanup**: Consolidated documentation standards, removed duplicates, demoted "MUST" language to guidance
- **Import Order Optimization**: Reordered AGENTS.md imports for LLM recency bias - constitution.md now loads last
- **New Console.log Hook**: `block-console-log.sh` blocks console.log in Adze projects (PreToolUse on Edit/Write)
- **Folder Rename**: `_git-hooks/` → `_git-hooks-project/` for naming consistency
- **Removed**: `_specify/` folder (replaced by Opus 4.5 plan mode), `Documentation.md` (merged into dev-guidelines)
- **Added**: `beads.md` (issue tracking), `ClaudeChrome.md` (browser automation), `projectrules.md` (template)
- **Header Comments**: Added "what belongs here" comments to constitution, dev-guidelines, projectrules
- **TypeScript Enforcement**: Zero tolerance via pre-commit hook, removed manifest system from gitpro skill

#### Complete Sync System
- **`/sync-global` Command**: Sync between `_claude-global/` and `~/.claude/`
  - Master mode detection via `.claude/master.txt`
  - Whitelist approach for watched folders/files
  - Executable bash script at `.claude/scripts/sync-global.sh`
- **`/sync-starter-kit` Command**: Sync starter kit → any project
  - Syncs AIRules/, git hooks, audits CLAUDE.md/AGENTS.md
  - Path mapping: `airules/` → `AIRules/`, `_git-hooks-project/` → `.git/hooks/`
  - Intelligent AGENTS.md merge (preserves enabled/disabled state)
  - Executable bash script at `~/.claude/scripts/sync-starter-kit.sh`
- **`/pull-from-project` Command**: Pull project changes → starter kit (master only)
  - Compares project AIRules/ with kit airules/
  - Shows diffs, asks which files to pull
- **README**: Added Master Workflow section documenting maintainer commands
- **Hooks Fix**: Made `architect_enforcer.sh` resilient to missing transcript

#### Global Config Cleanup
- **Removed Unused Skills**: Deleted skills no longer in use:
  - dispatching-parallel-agents, feature-documentation-cleanup, frontend-design
  - receiving-code-review, requesting-code-review, root-cause-tracing
  - skill-creator, subagent-driven-development, systematic-debugging, verification-before-completion
- **Removed Output Styles**: Deleted CriticalReview.md, task-adaptive.md
- **Removed Agents**: Deleted code-reviewer.md agent
- **Removed Commands**: Deleted code-review.md command
- **Cleaned GitPro**: Removed backup files and analysis document, updated ENFORCEMENT.md

#### New Hooks
- **architect_enforcer.sh**: UserPromptSubmit hook for principal engineer persona
- **dev-server-guard.sh**: Prevents AI from starting/killing dev server

#### Settings Updates
- Added `typescript-lsp@claude-plugins-official` plugin

---

#### Folder Naming Convention Overhaul
- **Underscore Prefix Convention**: Renamed all "dot-" folders to use underscore prefix for cleaner naming:
  - `dot-Claude(Global)` → `_claude-global`
  - `dot-Claude(Project)` → `_claude-project`
  - `dot-git-hooks(Project)` → `_git-hooks`
  - `dot-specify(Project)` → `_specify`
  - `AIRules` → `airules`
- **Removed Gemini Support**: Deleted `_gemini/` folder (no longer supporting Google Gemini CLI)
- **Typo Fix**: Corrected `project-documenation` → `project-documentation`

#### Documentation Restructure
- **README.md Rewrite**: Transformed from example project README to dual-purpose documentation that:
  - Documents the starter kit itself
  - Serves as a template for real projects
  - Includes file classification (synced vs template vs project-specific)
  - Has dedicated "For AI Agents" section
- **Changelog Format**: Established changelog as living document for this starter kit

#### AIRules Cleanup
- **Removed Obsolete Rules**: Deleted unused rule files:
  - `context7.md` (no longer used)
  - `linear.md` (no longer used)
  - `Playwright.md` (no longer used)
- **AGENTS.md Updates**: Updated all import paths to reflect new folder names

#### Sync System Planning
- **Phase 2 Planning Document**: Created `project-documentation/sync-system-planning.md` with:
  - File classification scheme (core/synced vs template vs project-specific)
  - Workflow design (pull from project → starter kit → push to others)
  - Registry concept for managing multiple projects
  - AI-assisted sync considerations

---

### September 19, 2025

#### Major Project Structure Reorganization
- **Agent Configuration Restructure**: Organized agent files into `dot-Claude(Global)/Agents/` structure
- **AI Rules System**: Created comprehensive `AIRules/` directory with specialized configuration files
- **Command Framework**: Added structured command system for standardized workflows
- **Specify Integration**: Implemented `.specify/` configuration with constitution, templates, and scripts
- **Global Configuration**: Added `dot-Claude(Global)/` with agent definitions, commands, and utilities
- **Project Commands**: Created `dot-Claude(Project)/commands/` for project-specific workflows

#### Configuration Enhancements
- **CLAUDE.md Simplification**: Streamlined to focus on importing AGENTS.md
- **AGENTS.md Creation**: Centralized agent guidance file with modular rule imports
- **Binary Tools**: Added `bin/cl` utility script for YOLO/SAFE mode toggling
