# Технический долг: Server Monitoring Dashboard

**Beads ID:** slime-arena-monitoring-dashboard
**Обновлено:** 2026-02-04

---

## P2 — После MVP (Phase 2+)

### DEBT-MON-001: Атомарность outbox — rename вместо delete

**Источник:** GPT-5.2 Thinking, ревью v1.6
**Модуль:** Ops (watchdog)

**Проблема:** Текущий поток: watchdog прочитал файл → удалил → выполнил restart → записал result. Если watchdog упадёт между «удалил» и «выполнил restart», команда теряется — файла уже нет, restart не произошёл.

**Решение:** Заменить «удалить файл» на `rename restart-requested → restart-processing`. Удалять `restart-processing` только после успешной записи `restart-result`. При старте watchdog — проверять наличие `restart-processing` и довыполнять.

**Приоритет:** P2 (для MVP допустимо — лишний restart безопаснее потерянного).

---

### DEBT-MON-002: WS аутентификация — token из query в cookie/header

**Источник:** GPT-5.2 Thinking, ревью v1.4
**Модуль:** Core (Phase 2, WebSocket)

**Проблема:** `WS /api/v1/admin/ws?token=<accessToken>` — токен в query попадает в логи прокси (Nginx access log, CDN).

**Решение:** Использовать `Sec-WebSocket-Protocol` или cookie для передачи токена при WS handshake.

**Приоритет:** P2 (решить до реализации Phase 2 WebSocket).

---

### DEBT-MON-003: Stale outbox-файл при перезапуске watchdog

**Источник:** Gemini, ревью v1.5
**Модуль:** Ops (watchdog)

**Проблема:** Если watchdog упал, не успев обработать `restart-requested`, после перезапуска он не помнит `auditId` последнего restart и выполнит команду повторно.

**Решение:** Персистировать `lastAuditId` в файл (`/opt/slime-arena/shared/.watchdog-state`). При старте — читать. Альтернатива: DEBT-MON-001 (rename flow) решает эту проблему побочно.

**Приоритет:** P2 (для MVP лишний restart допустим).
