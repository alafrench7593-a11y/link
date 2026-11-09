# IRLY Studio : installation sur Windows 10/11, sans Ubuntu.
# Lancer depuis PowerShell, dans le dossier irly-studio :
#   powershell -ExecutionPolicy Bypass -File .\setup_windows.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Le vrai Python (pas le raccourci "python" du Microsoft Store, qui ne fait rien)
function Find-Python {
  $candidates = @(
    "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
    "$env:ProgramFiles\Python311\python.exe",
    "$env:ProgramFiles\Python312\python.exe"
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) {
    $p = & py -3 -c "import sys; print(sys.executable)" 2>$null
    if ($p -and (Test-Path $p)) { return $p }
  }
  return $null
}

$Python = Find-Python
if (-not $Python) {
  Write-Host "Installation de Python 3.11..." -ForegroundColor Cyan
  winget install --id Python.Python.3.11 -e --scope user --accept-source-agreements --accept-package-agreements
  $Python = Find-Python
}
if (-not $Python) { throw "Python introuvable. Installe Python 3.11 depuis python.org (coche 'Add to PATH'), puis relance." }
Write-Host "Python : $Python" -ForegroundColor Cyan

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue) -and -not (Test-Path "$env:LOCALAPPDATA\Microsoft\WinGet\Links\ffmpeg.exe")) {
  Write-Host "Installation de FFmpeg..." -ForegroundColor Cyan
  winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
}

$Root = (Resolve-Path "$PSScriptRoot\..\..").Path
$Mpt = if ($env:IRLY_MPT_DIR) { $env:IRLY_MPT_DIR } else { Join-Path $Root "MoneyPrinterTurbo" }
$Commit = "c235354804104665b58679223847f78c2b5e27d4"
if (-not (Test-Path "$Mpt\cli.py")) {
  # Telechargement en ZIP : Git n'est pas necessaire
  Write-Host "Telechargement de MoneyPrinterTurbo..." -ForegroundColor Cyan
  $Zip = Join-Path $Root "mpt.zip"
  Invoke-WebRequest "https://github.com/harry0703/MoneyPrinterTurbo/archive/$Commit.zip" -OutFile $Zip
  Expand-Archive $Zip -DestinationPath $Root -Force
  if (Test-Path $Mpt) { Remove-Item $Mpt -Recurse -Force }
  Rename-Item (Join-Path $Root "MoneyPrinterTurbo-$Commit") $Mpt
  Remove-Item $Zip
}
if (-not (Test-Path "$Mpt\config.toml")) { Copy-Item "$Mpt\config.example.toml" "$Mpt\config.toml" }

Write-Host "Creation de l'environnement Python..." -ForegroundColor Cyan
& $Python -m venv "$Mpt\.venv"
$VenvPy = "$Mpt\.venv\Scripts\python.exe"
if (-not (Test-Path $VenvPy)) { throw "L'environnement Python n'a pas ete cree dans $Mpt\.venv" }
Write-Host "Installation des modules (5 a 10 minutes, sans affichage)..." -ForegroundColor Cyan
& $VenvPy -m pip install -q --upgrade pip
& $VenvPy -m pip install -q -r "$Mpt\requirements.txt" pytest
Write-Host "OK. Lance le studio avec start_windows.bat" -ForegroundColor Green
