@echo off
REM Bat скрипт для запуска сервера и клиента в отдельных окнах
REM Использование: scripts\start-servers.bat

setlocal enabledelayedexpansion

set "PROJECT_ROOT=%~dp0.."
set "LOG_DIR=%PROJECT_ROOT%\logs"

REM Создаём директорию логов, если её нет
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo.
echo ================================================================================
echo  ^^ SLIME ARENA — Запуск серверов
echo ================================================================================
echo.
echo Корневая директория: %PROJECT_ROOT%
echo Логи: %LOG_DIR%
echo.

REM Проверяем наличие node_modules
if not exist "%PROJECT_ROOT%\node_modules" (
    echo ⚠️  node_modules не найдены. Запускаю npm install...
    cd /d "%PROJECT_ROOT%"
    call npm install
)

REM Запускаем сервер в новом окне
echo ▶️  Запуск сервера (ws://localhost:2567)
set "SERVER_LOG=%LOG_DIR%\server.log"
start "SLIME ARENA - Server" /D "%PROJECT_ROOT%" cmd /k "npm run dev:server > "%SERVER_LOG%" 2>&1"
echo    ✓ Сервер запущен
echo.

REM Небольшая задержка перед запуском клиента
timeout /t 2 /nobreak > nul

REM Запускаем клиент в новом окне
echo ▶️  Запуск клиента (http://localhost:5173)
set "CLIENT_LOG=%LOG_DIR%\client.log"
start "SLIME ARENA - Client" /D "%PROJECT_ROOT%" cmd /k "npm run dev:client > "%CLIENT_LOG%" 2>&1"
echo    ✓ Клиент запущен
echo.

echo ================================================================================
echo ✅ Оба сервера запущены!
echo ================================================================================
echo.
echo 🌐 Адреса:
echo    Server:  ws://localhost:2567
echo    Client:  http://localhost:5173
echo.
echo 📋 Команды:
echo    • Закрыть сервер:  закройте окно сервера
echo    • Закрыть клиент:  закройте окно клиента
echo.
echo 📝 Логи: %LOG_DIR%
echo.
