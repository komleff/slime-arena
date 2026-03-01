# Автоматизация AI-агентов через Beads

**Версия:** 1.0  
**Дата:** 16 января 2026  
**Статус:** RFC (Request for Comments)

---

## 1. Цель

Устранить роль «человека-копипасты» в цикле разработки:

```
БЫЛО:                                 СТАНЕТ:
┌──────────┐                          ┌──────────┐
│ Architect│                          │ Architect│
└────┬─────┘                          └────┬─────┘
     │                                     │
     ▼                                     ▼
┌──────────┐     ┌──────────┐         ┌──────────┐
│  Coder   │◄────│ ЧЕЛОВЕК  │         │  Coder   │◄──┐
└────┬─────┘     │(копипаста)│         └────┬─────┘   │
     │           └─────┬────┘              │         │
     ▼                 │                   ▼         │
┌──────────┐           │              ┌──────────┐   │
│ Reviewers│───────────┘              │ Reviewers│───┘
└──────────┘                          └────┬─────┘
                                           │
                                      ┌────▼─────┐
                                      │ PM Agent │
                                      │(автомат) │
                                      └──────────┘
```

**Целевое время цикла:** 30 минут (как с человеком), но без участия человека.

---

## 2. Архитектура

### 2.1. Компоненты

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BEADS ORCHESTRATOR                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      Task Queue (bd)                          │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐             │  │
│  │  │ Task 1  │ │ Task 2  │ │ Task 3  │ │ Task 4  │ ...         │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘             │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Agent Dispatcher                           │  │
│  │                                                               │  │
│  │   assign_task() ──► pick_agent() ──► invoke_agent()          │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│         ┌────────────────────┼────────────────────┐                │
│         ▼                    ▼                    ▼                │
│  ┌─────────────┐     ┌─────────────┐      ┌─────────────┐         │
│  │ Coder Pool  │     │Reviewer Pool│      │  PM Agent   │         │
│  │             │     │             │      │             │         │
│  │ • Opus      │     │ • Opus      │      │ • Aggregate │         │
│  │ • Codex     │     │ • Gemini    │      │ • Dedupe    │         │
│  │ • Gemini    │     │ • Codex     │      │ • Decide    │         │
│  │             │     │ • Copilot   │      │             │         │
│  └─────────────┘     └─────────────┘      └─────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         GITHUB                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Branches  │  │Pull Requests│  │  Comments   │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2. Агенты

| Роль | Агент | Модель | Назначение |
|------|-------|--------|------------|
| **Coder** | coder-opus | Claude Opus | Сложные архитектурные задачи |
| **Coder** | coder-codex | OpenAI Codex/o1 | Быстрые фиксы, рефакторинг |
| **Coder** | coder-gemini | Gemini Pro | Резервный, документация |
| **Reviewer** | reviewer-opus | Claude Opus | Глубокий анализ архитектуры |
| **Reviewer** | reviewer-gemini | Gemini Pro | Проверка читаемости, стиля |
| **Reviewer** | reviewer-codex | OpenAI Codex | Поиск багов, edge cases |
| **Reviewer** | reviewer-copilot | GitHub Copilot | Встроенный ревью GitHub |
| **PM** | pm-agent | Claude Sonnet | Агрегация, решения о merge |

---

## 3. Процесс (автоматический)

### 3.1. Жизненный цикл задачи

