# План настройки PM Orchestration System

**Дата:** 2026-01-26
**Цель:** Настроить автоматическую систему оркестрации ИИ-агентов через PM
**Приоритет:** P0 (блокирует дальнейшую работу)

---

## Фаза 1: Документирование роли PM (P0)

### Задача 1.1: Создать универсальное описание PM роли

**Файл:** `docs/PM-ROLE.md`

**Что включить:**
- Универсальность (не привязана к конкретной ветке/спринту)
- Обязанности (планирование, делегирование, review coordination)
- Эскалация разработчиков (Opus → Codex → Человек)
- Инструменты (pm-orchestrator.py, Beads, gh CLI, worktree)
- Промпт-шаблоны для Developer и Reviewer
- Типичные сценарии работы

**Критерий приёмки:**
- Документ описывает ВСЕ обязанности PM
- Есть примеры команд и промптов
- Ссылки на все инструменты

### Задача 1.2: Обновить AGENT_ROLES.md

**Файл:** `.beads/AGENT_ROLES.md`

**Изменения:**
1. Добавить секцию "Project Manager (PM)" в начало (после общих правил)
2. Упростить остальные роли - удалить избыточные детали
3. Добавить ссылку на `docs/PM-ROLE.md` для полного описания

**Структура секции PM в AGENT_ROLES.md:**

```markdown
## 0️⃣ Project Manager (PM)

**Роль:** Координация всех ИИ-агентов, автоматизация review-fix-review цикла.

**Универсальность:** PM не привязан к конкретной ветке или спринту. Работает с любыми задачами и ТЗ.

### Основные обязанности

1. **Планирование:** Создание worktree, веток, задач в Beads
2. **Делегирование:** Запуск Developer агентов (Opus → Codex при неудаче)
3. **Review coordination:** Автоматический запуск 3-4 ревьюверов параллельно
4. **Синтез feedback:** Объединение замечаний, удаление дубликатов
5. **Эскалация:** Передача оператору после 5 неудачных попыток

### Инструменты

```bash
# Автоматический review cycle
python tools/pm-orchestrator.py --pr=<N> --cycle --max-iterations=5

# Beads workflow
bd ready                    # Доступные задачи
bd create --title="..." --type=bug --priority=1
bd close <id>

# Git worktree для изоляции
git worktree add d:/slime-arena-meta sprint-13/meta-gameplay
```

### Эскалация разработчиков

- **Попытки 1-3:** Claude Opus 4.5 (основной)
- **Попытки 4-5:** ChatGPT o1 Codex (резервный)
- **Попытка 6+:** Человек-оператор

### Подписи в комментариях

**Обязательно** указывать модель в отчётах и fix-комментариях:

```
## Code Review by Claude Opus 4.5
...

## Fix by ChatGPT o1 Codex (Attempt 4/5)
...
```

**Полное описание:** См. `docs/PM-ROLE.md`

---
```

**Критерий приёмки:**
- Секция PM добавлена в AGENT_ROLES.md
- Остальные роли упрощены (убраны избыточные детали)
- Размер AGENT_ROLES.md сократился на ~20%

---

## Фаза 2: Создание PM Orchestrator (P0)

### Задача 2.1: Базовая структура

**Новые файлы:**

1. `tools/review_state.py` — enum состояний
2. `tools/consensus.py` — проверка консенсуса
3. `tools/pr_parser.py` — парсинг PR комментариев
4. `tools/developer_requester.py` — создание задач в Beads
5. `tools/requirements.txt` — зависимости Python

**Что реализовать:**

```python
# tools/review_state.py
from enum import Enum

class ReviewState(Enum):
    INITIAL_REVIEW = "initial_review"
    FIXES_NEEDED = "fixes_needed"
    DEVELOPER_FIX_OPUS = "developer_fix_opus"     # 1-3
    DEVELOPER_FIX_CODEX = "developer_fix_codex"   # 4-5
    RE_REVIEW = "re_review"
    SUCCESS = "success"
    ESCALATE_TO_HUMAN = "escalate_to_human"

# tools/consensus.py
@dataclass
class ConsensusData:
    pr_number: int
    iteration: int
    reviews: Dict[str, ReviewData]
    approved_count: int
    all_approved: bool  # True if >= 3 APPROVED

def calculate_consensus(reviews: Dict[str, ReviewData]) -> ConsensusData:
    """3+ APPROVED из 3 ревьюверов (Opus, Codex, Gemini)"""
    ...
```

