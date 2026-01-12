# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**База:** main (12 января 2026)
**Релиз:** v0.4.0
**GDD версия:** 3.3.2
**Текущая ветка:** main
**Soft Launch Status:** ✅ READY (6/6 критериев выполнено)

### Локальная сеть (dev)
- Vite HMR теперь настраивается через переменные окружения `VITE_HMR_HOST`/`VITE_HMR_PROTOCOL` для работы с мобильными клиентами по LAN.
- Переменные читаются из `.env.local` через `loadEnv()`.
- Документация добавлена в README.md (раздел "Доступ с мобильных устройств").

### Фокус сессии

- **[В РАБОТЕ] PR #74: Env-based HMR config:**
  - ✅ vite.config.ts: функциональный конфиг с loadEnv()
  - ✅ README.md: обновлён порт 5174 + документация HMR env vars
  - ✅ Codex P2: loadEnv вместо process.env для поддержки .env файлов
  - ✅ Copilot: порт 5173 → 5174 в документации

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

---

*Полная история изменений доступна в progress.md*
