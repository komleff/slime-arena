# Промпты для активации ролей AI-агентов

Краткое руководство по использованию [.beads/AGENT_ROLES.md](.beads/AGENT_ROLES.md).

---

## Architect (декомпозиция задач)

```
Ты Architect. Прочитай AGENT_ROLES.md секция "1️⃣ Architect".
Задача: [описание задачи]
```

**Пример:**
```
Ты Architect. Прочитай AGENT_ROLES.md секция "1️⃣ Architect".
Задача: декомпозировать Stage D Testing на подзадачи.
```

---

## Art Director (визуальный дизайн)

```
Ты Art Director. Прочитай ART_DIRECTOR_ROLE.md.
Задача: [описание визуальной задачи]
```

**Пример:**
```
Ты Art Director. Прочитай ART_DIRECTOR_ROLE.md.
Задача: создать CSS-стили для Jelly Button в стиле "Sticker Pack 3D".
```

---

## Developer (написание кода)

```
Ты Developer. Прочитай AGENT_ROLES.md секция "2️⃣ Developer".
План утвержден. Задача: [issue-id или описание]
```

**Пример:**
```
Ты Developer. Прочитай AGENT_ROLES.md секция "2️⃣ Developer".
План утвержден. Задача: реализуй slime-arena-pgf (лимиты рекламы).
```

---

## Project Manager (координация)

```
Ты PM. Прочитай AGENT_ROLES.md секция "0️⃣ Project Manager" и PM_ROLE.md.
Задача: [описание]
```

**Пример:**
```
Ты PM. Прочитай AGENT_ROLES.md секция "0️⃣ Project Manager" и PM_ROLE.md.
Задача: запустить ревью PR #60, собрать консенсус от Opus/Gemini.
```

---

## Reviewer (проверка кода)

```
Ты Reviewer. Прочитай AGENT_ROLES.md секция "3️⃣ Reviewer".
Задача: проверь PR #[номер] на соответствие требованиям.
```

**Пример:**
```
Ты Reviewer. Прочитай AGENT_ROLES.md секция "3️⃣ Reviewer".
Задача: проверь PR #60 на соответствие требованиям.
```

---

## Интерпретация вердиктов

| Вердикт | Действие оператора |
|---------|-------------------|
| `APPROVED` | Можно мержить PR |
| `CHANGES_REQUESTED` | Ждать исправлений Developer |
| `BLOCKED` | Критичная проблема, работа остановлена |
