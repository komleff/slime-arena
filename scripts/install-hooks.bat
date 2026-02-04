@echo off
REM Скрипт установки git hooks для защиты ветки main (Windows)

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "HOOKS_DIR=%PROJECT_ROOT%\.githooks"
set "GIT_HOOKS_DIR=%PROJECT_ROOT%\.git\hooks"

echo Установка git hooks для защиты ветки main...
echo.

REM Проверяем наличие директории .githooks
if not exist "%HOOKS_DIR%" (
  echo [31mОшибка: Директория .githooks не найдена[0m
  exit /b 1
)

REM Проверяем наличие директории .git/hooks
if not exist "%GIT_HOOKS_DIR%" (
  echo [31mОшибка: Это не git репозиторий или .git\hooks не найдена[0m
  exit /b 1
)

REM Копируем hooks
for %%f in ("%HOOKS_DIR%\*") do (
  set "hook_name=%%~nxf"
  set "target=%GIT_HOOKS_DIR%\!hook_name!"
  
  REM Пропускаем README и другие не-hook файлы
  if /i "!hook_name!"=="README.md" (
    goto :skip
  )
  if "!hook_name:~-3!"==".md" (
    goto :skip
  )
  
  if exist "!target!" (
    echo [33mФайл !hook_name! уже существует, пропускаем...[0m
  ) else (
    copy "%%f" "!target!" >nul
    echo [32mУстановлен hook: !hook_name![0m
  )
  
  :skip
)

echo.
echo [32mУстановка завершена![0m
echo.
echo Установленные hooks:
echo   - pre-commit: блокирует коммиты в main
echo   - pre-push: блокирует push в main
echo   - prepare-commit-msg: предупреждает при работе в main
echo.

endlocal
