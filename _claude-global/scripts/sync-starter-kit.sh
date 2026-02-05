#!/bin/bash
set -euo pipefail

# sync-starter-kit.sh - Sync project with starter kit
# Run from any project directory
# Exit codes: 0 = success (check output for details), 1 = error

CONFIG_FILE="$HOME/.claude/starter-kit-config.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
    exit 1
}

# Cross-platform file hash (works on Mac, Linux, Windows/Git Bash)
get_file_hash() {
    local file="$1"
    if command -v md5sum &>/dev/null; then
        md5sum "$file" | cut -d' ' -f1
    elif command -v md5 &>/dev/null; then
        get_file_hash "$file"
    else
        shasum -a 256 "$file" | cut -d' ' -f1
    fi
}

warn() {
    echo -e "${YELLOW}$1${NC}"
}

info() {
    echo -e "${BLUE}$1${NC}"
}

success() {
    echo -e "${GREEN}$1${NC}"
}

header() {
    echo -e "${CYAN}$1${NC}"
}

# Get starter kit path from config
get_kit_path() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        error "Starter kit not configured. Run /sync-global from starter kit first."
    fi

    local path
    path=$(grep -o '"starterKitPath"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)

    if [[ -z "$path" ]]; then
        error "Invalid config file. Run /sync-global from starter kit to reconfigure."
    fi

    if [[ ! -d "$path" ]]; then
        error "Starter kit path does not exist: $path"
    fi

    echo "$path"
}

# Check if we're in a project directory
check_project() {
    if [[ ! -f "package.json" && ! -f "pyproject.toml" && ! -d ".git" && ! -d ".claude" ]]; then
        error "Not in a project directory. Run from a project root."
    fi
}

# MCP-dependent rules mapping
# Format: rule_path:mcp_name:mcp_type (global, project, or browser-extension)
declare -a MCP_RULES=(
    "integrations/ref.md:Ref:global"
    "integrations/exa.md:exa:global"
    "integrations/ClaudeChrome.md:claude-in-chrome:browser-extension"
    "shadcn.md:shadcn-ui:project"
)

# Check if global MCP is installed
check_global_mcp() {
    local mcp_name="$1"
    # Use claude mcp list and check for the MCP name
    if claude mcp list 2>/dev/null | grep -qi "$mcp_name"; then
        return 0
    fi
    return 1
}

# Check if browser extension is installed (via native messaging host)
check_browser_extension() {
    local ext_name="$1"

    # Native messaging host locations for various Chromium browsers
    local -a host_dirs=()

    # Detect OS and set appropriate paths
    case "$(uname -s)" in
        Darwin)
            # macOS paths
            host_dirs=(
                "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
                "$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
                "$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
                "$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
                "$HOME/Library/Application Support/Arc/User Data/NativeMessagingHosts"
            )
            ;;
        MINGW*|MSYS*|CYGWIN*|Windows_NT)
            # Windows paths (Git Bash / MSYS2 / Cygwin)
            local appdata="${LOCALAPPDATA:-$HOME/AppData/Local}"
            host_dirs=(
                "$appdata/Google/Chrome/User Data/NativeMessagingHosts"
                "$appdata/Chromium/User Data/NativeMessagingHosts"
                "$appdata/BraveSoftware/Brave-Browser/User Data/NativeMessagingHosts"
                "$appdata/Microsoft/Edge/User Data/NativeMessagingHosts"
            )
            ;;
        Linux)
            # Linux paths
            host_dirs=(
                "$HOME/.config/google-chrome/NativeMessagingHosts"
                "$HOME/.config/chromium/NativeMessagingHosts"
                "$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
                "$HOME/.config/microsoft-edge/NativeMessagingHosts"
            )
            ;;
    esac

    # Map extension names to native host manifest patterns
    local manifest_pattern=""
    case "$ext_name" in
        "claude-in-chrome")
            manifest_pattern="com.anthropic.claude_code_browser_extension.json"
            ;;
        *)
            return 1
            ;;
    esac

    # Check each browser's native messaging hosts directory
    for dir in "${host_dirs[@]}"; do
        if [[ -f "$dir/$manifest_pattern" ]]; then
            return 0
        fi
    done

    return 1
}

# Check if project MCP is installed
check_project_mcp() {
    local mcp_name="$1"
    local project_path="$PWD"

    # Check .mcp.json for mcpServers containing the name
    if [[ -f ".mcp.json" ]]; then
        if grep -q "\"$mcp_name\"" ".mcp.json" 2>/dev/null; then
            return 0
        fi
    fi

    # Check ~/.claude.json for project-specific MCPs
    # Claude Code stores project MCPs under projects.<path>.mcpServers
    if [[ -f "$HOME/.claude.json" ]]; then
        # Use jq if available for proper JSON parsing
        if command -v jq &>/dev/null; then
            if jq -e ".projects[\"$project_path\"].mcpServers[\"$mcp_name\"]" "$HOME/.claude.json" &>/dev/null; then
                return 0
            fi
        else
            # Fallback: grep for the MCP name near the project path
            if grep -A100 "\"$project_path\"" "$HOME/.claude.json" 2>/dev/null | grep -q "\"$mcp_name\""; then
                return 0
            fi
        fi
    fi

    return 1
}

