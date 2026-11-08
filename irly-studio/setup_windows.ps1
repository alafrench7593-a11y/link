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
Need python "Python.Python.3.11"
Need ffmpeg "Gyan.FFmpeg"
# Recharge le PATH pour voir les outils fraîchement installés
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
# Emplacements par défaut, au cas où Windows n'a pas encore mis le PATH à jour
foreach ($d in @("$env:ProgramFiles\Git\cmd", "$env:LOCALAPPDATA\Programs\Python\Python311",
                 "$env:LOCALAPPDATA\Programs\Python\Python311\Scripts", "$env:LOCALAPPDATA\Microsoft\WinGet\Links")) {
  if ((Test-Path $d) -and ($env:Path -notlike "*$d*")) { $env:Path += ";$d" }
}

$Root = (Resolve-Path "$PSScriptRoot\..\..").Path
$Mpt = if ($env:IRLY_MPT_DIR) { $env:IRLY_MPT_DIR } else { Join-Path $Root "MoneyPrinterTurbo" }
$Commit = "c235354804104665b58679223847f78c2b5e27d4"
if (-not (Test-Path "$Mpt\cli.py")) {
  # Téléchargement en ZIP : Git n'est pas nécessaire
  Write-Host "Téléchargement de MoneyPrinterTurbo..." -ForegroundColor Cyan
  $Zip = Join-Path $Root "mpt.zip"
  Invoke-WebRequest "https://github.com/harry0703/MoneyPrinterTurbo/archive/$Commit.zip" -OutFile $Zip
  Expand-Archive $Zip -DestinationPath $Root -Force
  if (Test-Path $Mpt) { Remove-Item $Mpt -Recurse -Force }
  Rename-Item (Join-Path $Root "MoneyPrinterTurbo-$Commit") $Mpt
  Remove-Item $Zip
}
if (-not (Test-Path "$Mpt\config.toml")) { Copy-Item "$Mpt\config.example.toml" "$Mpt\config.toml" }
python -m venv "$Mpt\.venv"
& "$Mpt\.venv\Scripts\python.exe" -m pip install -q --upgrade pip
& "$Mpt\.venv\Scripts\python.exe" -m pip install -q -r "$Mpt\requirements.txt" pytest
Write-Host "OK. Lance le studio avec start_windows.bat" -ForegroundColor Green
