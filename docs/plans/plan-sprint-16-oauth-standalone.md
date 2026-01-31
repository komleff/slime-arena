# Sprint 16: StandaloneAdapter с OAuth авторизацией

**Версия плана:** 1.0
**Дата:** 31 января 2026
**PM:** Claude Opus 4.5
**ТЗ:** [TZ-StandaloneAdapter-OAuth-v1.9.md](../soft-launch/TZ-StandaloneAdapter-OAuth-v1.9.md)
**Приоритет:** P0
**Ветка:** `sprint-16/oauth-standalone`

---

## 1. Цель спринта

Реализовать OAuth авторизацию (Google, Яндекс ID) для Standalone-пользователей браузерной версии игры с учётом региональных ограничений (Google недоступен в РФ).

---

## 2. Анализ текущего состояния

### 2.1. Что УЖЕ реализовано

| Компонент | Файл | Статус |
|-----------|------|--------|
| Таблица `oauth_links` | `server/src/db/migrations/007_meta_gameplay_tables.sql` | ✅ Есть |
| `GoogleOAuthProvider` | `server/src/meta/platform/GoogleOAuthProvider.ts` | ✅ Есть |
| Эндпоинт `/auth/oauth` | `server/src/meta/routes/auth.ts` | ✅ Есть (частично) |
| Эндпоинт `/auth/upgrade` | `server/src/meta/routes/auth.ts` | ✅ Есть |
| `IAuthAdapter` интерфейс | `client/src/platform/IAuthAdapter.ts` | ✅ Есть |
| `StandaloneAdapter` | `client/src/platform/StandaloneAdapter.ts` | ✅ Есть (dev) |
| `RegistrationPromptModal` | `client/src/ui/components/RegistrationPromptModal.tsx` | ✅ Есть |
| `authService` | `client/src/services/authService.ts` | ✅ Есть |

### 2.2. Что ОТСУТСТВУЕТ (требуется реализовать)

| Компонент | Описание | Приоритет |
|-----------|----------|-----------|
| `GET /auth/config` | Список провайдеров по региону | P0 |
| GeoIP сервис | Определение региона по IP | P0 |
| `YandexOAuthProvider` | Серверная верификация Яндекс | P0 |
| `POST /auth/oauth/resolve` | Вход после 409 конфликта | P0 |
| OAuth UI компонент | Кнопки выбора провайдера | P0 |
| OAuth клиентская логика | PKCE, state, redirect handling | P0 |
| Диалог 409 конфликта | UI для выбора аккаунта | P0 |
| `pendingAuthToken` механизм | JWT для resolve после 409 | P0 |
| Региональная фильтрация | Google скрыт для РФ/UNKNOWN | P0 |

---

## 3. Декомпозиция задач

### Фаза 1: Серверная инфраструктура (AUTH-1 — AUTH-3)

| ID | Задача | Файлы | Оценка |
|----|--------|-------|--------|
| **AUTH-1** | `GET /api/v1/auth/config` — список провайдеров по региону | `server/src/meta/routes/auth.ts` | 2ч |
| **AUTH-2** | GeoIP сервис + строгий fallback на UNKNOWN | `server/src/meta/services/GeoIPService.ts` | 3ч |
| **AUTH-3** | Фабрика OAuth провайдеров (Google, Yandex) | `server/src/meta/platform/OAuthProviderFactory.ts` | 2ч |

### Фаза 2: Серверные OAuth провайдеры (AUTH-5, AUTH-7)

| ID | Задача | Файлы | Оценка |
|----|--------|-------|--------|
| **AUTH-5** | Google OAuth сервер — code exchange, userinfo | `server/src/meta/platform/GoogleOAuthProvider.ts` | 4ч |
| **AUTH-7** | Яндекс ID сервер — code exchange, userinfo | `server/src/meta/platform/YandexOAuthProvider.ts` | 4ч |

### Фаза 3: Клиентские OAuth провайдеры (AUTH-4, AUTH-6)

| ID | Задача | Файлы | Оценка |
|----|--------|-------|--------|
| **AUTH-4** | Google OAuth клиент — URL builder, PKCE, state | `client/src/oauth/GoogleOAuthClient.ts` | 3ч |
| **AUTH-6** | Яндекс ID клиент — URL builder, state | `client/src/oauth/YandexOAuthClient.ts` | 3ч |

### Фаза 4: UI компоненты (AUTH-8 — AUTH-10)

| ID | Задача | Файлы | Оценка |
|----|--------|-------|--------|
| **AUTH-8** | Интерфейс выбора провайдера | `client/src/ui/components/OAuthProviderSelector.tsx` | 4ч |
| **AUTH-9** | Мобильный redirect + восстановление состояния | `client/src/oauth/OAuthRedirectHandler.ts` | 3ч |
| **AUTH-10** | Диалог 409 конфликта + pendingAuthToken | `client/src/ui/components/AccountConflictModal.tsx` | 4ч |

