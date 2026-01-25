# Claude Code Configuration

## Structure

| File | Purpose | Git |
|------|---------|-----|
| `settings.json` | Project-wide settings (team) | ✅ Committed |
| `settings.local.json` | Personal settings (local) | ❌ Ignored |

## Settings Priority

Claude Code merges settings in this order:
1. `settings.json` — base project settings
2. `settings.local.json` — overrides for personal preferences

## Usage

### Team Settings (`settings.json`)

Committed to Git, shared across all team members:
- Language: Russian
- Permissions: allowed/denied commands
- Directories: plans, notebooks
- MCP servers: enabled

### Personal Settings (`settings.local.json`)

Not committed, specific to each developer:
- `alwaysThinkingEnabled`
- `autoUpdatesChannel`
- Personal API keys (if needed)

## Example `settings.local.json`

```json
{
  "alwaysThinkingEnabled": false,
  "autoUpdatesChannel": "stable"
}
```

## Migration

Old structure (deprecated):
- `claude.json` in project root → now `.claude/settings.json`
