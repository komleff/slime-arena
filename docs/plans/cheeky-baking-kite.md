# План: Обновление worktree slime-arena-meta

**Дата:** 28 января 2026
**PM:** Claude Opus 4.5

---

## Статус

- ✅ PR #110 смержен в main (`6fba246`)
- ✅ Worktree `slime-arena-meta` обновлён (rebase завершён)

---

## Текущее состояние worktree

- **Путь:** `d:\slime-arena-meta`
- **Ветка:** `sprint-13/meta-gameplay`
- **Проблема:** Нет `tools/` (ветка отстаёт от main)

---

## План действий

### 1. Rebase sprint-13/meta-gameplay на main

```bash
cd d:\slime-arena-meta
git fetch origin
git rebase origin/main
```

### 2. Разрешить конфликты (если есть)

Возможные конфликты в:
- `.beads/AGENT_ROLES.md` (обновлён в обеих ветках)
- `TECH_DEBT.md`

### 3. Проверить результат

```bash
ls tools/
# Ожидаем: pm_orchestrator.py, pr_parser.py, consensus.py, review_state.py, gemini_reviewer.py

python tools/pm_orchestrator.py --help
```

### 4. Push обновлённую ветку

```bash
git push --force-with-lease origin sprint-13/meta-gameplay
```

---

## Критерии завершения

- [x] `git rebase origin/main` выполнен
- [x] Конфликты разрешены (8 файлов, использован HEAD)
- [x] `d:\slime-arena-meta\tools\` содержит файлы оркестратора
- [x] `git push --force-with-lease` выполнен (`a43e853`)
