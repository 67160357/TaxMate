@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 LTS from https://nodejs.org then run again.
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<24) process.exit(1)"
if errorlevel 1 (
  echo Taxmate requires Node.js 24 or newer.
  pause
  exit /b 1
)
if not exist "node_modules\express" (
  echo Installing dependencies...
  call npm ci --no-audit --no-fund
  if errorlevel 1 goto failed
)
if not exist "dist\index.html" (
  call npm run build
  if errorlevel 1 goto failed
)
echo.
echo Taxmate will be available at http://localhost:3000
start "" "http://localhost:3000"
call npm start
pause
exit /b 0
:failed
echo Setup failed. Check internet access and the error above.
pause
exit /b 1
