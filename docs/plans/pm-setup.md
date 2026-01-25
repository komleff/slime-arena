# План 1: Настройка PM роли и оркестрации

**Дата:** 2026-01-26
**Цель:** Документировать роль PM и создать автоматическую систему оркестрации
**Приоритет:** P0
**Статус:** В ожидании утверждения

---

## Фаза 1: Документирование роли PM

### Задача 1.1: Создать docs/PM-ROLE.md

**Что включить:**

1. **Универсальность роли:**
   - PM не привязан к конкретной ветке/спринту
   - Работает с любыми задачами и ТЗ
   - Может создавать worktree и ветки

2. **Обязанности:**
   - Планирование (создание задач в Beads, зависимости)
   - Делегирование Developer (Opus → Codex → Человек)
   - Review coordination (3-4 ревьювера параллельно)
   - Синтез feedback (объединение, приоритизация)
   - Эскалация к оператору

3. **Инструменты:**
   - `tools/pm-orchestrator.py` — автоматизация
   - `bd` — Beads CLI
   - `gh` — GitHub CLI
   - `git worktree` — изоляция работы

4. **Промпт-шаблоны:**
   - Для Developer (с указанием модели и попытки)
   - Для Reviewer (с метаданными)

5. **Типичные сценарии:**
   - Новый спринт с нуля
   - Исправление багов после ревью
   - Эскалация к оператору

**Критерий приёмки:**
- ✅ Документ полностью описывает роль PM
- ✅ Есть примеры команд и промптов
- ✅ Есть flow-диаграммы процессов

### Задача 1.2: Обновить .beads/AGENT_ROLES.md

**Изменения:**

1. **Добавить секцию PM** (в начало, после общих правил):

```markdown
## 0️⃣ Project Manager (PM)

**Универсальность:** Не привязан к ветке/спринту. Координирует все задачи.

**Обязанности:**
- Планирование и создание задач
- Делегирование Developer (Opus → Codex при неудаче)
- Автоматизация review через pm-orchestrator.py
- Синтез и приоритизация feedback
- Эскалация после 5 неудачных попыток

**Эскалация:**
- Попытки 1-3: Claude Opus 4.5
- Попытки 4-5: ChatGPT 5.2 Codex
- Попытка 6+: Человек-оператор

**Подписи:**
Обязательно указывать модель в комментариях:
- "Code Review by Claude Opus 4.5"
- "Fixed by ChatGPT 5.2 Codex (Attempt 4/5)"

**Полное описание:** См. `docs/PM-ROLE.md`
```

2. **Упростить остальные роли:**
   - Удалить избыточные детали
   - Оставить только ключевые обязанности
   - Сократить примеры команд

**Критерий приёмки:**
- ✅ Секция PM добавлена
- ✅ Размер файла сократился на ~20%
- ✅ Все роли остались функциональными

---

## Фаза 2: Создание PM Orchestrator

### Задача 2.1: Базовые модули

**Новые файлы:**

**1. tools/review_state.py:**
```python
from enum import Enum
from dataclasses import dataclass

class ReviewState(Enum):
    INITIAL_REVIEW = "initial_review"
    FIXES_NEEDED = "fixes_needed"
    DEVELOPER_FIX_OPUS = "developer_fix_opus"     # 1-3
    DEVELOPER_FIX_CODEX = "developer_fix_codex"   # 4-5
    RE_REVIEW = "re_review"
    SUCCESS = "success"
    ESCALATE_TO_HUMAN = "escalate_to_human"

@dataclass
class ReviewData:
    reviewer: str  # "opus", "codex", "gemini", "copilot"
    iteration: int
    status: str  # "APPROVED", "CHANGES_REQUESTED"
    body: str
    timestamp: str
```

**2. tools/consensus.py:**
```python
@dataclass
class ConsensusData:
    pr_number: int
    iteration: int
    reviews: Dict[str, ReviewData]
    approved_count: int
    all_approved: bool  # True if >= 3 APPROVED

def calculate_consensus(reviews: Dict[str, ReviewData]) -> ConsensusData:
    """Требуется 3+ APPROVED из 3 ревьюверов (Opus, Codex, Gemini)"""
    approved = sum(1 for r in reviews.values() if r.status == "APPROVED")
    return ConsensusData(
        reviews=reviews,
        approved_count=approved,
        all_approved=(approved >= 3)
    )
```

