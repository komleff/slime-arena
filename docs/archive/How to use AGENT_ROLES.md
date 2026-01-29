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
Ты Art Director. Прочитай AGENT_ROLES.md секция "5️⃣ Art Director".
Задача: [описание визуальной задачи]
```

**Пример:**
```
Ты Art Director. Прочитай AGENT_ROLES.md секция "5️⃣ Art Director".
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

## Session Manager (завершение сессии)

```
Ты Session Manager. Прочитай AGENT_ROLES.md секция "4️⃣ Session Manager".
Задача: выполни Landing the Plane protocol.
```

---

## Интерпретация вердиктов

| Вердикт | Действие оператора |
|---------|-------------------|
| `VERDICT: APPROVED` | Можно мержить PR |
| `VERDICT: REJECTED` | Ждать исправлений |
| `ESCALATION: ...` | Сменить модель или откатить |
