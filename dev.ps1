# Slime Arena - Development startup script
# Загружает переменные окружения из server/.env.local и запускает dev сервер

$envFile = "server/.env.local"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Убираем кавычки если есть
            $value = $value -replace '^["'']|["'']$', ''
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            Write-Host "Set $name" -ForegroundColor Green
        }
    }
} else {
    Write-Host "Warning: $envFile not found" -ForegroundColor Yellow
}

npm run dev
