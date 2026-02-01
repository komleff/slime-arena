# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**База:** main (v0.7.3)
**GDD версия:** 3.3.2
**Sprint 14 Status:** ✅ ЗАВЕРШЁН — v0.7.0 released
**Sprint 15 Status:** ✅ ЗАВЕРШЁН — PR#112 merged (v0.7.1-dev)
**Sprint 16 Status:** ✅ ЗАВЕРШЁН — PR#115 merged (v0.7.3)
**Sprint 17 Status:** 🔄 В РАБОТЕ — PR#116 (LeaderboardScreen + OAuth Hotfix)

---

## 🎯 Sprint 17 — LeaderboardScreen + OAuth Hotfix

**Ветка:** sprint-17/leaderboard-screen
**PR:** #116 (approved, ready to merge)
**Цель:** LeaderboardScreen + критические исправления OAuth

### OAuth Hotfix (2026-02-01)

Все P0/P1 исправления для OAuth авторизации:

| FIX | Описание | Коммит | Статус |
|-----|----------|--------|--------|
| FIX-000 | dotenv в MatchServer | `5659628` | ✅ |
| FIX-001 | Восстановление guest_token без login() | `e50ec1d` | ✅ |
| FIX-002 | Блокировка OAuth без токена | `e50ec1d` | ✅ |
| FIX-005 | Очистка claim токенов | `e50ec1d` | ✅ |
| FIX-006 | setOnUnauthorized после восстановления | `e50ec1d` | ✅ |
| FIX-007 | ProfileSummary в createDefaultProfile | `eaf9f93` | ✅ |
| FIX-009 | Сохранение access_token в localStorage | `8b1b16d` | ✅ |
| FIX-010 | fetchProfile после finishUpgrade | `c161926` | ✅ |

### LeaderboardScreen (частично)

| Компонент | Статус |
|-----------|--------|
| LeaderboardScreen базовый | ✅ |
| Переключатель total/best | ✅ |
| API с myPosition/myValue | ✅ |
| Плашка гостя | ⏳ P2 backlog |
| Миниатюра скина | ⏳ P2 backlog |

### Review Status (PR #116)

| Reviewer | Verdict |
|----------|---------|
| Claude Opus 4.5 | ✅ APPROVED |
| Gemini Code Assist | ✅ APPROVED |
| GPT-5 Codex | ✅ APPROVED |
| Lingma | ✅ APPROVED |
| GitHub Copilot | 💬 COMMENTED (P2/P3) |

### P2 Backlog (следующий спринт)

- FIX-003: base64url нормализация в decodeClaimToken
- FIX-004: Проверка exp токена в гостевой плашке
- LB-013: Миниатюра скина в строке лидерборда
- LB-015: Автозакрытие при нахождении матча

---

## 📋 Tech Debt

| Beads ID | Priority | Description |
|----------|----------|-------------|
| slime-arena-74gx | P2 | Merge anonymous match into existing account |
| slime-arena-9zu | P2 | GeoIP: HTTPS вместо HTTP |
| slime-arena-b1b | P1 | PKCE валидация на сервере |
| slime-arena-5tp | P1 | UNKNOWN регион: отключить Google |
| slime-arena-3ed | P1 | Rate limiting на /auth/* |
| slime-arena-2q0 | P1 | Nickname validation в /auth/upgrade |
| slime-arena-b48 | P1 | Accessibility: Escape + focus trap |
| slime-arena-k8w | P2 | Скин слайма не сохраняется после OAuth |

---

## 🎯 Sprint 16 — OAuth для Standalone (ЗАВЕРШЁН)

**Ветка:** sprint-16/oauth-standalone → main
**PR:** #115 (merged)
**Версия:** 0.7.3
**Цель:** Google/Yandex OAuth авторизация для Standalone платформы

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
