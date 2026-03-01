# PM Orchestration System

**Версия:** 1.0
**Дата:** 31 января 2026
**Статус:** Реализовано (Sprint 13)

---

## 1. Обзор

PM Orchestration System — автоматизированная система координации ИИ-агентов для code review и fix cycles. Позволяет PM (Project Manager) управлять процессом разработки с минимальным участием человека.

---

## 2. Роль Project Manager (PM)

### 2.1 Универсальность

PM не привязан к конкретной ветке или спринту. Работает с любыми задачами и ТЗ.

### 2.2 Обязанности

1. **Планирование:**
   - Создание worktree, веток, задач в Beads
   - Определение зависимостей между задачами
   - Учёт рисков и критических путей

2. **Делегирование:**
   - Запуск Developer агентов (Opus → Codex при неудаче)
   - Формирование промптов с контекстом задачи
   - Передача замечаний от ревьюверов

3. **Review coordination:**
   - Автоматический запуск 3 ревьюверов параллельно
   - Сбор и публикация отчётов в PR
   - Проверка консенсуса (3+ APPROVED)

4. **Синтез feedback:**
   - Объединение замечаний от разных ревьюверов
   - Удаление дубликатов
   - Приоритизация (P0 > P1 > P2)

5. **Эскалация:**
   - Передача оператору после 5 неудачных попыток
   - Документирование причин эскалации

### 2.3 Ограничения

- ❌ НЕ мержит PR самостоятельно (это делает оператор-человек)
- ❌ НЕ пишет код напрямую (делегирует Developer)
- ❌ НЕ ревьювит код самостоятельно (запускает ревьюверов)
- ✅ Только координация, планирование, отчётность

---

## 3. Эскалация разработчиков

| Попытка | Разработчик | Описание |
|---------|-------------|----------|
| 1-3 | Claude Opus 4.5 | Основной разработчик |
| 4-5 | ChatGPT o1 Codex | Резервный разработчик |
| 6+ | Человек-оператор | Ручное исправление |

### Подписи в комментариях

Обязательно указывать модель в fix-комментариях:

```markdown
## Fixed by Claude Opus 4.5 (Attempt 1/5)
- Исправлена проблема X
- Добавлена проверка Y
```

---

## 4. Ревьюверы

| Ревьювер | API | Приоритет |
|----------|-----|-----------|
| Claude Opus 4.5 | Anthropic | 1 |
| ChatGPT o1 Codex | OpenAI | 2 |
| Gemini 2.0 Flash | Google AI | 3 |
| GitHub Copilot | VS Code (вручную) | 4 (опционально) |

### Консенсус

- **Требуется:** 3+ APPROVED из 3 ревьюверов
- **Copilot опционален:** не блокирует консенсус
- **При разногласиях:** приоритет Codex > Opus > Gemini

---

## 5. Инструменты

### 5.1 PM Orchestrator

```bash
# Автоматический review cycle
python tools/pm_orchestrator.py --pr=<N> --cycle --max-iterations=5

# Только запуск ревьюверов (без цикла)
python tools/pm_orchestrator.py --pr=<N> --review-only
```

### 5.2 Beads CLI

```bash
# Доступные задачи
bd ready

# Создать задачу для fix
bd create --title="Fix: Review issues" --type=bug --priority=1

# Закрыть выполненную задачу
bd close <id>
```

### 5.3 GitHub CLI

```bash
# Создать PR
gh pr create --title="..." --base=main --head=<branch>

# Добавить комментарий
gh pr comment <N> --body="..."

# Статус PR
gh pr view <N>
```

### 5.4 Git Worktree

```bash
# Создать изолированную рабочую директорию
git worktree add d:/slime-arena-sprint-16 sprint-16/feature

# Удалить worktree
git worktree remove d:/slime-arena-sprint-16
```

---

## 6. Модули оркестратора

### 6.1 tools/review_state.py

```python
class ReviewState(Enum):
    INITIAL_REVIEW = "initial_review"
    FIXES_NEEDED = "fixes_needed"
    DEVELOPER_FIX_OPUS = "developer_fix_opus"     # 1-3
    DEVELOPER_FIX_CODEX = "developer_fix_codex"   # 4-5
    RE_REVIEW = "re_review"
    SUCCESS = "success"
    ESCALATE_TO_HUMAN = "escalate_to_human"
```

### 6.2 tools/consensus.py