### Фаза 5: Resolve и интеграция (AUTH-11 — AUTH-13)

| ID | Задача | Файлы | Оценка |
|----|--------|-------|--------|
| **AUTH-11** | `POST /api/v1/auth/oauth/resolve` эндпоинт | `server/src/meta/routes/auth.ts` | 2ч |
| **AUTH-12** | Интеграционное тестирование Google | `server/tests/oauth-google.test.ts` | 2ч |
| **AUTH-13** | Интеграционное тестирование Яндекс | `server/tests/oauth-yandex.test.ts` | 2ч |

---

## 4. Зависимости между задачами

```
AUTH-2 (GeoIP) ──┐
                 ├──► AUTH-1 (auth/config)
AUTH-3 (Factory) ┘
        │
        ▼
AUTH-5 (Google Server) ──┬──► AUTH-4 (Google Client)
AUTH-7 (Yandex Server) ──┴──► AUTH-6 (Yandex Client)
        │
        ▼
AUTH-8 (Provider UI) ──► AUTH-9 (Mobile Redirect)
        │
        ▼
AUTH-10 (409 Dialog) ──► AUTH-11 (resolve endpoint)
        │
        ▼
AUTH-12 + AUTH-13 (Tests)
```

---

## 5. Критические файлы

### Сервер (изменения)

| Файл | Действие |
|------|----------|
| `server/src/meta/routes/auth.ts` | Добавить `/auth/config`, `/auth/oauth/resolve` |
| `server/src/meta/services/AuthService.ts` | Добавить `findUserByOAuthLink`, `createPendingAuthToken` |
| `server/src/meta/platform/GoogleOAuthProvider.ts` | Расширить code exchange |
| `server/src/meta/config/index.ts` | Добавить ENV для OAuth secrets |

### Сервер (новые файлы)

| Файл | Назначение |
|------|------------|
| `server/src/meta/services/GeoIPService.ts` | Определение региона по IP |
| `server/src/meta/platform/YandexOAuthProvider.ts` | Яндекс ID интеграция |
| `server/src/meta/platform/OAuthProviderFactory.ts` | Фабрика провайдеров |

### Клиент (изменения)

| Файл | Действие |
|------|----------|
| `client/src/services/authService.ts` | Добавить OAuth методы |
| `client/src/platform/StandaloneAdapter.ts` | Интеграция с OAuth |
| `client/src/ui/components/RegistrationPromptModal.tsx` | Добавить OAuth кнопки |

### Клиент (новые файлы)

| Файл | Назначение |
|------|------------|
| `client/src/oauth/GoogleOAuthClient.ts` | Google OAuth URL builder |
| `client/src/oauth/YandexOAuthClient.ts` | Яндекс OAuth URL builder |
| `client/src/oauth/OAuthRedirectHandler.ts` | Обработка redirect |
| `client/src/oauth/types.ts` | Типы OAuth |
| `client/src/ui/components/OAuthProviderSelector.tsx` | UI выбора провайдера |
| `client/src/ui/components/AccountConflictModal.tsx` | Диалог 409 |

---

## 6. Требования из ТЗ

### 6.1. Региональные ограничения (P0)

- Google **запрещён** для регионов `RU` и `UNKNOWN`
- При `oauthRegionDetectionStrict=true` (default) — fallback на `UNKNOWN` при сбое GeoIP
- Яндекс доступен везде

### 6.2. API контракт

```typescript
// GET /api/v1/auth/config
{
  region: 'RU' | 'CIS' | 'GLOBAL' | 'UNKNOWN',
  providers: [{
    name: 'google' | 'yandex' | 'vk',
    clientId: string,
    priority: number,
    requiresPKCE: boolean
  }]
}

// POST /api/v1/auth/oauth
{
  provider: string,
  code: string,
  redirectUri: string,
  codeVerifier?: string  // для VK
}
// Response 404: аккаунт не найден
// Response 200: { accessToken, userId, profile, isAnonymous: false }

// POST /api/v1/auth/upgrade (mode: convert_guest)
{
  mode: 'convert_guest',
  provider: string,
  code: string,
  redirectUri: string,
  claimToken: string,
  nickname: string,
  codeVerifier?: string
}
// Response 409: { error: 'oauth_already_linked', pendingAuthToken, existingAccount }

// POST /api/v1/auth/oauth/resolve
{
  pendingAuthToken: string
}
// Response 200: { accessToken, userId, profile }
```

### 6.3. localStorage ключи

| Ключ | Назначение | Когда очищать |
|------|------------|---------------|
| `oauth_state` | CSRF токен | После возврата |
| `oauth_code_verifier` | PKCE verifier | После возврата |
| `oauth_provider` | Провайдер | После возврата |
| `oauth_intent` | `login` / `convert_guest` | После возврата |

---

## 7. Конфигурация

