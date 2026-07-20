#!/bin/bash
set -e

echo "⚡ Installing Super Terminal on macOS..."

# 1. Verify OS is macOS
OS="$(uname)"
if [ "$OS" != "Darwin" ]; then
    echo "❌ This installation script is only for macOS (Darwin). Found: $OS"
    exit 1
fi

# 2. Detect CPU Architecture
ARCH="$(uname -m)"
echo "🖥️ Detected architecture: $ARCH"

# 3. Query latest release from GitHub API
REPO="tkhan2004/super-terminal"
API_URL="https://api.github.com/repos/$REPO/releases/latest"

echo "🔍 Finding latest release..."
RELEASE_JSON=$(curl -s "$API_URL")

# Extract version tag
VERSION=$(echo "$RELEASE_JSON" | grep -m1 '"tag_name":' | cut -d'"' -f4)
if [ -z "$VERSION" ]; then
    echo "❌ Failed to query GitHub releases. Please make sure the repository is public."
    exit 1
fi
echo "✨ Found version $VERSION"

# 4. Find the matching DMG download URL
if [ "$ARCH" = "arm64" ]; then
    # Apple Silicon
    DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url":' | grep -i 'arm64.dmg' | head -n 1 | cut -d'"' -f4)
else
    # Intel Mac (x86_64)
    DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url":' | grep -i '.dmg' | grep -iv 'arm64' | head -n 1 | cut -d'"' -f4)
fi

if [ -z "$DOWNLOAD_URL" ]; then
    # Fallback to any DMG if architecture-specific one is not found
    DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url":' | grep -i '.dmg' | head -n 1 | cut -d'"' -f4)
fi

if [ -z "$DOWNLOAD_URL" ]; then
    echo "❌ Could not find a DMG installer in the latest release assets."
    exit 1
fi

DMG_NAME=$(basename "$DOWNLOAD_URL")
TEMP_DMG="/tmp/$DMG_NAME"
MOUNT_POINT="/tmp/super-terminal-mount"

# 5. Download the DMG
echo "📥 Downloading $DMG_NAME..."
curl -L -o "$TEMP_DMG" "$DOWNLOAD_URL"

# 6. Mount the DMG silently
echo "⚙️ Mounting installer..."
mkdir -p "$MOUNT_POINT"
hdiutil attach -nobrowse -quiet -mountpoint "$MOUNT_POINT" "$TEMP_DMG"

# 7. Copy the App to /Applications
echo "📦 Installing Super Terminal to /Applications..."
# If old version exists, remove it first
if [ -d "/Applications/Super Terminal.app" ]; then
    rm -rf "/Applications/Super Terminal.app"
fi
cp -R "$MOUNT_POINT/Super Terminal.app" /Applications/

# 8. Unmount and clean up
echo "🧹 Cleaning up..."
hdiutil detach -quiet "$MOUNT_POINT"
rm -f "$TEMP_DMG"
rm -rf "$MOUNT_POINT"

echo -e "\n✅ Super Terminal $VERSION installed successfully!"
echo "🚀 You can now find 'Super Terminal' in your Applications folder or launch it via Spotlight!"
