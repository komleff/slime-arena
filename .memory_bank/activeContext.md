# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**База:** main (17 января 2026)
**Релиз:** v0.4.6
**GDD версия:** 3.3.2
**Текущая ветка:** main
**Soft Launch Status:** ✅ READY (6/6 критериев выполнено)

### Локальная сеть (dev)
- Vite HMR теперь настраивается через переменные окружения `VITE_HMR_HOST`/`VITE_HMR_PROTOCOL` для работы с мобильными клиентами по LAN.
- Переменные читаются из `.env.local` через `loadEnv()`.
- Документация добавлена в README.md (раздел "Доступ с мобильных устройств").

### Фокус сессии

- **[ЗАВЕРШЕНО] PR #85: Battle UI improvements v0.4.6 (17 января 2026):**
  - ✅ Стрелка движения рисуется под слаймом
  - ✅ Размер стрелки уменьшен в 2 раза (minLength 15, maxLength 40)
  - ✅ Радиус сектора рта: 1.5 → 1.3
  - ✅ Окна талантов/умений полупрозрачные (0.6/0.5)
  - ✅ Сияние Короля под mouthSector, alpha 0.2+0.05
  - **Beads:** slime-arena-3o8, slime-arena-iqv, slime-arena-4n8, slime-arena-5ix (closed)

- **[В РАБОТЕ] Графика арены — Параллакс-фон (12 января 2026):**
  - ✅ GDD-Art-Architecture v2.0 — архитектура сцены (Layer Cake)
  - ✅ arena.css — базовый CSS параллакс-фона (mobile-optimized)
  - ✅ Mobile-First правила в CLAUDE.md и AGENT_ROLES.md
  - ✅ Ассеты организованы (19 файлов)
  - ⏳ slime-arena-duo — интеграция в main.ts (для Developer)
  - **Ветка:** `feature/graphics-arena-bg`
  - **PR:** #76

- **[ЗАВЕРШЕНО] PR #74: Env-based HMR config:**
  - ✅ vite.config.ts: функциональный конфиг с loadEnv()
  - ✅ README.md: обновлён порт 5174 + документация HMR env vars

- **[ЗАВЕРШЕНО] AGENT_ROLES v1.4 — Ограничения агентов (12 января 2026):**
  - ✅ Запрет работы с main веткой для всех агентов
  - ✅ Запрет редактирования кода для Art Director
  - ✅ Mobile-First CSS ограничения

- **[ЗАВЕРШЕНО] Графические ассеты UI — Golden Master (11 января 2026):**
  - ✅ Главный экран (LobbyScreen) — полный макет в `assets/main.html`
  - ✅ Jelly Button — CSS-стиль кнопки с 3D-эффектом
  - ✅ HUD профиля — аватар, рамка, бейджи уровней, XP-бар
  - ✅ Валюты — монеты и гемы с hover-анимацией
  - ✅ Иконки меню — настройки, лидеры, гардероб
  - ✅ Персонаж — hero_skin_current с анимацией левитации
  - **Ассеты (26 файлов в assets/):**
    - Фоны: `bg_main_menu.png`, `bg_loading_screen.png`
    - Кнопки: `btn_jelly_*.png` (4 цвета)
    - HUD: `hud_avatar_frame_cookie.png`, `hud_profile_base_chocolate.png`, `hud_level_badge_star_*.png` (4 цвета)
    - Иконки: `icon_menu_*.png`, `icon_currency_*.png`, `icon_alert_cookie.png`, `icon_error_burnt.png`, `icon_wifi_broken.png`
    - Персонаж: `hero_skin_current.png`, `hero_skin_current_alt.png`
  - **Арт-директор (Gemini):** Паспорт проекта Cookie Crash Arena создан

- **[ЗАВЕРШЕНО] PR #61-66: Ads Documentation Improvements (MERGED):**
  - ✅ PR #61: Устранить англицизм "dev-платформы" → "платформы разработки"
  - ✅ PR #62: Добавить русский перевод для parameter placement в JSDoc
  - ✅ PR #63: Добавить русский перевод для "rewarded video" → "(рекламы с вознаграждением)"
  - ✅ PR #64: Добавить русский перевод для "preload API" → "(API предварительной загрузки)"
  - ✅ PR #65: Добавить русский перевод для placement в adsService.ts
  - ✅ PR #66: Добавить русский перевод для placement в IAdsProvider/adsService

- **[ЗАВЕРШЕНО] Sprint 11.2: TalentSystem Integration (PR #57 MERGED):**
  - ✅ slime-arena-eg7 — ArenaRoom refactoring (−418 строк)
  - ✅ recalculateTalentModifiers → делегация в модуль
  - ✅ generateTalentCard → делегация в модуль
  - ✅ Удалены дубли: getTalentConfig, buildAbilityUpgradeId, parseAbilityUpgradeId

- **[ЗАВЕРШЕНО] Sprint 11: Tech Debt Refactoring (PR #56 MERGED):**
  - ✅ 11.1: slime-arena-dm5 — Daemon hooks (auto-commit, auto-push)
  - ✅ 11.2: slime-arena-foh — HUD frequency sync (убран forceUpdate)
  - ✅ 11.3: InputManager module created (558 строк)
  - ✅ 11.4: TalentSystem module created

### ✅ Аудит технического долга (сессия)
Уточнён и актуализирован список техдолга:
- Декомпозиция God Objects (ArenaRoom, main.ts)
- Порог ДХП теперь грузится из balance.json
- Рефакторинг: TalentSystem, InputManager модули созданы
