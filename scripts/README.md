# 🚀 Скрипты автоматизации Slime Arena

Набор скриптов для удобного запуска и управления серверами.

## Windows

### Запуск обоих серверов в отдельных окнах

**PowerShell (рекомендуется):**
```powershell
.\scripts\start-servers.ps1
```

**Command Prompt:**
```batch
scripts\start-servers.bat
```

### Остановка всех серверов

**PowerShell:**
```powershell
.\scripts\stop-servers.ps1
```

**Command Prompt:**
```batch
scripts\stop-servers.bat
```

## Linux / macOS

### Запуск обоих серверов в отдельных терминалах

```bash
./scripts/start-servers.sh
```

### Остановка всех серверов

**Linux:**
```bash
pkill -f "npm run dev:server"
pkill -f "npm run dev:client"
```

**macOS:**
```bash
killall node
```

## npm команды (все платформы)

### Запуск через npm (в одном терминале)

```bash
npm run start:servers
```

⚠️ **Примечание:** На Windows может привести к зависанию VS Code. Рекомендуется использовать `.ps1` или `.bat` скрипты.

### Запуск отдельно

**Сервер:**
```bash
npm run dev:server
```

**Клиент:**
```bash
npm run dev:client
```

### Остановка

Нажмите `Ctrl+C` в терминале или используйте скрипты выше.

## Что видеть после запуска

### Сервер (порт 2567)
```
Balance config loaded. Tick rate: 30
Listening on ws://localhost:2567
ArenaRoom created!
```

### Клиент (порт 5173)
```
VITE v5.4.21  ready in 157 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

## Логи

Логи сохраняются в директорию `logs/`:
- `logs/server.log` — логи сервера
- `logs/client.log` — логи клиента

## Порты

- **Сервер:** `ws://localhost:2567` (WebSocket)
- **Клиент:** `http://localhost:5173` (HTTP/Vite)

## Решение проблем

### Порты уже заняты

**Windows:**
```powershell
.\scripts\stop-servers.ps1
```

**Linux/macOS:**
```bash
lsof -i :2567  # сервер
lsof -i :5173  # клиент
kill -9 <PID>
```

### PowerShell: "файл не может быть загружен"

Выполните в PowerShell с правами администратора:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Затем:
```powershell
.\scripts\start-servers.ps1
```

### npm не найден

Установите [Node.js](https://nodejs.org/) 18+

### Требуется установка зависимостей

```bash
npm install
```

## Рекомендуемый рабочий процесс

### 1️⃣ Первый запуск

```bash
npm install
.\scripts\start-servers.ps1  # Windows
# или
./scripts/start-servers.sh   # Linux/macOS
```

### 2️⃣ Разработка

Откройте два терминала в VS Code:
- **Terminal 1:** `npm run dev:server`
- **Terminal 2:** `npm run dev:client`

### 3️⃣ Остановка

Нажмите `Ctrl+C` в каждом терминале, или используйте скрипт `stop-servers`
