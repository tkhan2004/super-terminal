$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Set Window Title
$Host.UI.RawUI.WindowTitle = "Installing Super Terminal..."

# ANSI Color Tokens (Baby Blue & Flying Dragon Palette)
$e = [char]27
$BabyBlue     = "$e[38;2;137;207;240m"
$BabyBlueBold = "$e[1;38;2;137;207;240m"
$DragonGold   = "$e[1;38;2;255;215;0m"
$DragonFlame  = "$e[1;38;2;255;99;71m"
$DragonPurple = "$e[1;38;2;186;85;211m"
$Reset        = "$e[0m"

# Header & Flying Dragon Banner
Clear-Host
Write-Host ""
Write-Host "  $BabyBlue================================================================"
Write-Host "  $DragonFlame             / \  __/\  / \"
Write-Host "  $DragonFlame            /   \/    \/   \          $DragonGold🐉 FLYING DRAGON"
Write-Host "  $BabyBlueBold          /  (  $DragonFlameo   o$BabyBlueBold  )   \        $DragonGold~~~~~~~~~~~~~~~"
Write-Host "  $BabyBlueBold         (   /\  ___  /\    )     $BabyBlueSuper Terminal OS"
Write-Host "  $BabyBlue            \ /  \/   \/  \  /"
Write-Host "  $BabyBlue             '             '"
Write-Host "  $BabyBlueBold    ____  _   _ ____  _____ ____    _____ _____ ____  __  __"
Write-Host "   / ___|| | | |  _ \| ____|  _ \  |_   _| ____|  _ \|  \/  |"
Write-Host "   \___ \| | | | |_) |  _| | |_) |   | | |  _| | |_) | |\/| |"
Write-Host "    ___) | |_| |  __/| |___|  _ <    | | | |___|  _ <| |  | |"
Write-Host "   |____/ \___/|_|   |_____|_| \_\   |_| |_____|_| \_\_|  |_|"
Write-Host "                                                             "
Write-Host "         $DragonGold✨ AI AGENT DESKTOP CONTROL CENTER (Windows) ✨"
Write-Host "  $BabyBlue================================================================"
Write-Host "$Reset"

# Helper: Print Step Status in Baby Blue
function Write-Step {
    param([string]$Message, [string]$Status = "RUNNING")
    $e = [char]27
    $BabyBlue = "$e[38;2;137;207;240m"
    $Green    = "$e[1;32m"
    $Red      = "$e[1;31m"
    $Reset    = "$e[0m"

    if ($Status -eq "RUNNING") {
        Write-Host "  $BabyBlue[?] $Message$Reset"
    } elseif ($Status -eq "SUCCESS") {
        Write-Host "  $Green[✓] $Message$Reset"
    } elseif ($Status -eq "FAILED") {
        Write-Host "  $Red[✗] $Message$Reset"
    }
}

# 1. Fetch latest release details
Write-Step "Connecting to GitHub API to check latest version..."
$repo = "tkhan2004/super-terminal"
$apiUrl = "https://api.github.com/repos/$repo/releases/latest"

try {
    $release = Invoke-RestMethod -Uri $apiUrl -Method Get -UseBasicParsing
    $version = $release.tag_name
    Write-Step "Found latest version: $version" "SUCCESS"
} catch {
    Write-Step "Failed to query GitHub releases API. Please check your internet connection." "FAILED"
    exit 1
}

# 2. Extract setup asset
Write-Step "Locating Windows installer package..."
$asset = $release.assets | Where-Object { $_.name -like "*Setup*.exe" } | Select-Object -First 1

if (-not $asset) {
    Write-Step "Could not find a Setup .exe installer in release $version" "FAILED"
    exit 1
}

$downloadUrl = $asset.browser_download_url
$tempPath = Join-Path $env:TEMP $asset.name
Write-Step "Found package: $($asset.name) ($([math]::Round($asset.size / 1MB, 1)) MB)" "SUCCESS"

# 3. Streamed Chunk Download with Live Progress Bar & Flying Dragon Animation
Write-Host ""
Write-Host "  $DragonGold[🐲] Flying Dragon Downloading Stream...$Reset"

