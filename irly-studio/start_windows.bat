@echo off
rem IRLY Studio sur Windows : double-clique sur ce fichier, puis ouvre http://localhost:8502
cd /d "%~dp0"
if "%IRLY_MPT_DIR%"=="" set "IRLY_MPT_DIR=%~dp0..\..\MoneyPrinterTurbo"
start "" http://localhost:8502
"%IRLY_MPT_DIR%\.venv\Scripts\streamlit.exe" run app.py --server.headless true --server.port 8502
pause