```
┌──────────────────────────────────────────────────────────────────────┐
│                         TASK LIFECYCLE                               │
│                                                                      │
│  ┌─────────┐    ┌───────────┐    ┌─────────┐    ┌──────────┐       │
│  │ CREATED │───►│IN_PROGRESS│───►│ REVIEW  │───►│ APPROVED │       │
│  └─────────┘    └───────────┘    └────┬────┘    └────┬─────┘       │
│       │              │                │              │              │
│       │              │                ▼              ▼              │
│       │              │         ┌───────────┐   ┌──────────┐        │
│       │              │         │ CHANGES   │   │  MERGED  │        │
│       │              │         │ REQUESTED │   └──────────┘        │
│       │              │         └─────┬─────┘                       │
│       │              │               │                              │
│       │              └───────────────┘                              │
│       │                    (loop)                                   │
│       ▼                                                             │
│  ┌─────────┐                                                        │
│  │ BLOCKED │ ← требуется человек                                   │
│  └─────────┘                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2. Детальный workflow

```
Шаг │ Актор          │ Действие                              │ Триггер
────┼────────────────┼───────────────────────────────────────┼─────────────
 1  │ Architect      │ Создаёт задачу в Beads                │ Ручной
 2  │ Orchestrator   │ Назначает задачу Coder-агенту         │ bd ready
 3  │ Coder          │ Обновляет статус: in_progress         │ bd update
 4  │ Coder          │ Создаёт ветку, пишет код              │ git checkout -b
 5  │ Coder          │ git push, создаёт PR                  │ gh pr create
 6  │ Orchestrator   │ Ловит webhook: PR created             │ GitHub webhook
 7  │ Orchestrator   │ Запускает 4 Reviewer-агента           │ Параллельно
 8  │ Reviewer ×4    │ Анализируют код, пишут отчёты         │ Параллельно
 9  │ Orchestrator   │ Барьер: ждёт 4 отчёта                 │ Счётчик
10  │ PM Agent       │ Агрегирует отчёты, дедуплицирует      │ 4/4 ready
11  │ PM Agent       │ Формирует единый отчёт                │ —
12  │ PM Agent       │ Решение: APPROVED / CHANGES_REQUESTED │ Правила
    │                │                                       │
    │ ═══════════════╪═══════ ЕСЛИ CHANGES_REQUESTED ════════╪═══════════
13  │ Orchestrator   │ Отправляет отчёт Coder-агенту         │ GitHub comment
14  │ Coder          │ Читает отчёт, вносит исправления      │ —
15  │ Coder          │ git push (тот же PR)                  │ —
16  │ Orchestrator   │ Ловит webhook: PR synchronized        │ GitHub webhook
17  │ —              │ GOTO Шаг 7                            │ —
    │                │                                       │
    │ ═══════════════╪═══════ ЕСЛИ APPROVED ═════════════════╪═══════════
18  │ PM Agent       │ Проверяет: все P1/P2 исправлены?      │ —
19  │ PM Agent       │ Записывает P3/P4 в TECH_DEBT.md       │ —
20  │ PM Agent       │ Выполняет merge                       │ gh pr merge
21  │ Orchestrator   │ Закрывает задачу в Beads              │ bd close
22  │ Orchestrator   │ Уведомляет человека (опционально)     │ Slack/Telegram
```

---

## 4. Протокол коммуникации

### 4.1. Формат сообщений агентов

Все агенты общаются через **комментарии в PR** в стандартизированном формате:

```markdown
<!-- AGENT_MESSAGE -->
<!-- From: reviewer-opus -->
<!-- To: coder -->
<!-- Type: REVIEW_RESULT -->
<!-- Verdict: CHANGES_REQUESTED -->

## 🔍 Code Review — reviewer-opus

### Verdict: `CHANGES_REQUESTED`

### Issues

| ID | P | File | Line | Description |
|----|---|------|------|-------------|
| R1 | P1 | main.ts | 2780 | Стагнация worldX/worldY |
| R2 | P2 | balance.json | 40 | inputTimeoutMs слишком велико |

### Checklist
- [x] Сборка проходит
- [x] Детерминизм сохранён
- [ ] Все P1 исправлены