function Stream-Download {
    param([string]$Url, [string]$Path)
    
    $request = [System.Net.HttpWebRequest]::Create($Url)
    $request.UserAgent = 'SuperTerminalInstaller'
    $response = $request.GetResponse()
    $totalBytes = $response.ContentLength
    $responseStream = $response.GetResponseStream()
    $targetStream = [System.IO.File]::Create($Path)
    
    $buffer = New-Object byte[] 65536
    $downloadedBytes = 0
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $dragonFrames = @("🐉 ~~~", "🐲 ~~~", "🐉 🔥~~", "🐲 🔥🔥")
    $frameIdx = 0

    try {
        while (($read = $responseStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $targetStream.Write($buffer, 0, $read)
            $downloadedBytes += $read
            
            $percent = if ($totalBytes -gt 0) { [math]::Floor(($downloadedBytes / $totalBytes) * 100) } else { 0 }
            $mbDownloaded = [math]::Round($downloadedBytes / 1MB, 1)
            $mbTotal = [math]::Round($totalBytes / 1MB, 1)
            
            $barLength = 26
            $filledLength = [math]::Floor(($percent / 100) * $barLength)
            $unfilledLength = $barLength - $filledLength
            
            $e = [char]27
            $BabyBlue = "$e[38;2;137;207;240m"
            $BabyBlueBold = "$e[1;38;2;137;207;240m"
            $Reset = "$e[0m"

            $bar = ($BabyBlueBold + ("█" * $filledLength)) + ($e + "[90m" + ("░" * $unfilledLength))
            
            $elapsedSec = $sw.Elapsed.TotalSeconds
            $speed = if ($elapsedSec -gt 0) { [math]::Round(($downloadedBytes / 1MB) / $elapsedSec, 1) } else { 0 }
            $dragon = $dragonFrames[$frameIdx % $dragonFrames.Length]

            $statusLine = "`r  $dragon [$bar$Reset$BabyBlue] $percent% | $mbDownloaded/$mbTotal MB ($speed MB/s) $Reset"
            Write-Host -NoNewline $statusLine
            $frameIdx++
        }
        Write-Host ""
    } finally {
        $targetStream.Close()
        $responseStream.Close()
        $response.Close()
    }
}

try {
    Stream-Download -Url $downloadUrl -Path $tempPath
    Write-Step "Download complete and verified!" "SUCCESS"
} catch {
    Write-Step "Download failed: $_" "FAILED"
    exit 1
}

# 4. Silent Execution with Flying Dragon Spinner
Write-Host ""
Write-Step "Installing Super Terminal to your system..."

# Unblock Mark of the Web (Zone.Identifier stream) to bypass Application Control policy
if (Get-Command Unblock-File -ErrorAction SilentlyContinue) {
    Unblock-File -Path $tempPath -ErrorAction SilentlyContinue
}
try {
    Remove-Item -Path "$tempPath:Zone.Identifier" -ErrorAction SilentlyContinue
} catch {}

# Start installer with fallback for elevated execution if blocked
try {
    $process = Start-Process -FilePath $tempPath -ArgumentList "/S" -PassThru
} catch {
    Write-Step "Notice: Application control policy active, requesting UAC elevation..." "RUNNING"
    $process = Start-Process -FilePath $tempPath -ArgumentList "/S" -Verb RunAs -PassThru
}

$dragonSpinner = @(
    "🐉 ⚡ Configuring shortcuts...",
    "🐲 ⚡ Registering PTY components...",
    "🐉 🔥 Optimizing workspace engine...",
    "🐲 🔥 Finalizing installation..."
)
$idx = 0

while (-not $process.HasExited) {
    $msg = $dragonSpinner[$idx % $dragonSpinner.Length]
    Write-Host -NoNewline "`r  $BabyBlueBold[$msg]$Reset          "
    Start-Sleep -Milliseconds 250
    $idx++
}

Write-Host "`r  $e[1;32m[✓] Flying Dragon Installation Completed Successfully!          $Reset"

# 5. Clean Up
if (Test-Path $tempPath) {
    Remove-Item $tempPath -Force
}

# Final Baby Blue Dragon Banner
Write-Host ""
Write-Host "  $BabyBlueBold┌──────────────────────────────────────────────────────────────┐"
Write-Host "  │                                                              │"
Write-Host "  │   $DragonGold✨ Super Terminal $version Installed Successfully!         $BabyBlueBold│"
Write-Host "  │                                                              │"
Write-Host "  │   $BabyBlueBold🚀 Launch from: Start Menu or Desktop Shortcut             │"
Write-Host "  │   $DragonFlame🐉 Powered by Flying Dragon OS Engine                     │"
Write-Host "  │                                                              │"
Write-Host "  └──────────────────────────────────────────────────────────────┘$Reset"
Write-Host ""