**3. tools/pr_parser.py:**
```python
def parse_pr_comments(pr_number: int) -> Dict[str, ReviewData]:
    """Парсить review-комментарии из PR через gh API"""
    result = subprocess.run([
        "gh", "api",
        f"/repos/komleff/slime-arena/issues/{pr_number}/comments"
    ], capture_output=True, text=True, check=True)

    reviews = {}
    for comment in json.loads(result.stdout):
        # Извлечь JSON из <!-- {...} -->
        match = re.search(r'<!--\s*({.*?})\s*-->', comment["body"])
        if match:
            metadata = json.loads(match.group(1))
            if metadata.get("type") == "review":
                reviews[metadata["reviewer"]] = ReviewData(**metadata)
    return reviews
```

**4. tools/developer_requester.py:**
```python
async def request_developer_fix(
    pr_number: int,
    issues: List[Issue],
    developer_model: str,  # "opus" or "codex"
    attempt: int
) -> str:
    """Создать задачу в Beads для Developer"""

    model_names = {
        "opus": "Claude Opus 4.5",
        "codex": "ChatGPT 5.2 Codex"
    }

    description = f"### Code Review Issues (PR #{pr_number})\n\n"
    description += f"**Разработчик:** {model_names[developer_model]}\n"
    description += f"**Попытка:** {attempt}/5\n\n"

    for issue in issues:
        description += f"**[{issue.priority}]** {issue.file}:{issue.line}\n"
        description += f"- Проблема: {issue.problem}\n"
        description += f"- Решение: {issue.solution}\n\n"

    description += f"\n**ВАЖНО:** Подпиши fix-комментарий в PR как:\n"
    description += f"```\nFixed by {model_names[developer_model]} (Attempt {attempt}/5)\n```\n"

    result = subprocess.run([
        "bd", "create",
        "--title", f"Fix: Review issues ({developer_model}, attempt {attempt})",
        "--type", "bug",
        "--priority", "0" if attempt > 3 else "1",
        "--description", description
    ], capture_output=True, text=True, cwd="d:/GitHub/slime-arena")

    task_id = re.search(r'(slime-arena-\w+)', result.stdout).group(1)
    return task_id
```

**5. tools/requirements.txt:**
```
anthropic>=0.25.0
openai>=1.12.0
google-generativeai>=0.4.0
pytest>=7.4.0
```

**Критерий приёмки:**
- ✅ Все 5 файлов созданы
- ✅ Код соответствует примерам выше
- ✅ `pip install -r tools/requirements.txt` работает

### Задача 2.2: Рефакторинг pm-orchestrator.py

**Изменения в существующем файле:**

1. **State machine с эскалацией:**
```python
async def run_review_cycle(self) -> CycleResult:
    MAX_ITERATIONS = 5
    iteration = 0

    while iteration < MAX_ITERATIONS:
        # Определить разработчика
        if iteration < 3:
            developer_model = "opus"
        elif iteration < 5:
            developer_model = "codex"
        else:
            return CycleResult.ESCALATE_TO_HUMAN

        # 1. Run reviewers
        reviews = await self.run_all_reviewers()

        # 2. Post to PR
        await self.post_reviews_to_pr(reviews)

        # 3. Check consensus
        consensus = calculate_consensus(reviews)
        if consensus.all_approved:
            return CycleResult.SUCCESS

        # 4. Extract issues
        issues = extract_blocking_issues(reviews)

        # 5. Create Beads task
        task_id = await request_developer_fix(
            self.pr_number,
            issues,
            developer_model,
            iteration + 1
        )

        # 6. Wait for fix
        if not await self.wait_for_developer_fix():
            return CycleResult.TIMEOUT

        iteration += 1

    return CycleResult.ESCALATE_TO_HUMAN
```

2. **Публикация в PR:**
```python
async def post_reviews_to_pr(self, reviews: Dict[str, str]):
    for reviewer, report in reviews.items():
        metadata = {
            "reviewer": reviewer,
            "iteration": self.iteration,
            "type": "review",
            "timestamp": datetime.now().isoformat()
        }

        body = f"<!-- {json.dumps(metadata)} -->\n{report}"

        subprocess.run([
            "gh", "pr", "comment", str(self.pr_number),
            "--repo", "komleff/slime-arena",
            "--body", body
        ], check=True)
```