<!-- /AGENT_MESSAGE -->
```

### 4.2. Парсинг сообщений

Orchestrator парсит комментарии по HTML-тегам:

```javascript
function parseAgentMessage(comment) {
    const match = comment.match(/<!-- AGENT_MESSAGE -->(.*)<!-- \/AGENT_MESSAGE -->/s);
    if (!match) return null;
    
    const from = comment.match(/<!-- From: (\S+) -->/)?.[1];
    const to = comment.match(/<!-- To: (\S+) -->/)?.[1];
    const type = comment.match(/<!-- Type: (\S+) -->/)?.[1];
    const verdict = comment.match(/<!-- Verdict: (\S+) -->/)?.[1];
    
    return { from, to, type, verdict, body: match[1] };
}
```

### 4.3. Команды в комментариях

PM Agent может отдавать команды через специальный синтаксис:

| Команда | Действие |
|---------|----------|
| `/approve` | Одобрить PR |
| `/request-changes` | Запросить исправления |
| `/merge` | Выполнить merge |
| `/assign @coder-opus` | Назначить агента |
| `/retry-review` | Перезапустить ревью |
| `/escalate` | Передать человеку |

---

## 5. Необходимые компоненты

### 5.1. Beads Extensions

| Компонент | Описание | Статус |
|-----------|----------|--------|
| `bd serve` | Daemon для webhook'ов | ✅ Есть в Beads |
| `bd agent` | CLI для управления агентами | ❌ Нужно создать |
| `bd dispatch` | Автоматическое назначение задач | ❌ Нужно создать |

### 5.2. Новые файлы в репозитории

```
slime-arena/
├── .beads/
│   ├── AGENT_ROLES.md          # ✅ Уже есть
│   ├── agents.yaml             # ❌ Конфигурация агентов
│   └── workflows/
│       ├── code-review.yaml    # ❌ Workflow ревью
│       └── task-lifecycle.yaml # ❌ Workflow задач
├── scripts/
│   ├── orchestrator.ts         # ❌ Главный диспетчер
│   ├── agent-runner.ts         # ❌ Запуск агентов
│   ├── pm-agent.ts             # ❌ PM логика
│   └── review-aggregator.ts    # ❌ Агрегация ревью
└── .github/
    └── workflows/
        └── beads-webhook.yml   # ❌ Приём webhook'ов
```

### 5.3. Внешние зависимости

| Сервис | Назначение | Требуется |
|--------|------------|-----------|
| **Anthropic API** | Claude Opus/Sonnet | API ключ |
| **OpenAI API** | Codex/GPT-4 | API ключ |
| **Google AI API** | Gemini Pro | API ключ |
| **GitHub API** | PR, комментарии, webhooks | Token |
| **Beads** | Управление задачами | ✅ Установлен |

### 5.4. Инфраструктура

| Вариант | Описание | Стоимость |
|---------|----------|-----------|
| **Локальный Mac** | bd serve на твоей машине | $0 |
| **GitHub Codespaces** | Облачная dev-среда | ~$20/мес |
| **VPS (Hetzner)** | Выделенный сервер | ~$5/мес |
| **Railway/Render** | Serverless | Pay-per-use |

**Рекомендация:** Начать с локального Mac, позже мигрировать на VPS.

---

## 6. Конфигурация агентов

### 6.1. Файл `.beads/agents.yaml`

```yaml
# Конфигурация AI-агентов для Slime Arena
version: 1

defaults:
  timeout_minutes: 15
  max_retries: 2
  context_files:
    - .agents/AGENT_ROLES.md
    - .github/copilot-instructions.md
    - .memory_bank/activeContext.md

