#!/bin/bash

# Dev Server Guard Hook - Prevents AI from managing dev server
# User manages the dev server per AGENTS.md protocol

# Read input from Claude Code
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Emergency override - set SKIP_SERVER_GUARD=1 to bypass this hook
if [ "$SKIP_SERVER_GUARD" = "1" ]; then
    exit 0
fi

# Check if this is a Bash command
if [ "$TOOL_NAME" = "Bash" ] || [ "$TOOL_NAME" = "mcp__acp__Bash" ]; then

    # Block: pkill commands targeting dev servers
    if echo "$COMMAND" | grep -E "pkill.*vite|pkill.*npm.*dev|pkill.*node.*dev" > /dev/null; then
        cat <<BLOCK
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "🚫 DEV SERVER KILL BLOCKED\n\nYou attempted to run: $COMMAND\n\nABSOLUTE RULE from AGENTS.md:\n**CRITICAL: NEVER RUN THE DEV SERVER WITHOUT EXPLICIT PERMISSION**\n\nThe user manages the development server. You must follow this protocol:\n\n1. ALWAYS check first if server is running:\n   - Mac/Linux: lsof -i :3001\n   - Windows: netstat -ano | findstr :3001\n2. If port 3001 is in use: DO NOT start another server - the user is running it\n3. If you need server interaction: Ask the user to start the server\n4. Focus on: Code analysis, file inspection, and log monitoring only\n\nYou CANNOT:\n- Kill the dev server (pkill/taskkill)\n- Start the dev server (npm run dev)\n- Restart the dev server\n\nWhat you SHOULD do:\n1. Make your code changes\n2. Ask the user to restart the server themselves\n3. Monitor logs using: tail -f logs/server.log OR tail -f logs/web-current.log\n\nException: Only run server if user explicitly asks AND port 3001 is free\n\nEmergency override: Set SKIP_SERVER_GUARD=1 environment variable"
  }
}
BLOCK
        exit 0
    fi

    # Block: Starting dev servers
    if echo "$COMMAND" | grep -E "npm run dev|npm start|vite dev|pnpm dev|yarn dev" > /dev/null; then
        cat <<BLOCK
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "🚫 DEV SERVER START BLOCKED\n\nYou attempted to run: $COMMAND\n\nABSOLUTE RULE from AGENTS.md:\n**CRITICAL: NEVER RUN THE DEV SERVER WITHOUT EXPLICIT PERMISSION**\n\nWhat you SHOULD do:\n1. Make your code changes\n2. Ask the user: \"I've made the changes. Please restart the dev server to test.\"\n3. Monitor logs using: tail -f logs/web-current.log\n\nDo NOT start the dev server unless:\n- User explicitly says \"start the dev server\"\n- AND port 3001 is confirmed free:\n  - Mac/Linux: lsof -i :3001\n  - Windows: netstat -ano | findstr :3001\n\nEmergency override: Set SKIP_SERVER_GUARD=1 environment variable"
  }
}
BLOCK
        exit 0
    fi
fi

# Allow all other commands
exit 0
