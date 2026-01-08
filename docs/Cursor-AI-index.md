Как настроить централизованную индексацию кода для всех агентов

Централизованная индексация кода для всех агентов — это локальный векторный индекс всего репозитория (файлы, связи, архитектура), доступный **одной Cursor IDE**, где все твои модели (Copilot/Claude/Gemini/OpenAI) работают через единый 
Composer/Agent, а не параллельно в чатах. Никаких внешних серверов или RAG-ядер — всё на твоей машине. [10][11]                                                                                                                            

## Настройка в Cursor (5 минут)

### 1. Установка и первый запуск
```
Скачай Cursor с cursor.com → установи → открой твой геймдев-репо (GitHub/Obsidian)
Перенос VS Code настроек: автоматом (extensions, keybindings, themes)
```

### 2. Включаем индексацию codebase
```
Cmd/Ctrl + Shift + P → "Cursor: Index Workspace" (или Settings → Features → Codebase Indexing → ON)
Фоново создаст .cursor/ индекс (~30 сек для 10k строк TS/Python)
```

### 3. .cursorignore (как .gitignore)
```
Создай файл .cursorignore в корне репо:
node_modules/
dist/
*.log
.pytest_cache/
# Но оставь docs/, README.md, Obsidian-ноты
```
**Результат**: индекс видит архитектуру, связи импортов, твою "живую документацию", техдолг из комментариев — но игнорирует мусор.

### 4. Подключаем твои API-ключи (multi-LLM)
```
Cmd/Ctrl + , → Cursor Settings → AI Models:
✅ OpenAI (твой ключ GPT-4o/o1)
✅ Anthropic (Claude 3.5 Sonnet/Opus)
✅ Google Gemini (твой ключ)
✅ GitHub Copilot (уже есть подписка)
Privacy Mode ON — индекс локальный, не уходит на сервера
```

## Как теперь работают агенты без коллизий

**Было**: Claude правит physics.ts → Gemini ломает gameLoop.ts → конфликт в git.

**Стало** (в Cursor Composer — Cmd/Ctrl + I):
```
@codebase Рефактор Slime Arena: мигрируй физику из @docs/physics.md,
почини клиппинг игроков, обнови UI в battle-ui.tsx.
Claude 3.5 → план → diff по 7 файлам → Apply → git commit
```

**Что происходит**:
1. `@codebase` тянет релевантные файлы/доки из индекса
2. Claude видит связи (physics → gameLoop → UI → тесты)
3. Один coherent diff по всему репо
4. Preview: +45/-12 строк, touched файлы
5. Apply → автоматический git commit с coherent сообщением

## Практика под твой флоу

```
Твой README + Obsidian tasks.md автоматически в индексе
Пишешь задачу → @codebase видит техдолг из комментариев
Claude генерит план рефактора → Gemini дописывает тесты
Единый Apply — никаких коллизий
```

**Проявление**: Вместо 4 чатов с размазанным контекстом — **один мозг проекта**, синхронизирующий все модели. Для геймдева это breakthrough: агент понимает, как UI зависит от физики, тесты от архитектуры, всё из твоей "живой документации".                                                                                                                                                                                                                                       

## Быстрый тест (5 минут)
```
1. Cursor → твой Little Battle Avatars репо
2. Index Workspace
3. Cmd+I → "@codebase найди баг с клиппингом в физике"
4. Смотри magic — он найдёт physics.ts + battle-ui.tsx + issue#23 автоматически
```

Это **не просто индексация файлов**, а **единый контекстный слой** для всех агентов. Коллизии исчезают, потому что больше нет "параллельной разработки через чаты" — есть централизованный мозг проекта. [10][11]

Цитаты:
[1] Базовый RAG-компонент для локального ... https://habr.com/ru/articles/982476/
[2] Что такое мультиагентные системы? https://www.sap.com/central-asia-caucasus/resources/what-are-multi-agent-systems
[3] Руководство администратора https://docs.trendmicro.com/all/ent/officescan/v11.0/ru-ru/osce_11.0_ag.pdf
[4] Параметры политики Агента администрирования https://support.kaspersky.com/ksc/14/ru-RU/219894.htm
[5] Использование индексирования кодовой базы в коде ... https://www.reddit.com/r/ClaudeAI/comments/1loebp9/using_codebase_indexing_in_claude_code/
[6] Внедрение управления учетными записями ... https://support.catonetworks.com/hc/ru/articles/13651203583773-%D0%92%D0%BD%D0%B5%D0%B4%D1%80%D0%B5%D0%BD%D0%B8%D0%B5-%D1%83%D0%BF%D1%80%D0%B0%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D1%8F-%D1%83%D1%87%D0%B5%D1%82%D0%BD%D1%8B%D0%BC%D0%B8-%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D1%8F%D0%BC%D0%B8-%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D0%B5%D0%B9-LDAP
[7] Руководство администратора Backup Exec 20.2 https://www.veritas.com/support/en_US/doc/63425337-132582167-0/v132377962-132582167
[8] Как создать AI-агента без кода https://mws.ru/events/webinar23092025/
[9] Как установить агент Кибер Бэкап (ex-Acronis) на Windows https://1dedic.ru/knowledge_base/kak-ustanovit-agent-kiber-bekap-ex-acronis-na-windows
[10] Что такое Cursor? - энциклопедия BigdataSchool https://bigdataschool.ru/wiki/cursor/
[11] Cursor: Обзор и возможности https://habr.com/ru/articles/959144/