agents:
  # ═══════════════════════════════════════════════════════════════
  # CODERS
  # ═══════════════════════════════════════════════════════════════
  coder-opus:
    model: claude-3-opus-20240229
    provider: anthropic
    role: Developer
    capabilities:
      - write_code
      - create_branch
      - commit
      - push
      - create_pr
    system_prompt: |
      Ты Developer. Прочитай AGENT_ROLES.md секция "2️⃣ Developer".
      Работай автономно. Не жди подтверждений.
    priority: 1  # Для сложных задач

  coder-codex:
    model: gpt-4-turbo
    provider: openai
    role: Developer
    capabilities:
      - write_code
      - create_branch
      - commit
      - push
      - create_pr
    system_prompt: |
      You are a Developer agent. Follow AGENT_ROLES.md section "2️⃣ Developer".
      Work autonomously. Do not wait for confirmations.
    priority: 2  # Для быстрых фиксов

  coder-gemini:
    model: gemini-1.5-pro
    provider: google
    role: Developer
    capabilities:
      - write_code
      - create_branch
      - commit
      - push
      - create_pr
    priority: 3  # Резервный

  # ═══════════════════════════════════════════════════════════════
  # REVIEWERS
  # ═══════════════════════════════════════════════════════════════
  reviewer-opus:
    model: claude-3-opus-20240229
    provider: anthropic
    role: Reviewer
    capabilities:
      - read_code
      - comment_pr
    system_prompt: |
      Ты Reviewer. Прочитай AGENT_ROLES.md секция "3️⃣ Reviewer".
      Выдай вердикт: APPROVED / CHANGES_REQUESTED / BLOCKED.
    output_format: agent_message

  reviewer-gemini:
    model: gemini-1.5-pro
    provider: google
    role: Reviewer
    capabilities:
      - read_code
      - comment_pr
    output_format: agent_message

  reviewer-codex:
    model: gpt-4-turbo
    provider: openai
    role: Reviewer
    capabilities:
      - read_code
      - comment_pr
    output_format: agent_message

  reviewer-copilot:
    provider: github
    role: Reviewer
    capabilities:
      - github_copilot_review
    # Специальный агент — использует GitHub Copilot API

  # ═══════════════════════════════════════════════════════════════
  # PM AGENT
  # ═══════════════════════════════════════════════════════════════
  pm-agent:
    model: claude-3-5-sonnet-20241022
    provider: anthropic
    role: PM
    capabilities:
      - read_comments
      - aggregate_reviews
      - make_decisions
      - merge_pr
      - close_task
    rules:
      min_approvals: 2
      required_reviewers: [reviewer-opus, reviewer-codex]
      optional_reviewers: [reviewer-gemini, reviewer-copilot]
      auto_merge_on: all_p1_fixed
      tech_debt_threshold: P3

pools:
  coders:
    agents: [coder-opus, coder-codex]
    selection: round_robin  # или: priority, random, least_busy
  
  reviewers:
    agents: [reviewer-opus, reviewer-gemini, reviewer-codex, reviewer-copilot]
    selection: all  # Запускать всех параллельно
    barrier: true   # Ждать всех перед агрегацией
```

---

## 7. Workflow ревью

### 7.1. Файл `.beads/workflows/code-review.yaml`

```yaml
name: code-review
version: 1

triggers:
  - event: pull_request.opened
  - event: pull_request.synchronize

steps:
  - name: start_reviews
    action: dispatch_agents
    pool: reviewers
    parallel: true
    input:
      pr_number: ${{ event.pull_request.number }}
      diff_url: ${{ event.pull_request.diff_url }}

  - name: wait_for_reviews
    action: barrier
    timeout_minutes: 30
    expect:
      count: 4
      message_type: REVIEW_RESULT

  - name: aggregate
    action: invoke_agent
    agent: pm-agent
    input:
      task: aggregate_reviews
      reviews: ${{ steps.wait_for_reviews.messages }}

  - name: decide
    action: invoke_agent
    agent: pm-agent
    input:
      task: make_decision
      aggregated_report: ${{ steps.aggregate.output }}

  - name: route
    action: conditional
    conditions:
      - if: ${{ steps.decide.verdict == 'APPROVED' }}
        goto: merge
      - if: ${{ steps.decide.verdict == 'CHANGES_REQUESTED' }}
        goto: notify_coder
      - if: ${{ steps.decide.verdict == 'BLOCKED' }}
        goto: escalate

  - name: notify_coder
    action: comment_pr
    content: ${{ steps.aggregate.output.consolidated_report }}
    # Workflow завершается, ждём push → re-trigger

  - name: merge
    action: merge_pr
    method: squash
    delete_branch: true

  - name: escalate
    action: notify_human
    channel: telegram
    message: "PR #${{ event.pull_request.number }} требует внимания!"
