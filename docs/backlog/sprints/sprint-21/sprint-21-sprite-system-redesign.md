# Редизайн системы спрайтов — привязка визуального образа к профилю

## Контекст

**Проблема:** Визуальный спрайт игрока (самурай, пират, дракон и т.д.) определяется хешем имени (`pickSpriteForPlayer(name)`) и никак не связан с профилем. При регистрации «обещанный» спрайт не сохраняется — игрок получает случайный цвет из 4 (`slime_green/blue/red/yellow`). Система цветных скинов (`config/skins.json`) была ошибочно создана вместо привязки реальных спрайтов.

**Цель:** Спрайт, который игрок видит в матче, должен сохраняться в профиле и отображаться в последующих матчах.

## Решение

### 1. Shared: константа SPRITE_NAMES

**Файл:** `shared/src/sprites.ts` (добавить экспорт)

Добавить массив `SPRITE_NAMES` — 21 имя файла спрайта. Используется и на сервере (валидация), и на клиенте (выбор).

### 2. Сервер: spriteId в JoinTokenPayload

**Файл:** `server/src/meta/services/JoinTokenService.ts`

Добавить `spriteId?: string` в `JoinTokenPayload`. Передаётся при join в комнату.

### 3. Сервер: spriteId в Colyseus Player schema

**Файл:** `server/src/rooms/schema/GameState.ts`

Добавить `@type("string") spriteId: string = "";` в класс `Player`.

### 4. Сервер: ArenaRoom передаёт spriteId

**Файл:** `server/src/rooms/ArenaRoom.ts`

При создании Player из JoinTokenPayload — записать `player.spriteId = options.spriteId || ""`.

### 5. Сервер: spriteId в matchJoin

**Файл:** `server/src/meta/routes/matchmaking.ts` (или где создаётся joinToken)

При генерации joinToken включить spriteId из профиля (`profiles.selected_skin_id`).

### 6. Клиент: использовать player.spriteId при рендеринге

**Файл:** `client/src/main.ts`

- В `onAdd`: если `player.spriteId` непустой — использовать его, иначе fallback на `pickSpriteForPlayer(name)`
- В рендеринге: аналогично

### 7. Клиент: сохранять спрайт как guest_skin_id

**Файл:** `client/src/services/authService.ts`

- `generateGuestSkinId()` → выбирать случайный спрайт из `SPRITE_NAMES` вместо 4 цветов
- `getSkinId()` → возвращает имя спрайта

### 8. Сервер: skinId в БД хранит имя спрайта

**Файлы:** `server/src/meta/routes/auth.ts`, `server/src/meta/services/AuthService.ts`

Существующие поля `profiles.selected_skin_id` и `users.registration_skin_id` будут хранить имена спрайтов (например `slime-samurai.webp`) вместо цветов.

### 9. Сервер: валидация spriteId

**Файл:** `server/src/meta/services/AuthService.ts` (или отдельный валидатор)

Проверять что spriteId из `SPRITE_NAMES`. Если невалидный — fallback на случайный.

### 10. Удалить config/skins.json и все ссылки на него

`config/skins.json` — ошибочный артефакт, созданный ИИ-агентами. Удалить файл и все импорты/ссылки на него в коде.

### 11. Хеш-выбор спрайта остаётся для ботов и анонимов

`pickSpriteForPlayer(name)` — детерминистичный выбор по хешу имени — **сохраняется** как дефолтный механизм для ботов и анонимных игроков. Это обеспечивает псевдо-случайное, но стабильное распределение спрайтов.

Для зарегистрированных игроков: при первом матче спрайт вычисляется по хешу имени и сохраняется в профиль. В последующих матчах используется сохранённый `spriteId`.

`generateRandomBasicSkin()` заменить на `pickSpriteForPlayer(nickname)` — тот же хеш-метод, но работающий на сервере через `SPRITE_NAMES`.

## Порядок реализации

1. `shared/src/sprites.ts` — добавить `SPRITE_NAMES`
2. `server/src/rooms/schema/GameState.ts` — добавить `spriteId` в Player
3. `server/src/meta/services/JoinTokenService.ts` — добавить `spriteId` в payload
4. `server/src/rooms/ArenaRoom.ts` — передать spriteId при создании Player
5. `server/src/meta/routes/auth.ts` — использовать спрайты вместо цветов
6. `client/src/services/authService.ts` — спрайты вместо цветов
7. `client/src/main.ts` — рендеринг по `player.spriteId`
8. `client/src/services/matchResultsService.ts` — claimToken со спрайтом
9. Сборка + тесты + ручная проверка

## Верификация

1. `npm run build` — сборка проходит
2. `npm run test` — тесты проходят
3. Локальное тестирование:
   - Гость заходит → получает случайный спрайт из 21
   - В матче видит именно этот спрайт
   - После регистрации спрайт сохраняется
   - Повторный вход → тот же спрайт
4. Проверка LAN-доступа с телефона
