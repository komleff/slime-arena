# Исправление бага: 2FA статус в Admin Dashboard

**Дата:** 2026-02-07
**Ветка:** `sprint-20/fix-admin-2fa-status`
**Контекст:** При локальном тестировании v0.8.4 обнаружен баг — после настройки 2FA и повторного логина Settings показывает кнопку «Настроить 2FA» вместо статуса «2FA включена».

---

## Причина бага

Сигнал `totpRequired` перегружен двумя смыслами:

| Компонент | Что отправляет/читает | Семантика |
|-----------|----------------------|-----------|
| **Бэкенд** (admin.ts:187, 277) | `totpRequired: user.totp_enabled` | «У пользователя включена 2FA» |
| **SettingsPage** (строка 62) | `totpRequired.value` → показать notice | «Нужно настроить 2FA» |

При `totp_enabled=true` в БД → `totpRequired=true` → Settings думает «нужно настроить» → показывает кнопку.
При этом `totpSuccess=false` (in-memory, сбрасывается при перезагрузке) → условие «2FA включена» (строка 39) не срабатывает.

---

## Решение

Инвертировать семантику `totpRequired` на бэкенде: `true` = «настройка нужна» (т.е. `!totp_enabled`).

### Шаг 1: Бэкенд — `server/src/meta/routes/admin.ts`

**Login (строка 187):**
```ts
// Было:
totpRequired: user.totp_enabled,
// Стало:
totpRequired: !user.totp_enabled,
```

**Refresh (строка 277):**
```ts
// Было:
totpRequired: user.totp_enabled,
// Стало:
totpRequired: !user.totp_enabled,
```

Безопасность: `totpRequired` не участвует в роутинге в `App.tsx` (используется только `isAuthenticated`).
Контракт: `totpRequired = true` — у пользователя ещё не настроена 2FA (настройка требуется); `totpRequired = false` — 2FA уже настроена. Сигнал читается в `SettingsPage.tsx` и `RestartPage.tsx`.

### Шаг 2: Фронтенд — `admin-dashboard/src/pages/SettingsPage.tsx`

Переписать логику `TotpSetup()`:

```tsx
function TotpSetup() {
  // Только что настроили 2FA в текущей сессии
  if (totpSuccess.value) {
    return (
      <div class="totp-status totp-enabled">
        <span class="status-icon">&#10003;</span>
        <span>2FA успешно настроена!</span>
      </div>
    );
  }

  // 2FA уже включена (totpRequired=false означает «настройка НЕ нужна»)
  if (!totpRequired.value && !totpSetupData.value) {
    return (
      <div class="totp-status totp-enabled">
        <span class="status-icon">&#10003;</span>
        <span>2FA включена</span>
      </div>
    );
  }

  // Нужна настройка (totpRequired=true означает «настройка нужна»)
  if (!totpSetupData.value) {
    return (
      <div class="totp-setup-start">
        {totpRequired.value && (
          <p class="totp-required-notice">...</p>
        )}
        <button ...>Настроить 2FA</button>
      </div>
    );
  }

  // Форма верификации (без изменений)
}
```

Ключевое изменение: порядок проверок. `totpSuccess` проверяется первым (приоритет у «только что настроили»), затем `!totpRequired` для «уже включена».

### Шаг 3: Фронтенд — `admin-dashboard/src/auth/signals.ts`

Обновить комментарий:
```ts
// Было:
/** Требуется ли настройка 2FA после логина */
// Стало:
/** Требуется ли настройка 2FA (true = 2FA не включена, нужно настроить) */
```

### Шаг 4: `handleVerify()` — без изменений

После успешной верификации `setTotpRequired(false)` уже корректно — 2FA настроена, настройка больше не нужна.

---

## Файлы

| Файл | Изменение |
|------|-----------|
| `server/src/meta/routes/admin.ts` | Строки 187, 277: инвертировать `totpRequired` |
| `admin-dashboard/src/pages/SettingsPage.tsx` | Строки 37-56: переписать логику TotpSetup |
| `admin-dashboard/src/auth/signals.ts` | Строка 11: обновить комментарий |

---

## Проверка

1. `npm run build` — сборка без ошибок
2. `npm run test` — тесты проходят
3. Локальная проверка:
   - Логин в Admin Dashboard
   - Settings показывает «2FA включена» (если уже настроена)
   - Logout → Login → Settings снова показывает «2FA включена»
   - Сброс 2FA в БД (`UPDATE admin_users SET totp_enabled=false, totp_secret_encrypted=NULL`) → логин → Settings показывает кнопку «Настроить 2FA»
4. Коммит в ветку, PR в main
