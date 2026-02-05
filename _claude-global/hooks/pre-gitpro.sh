#!/bin/bash
# Pre-GitPro Validation Hook
# Runs before gitpro skill to validate type errors, TODOs, and toast usage
# Supports Node (TypeScript) and Python (pyright/mypy) projects
# Returns deny if validation fails, allowing gitpro to use --no-verify safely

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

# Output helper
deny() {
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}' "$1"
    exit 0
}

# Detect project type
PROJECT_TYPE="unknown"
if [ -f "package.json" ]; then
    PROJECT_TYPE="node"
elif [ -f "pyproject.toml" ]; then
    PROJECT_TYPE="python"
fi

if [ "$PROJECT_TYPE" = "unknown" ]; then
    exit 0  # No recognized project, skip validation
fi

# ============================================
# VALIDATION 1: Type Checking
# ============================================
if [ "$PROJECT_TYPE" = "node" ]; then
    if grep -q '"check-types"' package.json 2>/dev/null; then
        echo "Pre-gitpro: Running TypeScript validation..." >&2
        if ! npm run check-types >/dev/null 2>&1; then
            deny "GITPRO BLOCKED - TypeScript Errors\\n\\nFix TypeScript errors before committing.\\nRun: npm run check-types"
        fi
    fi
elif [ "$PROJECT_TYPE" = "python" ]; then
    if command -v pyright >/dev/null 2>&1; then
        echo "Pre-gitpro: Running Python type checking (pyright)..." >&2
        if ! pyright >/dev/null 2>&1; then
            deny "GITPRO BLOCKED - Python Type Errors\\n\\nFix type errors before committing.\\nRun: pyright"
        fi
    elif command -v mypy >/dev/null 2>&1; then
        echo "Pre-gitpro: Running Python type checking (mypy)..." >&2
        if ! mypy . >/dev/null 2>&1; then
            deny "GITPRO BLOCKED - Python Type Errors\\n\\nFix type errors before committing.\\nRun: mypy ."
        fi
    fi
fi

# ============================================
# VALIDATION 2: TODO Tracking (if beads used)
# ============================================
if [ -d ".beads" ] && command -v bd >/dev/null 2>&1 && command -v rg >/dev/null 2>&1; then
    echo "Pre-gitpro: Validating TODO tracking..." >&2

    # Set file type flags based on project
    if [ "$PROJECT_TYPE" = "node" ]; then
        RG_TYPES="--type ts --type js --glob !**/node_modules/**"
    elif [ "$PROJECT_TYPE" = "python" ]; then
        RG_TYPES="--type py --glob !**/.venv/** --glob !**/venv/**"
    fi

    INVALID_TODOS=$(rg "TODO\(|FIXME\(|HACK\(|XXX\(" \
        $RG_TYPES \
        --line-number \
        --no-heading \
        --color never \
        2>/dev/null | while IFS=: read -r file line comment; do

        BEAD_ID=$(echo "$comment" | grep -oE '(TODO|FIXME|HACK|XXX)\(([a-z]+-[a-z0-9]+)\)' | grep -oE '[a-z]+-[a-z0-9]+')

        if [[ -z "$BEAD_ID" ]]; then
            echo "$file:$line - MISSING BEAD ID"
        else
            BEAD_STATUS=$(bd list --json 2>/dev/null | jq -r --arg id "$BEAD_ID" '.[] | select(.id == $id) | .status')

            if [[ -z "$BEAD_STATUS" ]]; then
                echo "$file:$line - BEAD NOT FOUND ($BEAD_ID)"
            elif [[ "$BEAD_STATUS" == "closed" ]]; then
                echo "$file:$line - BEAD CLOSED ($BEAD_ID)"
            fi
        fi
    done)

    if [[ -n "$INVALID_TODOS" ]]; then
        deny "GITPRO BLOCKED - Invalid TODOs\\n\\n$INVALID_TODOS\\n\\nFix TODO comments before committing."
    fi
fi

# ============================================
# VALIDATION 3: Toast Check (Node only, if lint:toast exists)
# ============================================
if [ "$PROJECT_TYPE" = "node" ] && grep -q '"lint:toast"' package.json 2>/dev/null; then
    echo "Pre-gitpro: Checking for toast usage..." >&2

    TOAST_OUTPUT=$(npm run lint:toast 2>&1)
    if [ $? -ne 0 ]; then
        # Toast found - warn but don't block (progressive migration)
        echo "WARNING: Toast usage detected. Consider migrating to contextual feedback." >&2
    fi
fi

# All validations passed
echo "Pre-gitpro: All validations passed" >&2
exit 0
