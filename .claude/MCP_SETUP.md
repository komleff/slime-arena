# MCP Servers Configuration

## Текущие серверы

### 1. Beads MCP Server ✅

**Статус:** Работает (v0.46.0)

```json
{
  "beads": {
    "type": "stdio",
    "command": "beads-mcp",
    "args": []
  }
}
```

**Установка:**
```bash
pip install beads-mcp
```

**Возможности:**
- Управление задачами Beads
- Создание/обновление/закрытие issues
- Просмотр зависимостей
- Синхронизация с Git

---

### 2. GitHub MCP Server ⚠️

**Статус:** Требует настройки токена

**Текущая конфигурация (неверная):**
```json
{
  "github": {
    "url": "https://api.githubcopilot.com/mcp/",
    "type": "http"
  }
}
```

**Правильная конфигурация:**
```json
{
  "github": {
    "type": "stdio",
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-github"
    ],
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
    }
  }
}
```

---

## Настройка GitHub MCP Server

### Шаг 1: Создать Personal Access Token

1. Перейти: https://github.com/settings/tokens
2. Нажать "Generate new token" → "Generate new token (classic)"
3. Выбрать scopes:
   - `repo` (полный доступ к репозиториям)
   - `read:org` (опционально, для организаций)
4. Скопировать токен

### Шаг 2: Установить переменную окружения

**Windows (PowerShell):**
```powershell
[System.Environment]::SetEnvironmentVariable('GITHUB_TOKEN', 'ghp_your_token_here', 'User')
```

**Windows (cmd):**
```cmd
setx GITHUB_TOKEN "ghp_your_token_here"
```

**Linux/Mac:**
```bash
echo 'export GITHUB_TOKEN="ghp_your_token_here"' >> ~/.bashrc
source ~/.bashrc
```

### Шаг 3: Обновить конфигурацию MCP

Отредактировать файл:
- **Windows:** `%APPDATA%\Code\User\mcp.json`
- **Linux/Mac:** `~/.config/Code/User/mcp.json`

Заменить секцию `"github"` на правильную конфигурацию (см. выше).

### Шаг 4: Перезапустить VS Code

После изменения конфигурации необходимо перезапустить VS Code.

---

## Проверка работоспособности

### Проверить beads-mcp:
```bash
beads-mcp --version
```

### Проверить GitHub token:
```bash
echo $GITHUB_TOKEN  # Linux/Mac
echo %GITHUB_TOKEN%  # Windows cmd
$env:GITHUB_TOKEN    # Windows PowerShell
```

### Проверить GitHub MCP:
```bash
npx -y @modelcontextprotocol/server-github
```

---

## Доступные инструменты

### Beads MCP:
- `bd_ready` - показать готовые задачи
- `bd_create` - создать задачу
- `bd_update` - обновить задачу
- `bd_close` - закрыть задачу
- `bd_show` - показать детали задачи

### GitHub MCP:
- `create_issue` - создать issue
- `create_pull_request` - создать PR
- `get_file_contents` - получить содержимое файла
- `push_files` - закоммитить файлы
- `search_repositories` - поиск репозиториев
- `create_repository` - создать репозиторий
- `fork_repository` - форкнуть репозиторий

---

## Файл конфигурации проекта

Путь: `.claude/settings.json`

```json
{
  "enableAllProjectMcpServers": true
}
```

Этот флаг включает все MCP серверы из `mcp.json` для текущего проекта.

---

## Troubleshooting

### GitHub MCP не работает:

1. Проверить токен: `echo $GITHUB_TOKEN`
2. Проверить права токена на GitHub
3. Проверить установку пакета: `npm list -g @modelcontextprotocol/server-github`
4. Проверить логи в VS Code: View → Output → MCP

### Beads MCP не работает:

1. Проверить установку: `pip list | grep beads`
2. Переустановить: `pip install --upgrade beads-mcp`
3. Проверить путь: `which beads-mcp`

---

## Полная конфигурация mcp.json

```json
{
  "servers": {
    "beads": {
      "type": "stdio",
      "command": "beads-mcp",
      "args": []
    },
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  },
  "inputs": []
}
```
