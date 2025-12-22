# Automation Scripts - Slime Arena

Collection of scripts for convenient server management and development tools.

## Branch Protection

### Check branch protection setup

```bash
npm run check:branch-protection
# or
./scripts/check-branch-protection.sh
```

Verifies that Git hooks and branch protection mechanisms are correctly installed and working.

## Windows

### Start both servers in separate windows

**PowerShell (recommended):**
```powershell
.\scripts\start-servers.ps1
```

**Command Prompt:**
```batch
scripts\start-servers.bat
```

### Stop all servers

**PowerShell:**
```powershell
.\scripts\stop-servers.ps1
```

**Command Prompt:**
```batch
scripts\stop-servers.bat
```

## Linux / macOS

### Start both servers in separate terminals

```bash
./scripts/start-servers.sh
```

### Stop all servers

**Linux:**
```bash
pkill -f "npm run dev:server"
pkill -f "npm run dev:client"
```

**macOS:**
```bash
killall node
```

## npm commands (all platforms)

### Start via npm (in one terminal)

```bash
npm run start:servers
```

**Note:** On Windows, this may freeze VS Code. Use `.ps1` or `.bat` scripts instead.

### Start separately

**Server:**
```bash
npm run dev:server
```

**Client:**
```bash
npm run dev:client
```

### Stop

Press `Ctrl+C` in terminals or use stop scripts above.

## Expected output after startup

### Server output
```
Balance config loaded. Tick rate: 30
Listening on ws://localhost:2567
ArenaRoom created!
```

### Client output
```
VITE v5.4.21  ready in 157 ms

  Local:   http://localhost:5173/
  Network: use --host to expose
```

## Ports

- **Server:** `ws://localhost:2567` (WebSocket)
- **Client:** `http://localhost:5173` (HTTP/Vite)

## Troubleshooting

### Ports already in use

**Windows:**
```powershell
.\scripts\stop-servers.ps1
```

**Linux/macOS:**
```bash
lsof -i :2567  # server
lsof -i :5173  # client
kill -9 <PID>
```

### PowerShell: "cannot be loaded"

Run in PowerShell as Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then:
```powershell
.\scripts\start-servers.ps1
```

### npm not found

Install [Node.js](https://nodejs.org/) 18+

### Dependencies missing

```bash
npm install
```

## Recommended workflow

### 1. First run

```bash
npm install
.\scripts\start-servers.ps1  # Windows
# or
./scripts/start-servers.sh   # Linux/macOS
```

### 2. Development

Open two terminals in VS Code:
- **Terminal 1:** `npm run dev:server`
- **Terminal 2:** `npm run dev:client`

### 3. Stop

Press `Ctrl+C` in each terminal, or use stop scripts above
