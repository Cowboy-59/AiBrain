#!/bin/bash
# SpockAI Installation Script for Linux/macOS
# Creates a systemd user service (Linux) or launchd agent (macOS)

set -e

ACTION="${1:-install}"
SERVICE_NAME="spockai"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    else
        echo "unknown"
    fi
}

# Find Node.js
find_node() {
    if command -v node &> /dev/null; then
        command -v node
    elif [ -f "$HOME/.nvm/current/bin/node" ]; then
        echo "$HOME/.nvm/current/bin/node"
    else
        echo ""
    fi
}

# Find SpockAI
find_spockai() {
    local paths=(
        "$HOME/.openclaw/workspace/skills/spockai"
        "$(dirname "$0")/.."
    )

    for path in "${paths[@]}"; do
        if [ -f "$path/package.json" ]; then
            echo "$path"
            return
        fi
    done
    echo ""
}

# Install on Linux (systemd)
install_linux() {
    echo -e "${CYAN}Installing SpockAI as systemd user service...${NC}"

    local node_path=$(find_node)
    if [ -z "$node_path" ]; then
        echo -e "${RED}ERROR: Node.js not found. Please install Node.js 22 or later.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Found Node.js: $node_path${NC}"

    local spockai_path=$(find_spockai)
    if [ -z "$spockai_path" ]; then
        echo -e "${RED}ERROR: SpockAI not found.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Found SpockAI: $spockai_path${NC}"

    # Create user systemd directory
    mkdir -p "$HOME/.config/systemd/user"

    # Create service file
    cat > "$HOME/.config/systemd/user/$SERVICE_NAME.service" << EOF
[Unit]
Description=SpockAI Personal Assistant
After=network.target

[Service]
Type=simple
WorkingDirectory=$spockai_path
ExecStart=$node_path $spockai_path/dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF

    # Reload systemd
    systemctl --user daemon-reload

    # Enable service
    systemctl --user enable "$SERVICE_NAME"

    echo -e ""
    echo -e "${GREEN}SUCCESS: SpockAI installed as systemd user service${NC}"
    echo -e ""
    echo -e "Commands:"
    echo -e "  Start:   systemctl --user start $SERVICE_NAME"
    echo -e "  Stop:    systemctl --user stop $SERVICE_NAME"
    echo -e "  Status:  systemctl --user status $SERVICE_NAME"
    echo -e "  Logs:    journalctl --user -u $SERVICE_NAME -f"
}

# Install on macOS (launchd)
install_macos() {
    echo -e "${CYAN}Installing SpockAI as launchd agent...${NC}"

    local node_path=$(find_node)
    if [ -z "$node_path" ]; then
        echo -e "${RED}ERROR: Node.js not found. Please install Node.js 22 or later.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Found Node.js: $node_path${NC}"

    local spockai_path=$(find_spockai)
    if [ -z "$spockai_path" ]; then
        echo -e "${RED}ERROR: SpockAI not found.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Found SpockAI: $spockai_path${NC}"

    # Create LaunchAgents directory
    mkdir -p "$HOME/Library/LaunchAgents"

    local plist_path="$HOME/Library/LaunchAgents/com.spockai.agent.plist"
    local log_path="$HOME/.openclaw/logs"
    mkdir -p "$log_path"

    # Create plist file
    cat > "$plist_path" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.spockai.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>$node_path</string>
        <string>$spockai_path/dist/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$spockai_path</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$log_path/spockai.log</string>
    <key>StandardErrorPath</key>
    <string>$log_path/spockai-error.log</string>
</dict>
</plist>
EOF

    # Load the agent
    launchctl load "$plist_path"

    echo -e ""
    echo -e "${GREEN}SUCCESS: SpockAI installed as launchd agent${NC}"
    echo -e ""
    echo -e "Commands:"
    echo -e "  Start:   launchctl start com.spockai.agent"
    echo -e "  Stop:    launchctl stop com.spockai.agent"
    echo -e "  Logs:    tail -f $log_path/spockai.log"
}

# Uninstall on Linux
uninstall_linux() {
    echo -e "${CYAN}Uninstalling SpockAI...${NC}"

    systemctl --user stop "$SERVICE_NAME" 2>/dev/null || true
    systemctl --user disable "$SERVICE_NAME" 2>/dev/null || true
    rm -f "$HOME/.config/systemd/user/$SERVICE_NAME.service"
    systemctl --user daemon-reload

    echo -e "${GREEN}SUCCESS: SpockAI uninstalled${NC}"
}

# Uninstall on macOS
uninstall_macos() {
    echo -e "${CYAN}Uninstalling SpockAI...${NC}"

    local plist_path="$HOME/Library/LaunchAgents/com.spockai.agent.plist"

    launchctl unload "$plist_path" 2>/dev/null || true
    rm -f "$plist_path"

    echo -e "${GREEN}SUCCESS: SpockAI uninstalled${NC}"
}

# Get status
get_status() {
    local os=$(detect_os)

    echo -e "${CYAN}SpockAI Status:${NC}"

    if [ "$os" == "linux" ]; then
        systemctl --user status "$SERVICE_NAME" --no-pager || echo "Not installed"
    elif [ "$os" == "macos" ]; then
        launchctl list | grep spockai || echo "Not installed"
    fi
}

# Main
OS=$(detect_os)

if [ "$OS" == "unknown" ]; then
    echo -e "${RED}ERROR: Unsupported operating system${NC}"
    exit 1
fi

case "$ACTION" in
    install)
        if [ "$OS" == "linux" ]; then
            install_linux
        else
            install_macos
        fi
        ;;
    uninstall)
        if [ "$OS" == "linux" ]; then
            uninstall_linux
        else
            uninstall_macos
        fi
        ;;
    status)
        get_status
        ;;
    start)
        if [ "$OS" == "linux" ]; then
            systemctl --user start "$SERVICE_NAME"
        else
            launchctl start com.spockai.agent
        fi
        ;;
    stop)
        if [ "$OS" == "linux" ]; then
            systemctl --user stop "$SERVICE_NAME"
        else
            launchctl stop com.spockai.agent
        fi
        ;;
    *)
        echo "Usage: $0 <install|uninstall|status|start|stop>"
        echo ""
        echo "Actions:"
        echo "  install   - Install SpockAI as a system service"
        echo "  uninstall - Remove SpockAI service"
        echo "  status    - Show SpockAI service status"
        echo "  start     - Start SpockAI"
        echo "  stop      - Stop SpockAI"
        ;;
esac
