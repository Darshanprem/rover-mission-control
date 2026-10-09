@echo off
setlocal
cd /d "%~dp0backend"
echo.
echo ORBIT - Rover Mission Control
echo.
where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install Python 3.11 or newer and enable Add to PATH.
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
  python -m venv .venv
  if errorlevel 1 goto failure
)
".venv\Scripts\python.exe" -m pip install -r requirements-lock.txt
if errorlevel 1 goto failure
echo.
echo Open http://127.0.0.1:8000 in your browser after the server starts.
echo Keep this window open. Press Ctrl+C to stop.
echo.
".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
if errorlevel 1 goto failure
exit /b 0
:failure
echo.
echo Startup failed. Check the message above and README.md troubleshooting.
pause
exit /b 1