```

---

## 8. PM Agent — логика принятия решений

### 8.1. Правила агрегации

```typescript
interface ReviewIssue {
    id: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
    file: string;
    line: number;
    description: string;
    foundBy: string[];
}

interface AggregatedReport {
    issues: ReviewIssue[];
    verdicts: Map<string, string>;
    consensus: number;
}

function aggregateReviews(reviews: AgentMessage[]): AggregatedReport {
    const allIssues: ReviewIssue[] = [];
    const verdicts = new Map<string, string>();
    
    for (const review of reviews) {
        verdicts.set(review.from, review.verdict);
        
        for (const issue of parseIssues(review.body)) {
            // Поиск дубликата (тот же файл, ±5 строк)
            const duplicate = allIssues.find(i => 
                i.file === issue.file && 
                Math.abs(i.line - issue.line) <= 5 &&
                semanticSimilarity(i.description, issue.description) > 0.7
            );
            
            if (duplicate) {
                // Добавляем источник к существующему
                duplicate.foundBy.push(review.from);
                // Берём худший приоритет
                duplicate.priority = worstPriority(duplicate.priority, issue.priority);
            } else {
                allIssues.push({
                    ...issue,
                    id: generateId(),
                    foundBy: [review.from],
                });
            }
        }
    }
    
    // Консенсус: процент согласных ревьюверов
    const approvals = [...verdicts.values()].filter(v => v === 'APPROVED').length;
    const consensus = approvals / verdicts.size;
    
    return { issues: allIssues, verdicts, consensus };
}
```

### 8.2. Правила принятия решений

```typescript
function makeDecision(report: AggregatedReport): Decision {
    const { issues, verdicts, consensus } = report;
    
    // P0 = блокер — эскалация человеку
    if (issues.some(i => i.priority === 'P0')) {
        return { verdict: 'BLOCKED', reason: 'Critical P0 issues found' };
    }
    
    // Любой ревьювер сказал BLOCKED
    if ([...verdicts.values()].includes('BLOCKED')) {
        return { verdict: 'BLOCKED', reason: 'Reviewer blocked' };
    }
    
    // Есть P1 issues — нужны исправления
    const p1Issues = issues.filter(i => i.priority === 'P1');
    if (p1Issues.length > 0) {
        return { 
            verdict: 'CHANGES_REQUESTED', 
            reason: `${p1Issues.length} P1 issues require fixes`,
            requiredFixes: p1Issues,
        };
    }
    
    // P2 issues — желательно исправить, но можно в tech debt
    const p2Issues = issues.filter(i => i.priority === 'P2');
    
    // Минимум 2 APPROVED
    const approvals = [...verdicts.values()].filter(v => v === 'APPROVED').length;
    if (approvals >= 2) {
        return {
            verdict: 'APPROVED',
            reason: `${approvals}/${verdicts.size} approved`,
            techDebt: issues.filter(i => ['P2', 'P3', 'P4'].includes(i.priority)),
        };
    }
    
    // Недостаточно одобрений
    return {
        verdict: 'CHANGES_REQUESTED',
        reason: `Only ${approvals}/${verdicts.size} approved, need 2+`,
        suggestedFixes: p2Issues,
    };
}
```

---

## 9. План реализации

### Фаза 1: Базовая инфраструктура (3-5 дней)

| # | Задача | Результат |
|---|--------|-----------|
| 1.1 | Создать `scripts/orchestrator.ts` | Базовый диспетчер событий |
| 1.2 | Создать `scripts/agent-runner.ts` | Запуск агентов через API |
| 1.3 | Настроить API ключи в `.env` | Доступ к Anthropic, OpenAI, Google |
| 1.4 | Создать `.beads/agents.yaml` | Конфигурация агентов |
| 1.5 | Тест: запуск одного ревьювера вручную | Проверка работоспособности |

### Фаза 2: Ревью-пайплайн (5-7 дней)

| # | Задача | Результат |
|---|--------|-----------|
| 2.1 | Реализовать парсинг AGENT_MESSAGE | Чтение отчётов из комментариев |
| 2.2 | Реализовать барьер ожидания | Синхронизация 4 ревьюверов |
| 2.3 | Создать `scripts/review-aggregator.ts` | Агрегация и дедупликация |
| 2.4 | Создать `scripts/pm-agent.ts` | Логика принятия решений |
| 2.5 | Интеграция с GitHub Copilot Review | 4-й ревьювер |
| 2.6 | Тест: полный цикл ревью на тестовом PR | E2E проверка |

### Фаза 3: Автоматизация кодера (5-7 дней)

| # | Задача | Результат |
|---|--------|-----------|
| 3.1 | Передача отчёта кодеру через комментарий | Coder читает consolidated report |
| 3.2 | Coder парсит issues и исправляет | Автономная работа |
| 3.3 | Coder делает push → re-trigger ревью | Замкнутый цикл |
| 3.4 | Лимит итераций (max 5 циклов) | Защита от бесконечного loop |
| 3.5 | Тест: полный автономный цикл | E2E без человека |

### Фаза 4: Продакшн (3-5 дней)

| # | Задача | Результат |
|---|--------|-----------|
| 4.1 | GitHub webhook handler | Автоматический триггер |
| 4.2 | Логирование и мониторинг | Отслеживание состояния |
| 4.3 | Уведомления (Telegram/Slack) | Оповещение о событиях |
| 4.4 | Документация для оператора | Инструкции по управлению |
| 4.5 | Миграция на VPS (опционально) | 24/7 работа |

---

## 10. Точки контроля человека

Даже в автоматическом режиме человек сохраняет контроль:

| Ситуация | Действие системы |
|----------|------------------|
| P0 issue найден | ESCALATE → уведомление человеку |
| 5+ циклов без APPROVED | ESCALATE → возможно, задача некорректна |
| Все ревьюверы BLOCKED | ESCALATE → серьёзная проблема |
| API лимиты исчерпаны | PAUSE → уведомление человеку |
| Ошибка агента (timeout) | RETRY × 2, затем ESCALATE |

**Команды ручного управления:**

```bash
# Остановить автоматику для PR
bd pause pr:81

# Возобновить
bd resume pr:81

# Принудительный merge (override)
bd force-merge pr:81

# Принудительное закрытие
bd force-close pr:81 --reason="Отменено"
```

---

## 11. Метрики успеха

| Метрика | Текущее | Целевое |
|---------|---------|---------|
| Время цикла ревью | 30 мин (с человеком) | 30 мин (без человека) |
| Участие человека | 100% | < 10% (только эскалации) |
| Количество циклов до merge | 2-4 | 2-3 |
| Пропущенные баги | ? | Отслеживать |

---

## 12. Риски и митигация

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Агенты зациклились | Средняя | Лимит 5 итераций |
| Ложные P1 от ревьюверов | Средняя | Консенсус (2+ должны согласиться) |
| API лимиты | Низкая | Rate limiting, fallback модели |
| Конфликт рекомендаций | Средняя | PM Agent как арбитр |
| Мусорный код от кодера | Низкая | 4 независимых ревьювера |

---

## 13. Следующие шаги

1. **Согласовать план** с оператором (ты)
2. **Создать issue в Beads** для каждой фазы
3. **Начать с Фазы 1.1** — `scripts/orchestrator.ts`

---

**Вопросы?** Готов приступить к реализации после твоего одобрения.
