@echo off
REM Bat script for stopping all running servers
REM Usage: scripts\stop-servers.bat

setlocal enabledelayedexpansion

echo.
echo ================================================================================
echo  SLIME ARENA - Stopping servers
echo ================================================================================
echo.

set "PORTS=2567 5173"
set "KILLED=0"

for %%P in (%PORTS%) do (
    echo [*] Looking for processes on port %%P...
    
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr :%%P') do (
        if not "%%A"=="" (
            echo    Found process with PID: %%A
            echo    Stopping...
            taskkill /PID %%A /F > nul 2>&1
            if !ERRORLEVEL! equ 0 (
                echo    [+] Process stopped
                set "KILLED=1"
            ) else (
                echo    [!] Failed to stop process
            )
        )
    )
    echo.
)

if !KILLED! equ 1 (
    echo ================================================================================
    echo [OK] All servers stopped!
    echo ================================================================================
) else (
    echo ================================================================================
    echo [i] No processes found on ports 2567, 5173
    echo ================================================================================
)

echo.
