#!/bin/bash
# Pre-GitPro Hook
# Creates token to allow git-guard bypass when gitpro skill is active

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // {}')

# Only process Skill tool invocations
if [ "$TOOL_NAME" != "Skill" ]; then
    exit 0
fi

# Check if this is gitpro skill
SKILL_NAME=$(echo "$TOOL_INPUT" | jq -r '.skill // ""')
if [ "$SKILL_NAME" != "gitpro" ]; then
    exit 0
fi

# Create token for git-guard bypass
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
if [ -n "$SESSION_ID" ]; then
    TOKEN_FILE="/tmp/.gitpro-token-${SESSION_ID}"
    date +%s > "$TOKEN_FILE"
fi

exit 0
