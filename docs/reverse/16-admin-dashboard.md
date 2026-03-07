# Reverse: Admin Dashboard
**Версия:** v0.8.7 (425d333) | **Дата:** 2026-03-07

## 1. Обзор

Admin Dashboard -- это отдельное SPA-приложение для администрирования игрового сервера Slime Arena. Предоставляет мониторинг состояния сервера (CPU, RAM, Rooms, Players, Tick latency), просмотр активных игровых комнат, аудит-лог действий администраторов, управление перезапуском сервера (с обязательной 2FA-верификацией) и настройку двухфакторной аутентификации (TOTP).

Стек: **Preact** + **@preact/signals** для реактивного состояния, **Vite** для сборки, plain CSS (mobile-first, без CSS Modules). Деплой -- как статика под Nginx с proxy_pass на MetaServer API.

Приложение полностью самодостаточно: не зависит от shared/ пакета, не использует Colyseus, общается только с MetaServer через REST API `/api/v1/admin/*`.

## 2. Исходные файлы

| Файл | Назначение |
|------|-----------|
| `admin-dashboard/package.json` | Зависимости и скрипты (v0.8.7) |
| `admin-dashboard/vite.config.ts` | Vite конфигурация (base, proxy, build) |
| `admin-dashboard/tsconfig.json` | TypeScript конфиг (Preact JSX) |
| `admin-dashboard/index.html` | HTML entry point (`lang="ru"`) |
| `admin-dashboard/serve.json` | SPA rewrite rules для production serving |
| `admin-dashboard/src/main.tsx` | Entry point: `render(<App />, #app)` |
| `admin-dashboard/src/App.tsx` | Корневой компонент, роутинг, session restore |
| `admin-dashboard/src/api/client.ts` | HTTP-клиент, auth, refresh, API-функции |
| `admin-dashboard/src/auth/signals.ts` | Сигналы аутентификации (accessToken, totp) |
| `admin-dashboard/src/components/TabBar.tsx` | Нижняя навигационная панель (5 вкладок) |
| `admin-dashboard/src/pages/LoginPage.tsx` | Страница входа |
| `admin-dashboard/src/pages/DashboardPage.tsx` | Метрики сервера (polling 5s) |
| `admin-dashboard/src/pages/RoomsPage.tsx` | Активные игровые комнаты (polling 5s) |
| `admin-dashboard/src/pages/AuditPage.tsx` | Аудит-лог с пагинацией |
| `admin-dashboard/src/pages/RestartPage.tsx` | Перезапуск сервера (требует 2FA) |
| `admin-dashboard/src/pages/SettingsPage.tsx` | 2FA настройка, logout |
| `admin-dashboard/src/styles/index.css` | Единый CSS-файл (~1023 строки) |

## 3. Архитектура

### 3.1 Фреймворк и состояние

- **Preact** v10.28.1 -- легковесная альтернатива React (3KB gzip).
- **@preact/signals** v2.5.1 -- реактивные сигналы для управления состоянием. Сигналы объявлены на уровне модулей (не внутри компонентов), что делает их глобальными синглтонами.
- JSX компилируется через `@preact/preset-vite` с `jsxImportSource: "preact"`.

### 3.2 Routing

Собственная реализация на основе сигнала `currentTab`:
```typescript
export type TabId = 'dashboard' | 'rooms' | 'audit' | 'restart' | 'settings';
export const currentTab = signal<TabId>('dashboard');
```

`PageRouter` -- простой `switch` по `currentTab.value`. Нет URL-роутинга, нет hash-routing, нет browser history API. Навигация осуществляется исключительно через TabBar или программное изменение `currentTab.value`.

### 3.3 Жизненный цикл приложения

1. `main.tsx`: `render(<App />, #app)` -- монтирование.
2. `App`: `useEffect` вызывает `tryRestoreSession()` -- попытка refresh access token через httpOnly cookie.
3. Пока идёт restore -- отображается loading spinner.
4. Если `isAuthenticated` = false -- отображается `LoginPage`.
5. Если `isAuthenticated` = true -- отображается layout с `TabBar` + `PageRouter`.

### 3.4 Стилизация