# Install MCP by name and type
install_mcp() {
    local mcp_name="$1"
    local mcp_type="$2"

    case "$mcp_name" in
        "Ref")
            echo "  Installing Ref MCP (global)..."
            claude mcp add Ref --transport http https://api.ref.tools/mcp
            ;;
        "exa")
            echo "  Installing exa MCP (global)..."
            echo "  Note: Requires EXA_API_KEY environment variable"
            claude mcp add exa -- npx -y mcp-remote "https://mcp.exa.ai/mcp?exaApiKey=\${EXA_API_KEY}"
            ;;
        "claude-in-chrome")
            warn "  claude-in-chrome is a browser extension, not an MCP."
            echo "  Install from: https://chromewebstore.google.com/detail/claude-in-chrome"
            echo "  Then run: claude mcp add claude-in-chrome"
            ;;
        "shadcn-ui")
            echo "  Installing shadcn-ui MCP (project)..."
            claude mcp add shadcn-ui -- npx @jpisnice/shadcn-ui-mcp-server
            ;;
        *)
            warn "  Unknown MCP: $mcp_name - manual installation required"
            return 1
            ;;
    esac
}

# Check MCP dependencies for rules
check_mcp_rules() {
    local kit_path="$1"
    local kit_rules="$kit_path/_claude-project/rules"
    local project_rules="./.claude/rules"

    header "=== MCP RULE DEPENDENCIES ==="
    echo ""

    local has_issues=0

    for mapping in "${MCP_RULES[@]}"; do
        local rule_path="${mapping%%:*}"
        local rest="${mapping#*:}"
        local mcp_name="${rest%%:*}"
        local mcp_type="${rest##*:}"

        local kit_rule="$kit_rules/$rule_path"
        local project_rule="$project_rules/$rule_path"

        # Skip if kit doesn't have this rule
        [[ ! -f "$kit_rule" ]] && continue

        local rule_exists=false
        local mcp_installed=false

        [[ -f "$project_rule" ]] && rule_exists=true

        case "$mcp_type" in
            "global")
                check_global_mcp "$mcp_name" && mcp_installed=true
                ;;
            "browser-extension")
                check_browser_extension "$mcp_name" && mcp_installed=true
                ;;
            "project")
                check_project_mcp "$mcp_name" && mcp_installed=true
                ;;
        esac

        if $rule_exists && ! $mcp_installed; then
            warn "RULE WITHOUT MCP: $rule_path"
            echo "  Rule exists but MCP '$mcp_name' not installed ($mcp_type)"
            echo ""
            echo "  Options:"
            echo "    [i] Install MCP"
            echo "    [r] Remove rule file"
            echo "    [s] Skip"
            echo -n "  Choice [i/r/s]: "
            read -r choice
            case "$choice" in
                i|I)
                    install_mcp "$mcp_name" "$mcp_type"
                    ;;
                r|R)
                    rm -f "$project_rule"
                    success "  Removed: $project_rule"
                    ;;
                *)
                    echo "  Skipped"
                    has_issues=1
                    ;;
            esac
            echo ""
        elif ! $rule_exists && $mcp_installed; then
            info "MCP WITHOUT RULE: $mcp_name"
            echo "  MCP installed but rule '$rule_path' missing"
            echo ""
            echo "  Options:"
            echo "    [a] Add rule from starter kit"
            echo "    [s] Skip"
            echo -n "  Choice [a/s]: "
            read -r choice
            case "$choice" in
                a|A)
                    mkdir -p "$(dirname "$project_rule")"
                    cp "$kit_rule" "$project_rule"
                    success "  Added: $project_rule"
                    ;;
                *)
                    echo "  Skipped"
                    has_issues=1
                    ;;
            esac
            echo ""
        elif $rule_exists && $mcp_installed; then
            success "OK: $rule_path ↔ $mcp_name"
        fi
    done

    echo ""
    return $has_issues
}

