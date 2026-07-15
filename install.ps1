$ErrorActionPreference = 'Stop'

Write-Host "⚡ Installing Super Terminal..." -ForegroundColor Cyan

# 1. Fetch latest release details from GitHub API
$repo = "tkhan2004/super-terminal"
$apiUrl = "https://api.github.com/repos/$repo/releases/latest"

Write-Host "🔍 Finding latest release..." -ForegroundColor Gray
try {
    $release = Invoke-RestMethod -Uri $apiUrl -Method Get -UseBasicParsing
} catch {
    Write-Host "❌ Failed to query GitHub releases API. Please verify repository exists and is public." -ForegroundColor Red
    exit 1
}

$version = $release.tag_name
Write-Host "✨ Found version $version" -ForegroundColor Green

# 2. Extract download URL for the setup exe
$asset = $release.assets | Where-Object { $_.name -like "*Setup*.exe" } | Select-Object -First 1

if (-not $asset) {
    Write-Host "❌ Could not find a Setup .exe installer in the latest release assets." -ForegroundColor Red
    exit 1
}

$downloadUrl = $asset.browser_download_url
$tempPath = Join-Path $env:TEMP $asset.name

# 3. Download the setup file
Write-Host "📥 Downloading installer ($($asset.name))..." -ForegroundColor Gray
Invoke-WebRequest -Uri $downloadUrl -OutFile $tempPath -UseBasicParsing

# 4. Execute silently and wait
Write-Host "⚙️ Installing silently. Please wait..." -ForegroundColor Gray
$process = Start-Process -FilePath $tempPath -ArgumentList "/S" -PassThru -Wait

# 5. Clean up and report success
if (Test-Path $tempPath) {
    Remove-Item $tempPath -Force
}

Write-Host "`n✅ Super Terminal version $version installed successfully!" -ForegroundColor Green
Write-Host "🚀 You can now launch 'Super Terminal' from your Start Menu or Desktop shortcut!" -ForegroundColor Green
