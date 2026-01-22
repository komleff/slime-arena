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

## Использование GitHub

Для работы с GitHub используй **GitHub CLI (`gh`)** вместо MCP сервера:

```bash
gh pr create            # Создать PR
gh pr list              # Список PR
gh issue list           # Список issues
gh api repos/...        # GitHub API
```

GitHub CLI уже настроен и используется в проекте.

---

## Проверка работоспособности

```bash
beads-mcp --version    # Проверить версию
bd ready               # Показать готовые задачи
```

---

## Доступные команды Beads

- `bd ready` — показать готовые задачи
- `bd create` — создать задачу
- `bd update` — обновить задачу
- `bd close` — закрыть задачу
- `bd show` — показать детали задачи
- `bd dep` — управление зависимостями
- `bd sync` — синхронизация с Git

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

### Beads MCP не работает

1. Проверить установку: `pip list | grep beads`
2. Переустановить: `pip install --upgrade beads-mcp`
3. Проверить путь: `which beads-mcp`

---

## Конфигурация mcp.json

**Путь:** `%APPDATA%\Code\User\mcp.json` (Windows)

```json
{
  "servers": {
    "beads": {
      "type": "stdio",
      "command": "beads-mcp",
      "args": []
    }
  },
  "inputs": []
}
```
