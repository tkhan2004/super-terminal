#!/bin/bash
set -e

# ANSI Color Codes
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Clear terminal screen
clear

echo -e "${CYAN}================================================================"
echo -e "${CYAN}  ____  _   _ ____  _____ ____    _____ _____ ____  __  __"
echo -e "${CYAN} / ___|| | | |  _ \| ____|  _ \  |_   _| ____|  _ \|  \/  |"
echo -e "${MAGENTA} \___ \| | | | |_) |  _| | |_) |   | | |  _| | |_) | |\/| |"
echo -e "${MAGENTA}  ___) | |_| |  __/| |___|  _ <    | | | |___|  _ <| |  | |"
echo -e "${CYAN} |____/ \___/|_|   |_____|_| \_\   |_| |_____|_| \_\_|  |_|"
echo -e "                                                             "
echo -e "         ${YELLOW}${BOLD}AI AGENT DESKTOP CONTROL CENTER (macOS)${NC}"
echo -e "${CYAN}================================================ raw${NC}\n"

# Helper step printer
step_run() {
    echo -e "  ${CYAN}[?]${NC} $1"
}

step_ok() {
    echo -e "  ${GREEN}[✓]${NC} $1"
}

step_fail() {
    echo -e "  ${RED}[✗]${NC} $1"
}

# 1. Verify macOS
step_run "Checking system environment..."
OS="$(uname)"
if [ "$OS" != "Darwin" ]; then
    step_fail "This installer is designed for macOS (Darwin). Found: $OS"
    exit 1
fi
step_ok "macOS environment verified"

# 2. Detect CPU Architecture
step_run "Detecting CPU architecture..."
ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then
    step_ok "Architecture: Apple Silicon ($ARCH)"
else
    step_ok "Architecture: Intel ($ARCH)"
fi

# 3. Fetch latest release from GitHub API
step_run "Connecting to GitHub API to check latest release..."
REPO="tkhan2004/super-terminal"
API_URL="https://api.github.com/repos/$REPO/releases/latest"

RELEASE_JSON=$(curl -s "$API_URL")

VERSION=$(echo "$RELEASE_JSON" | grep -m1 '"tag_name":' | cut -d'"' -f4)
if [ -z "$VERSION" ]; then
    step_fail "Failed to query GitHub releases. Please check your internet connection."
    exit 1
fi
step_ok "Found latest version: ${BOLD}$VERSION${NC}"

# 4. Find matching DMG URL
step_run "Locating macOS installer package..."
if [ "$ARCH" = "arm64" ]; then
    DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url":' | grep -i 'arm64.dmg' | head -n 1 | cut -d'"' -f4)
else
    DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url":' | grep -i '.dmg' | grep -iv 'arm64' | head -n 1 | cut -d'"' -f4)
fi

if [ -z "$DOWNLOAD_URL" ]; then
    DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url":' | grep -i '.dmg' | head -n 1 | cut -d'"' -f4)
fi

if [ -z "$DOWNLOAD_URL" ]; then
    step_fail "Could not find a DMG installer in release $VERSION"
    exit 1
fi

DMG_NAME=$(basename "$DOWNLOAD_URL")
TEMP_DMG="/tmp/$DMG_NAME"
MOUNT_POINT="/tmp/super-terminal-mount"
step_ok "Found package: $DMG_NAME"

# 5. Download with Progress Bar
echo -e "\n  ${YELLOW}[↓] Downloading package...${NC}"
curl -L --progress-bar -o "$TEMP_DMG" "$DOWNLOAD_URL"
step_ok "Download complete and verified!"

# 6. Mount DMG silently
echo ""
step_run "Mounting disk image..."
mkdir -p "$MOUNT_POINT"
hdiutil attach -nobrowse -quiet -mountpoint "$MOUNT_POINT" "$TEMP_DMG"
step_ok "Disk image mounted successfully"

# 7. Copy App to /Applications
step_run "Installing Super Terminal to /Applications..."
if [ -d "/Applications/Super Terminal.app" ]; then
    rm -rf "/Applications/Super Terminal.app"
fi
cp -R "$MOUNT_POINT/Super Terminal.app" /Applications/
step_ok "Super Terminal.app copied to /Applications"

# 8. Clean Up
step_run "Cleaning temporary files..."
hdiutil detach -quiet "$MOUNT_POINT" 2>/dev/null || true
rm -f "$TEMP_DMG"
rm -rf "$MOUNT_POINT"
step_ok "Cleanup complete"

# Final Banner
echo -e "\n  ${GREEN}┌──────────────────────────────────────────────────────────────┐${NC}"
echo -e "  ${GREEN}│                                                              │${NC}"
echo -e "  ${GREEN}│${NC}   ${YELLOW}${BOLD}✨ Super Terminal $VERSION Installed Successfully!${NC}         ${GREEN}│${NC}"
echo -e "  ${GREEN}│                                                              │${NC}"
echo -e "  ${GREEN}│${NC}   ${CYAN}🚀 Launch via: Spotlight (⌘ + Space) -> Super Terminal     ${GREEN}│${NC}"
echo -e "  ${GREEN}│${NC}   ${GRAY}📁 Application: /Applications/Super Terminal.app        ${GREEN}│${NC}"
echo -e "  ${GREEN}│                                                              │${NC}"
echo -e "  ${GREEN}└──────────────────────────────────────────────────────────────┘${NC}\n"
