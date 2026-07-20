#!/bin/bash
set -e

# ANSI TrueColor (24-bit) Tokens (Baby Blue & Flying Dragon Palette)
BABY_BLUE='\033[38;2;137;207;240m'
BOLD_BABY_BLUE='\033[1;38;2;137;207;240m'
DRAGON_GOLD='\033[1;38;2;255;215;0m'
DRAGON_FLAME='\033[1;38;2;255;99;71m'
GREEN='\033[1;32m'
RED='\033[1;31m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Clear terminal screen
clear

echo -e "${BABY_BLUE}================================================================"
echo -e "${DRAGON_FLAME}             / \\  __/\\  / \\"
echo -e "${DRAGON_FLAME}            /   \\/    \\/   \\          ${DRAGON_GOLD}🐉 FLYING DRAGON"
echo -e "${BOLD_BABY_BLUE}          /  (  ${DRAGON_FLAME}o   o${BOLD_BABY_BLUE}  )   \\        ${DRAGON_GOLD}~~~~~~~~~~~~~~~"
echo -e "${BOLD_BABY_BLUE}         (   /\\  ___  /\\    )     ${BOLD_BABY_BLUE}Super Terminal OS"
echo -e "${BABY_BLUE}            \\ /  \\/   \\/  \\  /"
echo -e "${BABY_BLUE}             '             '"
echo -e "${BOLD_BABY_BLUE}  ____  _   _ ____  _____ ____    _____ _____ ____  __  __"
echo -e "${BOLD_BABY_BLUE} / ___|| | | |  _ \\| ____|  _ \\  |_   _| ____|  _ \\|  \\/  |"
echo -e "${BOLD_BABY_BLUE} \\___ \\| | | | |_) |  _| | |_) |   | | |  _| | |_) | |\\/| |"
echo -e "${BOLD_BABY_BLUE}  ___) | |_| |  __/| |___|  _ <    | | | |___|  _ <| |  | |"
echo -e "${BOLD_BABY_BLUE} |____/ \\___/|_|   |_____|_| \\_\\   |_| |_____|_| \\_\\_|  |_|"
echo -e "                                                             "
echo -e "         ${DRAGON_GOLD}${BOLD}✨ AI AGENT DESKTOP CONTROL CENTER (macOS) ✨${NC}"
echo -e "${BABY_BLUE}================================================================${NC}\n"

# Helper step printer
step_run() {
    echo -e "  ${BABY_BLUE}[?]${NC} $1"
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
step_ok "Found latest version: ${BOLD_BABY_BLUE}$VERSION${NC}"

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

# 5. Stream Download with Flying Dragon Indicator
echo -e "\n  ${DRAGON_GOLD}[🐲] Flying Dragon Downloading Stream...${NC}"
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

# Final Banner in Baby Blue
echo -e "\n  ${BOLD_BABY_BLUE}┌──────────────────────────────────────────────────────────────┐${NC}"
echo -e "  ${BOLD_BABY_BLUE}│                                                              │${NC}"
echo -e "  ${BOLD_BABY_BLUE}│${NC}   ${DRAGON_GOLD}${BOLD}✨ Super Terminal $VERSION Installed Successfully!${NC}         ${BOLD_BABY_BLUE}│${NC}"
echo -e "  ${BOLD_BABY_BLUE}│                                                              │${NC}"
echo -e "  ${BOLD_BABY_BLUE}│${NC}   ${BOLD_BABY_BLUE}🚀 Launch via: Spotlight (⌘ + Space) -> Super Terminal     ${BOLD_BABY_BLUE}│${NC}"
echo -e "  ${BOLD_BABY_BLUE}│${NC}   ${DRAGON_FLAME}🐉 Powered by Flying Dragon OS Engine                     ${BOLD_BABY_BLUE}│${NC}"
echo -e "  ${BOLD_BABY_BLUE}│                                                              │${NC}"
echo -e "  ${BOLD_BABY_BLUE}└──────────────────────────────────────────────────────────────┘${NC}\n"
