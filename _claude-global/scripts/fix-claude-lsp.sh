#!/bin/bash
#
# Claude Code LSP Fix (adapted for Homebrew)
# ==========================================
# Original: https://gist.github.com/Zamua/f7ca58ce5dd9ba61279ea195a01b190c
# Fixes: https://github.com/anthropics/claude-code/issues/13952
#
# The bug: In b52() (LSP server manager factory), the initialize method G()
# is empty: "async function G(){return}" - it does nothing!
#
# Usage: ./fix-claude-lsp.sh [--check|--restore]
#   --check   : Only check if patch is needed/applied
#   --restore : Restore from most recent backup
#
# Note: Re-run after Claude Code updates if LSP stops working.
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}!${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

find_cli_path() {
    local locations=(
        # Windows (npm global) - check first for Windows users
        "${APPDATA:-$HOME/AppData/Roaming}/npm/node_modules/@anthropic-ai/claude-code/cli.js"
        # Windows (LOCALAPPDATA)
        "${LOCALAPPDATA:-$HOME/AppData/Local}/npm/node_modules/@anthropic-ai/claude-code/cli.js"
        # Homebrew (Apple Silicon)
        "/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/cli.js"
        # Homebrew (Intel)
        "/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js"
        # Native install
        "$HOME/.claude/local/node_modules/@anthropic-ai/claude-code/cli.js"
        # npm global (Linux/Mac)
        "/usr/lib/node_modules/@anthropic-ai/claude-code/cli.js"
        "$(npm root -g 2>/dev/null)/@anthropic-ai/claude-code/cli.js"
    )

    for path in "${locations[@]}"; do
        if [ -f "$path" ]; then
            echo "$path"
            return 0
        fi
    done

    return 1
}

CLI_PATH=$(find_cli_path)

if [ -z "$CLI_PATH" ]; then
    print_error "Claude Code cli.js not found"
    exit 1
fi

if [ "$1" = "--restore" ]; then
    LATEST_BACKUP=$(ls -t "${CLI_PATH}.backup-"* 2>/dev/null | head -1)
    if [ -z "$LATEST_BACKUP" ]; then
        print_error "No backup found for $CLI_PATH"
        exit 1
    fi
    echo "Restoring from: $LATEST_BACKUP"
    cp "$LATEST_BACKUP" "$CLI_PATH"
    print_status "Restored successfully"
    exit 0
fi

VERSION=$(grep -o '"version":"[^"]*"' "$CLI_PATH" | head -1 | cut -d'"' -f4 2>/dev/null || echo "unknown")
echo "Claude Code version: $VERSION"
echo "CLI path: $CLI_PATH"
echo ""

if grep -q 'async function G(){let{servers:F}=await v52()' "$CLI_PATH"; then
    print_status "Already patched!"
    if [ "$1" = "--check" ]; then
        exit 0
    fi
    echo "To restore original: $0 --restore"
    exit 0
fi

if ! grep -q 'async function G(){return}async function Z()' "$CLI_PATH"; then
    print_error "Expected pattern not found"
    echo ""
    echo "This patch is for Claude Code v2.0.76"
    echo "Your version ($VERSION) may have different function names."
    echo ""
    echo "Search for the pattern manually:"
    echo "  grep -o 'async function [A-Z](){return}' \"$CLI_PATH\""
    exit 1
fi

if [ "$1" = "--check" ]; then
    print_warning "Patch needed - run without --check to apply"
    exit 1
fi

BACKUP_PATH="${CLI_PATH}.backup-$(date +%Y%m%d-%H%M%S)"
cp "$CLI_PATH" "$BACKUP_PATH"
echo "Backup: $BACKUP_PATH"
echo ""

echo "Applying fix..."

perl -i -pe 's/async function G\(\)\{return\}async function Z\(\)/async function G(){let{servers:F}=await v52();for(let[E,z]of Object.entries(F)){let \$=T52(E,z);A.set(E,\$);for(let[L,N]of Object.entries(z.extensionToLanguage)){let M=Q.get(L)||[];M.push(E);Q.set(L,M)}}}async function Z()/g' "$CLI_PATH"

if grep -q 'async function G(){let{servers:F}=await v52()' "$CLI_PATH"; then
    echo ""
    print_status "Fix applied successfully!"
    print_warning "Restart Claude Code for changes to take effect"
    echo ""
    echo "To restore original: $0 --restore"
else
    print_error "Fix verification failed. Restoring backup..."
    cp "$BACKUP_PATH" "$CLI_PATH"
    exit 1
fi
