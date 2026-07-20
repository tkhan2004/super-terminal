# Walkthrough — Next-Gen Artistic One-Command Installers

I have completely redesigned and upgraded both the **Windows (`install.ps1`)** and **macOS (`install.sh`)** one-command installer scripts with state-of-the-art terminal UI features, ASCII banners, streaming progress bars, and animations.

---

## Highlights & Features

### 🪟 Windows PowerShell Installer (`install.ps1`)
- **ASCII Art Banner**: Displays a retro cyan/magenta "SUPER TERMINAL" logo and yellow subtitle header.
- **Step Indicators**: Displays clear step ticks (`[?] Connecting...`, `[✓] Found package`).
- **Streamed .NET Chunk Download**: Custom `.NET System.Net.HttpWebRequest` chunk streaming loop that renders a **real-time block progress bar** with MB downloaded, total MB, percentage, and live speed (MB/s):
  `[████████████████████░░░░░░░░░░░░░░░░] 60% | 24.5 / 40.8 MB (3.2 MB/s)`
- **Animated Installer Spinner**: Shows a smooth braille spinner (`⠋`, `⠙`, `⠹`, `⠸`...) while `Start-Process` executes the silent NSIS installer in the background.
- **Success Card**: Prints a clean box with desktop/start menu launch instructions.

---

### 🍎 macOS Bash Installer (`install.sh`)
- **ANSI Color Palette**: Bright Cyan, Magenta, Yellow, Green, and Bold text styling.
- **ASCII Art Banner**: Matching ASCII header customized for macOS.
- **System & Architecture Checks**: Displays `[✓] macOS environment verified` and `[✓] Architecture: Apple Silicon (arm64)` or `Intel (x86_64)`.
- **Clean Download Bar**: Uses `curl` with streaming progress bar.
- **Step-by-Step Checkmarks**: Shows live feedback for mounting the DMG image, copying `Super Terminal.app` to `/Applications`, and unmounting.
- **Success Card**: Displays instructions on launching via Spotlight (`⌘ + Space`).

---

## How to Test / Run

Users can run the commands directly in their terminal:

### Windows:
```powershell
irm https://raw.githubusercontent.com/tkhan2004/super-terminal/main/install.ps1 | iex
```

### macOS:
```bash
curl -fsSL https://raw.githubusercontent.com/tkhan2004/super-terminal/main/install.sh | bash
```