### ENV переменные (сервер)

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
YANDEX_CLIENT_ID=...
YANDEX_CLIENT_SECRET=...
```

### Флаги

| Флаг | Default | Описание |
|------|---------|----------|
| `oauthGoogleEnabled` | true | Google глобально |
| `oauthYandexEnabled` | true | Яндекс глобально |
| `oauthGoogleEnabledRU` | **false** | Google для РФ |
| `oauthRegionDetectionStrict` | **true** | Строгий режим |

---

## 8. Верификация

### 8.1. Unit тесты

```bash
npm run test
```

- GeoIPService: определение региона
- OAuthProviderFactory: фильтрация по региону
- AuthService: pendingAuthToken lifecycle

### 8.2. Интеграционные тесты

- `/auth/config` возвращает правильных провайдеров для RU/GLOBAL/UNKNOWN
- `/auth/oauth` возвращает 404 для нового пользователя
- `/auth/upgrade` возвращает 409 при конфликте
- `/auth/oauth/resolve` работает с pendingAuthToken

### 8.3. E2E сценарии

1. **Новый пользователь (РФ):** Видит только Яндекс → OAuth → 404 → играет как гость
2. **Новый пользователь (EU):** Видит Google + Яндекс → OAuth → 404 → играет как гость
3. **Upgrade гостя:** Играет → 200кг → OAuth → upgrade успех
4. **Конфликт 409:** Upgrade → OAuth привязан к другому → диалог → resolve

---

## 9. План создания задач Beads

После утверждения плана создать задачи:

```bash
# Фаза 1
bd create --title="AUTH-1: GET /api/v1/auth/config" --type=task --priority=0
bd create --title="AUTH-2: GeoIP сервис определения региона" --type=task --priority=0
bd create --title="AUTH-3: Фабрика OAuth провайдеров" --type=task --priority=0

# Фаза 2
bd create --title="AUTH-5: Google OAuth сервер" --type=task --priority=0
bd create --title="AUTH-7: Яндекс ID сервер" --type=task --priority=0

# Фаза 3
bd create --title="AUTH-4: Google OAuth клиент" --type=task --priority=0
bd create --title="AUTH-6: Яндекс ID клиент" --type=task --priority=0

# Фаза 4
bd create --title="AUTH-8: UI выбора OAuth провайдера" --type=task --priority=0
bd create --title="AUTH-9: Mobile redirect + state restore" --type=task --priority=0
bd create --title="AUTH-10: Диалог 409 конфликта" --type=task --priority=0

# Фаза 5
bd create --title="AUTH-11: POST /auth/oauth/resolve" --type=task --priority=0
bd create --title="AUTH-12: Тестирование Google OAuth" --type=task --priority=1
bd create --title="AUTH-13: Тестирование Яндекс ID" --type=task --priority=1

# Зависимости
bd dep add AUTH-1 AUTH-2
bd dep add AUTH-1 AUTH-3
bd dep add AUTH-4 AUTH-5
bd dep add AUTH-6 AUTH-7
bd dep add AUTH-8 AUTH-4
bd dep add AUTH-8 AUTH-6
bd dep add AUTH-9 AUTH-8
bd dep add AUTH-10 AUTH-9
bd dep add AUTH-11 AUTH-10
bd dep add AUTH-12 AUTH-11
bd dep add AUTH-13 AUTH-11
```

---

## 10. Риски и митигации

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| GeoIP сервис недоступен | Средняя | Строгий режим → UNKNOWN → только Яндекс |
| Google отклоняет redirect URI | Низкая | Заранее зарегистрировать все URI |
| Яндекс не отдаёт email | Высокая | Работать без email (ТЗ раздел 6.4) |
| localStorage недоступен (incognito) | Средняя | Показать предупреждение |

---

## 11. Итого

**Scope:** 13 задач
**Оценка:** 38 часов (~5 рабочих дней)
**Критический путь:** AUTH-2 → AUTH-1 → AUTH-5/7 → AUTH-4/6 → AUTH-8 → AUTH-9 → AUTH-10 → AUTH-11

---

**Статус:** ✅ Утверждён (31.01.2026)

## 12. Задачи Beads

| AUTH ID | Beads ID | Статус |
|---------|----------|--------|
| AUTH-1 | slime-arena-1fs | blocked |
| AUTH-2 | slime-arena-fbp | ready |
| AUTH-3 | slime-arena-y60 | ready |
| AUTH-4 | slime-arena-8p1 | blocked |
| AUTH-5 | slime-arena-bw7 | ready |
| AUTH-6 | slime-arena-fn5 | blocked |
| AUTH-7 | slime-arena-4vy | ready |
| AUTH-8 | slime-arena-8cv | blocked |
| AUTH-9 | slime-arena-b97 | blocked |
| AUTH-10 | slime-arena-8uv | blocked |
| AUTH-11 | slime-arena-on8 | blocked |
| AUTH-12 | slime-arena-0jf | blocked |
| AUTH-13 | slime-arena-cfx | blocked |