Единый CSS файл `index.css`, **без CSS Modules** (осознанное отклонение от ТЗ, задокументировано в комментарии файла). Mobile-first подход, min-width 320px. Брейкпоинты:
- `< 480px` -- мобильный layout (по умолчанию)
- `>= 480px` -- увеличенные отступы
- `>= 768px` -- десктопный layout (TabBar сверху, таблица вместо карточек в Audit)

## 4. API Client

**Файл:** `admin-dashboard/src/api/client.ts`

### 4.1 Base URL

```typescript
const API_BASE = '/api/v1/admin';
```

Относительный путь. В dev-режиме запросы проксируются через Vite (`/api` -> `http://localhost:3000`). В production -- через Nginx reverse proxy.

### 4.2 Аутентификация запросов

Функция `fetchWithAuth()` добавляет:
- `Authorization: Bearer <accessToken>` -- из signal `accessToken`.
- `Content-Type: application/json` -- автоматически при наличии body.
- `credentials: 'include'` -- для передачи httpOnly refresh_token cookie.

### 4.3 Token Refresh (автоматический)

При получении 401:
1. Вызывается `tryRefreshToken()` -- POST `/api/v1/admin/refresh` (credentials: include).
2. При успехе: обновляется `accessToken`, повторяется оригинальный запрос.
3. При неудаче: `clearAuth()`, выброс `ApiError(401)`.

Механизм очереди: если refresh уже выполняется, параллельные запросы ставятся в `refreshQueue` и ждут результата текущего refresh (паттерн "coalescing refresh").

### 4.4 Обработка ошибок

Класс `ApiError` с полями `status: number` и `message: string`. Парсинг ошибки: `response.json()` -> `data.message || data.error || 'Неизвестная ошибка'`. Для 204 No Content возвращается пустой объект `{} as T`.

### 4.5 Экспортируемые API-функции

| Функция | Метод | Endpoint | Описание |
|---------|-------|----------|----------|
| `apiRequest<T>(endpoint, options)` | any | `API_BASE + endpoint` | Универсальный запрос с auto-refresh |
| `login(username, password)` | POST | `/login` | Логин, возвращает `{ accessToken, totpRequired }` |
| `logout()` | POST | `/logout` | Выход, очищает auth state |
| `tryRestoreSession()` | POST | `/refresh` | Восстановление сессии (вызывает `tryRefreshToken`) |
| `getTotpSetup()` | POST | `/totp/setup` | Получение secret + QR для 2FA |
| `verifyTotp(code)` | POST | `/totp/verify` | Подтверждение 2FA-кода |

Дополнительно, страницы вызывают `apiRequest` напрямую:
- `GET /stats` -- DashboardPage
- `GET /rooms` -- RoomsPage
- `GET /audit?limit=N&offset=M` -- AuditPage
- `POST /restart` (с header `X-2FA-Code`) -- RestartPage

## 5. Auth

**Файл:** `admin-dashboard/src/auth/signals.ts`

### 5.1 Хранение токенов

| Сигнал | Тип | Хранилище | Описание |
|--------|-----|-----------|----------|
| `accessToken` | `signal<string \| null>` | In-memory (signal) | JWT access token. Теряется при закрытии вкладки |
| `totpRequired` | `signal<boolean>` | In-memory | `true` = 2FA не настроена, нужно настроить |
| `totpSuccess` | `signal<boolean>` | In-memory | 2FA успешно настроена в текущей сессии |
| `isAuthenticated` | `computed<boolean>` | Вычисляемый | `accessToken !== null` |

**Безопасность:** Access token хранится ТОЛЬКО в памяти (не localStorage, не sessionStorage). Refresh token -- httpOnly cookie, управляется сервером. Это правильный паттерн для защиты от XSS.

### 5.2 Login Flow

1. Пользователь вводит username/password на LoginPage.
2. `login()` -> POST `/api/v1/admin/login` (без Authorization header).
3. Сервер возвращает `{ accessToken, totpRequired }` + устанавливает httpOnly cookie с refresh token.
4. `setAccessToken(response.accessToken)` -> `isAuthenticated` = true -> App рендерит main layout.
5. Если `totpRequired === true` -> автоматическое переключение на вкладку Settings для настройки 2FA.
6. Если `totpRequired === false` -> переключение на Dashboard.

### 5.3 Session Restore

