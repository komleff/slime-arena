# Рекомендации по надёжности серверов Slime Arena

## Проблема

Серверы Slime Arena, развёрнутые в production (версия 0.4.2), перестали работать через короткое время после запуска.

## Причина

Отсутствие глобальных обработчиков ошибок (`uncaughtException`, `unhandledRejection`) приводило к краху процесса Node.js при любом необработанном исключении.

### Критические точки отказа

1. **ArenaRoom.onTick()** - вызывается 30 раз в секунду, содержит 15+ систем симуляции
   - Любая ошибка в системе (деление на ноль, null reference) → крах всего сервера
   - Все активные игровые комнаты теряются
   
2. **Отсутствие изоляции ошибок** между комнатами
   - Ошибка в одной комнате убивает все остальные комнаты

3. **Unhandled Promise Rejections**
   - Асинхронные операции (fetch к MetaServer, работа с БД) без обработки ошибок

## Исправления (версия 0.4.3)

### 1. Глобальные обработчики ошибок

**Файл:** `server/src/index.ts` (MatchServer)
```typescript
process.on("uncaughtException", (error: Error) => {
    console.error("[MatchServer] FATAL: Uncaught exception:", error);
    console.error("Stack:", error.stack);
    // Логируем, но НЕ завершаем процесс - другие комнаты продолжают работать
});

process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
    console.error("[MatchServer] FATAL: Unhandled promise rejection:", reason);
    if (reason instanceof Error) {
        console.error("Stack:", reason.stack);
    }
});
```

**Файл:** `server/src/meta/server.ts` (MetaServer)
```typescript
process.on('uncaughtException', (error: Error) => {
  console.error('[MetaServer] FATAL: Uncaught exception:', error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('[MetaServer] FATAL: Unhandled promise rejection:', reason);
  if (reason instanceof Error) {
    console.error('Stack:', reason.stack);
  }
});
```

### 2. Изоляция ошибок в onTick()

**Файл:** `server/src/rooms/ArenaRoom.ts`
```typescript
private onTick() {
    try {
        // Вся логика симуляции
        this.updateMatchPhase();
        this.collectInputs();
        // ... все системы
    } catch (error) {
        console.error(`[ArenaRoom ${this.roomId}] CRITICAL: onTick() error at tick ${this.tick}:`, error);
        if (error instanceof Error) {
            console.error("Stack:", error.stack);
        }
        // НЕ пробрасываем ошибку - комната продолжает работать
    }
}
```

### 3. Graceful Shutdown

**MatchServer:**
```typescript
const shutdown = async () => {
    console.log("[MatchServer] Shutting down gracefully...");
    try {
        await gameServer.gracefullyShutdown();
        console.log("[MatchServer] Shutdown complete");
        process.exit(0);
    } catch (error) {
        console.error("[MatchServer] Error during shutdown:", error);
        process.exit(1);
    }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

## Мониторинг и отладка

### Логи для мониторинга

После внедрения исправлений следите за следующими логами:

1. **Критические ошибки в симуляции:**
   ```
   [ArenaRoom <roomId>] CRITICAL: onTick() error at tick <N>
   ```
   Означает ошибку в одной из систем симуляции. Комната продолжает работать, но нужно найти и исправить баг.

2. **Необработанные исключения:**
   ```
   [MatchServer] FATAL: Uncaught exception:
   [MetaServer] FATAL: Uncaught exception:
   ```
   Означает серьёзную ошибку вне игровой логики. Сервер продолжает работать, но требуется немедленное исправление.

3. **Unhandled Promise Rejections:**
   ```
   [MatchServer] FATAL: Unhandled promise rejection:
   [MetaServer] FATAL: Unhandled promise rejection:
   ```
   Означает ошибку в асинхронной операции (обычно fetch или БД).

### Рекомендации по развёртыванию

1. **Process Manager (PM2):**
   ```bash
   pm2 start server/dist/server/src/index.js --name match-server --max-memory-restart 1G
   pm2 start server/dist/server/src/meta/server.js --name meta-server --max-memory-restart 1G
   ```

2. **Мониторинг памяти:**
   - Добавить алерты на использование памяти >80%
   - Перезапуск при достижении лимита

3. **Health Checks:**
   - MetaServer: `GET /health` (уже реализован)
   - MatchServer: добавить endpoint для проверки

4. **Централизованное логирование:**
   - Настроить сбор логов в ELK/Loki/CloudWatch
   - Алерты на `FATAL:` и `CRITICAL:` в логах

## Дальнейшие улучшения

### Приоритет 1 (Критично)

1. **Детальное логирование ошибок в системах**
   - Добавить try-catch в каждую систему с указанием имени системы
   - Помогает быстро локализовать проблемный код

2. **Health endpoint для MatchServer**
   ```typescript
   app.get('/health', (req, res) => {
       res.json({
           status: 'ok',
           rooms: gameServer.rooms.size,
           uptime: process.uptime(),
       });
   });
   ```

3. **Мониторинг метрик:**
   - Количество активных комнат
   - Количество игроков онлайн
   - Частота ошибок в onTick()
   - Утилизация CPU/памяти

### Приоритет 2 (Важно)

1. **Circuit Breaker для внешних сервисов**
   - MatchResultService: временно отключать отправку при длительных сбоях MetaServer
   - Избегать накопления запросов в очереди

2. **Rate Limiting**
   - Ограничение частоты сообщений от клиентов
   - Защита от DoS атак и багов в клиенте

3. **Memory Leak Detection**
   - Периодический snapshot heap
   - Алерты на рост памяти

### Приоритет 3 (Желательно)

1. **Graceful Room Disposal**
   - Корректная очистка всех ресурсов при закрытии комнаты
   - Отмена pending promises и таймеров

2. **Distributed Tracing**
   - Trace от клиента через MatchServer к MetaServer
   - Помогает отлаживать проблемы с задержками

3. **Автоматическое восстановление**
   - Сохранение состояния комнаты в Redis
   - Возможность переподключения игроков при падении сервера

## Чеклист перед развёртыванием

- [x] Добавлены глобальные обработчики ошибок
- [x] onTick() обёрнут в try-catch
- [x] Graceful shutdown настроен
- [ ] PM2 или аналогичный process manager настроен
- [ ] Логи пишутся в постоянное хранилище
- [ ] Алерты на FATAL/CRITICAL настроены
- [ ] Health checks мониторятся (uptime monitoring)
- [ ] Backup стратегия определена

## Контакты

При возникновении проблем с надёжностью серверов:
1. Проверьте логи на `FATAL:` и `CRITICAL:`
2. Проверьте использование памяти/CPU
3. Проверьте connectivity к PostgreSQL и Redis
4. Проверьте connectivity к MetaServer (если MatchServer падает)

---

**Версия документа:** 1.0  
**Дата:** 13 января 2026  
**Связанные PR:** copilot/review-latest-server-code