# Compare rules (from _claude-project-rules template to .claude/rules/)
compare_rules() {
    local kit_path="$1"
    local kit_rules="$kit_path/_claude-project/rules"
    local project_rules="./.claude/rules"

    header "=== RULES COMPARISON ==="
    echo ""

    if [[ ! -d "$kit_rules" ]]; then
        error "Starter kit missing _claude-project/rules/ folder"
    fi

    local has_changes=0

    # Create .claude/rules if missing
    if [[ ! -d "$project_rules" ]]; then
        warn ".claude/rules/ folder missing in project"
        has_changes=1
    fi

    # Detect target project type for language-specific rule filtering
    local target_type="unknown"
    if [[ -f "package.json" ]]; then
        target_type="node"
    elif [[ -f "pyproject.toml" ]]; then
        target_type="python"
    fi

    # Compare each kit file (recursively)
    while IFS= read -r -d '' kit_file; do
        [[ -f "$kit_file" ]] || continue

        # Get relative path from kit_rules
        local rel_path="${kit_file#$kit_rules/}"

        # Skip projectrules.md - always project-specific
        if [[ "$rel_path" == "projectrules.md" ]]; then
            echo "SKIP: $rel_path (project-specific)"
            continue
        fi

        # Language-specific rule filtering:
        # - *-py.md files: only used for Python projects, always skip for others
        # - Base files (e.g. constitution.md): skip for Python IF a -py variant exists in kit
        local base_name
        base_name=$(basename "$rel_path")
        if [[ "$base_name" == *-py.md ]]; then
            if [[ "$target_type" != "python" ]]; then
                continue
            fi
        elif [[ "$target_type" == "python" ]]; then
            local py_variant="${kit_file%.md}-py.md"
            if [[ -f "$py_variant" ]]; then
                continue
            fi
        fi

        local project_file="$project_rules/$rel_path"

        if [[ ! -f "$project_file" ]]; then
            warn "NEW: $rel_path (not in project)"
            has_changes=1
        else
            local kit_hash project_hash
            kit_hash=$(get_file_hash "$kit_file")
            project_hash=$(get_file_hash "$project_file")

            if [[ "$kit_hash" == "$project_hash" ]]; then
                success "IDENTICAL: $rel_path"
            else
                warn "DIFFERS: $rel_path"
                has_changes=1
            fi
        fi
    done < <(find "$kit_rules" -name "*.md" -type f -print0)

    # Check for project-only files (skip project/ subfolder - always project-specific)
    if [[ -d "$project_rules" ]]; then
        while IFS= read -r -d '' project_file; do
            [[ -f "$project_file" ]] || continue

            local rel_path="${project_file#$project_rules/}"

            # Skip project/ subfolder - always project-specific
            if [[ "$rel_path" == project/* ]]; then
                continue
            fi

            local kit_file="$kit_rules/$rel_path"

            if [[ ! -f "$kit_file" ]]; then
                info "PROJECT-ONLY: $rel_path"
            fi
        done < <(find "$project_rules" -name "*.md" -type f -print0)
    fi

    echo ""
    return $has_changes
}

# Compare and install git hooks
compare_hooks() {
    local kit_path="$1"
    local kit_hooks="$kit_path/_git-hooks-project"
    local project_hooks="./.git/hooks"

    header "=== GIT HOOKS ==="
    echo ""

    if [[ ! -d ".git" ]]; then
        warn "No .git directory - skipping hooks"
        echo ""
        return 0
    fi

    if [[ ! -d "$kit_hooks" ]]; then
        warn "Starter kit missing _git-hooks-project/ folder"
        echo ""
        return 0
    fi

    local has_changes=0

    for kit_hook in "$kit_hooks"/*; do
        [[ -f "$kit_hook" ]] || continue

        local filename
        filename=$(basename "$kit_hook")

        # Skip README
        if [[ "$filename" == "README.md" ]]; then
            continue
        fi

        local project_hook="$project_hooks/$filename"

        if [[ ! -f "$project_hook" ]]; then
            warn "MISSING: $filename"
            echo "  Hook not installed in project"
            echo ""
            echo "  Options:"
            echo "    [i] Install hook from starter kit"
            echo "    [s] Skip"
            echo -n "  Choice [i/s]: "
            read -r choice
            case "$choice" in
                i|I)
                    cp "$kit_hook" "$project_hook"
                    chmod +x "$project_hook"
                    success "  Installed: $filename"
                    ;;
                *)
                    echo "  Skipped"
                    has_changes=1
                    ;;
            esac
            echo ""
        else
            local kit_hash project_hash
            kit_hash=$(get_file_hash "$kit_hook")
            project_hash=$(get_file_hash "$project_hook")

            if [[ "$kit_hash" == "$project_hash" ]]; then
                # Check if executable
                if [[ -x "$project_hook" ]]; then
                    success "OK: $filename"
                else
                    warn "NOT EXECUTABLE: $filename"
                    echo ""
                    echo "  Options:"
                    echo "    [f] Fix permissions (chmod +x)"
                    echo "    [s] Skip"
                    echo -n "  Choice [f/s]: "
                    read -r choice
                    case "$choice" in
                        f|F)
                            chmod +x "$project_hook"
                            success "  Fixed: $filename is now executable"
                            ;;
                        *)
                            echo "  Skipped"
                            has_changes=1
                            ;;
                    esac
                    echo ""
                fi
            else
                warn "DIFFERS: $filename"
                echo "  Project hook differs from starter kit"
                echo ""
                echo "  Options:"
                echo "    [u] Update with starter kit version"
                echo "    [d] Show diff"
                echo "    [s] Skip (keep project version)"
                echo -n "  Choice [u/d/s]: "
                read -r choice
                case "$choice" in
                    u|U)
                        cp "$kit_hook" "$project_hook"
                        chmod +x "$project_hook"
                        success "  Updated: $filename"
                        ;;
                    d|D)
                        echo ""
                        echo "--- Project version"
                        echo "+++ Starter kit version"
                        diff "$project_hook" "$kit_hook" || true
                        echo ""
                        echo "  Options:"
                        echo "    [u] Update with starter kit version"
                        echo "    [s] Skip (keep project version)"
                        echo -n "  Choice [u/s]: "
                        read -r choice2
                        case "$choice2" in
                            u|U)
                                cp "$kit_hook" "$project_hook"
                                chmod +x "$project_hook"
                                success "  Updated: $filename"
                                ;;
                            *)
                                echo "  Skipped"
                                has_changes=1
                                ;;
                        esac
                        ;;
                    *)
                        echo "  Skipped"
                        has_changes=1
                        ;;
                esac
                echo ""
            fi
        fi
    done

    echo ""
    return $has_changes
}

# Audit CLAUDE.md
audit_claude_md() {
    local kit_path="$1"
    local kit_claude="$kit_path/_claude-project/CLAUDE.md"

    header "=== CLAUDE.MD AUDIT ==="
    echo ""

    if [[ ! -f "CLAUDE.md" ]]; then
        warn "MISSING: CLAUDE.md"
        echo ""
        echo "  Options:"
        echo "    [c] Create from starter kit template"
        echo "    [s] Skip"
        echo -n "  Choice [c/s]: "
        read -r choice
        case "$choice" in
            c|C)
                if [[ -f "$kit_claude" ]]; then
                    cp "$kit_claude" "CLAUDE.md"
                    success "  Created: CLAUDE.md"
                else
                    # Fallback if kit template missing
                    cat > "CLAUDE.md" << 'EOF'
# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

Rules are auto-discovered from `.claude/rules/` - no imports needed.
EOF
                    success "  Created: CLAUDE.md (default template)"
                fi
                ;;
            *)
                echo "  Skipped"
                ;;
        esac
        echo ""
        return 1
    fi

    # Check for legacy AGENTS.md import (deprecated)
    if grep -q "@AGENTS.md" "CLAUDE.md"; then
        warn "CLAUDE.md imports @AGENTS.md (deprecated - use .claude/rules/ instead)"
        echo ""
        return 1
    fi

    # Check for legacy AIRules imports
    if grep -qE "@AIRules/|@airules/" "CLAUDE.md"; then
        warn "CLAUDE.md has legacy AIRules imports (migrate to .claude/rules/)"
        echo ""
        return 1
    fi

    success "CLAUDE.md OK"
    echo ""
    return 0
}

# Check for legacy AGENTS.md (deprecated)
check_legacy_agents() {
    header "=== LEGACY CHECK ==="
    echo ""

    if [[ -f "AGENTS.md" ]]; then
        warn "AGENTS.md exists (deprecated - .claude/rules/ auto-discovers)"
        echo "Consider deleting AGENTS.md and migrating imports to .claude/rules/"
        echo ""
        return 1
    fi

    if [[ -d "AIRules" ]]; then
        warn "AIRules/ folder exists (deprecated - migrate to .claude/rules/)"
        echo ""
        return 1
    fi

    success "No legacy files found"
    echo ""
    return 0
}

# Main
main() {
    echo "=========================================="
    echo "STARTER KIT SYNC"
    echo "=========================================="
    echo ""

    check_project

    local kit_path
    kit_path=$(get_kit_path)

    echo "Project:     $PWD"
    echo "Starter Kit: $kit_path"
    echo ""

    local total_changes=0

    compare_rules "$kit_path" || total_changes=1
    check_mcp_rules "$kit_path" || total_changes=1
    compare_hooks "$kit_path" || total_changes=1
    audit_claude_md "$kit_path" || total_changes=1
    check_legacy_agents || true  # Warn but don't block

    echo "=========================================="
    if [[ $total_changes -eq 0 ]]; then
        success "✓ All synced. No changes needed."
    else
        warn "⚠ Changes available. Review above and decide actions."
    fi
    exit 0
}

main "$@"