При загрузке страницы `tryRestoreSession()` пытается POST `/api/v1/admin/refresh`. Если httpOnly cookie валидна, сервер возвращает новый accessToken. Это позволяет восстанавливать сессию после перезагрузки страницы (access token потерян, но refresh cookie жива).

### 5.4 Logout

`logout()` -> POST `/logout` -> `clearAuth()` (сбрасывает accessToken, totpRequired, totpSuccess). При ошибке сети clearAuth всё равно выполняется (finally).

## 6. Страницы

### 6.1 LoginPage

**Файл:** `admin-dashboard/src/pages/LoginPage.tsx`

**Назначение:** Форма аутентификации администратора.

**Что отображает:**
- Заголовок "Slime Arena" / "Admin Dashboard"
- Поля: username (autocomplete="username"), password (autocomplete="current-password")
- Кнопка "Войти" (disabled при isSubmitting)
- Сообщение об ошибке (role="alert")

**API вызовы:**
- `login(username, password)` -> POST `/api/v1/admin/login`

**Обработка ошибок:**
- 401: "Неверное имя пользователя или пароль"
- 429: "Слишком много попыток. Подождите и попробуйте снова"
- Прочие: `err.message || 'Ошибка сервера'`
- Catch: "Ошибка соединения с сервером"

**Состояние:** Сигналы `username`, `password`, `error`, `isSubmitting` -- модульные (глобальные). Ошибка сбрасывается при монтировании (useEffect).

**Post-login redirect:**
- `totpRequired` = true -> `currentTab = 'settings'`
- `totpRequired` = false -> `currentTab = 'dashboard'`

### 6.2 DashboardPage (метрики сервера)

**Файл:** `admin-dashboard/src/pages/DashboardPage.tsx`

**Назначение:** Мониторинг состояния сервера в реальном времени. Требования ACC-MON-009, ACC-MON-010, ACC-MON-015.

**API вызовы:**
- `apiRequest<StatsResponse>('/stats')` -> GET `/api/v1/admin/stats`
- Polling: каждые **5000 ms** (setTimeout, не setInterval, для предотвращения наложения)

**Что отображает:**
1. **StatusCard** -- индикатор состояния сервера с пульсирующей анимацией:
   - `online` (зелёный): CPU < 90% И RAM < 90%
   - `degraded` (жёлтый): CPU >= 90% ИЛИ RAM >= 90%
   - `offline` (красный): ошибка при запросе
   - `unknown` (серый): нет данных
2. **Metrics Grid** (сетка 2x3):
   - CPU (%)
   - RAM (%, subtitle: used / total MB)
   - Rooms (количество или "---")
   - Players (количество или "---")
   - Tick Latency (avg ms, subtitle: max ms)
3. **Uptime** -- время работы (форматируется: Nd Nh / Nh Mm / Mm)
4. **Last Update** -- время последнего обновления (toLocaleTimeString)

**Интерфейс ответа StatsResponse:**
```typescript
interface StatsResponse {
  cpu: number;
  memory: { used: number; total: number; percent: number };
  uptime: number;
  rooms: number | null;
  players: number | null;
  tick: { avg: number; max: number } | null;
  timestamp: string;
}
```

**Polling паттерн:** `setTimeout`-based, запускается в `useEffect`, очищается при unmount через `mounted` флаг и `clearTimeout`. Предотвращает наложение запросов -- следующий poll запускается только после завершения предыдущего.

### 6.3 RoomsPage (активные комнаты)

**Файл:** `admin-dashboard/src/pages/RoomsPage.tsx`

**Назначение:** Просмотр списка активных игровых комнат. Требование ACC-MON-015.

**API вызовы:**
- `apiRequest<RoomData[]>('/rooms')` -> GET `/api/v1/admin/rooms`
- Polling: каждые **5000 ms** (тот же setTimeout паттерн)

**Что отображает:**
- Заголовок "Rooms (N)" -- с количеством комнат
- **RoomCard** для каждой комнаты:
  - roomId (monospace, truncated)
  - State badge: Spawning (amber), Playing (green), Ending (gray)
  - Players: playerCount / maxPlayers
  - Phase (текстовое название фазы)
  - Tick: avg ms (max: max ms)
  - Duration: MM:SS