**Критерий приёмки:**
- Все 5 файлов созданы
- Unit-тесты для каждого модуля
- `pytest` проходит успешно

### Задача 2.2: Рефакторинг pm-orchestrator.py

**Файл:** `tools/pm-orchestrator.py`

**Изменения:**

1. **Добавить state machine:**
   - MAX_ITERATIONS = 5
   - developer_model = "opus" (1-3) → "codex" (4-5)
   - Эскалация после 5 попыток

2. **Публикация в PR как комментарии:**
   ```python
   async def post_reviews_to_pr(self, reviews: Dict[str, str]):
       for reviewer, report in reviews.items():
           metadata = {
               "reviewer": reviewer,
               "iteration": self.iteration,
               "type": "review"
           }
           body = f"<!-- {json.dumps(metadata)} -->\n{report}"
           subprocess.run(["gh", "pr", "comment", str(self.pr_number), "--body", body])
   ```

3. **Ожидание Copilot:**
   ```python
   async def wait_for_copilot_review(self, timeout=600):
       # Проверять каждые 30 сек, ждать до 10 минут
       ...
   ```

4. **Создание Beads задач:**
   ```python
   async def request_developer_fix(
       self,
       issues: List[Issue],
       developer_model: str,
       attempt: int
   ):
       description = f"**Разработчик:** {developer_model}\n"
       description += f"**Попытка:** {attempt}/5\n\n"
       description += "ВАЖНО: Подпиши fix-комментарий как:\n"
       description += f"Fixed by {developer_model} (Attempt {attempt}/5)\n"
       ...
   ```

**Критерий приёмки:**
- Оркестратор работает в циклическом режиме
- Эскалация разработчиков (Opus → Codex → Человек)
- Публикация отчётов в PR
- Создание задач в Beads

### Задача 2.3: Интеграционные тесты

**Файл:** `tools/test_orchestrator.py`

**Сценарии:**

1. **Тест консенсуса (успех):**
   - Mock PR с 3 APPROVED комментариями
   - Ожидаемый результат: SUCCESS

2. **Тест fix cycle (1 итерация):**
   - Mock PR с 1 CHANGES_REQUESTED
   - Mock Developer fix
   - Mock повторное ревью → APPROVED
   - Ожидаемый результат: SUCCESS после 1 итерации

3. **Тест эскалации (макс итерации):**
   - Mock 5 неудачных попыток
   - Ожидаемый результат: ESCALATE_TO_HUMAN

**Критерий приёмки:**
- Все 3 сценария проходят
- Нет реальных вызовов API (моки)

---

## Фаза 3: Применение к PR #105 (P1)

### Задача 3.1: Исправить найденные баги

**Контекст:**
- PR #105: Sprint 13 Phase 1
- Найдено: 2 P1 проблемы (Opus review)
- Задачи созданы: slime-arena-qf9, slime-arena-iu4

**Действия PM:**

1. **Запустить Developer (Opus, попытка 1):**
   ```bash
   bd update slime-arena-qf9 --status=in_progress --assignee=opus
   bd update slime-arena-iu4 --status=in_progress --assignee=opus
   ```

2. **Делегировать исправления:**
   - Промпт из docs/PM-ROLE.md (секция "Для Developer")
   - Передать все замечания P1 из phase1-opus-4.5.md

3. **Ждать фикса:**
   - Developer коммитит изменения
   - Developer добавляет fix-комментарий в PR #105
   - Developer закрывает задачи в Beads

4. **Запустить повторное ревью (iteration 1):**
   ```bash
   python tools/pm-orchestrator.py --pr=105 --cycle --max-iterations=5
   ```

5. **Проверить консенсус:**
   - Если 3+ APPROVED → готово к мержу
   - Если ещё есть проблемы → попытка 2 (Opus)

