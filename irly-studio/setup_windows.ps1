# IRLY Studio : installation sur Windows 10/11, sans Ubuntu.
# Lancer depuis PowerShell, dans le dossier irly-studio :
#   powershell -ExecutionPolicy Bypass -File .\setup_windows.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Need($cmd, $wingetId) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Host "Installation de $wingetId..." -ForegroundColor Cyan
    winget install --id $wingetId -e --accept-source-agreements --accept-package-agreements
  }
}
Need git "Git.Git"
Need python "Python.Python.3.11"
Need ffmpeg "Gyan.FFmpeg"
# Recharge le PATH pour voir les outils fraîchement installés
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")

$Root = (Resolve-Path "$PSScriptRoot\..\..").Path
$Mpt = if ($env:IRLY_MPT_DIR) { $env:IRLY_MPT_DIR } else { Join-Path $Root "MoneyPrinterTurbo" }
if (-not (Test-Path $Mpt)) {
  git clone https://github.com/harry0703/MoneyPrinterTurbo.git $Mpt
  git -C $Mpt checkout c235354804104665b58679223847f78c2b5e27d4
}
if (-not (Test-Path "$Mpt\config.toml")) { Copy-Item "$Mpt\config.example.toml" "$Mpt\config.toml" }
python -m venv "$Mpt\.venv"
& "$Mpt\.venv\Scripts\python.exe" -m pip install -q --upgrade pip
& "$Mpt\.venv\Scripts\python.exe" -m pip install -q -r "$Mpt\requirements.txt" pytest
Write-Host "OK. Lance le studio avec start_windows.bat" -ForegroundColor Green