- Пустое состояние: "Нет активных комнат"

**Интерфейс RoomData:**
```typescript
interface RoomData {
  roomId: string;
  playerCount: number;
  maxPlayers: number;
  state: 'spawning' | 'playing' | 'ending';
  phase: string;
  duration: number;
  tick: { avg: number; max: number };
}
```

### 6.4 RestartPage (перезапуск сервера)

**Файл:** `admin-dashboard/src/pages/RestartPage.tsx`

**Назначение:** Graceful restart игрового сервера с обязательным 2FA-подтверждением.

**API вызовы:**
- `apiRequest('/restart', { method: 'POST', headers: { 'X-2FA-Code': code } })` -> POST `/api/v1/admin/restart`

**State Machine (restartState):**
```
idle -> confirming -> sending -> sent
                   |            |
                   +-> error ---+
                   |            |
                   +-- idle <---+
```

1. **idle** -- кнопка "Перезапустить сервер" (btn-danger, 56px высота)
2. **confirming** -- предупреждение + ввод 6-значного 2FA-кода + кнопки "Подтвердить" / "Отмена"
3. **sending** -- spinner + "Отправка запроса на перезапуск..."
4. **sent** -- галочка + "Запрос отправлен" + Audit ID + кнопка "Готово"
5. **error** -- сообщение об ошибке + "Попробовать снова" / "Отмена"

**Проверка 2FA:**
- Если `totpRequired === true && !totpSuccess` -- 2FA не настроена -> показывается предупреждение "2FA не настроена" с кнопкой перехода в Settings.
- Только при `!totpRequired || totpSuccess` показывается контрол перезапуска.

**Обработка ошибок restart:**
- 403: "Неверный 2FA-код"
- 429: "Слишком частые запросы (лимит: 2 в минуту)"
- 409: "Перезапуск уже запрошен"

**Передача 2FA-кода:** через HTTP header `X-2FA-Code` (не в body).

### 6.5 SettingsPage (настройки)

**Файл:** `admin-dashboard/src/pages/SettingsPage.tsx`

**Назначение:** Настройка двухфакторной аутентификации (TOTP) и выход из системы.

**Секции:**
1. **2FA (TotpSetup)**
2. **Сессия (LogoutButton)**

**API вызовы:**
- `getTotpSetup()` -> POST `/api/v1/admin/totp/setup`
- `verifyTotp(code)` -> POST `/api/v1/admin/totp/verify`
- `logout()` -> POST `/api/v1/admin/logout`

**Логика TotpSetup:**
- Если `totpSuccess === true` -> "2FA успешно настроена!" (зелёная карточка)
- Если `totpRequired === false && !totpSetupData` -> "2FA включена" (уже настроена ранее)
- Если `totpRequired === true && !totpSetupData` -> кнопка "Настроить 2FA" + предупреждение
- При клике "Настроить 2FA" -> `getTotpSetup()` -> получение `{ secret, qrCodeUrl }`
- QR-код отображается как `<img>` с data:image/ URL (валидируется на клиенте: `startsWith('data:image/')`)
- Секция "Ввести вручную" (`<details>/<summary>`) -> показывает secret код
- Ввод 6-значного TOTP-кода -> `verifyTotp(code)` -> при успехе: `totpSuccess = true`, `setTotpRequired(false)`

**Обработка ошибок 2FA verify:**
- 401: "Неверный код. Проверьте время на устройстве."

### 6.6 AuditPage (журнал действий)

**Файл:** `admin-dashboard/src/pages/AuditPage.tsx`

**Назначение:** Просмотр истории действий администраторов с пагинацией.

**API вызовы:**
- `apiRequest<AuditResponse>('/audit?limit=50&offset=N')` -> GET `/api/v1/admin/audit`

**Пагинация:**
- Размер страницы: `PAGE_SIZE = 50` (захардкожен)
- Загрузка: initial + "Загрузить ещё" (append-паттерн, не page-based)
- `hasMore` = `items.length === PAGE_SIZE && offset < total`

**Что отображает:**
- **Мобильный вид** (`< 768px`): карточки `AuditEntryCard`
  - Header: action badge + timestamp
  - Body: Админ, Цель, Детали (JSON), IP
