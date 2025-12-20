@echo off
REM Bat script for launching server and client in separate windows
REM Usage: scripts\start-servers.bat

setlocal enabledelayedexpansion

set "PROJECT_ROOT=%~dp0.."
set "LOG_DIR=%PROJECT_ROOT%\logs"

REM Create logs directory if needed
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo.
echo ================================================================================
echo  SLIME ARENA - Starting servers
echo ================================================================================
echo.
echo Project root: %PROJECT_ROOT%
echo Logs: %LOG_DIR%
echo.

REM Check if node_modules exists
if not exist "%PROJECT_ROOT%\node_modules" (
    echo [!] node_modules not found. Running npm install...
    cd /d "%PROJECT_ROOT%"
    call npm install
)

REM Start server in new window
echo [*] Starting server (ws://localhost:2567)
set "SERVER_LOG=%LOG_DIR%\server.log"
start "SLIME ARENA - Server" /D "%PROJECT_ROOT%" cmd /k "npm run dev:server"
echo [+] Server started
echo.

REM Wait before starting client
timeout /t 2 /nobreak > nul

REM Start client in new window
echo [*] Starting client (http://localhost:5173)
set "CLIENT_LOG=%LOG_DIR%\client.log"
start "SLIME ARENA - Client" /D "%PROJECT_ROOT%" cmd /k "npm run dev:client"
echo [+] Client started
echo.

echo ================================================================================
echo [OK] Both servers are running!
echo ================================================================================
echo.
echo Addresses:
echo    Server:  ws://localhost:2567
echo    Client:  http://localhost:5173
echo.
echo Commands:
echo    - Close server:  close the server window
echo    - Close client:  close the client window
echo.
echo Logs: %LOG_DIR%
echo.