**Критерий приёмки:**
- Все P1 проблемы исправлены
- Консенсус достигнут (3+ APPROVED)
- PR #105 готов к мержу

### Задача 3.2: Документировать процесс

**Файл:** `docs/sprint-13/phase1-fix-cycle.md`

**Что включить:**
- История итераций (attempt 1, 2, ...)
- Кто исправлял (Opus/Codex)
- Какие проблемы были найдены
- Как достигнут консенсус

**Критерий приёмки:**
- Документ описывает весь цикл исправлений
- Есть ссылки на PR комментарии
- Метрики: сколько попыток, какие модели

---

## Фаза 4: Продолжение Sprint 13 (P2)

### Задача 4.1: Мерж PR #105

**После консенсуса:**
1. PM помечает PR как "Ready to merge"
2. PM передаёт PR оператору для ручного мержа
3. Оператор мержит в main

### Задача 4.2: Фаза 2 Sprint 13

**Возврат к исходному плану:**
- См. `docs/plans/snug-tickling-wilkes.md`
- Фаза 2: API и серверная логика (9 задач)
- Применить тот же процесс оркестрации

---

## Критические файлы

**Новые файлы:**
1. `docs/PM-ROLE.md` — полное описание роли PM
2. `tools/review_state.py` — state machine
3. `tools/consensus.py` — проверка консенсуса
4. `tools/pr_parser.py` — парсинг PR
5. `tools/developer_requester.py` — создание задач Beads
6. `tools/test_orchestrator.py` — интеграционные тесты
7. `docs/sprint-13/phase1-fix-cycle.md` — документация процесса

**Изменённые файлы:**
1. `.beads/AGENT_ROLES.md` — добавить PM, упростить остальные
2. `tools/pm-orchestrator.py` — рефакторинг под циклы
3. `tools/requirements.txt` — зависимости

---

## Верификация

### End-to-end тест

1. **Создать тестовый PR:**
   ```bash
   git checkout -b test-pm-orchestration
   echo "// test bug" >> server/src/test.ts
   git commit -am "test: intentional bug for PM test"
   git push origin test-pm-orchestration
   gh pr create --title="Test PM Orchestration" --base=main --head=test-pm-orchestration
   ```

2. **Запустить оркестратор:**
   ```bash
   python tools/pm-orchestrator.py --pr=<N> --cycle --max-iterations=5
   ```

3. **Проверить результат:**
   - Ревьюверы нашли проблему
   - Задача создана в Beads
   - Developer исправил
   - Повторное ревью прошло (APPROVED)
   - Консенсус достигнут

4. **Очистить:**
   ```bash
   gh pr close <N>
   git branch -D test-pm-orchestration
   git push origin --delete test-pm-orchestration
   ```

### Unit-тесты

```bash
cd tools
pytest test_review_state.py
pytest test_consensus.py
pytest test_pr_parser.py
pytest test_orchestrator.py
```

---

## Зависимости

**Python пакеты:**
```
anthropic>=0.25.0
openai>=1.12.0
google-generativeai>=0.4.0
pytest>=7.4.0
```

**GitHub CLI:**
```bash
gh --version  # Должно быть >= 2.40.0
```

**API ключи:**
- ANTHROPIC_API_KEY ✅ (уже настроен)
- OPENAI_API_KEY ✅ (уже настроен)
- GOOGLE_API_KEY ✅ (уже настроен)

---

## Риски и митигация

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| API timeout | Средняя | Retry логика, увеличенный timeout |
| Copilot не отвечает | Высокая | Опциональный, не блокирует консенсус |
| Конфликт ревьюверов | Низкая | Приоритизация (Codex > Opus > Gemini) |
| Developer не справился за 5 попыток | Средняя | Эскалация к оператору |

---

## Итого

**Фазы:** 4
**Задачи:** 9 (P0: 5, P1: 2, P2: 2)
**Время:** 1-2 дня
**Приоритет:** P0 (блокирует Sprint 13)

**После выполнения этого плана:**
- PM роль полностью документирована
- Оркестратор автоматизирует review-fix-review
- PR #105 исправлен и готов к мержу
- Процесс применим ко всем будущим задачам