- **Десктопный вид** (`>= 768px`): таблица `<table>`
  - Колонки: Время, Админ, Действие, Цель, Детали

**Интерфейс AuditEntry:**
```typescript
interface AuditEntry {
  id: number;
  timestamp: string;       // ISO-8601
  userId: string | null;   // UUID admin user
  username: string | null;
  action: string;
  target: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
}
```

**Локализация action:**
| action | Отображение |
|--------|------------|
| `login` | Вход |
| `login_failed` | Неудачный вход |
| `logout` | Выход |
| `settings_change` | Изменение настроек |
| `totp_setup` | Настройка 2FA |
| `totp_setup_initiated` | Инициирована настройка 2FA |
| `totp_verify` | Верификация 2FA |
| `totp_verify_failed` | Неудачная верификация 2FA |
| `totp_enabled` | 2FA включена |
| `password_change` | Смена пароля |
| `room_restart` | Перезапуск комнаты |
| `server_restart` | Перезапуск сервера |
| `server_restart_requested` | Запрошен перезапуск сервера |

**Цветовое кодирование action (CSS):**
- login -> зелёный (#22C55E)
- logout -> серый (#6B7280)
- settings/totp/password -> синий (#3B82F6)
- restart -> жёлтый (#F59E0B)

**Формат timestamp:** DD.MM.YYYY HH:MM:SS (кастомная функция `formatTimestamp`, не `Intl`).

## 7. Компоненты

### 7.1 TabBar

**Файл:** `admin-dashboard/src/components/TabBar.tsx`

Нижняя навигационная панель (fixed bottom на мобильных, static top на desktop >= 768px).

5 вкладок:
| id | label | icon |
|----|-------|------|
| `dashboard` | Dashboard | `📊` |
| `rooms` | Rooms | `👥` |
| `audit` | Audit | `📋` |
| `restart` | Restart | `🔄` |
| `settings` | Settings | `⚙️` |

**Доступность:** `role="navigation"`, `aria-label="Основная навигация"`, `aria-current="page"` на активной вкладке. Иконки имеют `aria-hidden="true"`.

**Layout:**
- Mobile: vertical stack (icon сверху, label снизу), fixed bottom, 60px height
- Desktop (>= 768px): horizontal row (icon + label в строку), static, border-bottom

## 8. Стилизация

### 8.1 Подход

Единый CSS файл `index.css` (~1023 строки). Mobile-first, без CSS Modules, без CSS-in-JS. Отклонение от ТЗ задокументировано комментарием в файле.

### 8.2 CSS Variables (тема)

Тёмная тема (единственная):
```css
--color-bg: #111827;          /* Фон */
--color-bg-card: #1f2937;     /* Карточки */
--color-bg-input: #374151;    /* Инпуты */
--color-text: #f9fafb;        /* Основной текст */
--color-text-muted: #9ca3af;  /* Мутный текст */
--color-primary: #3b82f6;     /* Основной акцент */
--color-danger: #ef4444;      /* Опасные действия */
--color-border: #374151;      /* Границы */
```

Цвета статусов:
```css
--color-online: #22C55E;      /* Зелёный */
--color-degraded: #F59E0B;    /* Жёлтый */
--color-offline: #EF4444;     /* Красный */
--color-unknown: #6B7280;     /* Серый */
```

### 8.3 Touch-friendly

`--min-touch-size: 44px` -- минимальная высота кнопок и инпутов (соответствует WCAG 2.5.5 Target Size).

### 8.4 Responsive брейкпоинты

| Брейкпоинт | Изменения |
|------------|-----------|
| `< 480px` | Базовый mobile layout |
| `>= 480px` | Увеличенные padding |
| `>= 768px` | Desktop layout: TabBar сверху, Audit в таблице, page max-width 800px (audit 1000px) |

### 8.5 Анимации

- `spin` -- вращение loading spinner (1s linear infinite)
- `pulse` -- пульсация индикатора статуса (2s ease-in-out infinite)

## 9. Build & Deploy

### 9.1 Vite Config

```typescript
// admin-dashboard/vite.config.ts
export default defineConfig({
  plugins: [preact()],
  base: '/admin/',
  server: {
    port: 5175,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
```

- `base: '/admin/'` -- все пути ассетов относительно /admin/
- Dev server на порту **5175** (не 5173, чтобы не конфликтовать с клиентом)
- Proxy `/api` -> `http://localhost:3000` (MetaServer)
- Build output: `admin-dashboard/dist/`

### 9.2 TypeScript Config

- Target: ES2020
- JSX: `react-jsx` с `jsxImportSource: "preact"`
- Strict mode: enabled (strict, noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch)
- Module resolution: bundler

### 9.3 serve.json

Для production serving (используется вместе со статическими файл-серверами):
```json
{
  "rewrites": [{ "source": "**", "destination": "/index.html" }],
  "headers": [
    { "source": "**/*.js", "headers": [{ "key": "Content-Type", "value": "application/javascript" }] },
    { "source": "**/*.css", "headers": [{ "key": "Content-Type", "value": "text/css" }] }
  ]
}
```

SPA fallback: все пути перенаправляются на `/index.html`.

### 9.4 Зависимости

**Runtime:**
- `preact` ^10.28.1
- `@preact/signals` ^2.5.1

**Dev:**
- `@preact/preset-vite` ^2.9.0
- `typescript` ^5.0.0
- `vite` ^5.0.0

Минимальный набор зависимостей. Нет UI-библиотек, нет CSS фреймворков, нет state management библиотек кроме signals.

### 9.5 Deploy

Билд собирается как часть общего `npm run build` (shared -> server -> client -> admin-dashboard). Результат -- статика в `admin-dashboard/dist/`. В production обслуживается Nginx с location `/admin/`, proxy_pass для API на MetaServer.

## 10. Захардкоженные значения

| Значение | Где | Описание |
|----------|-----|----------|
| `'/api/v1/admin'` | `api/client.ts:9` | API base URL |
| `5000` | `DashboardPage.tsx:70`, `RoomsPage.tsx:47` | Polling interval (ms) |
| `50` | `AuditPage.tsx:28` | PAGE_SIZE для аудит-лога |
| `90` | `DashboardPage.tsx:58` | Порог CPU/RAM для статуса "degraded" (%) |
| `6` | `RestartPage.tsx:125`, `SettingsPage.tsx:129` | Длина TOTP-кода |
| `200` | `SettingsPage.tsx:98-99` | QR-код размер (width/height px) |
| `60` | `RestartPage.tsx:94` | Ожидаемое время простоя при restart (секунд) |
| `5175` | `vite.config.ts:8` | Dev server port |
| `3000` | `vite.config.ts:10` | MetaServer target port для proxy |
| `'/admin/'` | `vite.config.ts:6` | Vite base path |
| `320` | `index.css:74` | Минимальная ширина (min-width body) |
| `600` | `index.css:163` | Max-width страниц (px) |
| `60` | `index.css:129` | Высота TabBar (px) |
| Emoji icons (`📊`, `👥`, `📋`, `🔄`, `⚙️`) | `TabBar.tsx:12-18` | Иконки вкладок (временно, комментарий: "позже можно заменить на SVG") |

## 11. Расхождения с документацией

### Сравнение с Architecture v4.2.5 Part 4

1. **Admin API не детализирован в документации.** Раздел C.12 ("Административные маршруты") в Part4 содержит только одну строку: "Маршруты доступны только с ролью администратора и пишут записи в `audit_log`. Перечень и конкретные права задаются конфигурацией и окружением." В реальности реализовано 8 эндпоинтов: `/login`, `/logout`, `/refresh`, `/stats`, `/rooms`, `/audit`, `/restart`, `/totp/setup`, `/totp/verify`.

2. **Таблица `audit_log` vs AuditEntry.** Документация (B.18) описывает поля: `id` (UUID), `actor_user_id`, `action`, `target`, `payload`, `ip`, `created_at`. В коде клиента `AuditEntry` использует: `id` (number, не UUID), `timestamp` (вместо `created_at`), `userId` (вместо `actor_user_id`), `username` (нет в схеме БД), `details` (вместо `payload`). Это может быть трансформацией на уровне API или расхождением.

3. **2FA не упомянута в архитектуре.** TOTP-аутентификация (setup, verify) полностью отсутствует в архитектурной документации. Это значимая функциональность безопасности, не покрытая спецификацией.

4. **Restart endpoint не документирован.** POST `/api/v1/admin/restart` с header `X-2FA-Code` -- нет в документации. Rate limiting (2 запроса в минуту, код 429), conflict detection (код 409) -- не описаны.

5. **CSS Modules.** В документации (или ТЗ, упомянут в комментарии CSS-файла) ожидались CSS Modules. Реализовано plain CSS -- осознанное отклонение, задокументировано в коде.

6. **Отсутствие runtime settings.** Страница Settings содержит только 2FA и logout. Нет функциональности изменения runtime-конфигурации (balance.json, feature flags и т.п.), хотя action `settings_change` присутствует в аудит-логе.

## 12. Технический долг

1. **Глобальные сигналы на уровне модулей.** Сигналы состояния каждой страницы (например, `statsData`, `roomsData`, `auditEntries`) объявлены на уровне модуля и не очищаются при unmount. При переключении вкладок старые данные сохраняются в памяти. Это может приводить к показу stale данных при возврате на вкладку до завершения первого poll.

2. **Нет URL-роутинга.** Невозможно поделиться ссылкой на конкретную страницу или использовать кнопку "Назад" браузера. Все навигации -- внутренние через сигнал `currentTab`.

3. **Emoji иконки в TabBar.** Комментарий в коде: "Временно emoji, позже можно заменить на SVG". Emoji рендерятся по-разному на разных ОС/браузерах.

4. **Нет i18n.** Смесь русского (labels, ошибки, заголовки) и английского (статусы, метрики). Нет системы интернационализации.

5. **Нет WebSocket для real-time.** Dashboard и Rooms используют polling (5s). Для real-time мониторинга желательно WebSocket/SSE.

6. **Audit details отображается как raw JSON.** `formatDetails()` просто делает `JSON.stringify(details)`. Нет форматирования или человекочитаемого представления.

7. **Нет поиска/фильтрации в аудит-логе.** Только пагинация (append). Нет фильтров по action, admin, дате.

8. **Нет управления пользователями/админами.** Нет UI для создания/удаления админов, смены паролей, управления правами.

9. **Нет runtime config editing.** SettingsPage содержит только 2FA и logout. Нет возможности менять баланс, feature flags, matchmaking параметры через UI.

10. **CSS: отсутствие CSS Modules.** Все стили глобальные. При росте может привести к конфликтам имён.

11. **input autocomplete="one-time-code"** на TOTP-полях -- возможный UX-конфликт с SMS-based autofill на мобильных устройствах.

12. **LoginPage: сигналы username/password глобальные.** При logout и повторном показе LoginPage пароль может сохраняться в signal (хотя сбрасывается в handleSubmit при успехе, при ошибке -- нет).

## 13. Заметки для форка BonkRace

Admin Dashboard переиспользуется практически целиком. Основные адаптации:

1. **Ребрендинг:**
   - `LoginPage`: заголовок "Slime Arena" -> "BonkRace"
   - `index.html`: title "Slime Arena -- Admin Dashboard" -> "BonkRace -- Admin Dashboard"
   - `theme-color`: пересмотреть цветовую схему

2. **RoomsPage -> RacesPage:**
   - Переименование: rooms -> races
   - `RoomData.state`: `'spawning' | 'playing' | 'ending'` -> адаптировать под гоночные фазы (countdown, racing, finished)
   - `RoomData.phase` -> race phase (start, lap N, finish)
   - Метрика `duration` остаётся актуальной (длительность гонки)
   - Метрика `tick` остаётся актуальной

3. **DashboardPage:**
   - Метрики CPU, RAM, Uptime -- без изменений
   - Rooms -> Races (label)
   - Players -> Racers (label)
   - Tick Latency -- без изменений

4. **AuditPage:**
   - `room_restart` -> `race_restart` в actionMap
   - Остальные action (login, logout, settings_change, totp_*) -- без изменений

5. **RestartPage:**
   - Текст "все активные матчи" -> "все активные гонки"
   - Механизм 2FA -- без изменений

6. **SettingsPage, Auth, API Client:**
   - Без изменений, полностью переносятся

7. **API Base:**
   - `'/api/v1/admin'` -- возможно переименование, но можно оставить

8. **Vite config:**
   - `base: '/admin/'` -- без изменений
   - `port: 5175` -- без изменений
