@echo off
REM Скрипт установки Git hooks для защиты ветки main (Windows)

echo Установка Git hooks...

REM Получаем путь к репозиторию
for /f "delims=" %%i in ('git rev-parse --show-toplevel 2^>nul') do set REPO_ROOT=%%i

if "%REPO_ROOT%"=="" (
    echo Ошибка: не удалось найти корень Git репозитория
    exit /b 1
)

REM Конвертируем путь из Unix-стиля в Windows-стиль
set REPO_ROOT=%REPO_ROOT:/=\%

REM Путь к директории с hooks
set HOOKS_DIR=%REPO_ROOT%\.githooks

REM Проверяем наличие .githooks
if not exist "%HOOKS_DIR%" (
    echo Ошибка: директория .githooks не найдена
    exit /b 1
)

REM Конфигурируем Git для использования .githooks
echo Настройка Git для использования .githooks...
git config core.hooksPath .githooks

echo Git hooks установлены успешно!
echo.
echo Теперь попытки прямой отправки в main будут заблокированы локально.
echo.
