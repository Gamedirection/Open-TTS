param(
    [string]$ApiUrl = "",
    [string]$Voice = "",
    [string]$Speed = "",
    [string]$Volume = "",
    [switch]$Force
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configDir = Join-Path $env:APPDATA "qutebrowser\config"
$userscriptsDir = Join-Path $configDir "userscripts"

if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir | Out-Null
}
if (-not (Test-Path $userscriptsDir)) {
    New-Item -ItemType Directory -Path $userscriptsDir | Out-Null
}

$files = @(
    "open-tts.py",
    "open-tts.cmd",
    "open-tts-stop.py",
    "open-tts-stop.cmd"
)

foreach ($file in $files) {
    $src = Join-Path $scriptDir $file
    $dst = Join-Path $userscriptsDir $file

    if (-not (Test-Path $src)) {
        Write-Error "Missing source file: $src"
        exit 1
    }

    if ((Test-Path $dst) -and (-not $Force)) {
        Write-Host "Skip existing userscript: $dst"
        continue
    }

    Copy-Item -Path $src -Destination $dst -Force
    Write-Host "Installed userscript: $dst"
}

$cmdPath = Join-Path $userscriptsDir "open-tts.cmd"
if ($ApiUrl -or $Voice -or $Speed -or $Volume) {
    if ((Test-Path $cmdPath) -and (-not $Force)) {
        Write-Host "Defaults not set in open-tts.cmd because it already exists. Edit it manually or re-run with -Force."
    } else {
        $lines = @("@echo off")
        if ($ApiUrl) { $lines += "set \"OPEN_TTS_API=$ApiUrl\"" }
        if ($Voice) { $lines += "set \"OPEN_TTS_VOICE=$Voice\"" }
        if ($Speed) { $lines += "set \"OPEN_TTS_SPEED=$Speed\"" }
        if ($Volume) { $lines += "set \"OPEN_TTS_VOLUME=$Volume\"" }
        $lines += "python `\"%~dp0open-tts.py`\" %*"
        Set-Content -Path $cmdPath -Value ($lines -join "`r`n") -Encoding ASCII
        Write-Host "Configured defaults in open-tts.cmd."
    }
}

$configFile = Join-Path $configDir "config.py"
if (-not (Test-Path $configFile)) {
    New-Item -ItemType File -Path $configFile | Out-Null
}

$marker = "# Open-TTS qutebrowser bindings (Windows)"
$bindingBlock = @"
$marker
config.bind(',t', 'spawn --userscript open-tts.cmd')
config.bind(',T', 'spawn --userscript open-tts.cmd --page')
config.bind(',s', 'spawn --userscript open-tts-stop.cmd')
"@

$exists = Select-String -Path $configFile -Pattern [regex]::Escape($marker) -Quiet
if (-not $exists) {
    Add-Content -Path $configFile -Value "`r`n$bindingBlock`r`n"
    Write-Host "Appended bindings to config.py."
} else {
    Write-Host "Bindings already present in config.py."
}
