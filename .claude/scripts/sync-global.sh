#!/bin/bash
set -euo pipefail

# sync-global.sh - Compare ~/.claude with starter kit's _claude-global
# WHITELIST APPROACH: Only compare specific folders/files we care about
# Exit codes: 0 = has changes, 1 = error, 2 = no changes needed

GLOBAL_DIR="$HOME/.claude"
CONFIG_FILE="$GLOBAL_DIR/starter-kit-config.json"

# WHITELIST: Only these locations are compared
WATCHED_DIRS=("hooks" "skills" "commands" "scripts")
WATCHED_FILES=("settings.json" "statusline.sh")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

error() { echo -e "${RED}ERROR: $1${NC}" >&2; exit 1; }
warn() { echo -e "${YELLOW}$1${NC}"; }
info() { echo -e "${BLUE}$1${NC}"; }
success() { echo -e "${GREEN}$1${NC}"; }

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

# Detect if we're in starter kit (has .claude/master.txt)
detect_kit_path() {
    if [[ -f "$PWD/.claude/master.txt" ]]; then
        echo "$PWD"
        return 0
    fi
    if [[ -f "$CONFIG_FILE" ]]; then
        local path
        path=$(grep -o '"starterKitPath"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
        if [[ -n "$path" && -d "$path" ]]; then
            echo "$path"
            return 0
        fi
    fi
    return 1
}

detect_mode() {
    [[ -f "$PWD/.claude/master.txt" ]] && echo "MASTER" || echo "CONSUMER"
}

# Update config (master mode)
update_config() {
    local kit_path="$1"
    mkdir -p "$(dirname "$CONFIG_FILE")"
    cat > "$CONFIG_FILE" << EOF
{
  "starterKitPath": "$kit_path",
  "lastConfigured": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    info "Updated starter-kit-config.json"
}

# Compare files in whitelist only
compare_files() {
    local kit_dir="$1"
    local mode="$2"
    local kit_base="$kit_dir/_claude-global"

    [[ -d "$kit_base" ]] || error "Starter kit _claude-global not found: $kit_base"

    local identical=0 differs=0 missing_global=0 only_global=0
    declare -a differs_files=() missing_files=() only_global_files=()

    echo "=========================================="
    echo "SYNC ANALYSIS: $mode MODE"
    echo "=========================================="
    echo ""
    echo "Kit:    $kit_base"
    echo "Global: $GLOBAL_DIR"
    echo ""
    echo "Watched: ${WATCHED_DIRS[*]} + ${WATCHED_FILES[*]}"
    echo ""

    # Compare watched directories
    for dir in "${WATCHED_DIRS[@]}"; do
        local kit_dir_path="$kit_base/$dir"
        local global_dir_path="$GLOBAL_DIR/$dir"

        [[ -d "$kit_dir_path" ]] || continue

        while IFS= read -r -d '' file; do
            local rel_path="${file#$kit_base/}"
            local global_file="$GLOBAL_DIR/$rel_path"

            if [[ -f "$global_file" ]]; then
                local kit_hash global_hash
                kit_hash=$(get_file_hash "$file")
                global_hash=$(get_file_hash "$global_file")
                if [[ "$kit_hash" == "$global_hash" ]]; then
                    ((identical++))
                else
                    ((differs++))
                    differs_files+=("$rel_path")
                fi
            else
                ((missing_global++))
                missing_files+=("$rel_path")
            fi
        done < <(find "$kit_dir_path" -type f ! -name ".DS_Store" -print0 2>/dev/null)

        # Check for files only in global (not in kit)
        [[ -d "$global_dir_path" ]] || continue
        while IFS= read -r -d '' file; do
            local rel_path="${file#$GLOBAL_DIR/}"
            local kit_file="$kit_base/$rel_path"
            if [[ ! -f "$kit_file" ]]; then
                ((only_global++))
                only_global_files+=("$rel_path")
            fi
        done < <(find "$global_dir_path" -type f ! -name ".DS_Store" -print0 2>/dev/null)
    done

    # Compare watched root files
    for file in "${WATCHED_FILES[@]}"; do
        local kit_file="$kit_base/$file"
        local global_file="$GLOBAL_DIR/$file"

        [[ -f "$kit_file" ]] || continue

        if [[ -f "$global_file" ]]; then
            local kit_hash global_hash
            kit_hash=$(get_file_hash "$kit_file")
            global_hash=$(get_file_hash "$global_file")
            if [[ "$kit_hash" == "$global_hash" ]]; then
                ((identical++))
            else
                ((differs++))
                differs_files+=("$file")
            fi
        else
            ((missing_global++))
            missing_files+=("$file")
        fi
    done

    # Summary
    echo "--- SUMMARY ---"
    success "Identical:         $identical files"
    [[ $differs -gt 0 ]] && warn "Different:         $differs files" || echo "Different:         $differs files"
    [[ $missing_global -gt 0 ]] && warn "Missing in global: $missing_global files" || echo "Missing in global: $missing_global files"
    [[ $only_global -gt 0 ]] && info "Only in global:    $only_global files" || echo "Only in global:    $only_global files"
    echo ""

    # Details
    if [[ ${#differs_files[@]} -gt 0 ]]; then
        echo "--- DIFFERS ---"
        printf '  %s\n' "${differs_files[@]}"
        echo ""
    fi

    if [[ ${#missing_files[@]} -gt 0 ]]; then
        echo "--- MISSING IN GLOBAL ---"
        printf '  %s\n' "${missing_files[@]}"
        echo ""
    fi

    if [[ ${#only_global_files[@]} -gt 0 ]]; then
        echo "--- ONLY IN GLOBAL ---"
        printf '  %s\n' "${only_global_files[@]}"
        echo ""
    fi

    if [[ $differs -eq 0 && $missing_global -eq 0 ]]; then
        success "All synced. No changes needed."
        return 2
    fi
    return 0
}

main() {
    local kit_path
    kit_path=$(detect_kit_path) || error "Cannot find starter kit. Run from starter kit directory or configure path first."

    local mode
    mode=$(detect_mode)

    [[ "$mode" == "MASTER" ]] && update_config "$kit_path"

    compare_files "$kit_path" "$mode"
}

main "$@"