3. **Ожидание Copilot:**
```python
async def wait_for_copilot_review(self, timeout: int = 600) -> bool:
    """Ждать Copilot до 10 минут"""
    start = time.time()
    while time.time() - start < timeout:
        comments = parse_pr_comments(self.pr_number)
        if "copilot" in comments or "github-copilot" in comments:
            return True
        await asyncio.sleep(30)
    return False
```

**Критерий приёмки:**
- ✅ Оркестратор работает в циклическом режиме
- ✅ Эскалация Opus → Codex → Человек
- ✅ Публикация отчётов как PR комментарии
- ✅ Создание задач в Beads с правильными метаданными

### Задача 2.3: Unit-тесты

**Файл:** `tools/test_orchestrator.py`

**Сценарии:**

1. **test_consensus_success:**
   - Mock 3 APPROVED комментария
   - Ожидаемый результат: SUCCESS

2. **test_fix_cycle_one_iteration:**
   - Mock CHANGES_REQUESTED
   - Mock Developer fix
   - Mock повторное ревью → APPROVED
   - Ожидаемый результат: SUCCESS после 1 итерации

3. **test_escalation_max_iterations:**
   - Mock 5 неудачных попыток
   - Ожидаемый результат: ESCALATE_TO_HUMAN

4. **test_developer_escalation:**
   - Попытки 1-3 → Opus
   - Попытки 4-5 → Codex
   - Попытка 6 → ESCALATE

```bash
cd tools
pytest test_orchestrator.py -v
```

**Критерий приёмки:**
- ✅ Все тесты проходят
- ✅ Покрытие кода >= 80%
- ✅ Нет реальных API вызовов (все моки)

---

## Фаза 3: Верификация

### E2E тест (mock PR)

1. **Создать тестовый PR:**
```bash
git checkout -b test-pm-orchestration
echo "// intentional bug" >> server/src/test.ts
git add server/src/test.ts
git commit -m "test: intentional bug for PM test"
git push origin test-pm-orchestration
gh pr create --title="Test PM Orchestration" --base=main --head=test-pm-orchestration --body="Testing PM orchestrator"
```

2. **Запустить оркестратор:**
```bash
# <N> - номер PR, созданного на предыдущем шаге
python tools/pm-orchestrator.py --pr=<N> --cycle --max-iterations=5
```

**Оркестратор запускает 3 ревьювера параллельно:**
- Claude Opus 4.5 (Anthropic API)
- ChatGPT 5.2 Codex (OpenAI API)
- Gemini 3 Pro (Google AI API)

3. **Проверить:**
   - ✅ Ревьюверы нашли проблему
   - ✅ Задача создана в Beads
   - ✅ Developer исправил (mock)
   - ✅ Повторное ревью прошло
   - ✅ Консенсус достигнут

4. **Очистить:**
```bash
gh pr close <N>
git branch -D test-pm-orchestration
git push origin --delete test-pm-orchestration
```

**Критерий приёмки:**
- ✅ E2E тест проходит успешно
- ✅ Все этапы работают автоматически

---

## Критические файлы

**Новые:**
1. `docs/PM-ROLE.md`
2. `tools/review_state.py`
3. `tools/consensus.py`
4. `tools/pr_parser.py`
5. `tools/developer_requester.py`
6. `tools/test_orchestrator.py`
7. `tools/requirements.txt`

**Изменённые:**
1. `.beads/AGENT_ROLES.md` — добавить PM
2. `tools/pm-orchestrator.py` — рефакторинг

---

## Зависимости

**API ключи (уже настроены):**
- ✅ ANTHROPIC_API_KEY
- ✅ OPENAI_API_KEY
- ✅ GOOGLE_API_KEY

**Инструменты:**
- ✅ Python 3.14
- ✅ GitHub CLI (gh)
- ✅ Beads CLI (bd)

---

## Итого

**Фазы:** 3
**Задачи:** 6
**Приоритет:** P0
**Время:** 1 день

**Результат:**
- PM роль полностью документирована
- Оркестратор автоматизирует review-fix-review
- Система готова к применению на PR #105
