# Automation Scripts - Slime Arena

Collection of scripts for convenient server management and repository configuration.

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

## Branch Protection Setup

### Apply branch protection rules to main branch

Requires GitHub token with `repo` permissions.

```bash
# Create token at: https://github.com/settings/tokens
export GITHUB_TOKEN=your_token_here
./scripts/apply-branch-protection.sh
```

This will automatically configure the main branch to:
- Require pull requests for all changes
- Require code owner approval
- Require CI checks to pass
- Prevent force pushes and direct commits

See `.github/BRANCH_PROTECTION.md` for detailed documentation.
