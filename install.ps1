$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Set Window Title
$Host.UI.RawUI.WindowTitle = "Installing Super Terminal..."

# Header & Banner
Clear-Host
Write-Host ""
Write-Host "  ================================================================" -ForegroundColor Cyan
Write-Host "    ____  _   _ ____  _____ ____    _____ _____ ____  __  __" -ForegroundColor Cyan
Write-Host "   / ___|| | | |  _ \| ____|  _ \  |_   _| ____|  _ \|  \/  |" -ForegroundColor Cyan
Write-Host "   \___ \| | | | |_) |  _| | |_) |   | | |  _| | |_) | |\/| |" -ForegroundColor Magenta
Write-Host "    ___) | |_| |  __/| |___|  _ <    | | | |___|  _ <| |  | |" -ForegroundColor Magenta
Write-Host "   |____/ \___/|_|   |_____|_| \_\   |_| |_____|_| \_\_|  |_|" -ForegroundColor DarkCyan
Write-Host "                                                             "
Write-Host "               AI AGENT DESKTOP CONTROL CENTER               " -ForegroundColor Yellow
Write-Host "  ================================================================" -ForegroundColor Cyan
Write-Host ""

# Helper: Print Step Status
function Write-Step {
    param([string]$Message, [string]$Status = "RUNNING")
    if ($Status -eq "RUNNING") {
        Write-Host "  [?] $Message" -ForegroundColor Cyan
    } elseif ($Status -eq "SUCCESS") {
        Write-Host "  [✓] $Message" -ForegroundColor Green
    } elseif ($Status -eq "FAILED") {
        Write-Host "  [✗] $Message" -ForegroundColor Red
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

# 3. Streamed Chunk Download with Live Progress Bar
Write-Host ""
Write-Host "  [↓] Streaming package download..." -ForegroundColor Yellow

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

    try {
        while (($read = $responseStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $targetStream.Write($buffer, 0, $read)
            $downloadedBytes += $read
            
            $percent = if ($totalBytes -gt 0) { [math]::Floor(($downloadedBytes / $totalBytes) * 100) } else { 0 }
            $mbDownloaded = [math]::Round($downloadedBytes / 1MB, 1)
            $mbTotal = [math]::Round($totalBytes / 1MB, 1)
            
            $barLength = 30
            $filledLength = [math]::Floor(($percent / 100) * $barLength)
            $unfilledLength = $barLength - $filledLength
            $bar = ("█" * $filledLength) + ("░" * $unfilledLength)
            
            $elapsedSec = $sw.Elapsed.TotalSeconds
            $speed = if ($elapsedSec -gt 0) { [math]::Round(($downloadedBytes / 1MB) / $elapsedSec, 1) } else { 0 }

            $statusLine = "`r  [$bar] $percent% | $mbDownloaded / $mbTotal MB ($speed MB/s) "
            Write-Host -NoNewline $statusLine
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

# 4. Silent Execution with Animated Spinner
Write-Host ""
Write-Step "Installing Super Terminal to your system..."

$process = Start-Process -FilePath $tempPath -ArgumentList "/S" -PassThru
$spinner = @('⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏')
$idx = 0

while (-not $process.HasExited) {
    $char = $spinner[$idx % $spinner.Length]
    Write-Host -NoNewline "`r  [$char] Configuring shortcuts & registered components... "
    Start-Sleep -Milliseconds 120
    $idx++
}

Write-Host "`r  [✓] Installation completed successfully!            " -ForegroundColor Green

# 5. Clean Up
if (Test-Path $tempPath) {
    Remove-Item $tempPath -Force
}

# Final Banner
Write-Host ""
Write-Host "  ┌──────────────────────────────────────────────────────────────┐" -ForegroundColor Green
Write-Host "  │                                                              │" -ForegroundColor Green
Write-Host "  │   ✨ Super Terminal $version Installed Successfully!         │" -ForegroundColor Yellow
Write-Host "  │                                                              │" -ForegroundColor Green
Write-Host "  │   🚀 Launch from: Start Menu or Desktop Shortcut             │" -ForegroundColor Cyan
Write-Host "  │   ⚡ Operating system for your AI coding companions          │" -ForegroundColor Gray
Write-Host "  │                                                              │" -ForegroundColor Green
Write-Host "  └──────────────────────────────────────────────────────────────┘" -ForegroundColor Green
Write-Host ""
