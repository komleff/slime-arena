# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**База:** main (v0.7.3)
**GDD версия:** 3.3.2
**Sprint 14 Status:** ✅ ЗАВЕРШЁН — v0.7.0 released
**Sprint 15 Status:** ✅ ЗАВЕРШЁН — PR#112 merged (v0.7.1-dev)
**Sprint 16 Status:** ✅ ЗАВЕРШЁН — PR#115 merged (v0.7.3)

---

## 🎯 Sprint 16 — OAuth для Standalone (ЗАВЕРШЁН)

**Ветка:** sprint-16/oauth-standalone → main
**PR:** #115 (merged)
**Версия:** 0.7.3
**Цель:** Google/Yandex OAuth авторизация для Standalone платформы

### Выполненные задачи

| Компонент | Статус |
|-----------|--------|
| Google OAuth Provider | ✅ |
| Yandex OAuth Provider | ✅ |
| OAuthProviderFactory | ✅ |
| GeoIP Service | ✅ |
| OAuth Upgrade Flow | ✅ |
| OAuth Conflict Modal | ✅ |
| NicknameConfirmModal | ✅ |
| Rating initialization | ✅ |
| Rating accumulation | ✅ |

### Final Review (5 reviewers)

| Reviewer | Verdict |
|----------|---------|
| Copilot | ✅ CLEAN |
| Opus | ⚠️ P1 issues → tech debt |
| Gemini | ✅ APPROVED |
| Codex | ✅ APPROVED |
| Lingma | ✅ APPROVED |

---

## 📋 Tech Debt для Sprint 17

| Beads ID | Priority | Description |
|----------|----------|-------------|
| slime-arena-9zu | P2 | GeoIP: HTTPS вместо HTTP |
| slime-arena-b1b | P1 | PKCE валидация на сервере |
| slime-arena-5tp | P1 | UNKNOWN регион: отключить Google |
| slime-arena-3ed | P1 | Rate limiting на /auth/* |
| slime-arena-2q0 | P1 | Nickname validation в /auth/upgrade |
| slime-arena-b48 | P1 | Accessibility: Escape + focus trap |
| slime-arena-k8w | P2 | Скин слайма не сохраняется после OAuth |

---

## 🎯 Sprint 14 — Meta Integration (ЗАВЕРШЁН)

**Цель:** Интеграция клиента с meta-сервером (v0.7.0)

---

## 🎯 Sprint 15 — Production Readiness (ЗАВЕРШЁН)

**Цель:** Platform Adapters + Production Readiness (v0.7.1-dev)

---

## Команды

```bash
# Разработка
npm run dev:server      # ws://localhost:2567
npm run dev:client      # http://localhost:5174

# Тесты и сборка
npm run test
npm run build

# Beads
bd ready                 # Доступные задачи
bd list --status=open    # Все открытые
```