```python
def calculate_consensus(reviews: Dict[str, ReviewData]) -> ConsensusData:
    """Требуется 3+ APPROVED из 3 ревьюверов"""
    approved = sum(1 for r in reviews.values() if r.status == "APPROVED")
    return ConsensusData(
        reviews=reviews,
        approved_count=approved,
        all_approved=(approved >= 3)
    )
```

### 6.3 tools/pr_parser.py

```python
def parse_pr_comments(pr_number: int) -> Dict[str, ReviewData]:
    """Парсить review-комментарии из PR через gh API"""
    # Извлекает метаданные из <!-- {...} --> в комментариях
    ...
```

---

## 7. Review Cycle Flow

```
┌──────────────────────────────────────────────────────────────┐
│                      PM ORCHESTRATOR                          │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 1. RUN REVIEWERS (parallel)                                   │
│    - Claude Opus 4.5                                          │
│    - ChatGPT o1 Codex                                         │
│    - Gemini 2.0 Flash                                         │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. POST REVIEWS TO PR                                         │
│    - Каждый отчёт как комментарий с метаданными               │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. CHECK CONSENSUS                                            │
│    - 3+ APPROVED? → SUCCESS                                   │
│    - Иначе → FIXES_NEEDED                                     │
└──────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
        ┌──────────┐              ┌──────────────────┐
        │ SUCCESS  │              │ FIXES_NEEDED     │
        │ Ready to │              │ Extract issues   │
        │ merge    │              │ Create Beads task│
        └──────────┘              └──────────────────┘
                                          │
                                          ▼
                              ┌──────────────────────┐
                              │ 4. REQUEST DEVELOPER │
                              │    - Opus (1-3)      │
                              │    - Codex (4-5)     │
                              │    - Human (6+)      │
                              └──────────────────────┘
                                          │
                                          ▼
                              ┌──────────────────────┐
                              │ 5. WAIT FOR FIX      │
                              │    - Timeout: 1 hour │
                              └──────────────────────┘
                                          │
                                          ▼
                              ┌──────────────────────┐
                              │ 6. RE-REVIEW         │
                              │    (iteration + 1)   │
                              │    → Goto step 1     │
                              └──────────────────────┘
```

---

## 8. Промпт-шаблоны

### 8.1 Для Developer

```markdown
## Контекст
- Спринт: [N]
- Фаза: [1/2/3]
- Beads ID: [beads-xxx]
- PR: #[N]

## Задача: [краткое название]
[Детальное описание из замечаний ревьюверов]

## Замечания (P0/P1)
[Список проблем с файлами и строками]

## Критерии приёмки
[Список из плана]

## Ограничения
- Детерминизм: использовать только Rng из server/src/utils/rng.ts
- Баланс: все числа в config/balance.json
- Код-стиль: следовать CLAUDE.md

## После исправления
1. Запустить верификацию: `npm run build && npm run test`
2. Закоммитить с сообщением: "fix: [описание]"
3. Добавить fix-комментарий в PR
4. Обновить статус задачи: `bd close <id>`
```

### 8.2 Для Reviewer

```markdown
## Code Review Request

**PR:** #[N]
**Iteration:** [M]
**Branch:** [branch-name]

## Контекст
[Описание изменений из PR description]

## Файлы для ревью
[Список изменённых файлов]

## Фокус ревью
1. Соответствие GDD v3.3
2. Детерминизм симуляции
3. Производительность (30 Hz)
4. Совместимость с мобильными устройствами

## Формат ответа
Используй шаблон из .beads/AGENT_ROLES.md секция "Review Report Template"
```

---

## 9. API ключи

Хранятся в переменных окружения:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_API_KEY="AIza..."
```

⚠️ **ВАЖНО:** Не коммитить ключи в репозиторий!

---

## 10. Зависимости

### Python пакеты

```
anthropic>=0.25.0
openai>=1.12.0
google-generativeai>=0.4.0
pytest>=7.4.0
```

### Установка

```bash
cd tools
pip install -r requirements.txt
```

---

## 11. Связанные документы

| Документ | Путь |
|----------|------|
| Роли агентов | `.beads/AGENT_ROLES.md` |
| Инструкции Copilot | `.github/copilot-instructions.md` |
| Memory Bank инструкция | `agents.md` |
| Архив PM планов (Sprint 13) | `docs/archive/sprint-13-pm/` |
