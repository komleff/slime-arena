# SlimeArena Flight — MVP Server Task (AI Coder)

**Куда положить:** `docs/ai/SlimeArena_Flight_MVP_Server_Task.md`

**Как использовать:**
1) Сначала отправить ИИ‑кодеру `docs/ai/SlimeArena_Flight_AI_Coder_Prompt.md`.
2) Затем отправить этот файл.
3) Затем приложить/вставить ТЗ **“SlimeArena Flight TZ (Merged)”**.

---

## ЗАДАЧА

Реализовать серверный MVP системы движения слаймов по ТЗ.

### Обязательные подсистемы
1) **Конфиги и валидация**
- `SlimeConfig`, `WorldPhysicsConfig`
- конвертация Deg→Rad при загрузке
- валидатор: диапазоны, предупреждения про рассинхрон сил/ускорений

2) **Input pipeline**
- приём `inputSeq`, хранение `latestInput`
- `inputTimeoutMs` → отсутствие ввода
- deadzone на сервере

3) **SlimeFlightAssistSystem**
- формирование локальных `F_forward`, `F_right`, `τ` по разделу 9
- антиосцилляции yaw
- переключение 9.6/9.7 через `yawCmdEps`
- drift‑brake / overspeed‑brake / angular damping

4) **SlimePhysicsSystem**
- drag по 7.2
- Semi‑Implicit Euler по 10.2
- правило изменения массы по 10.3 (vel/angVel сохраняются)

5) **CollisionSystem**
- circle–circle: импульс + позиционная коррекция, `maxPositionCorrectionM`
- circle–bounds: rectangle/circle
- итерационный решатель `solverIterations`

6) **Server tick pipeline**
- фиксированный `dt=1/30`
- порядок: Assist → Physics → Collision
- снапшот: `pos, vel, angle, angVel, mass, radius`

### Тесты (smoke‑suite)
Минимум реализовать автоматические проверки по критериям приёмки ТЗ:
- drift‑brake timing (±20%)
- overspeed: возврат к лимиту за 1–3 сек без резкого клэмпа
- hold limit: ≤5% превышение
- mass x10: поведение по кривым
- коллизии: penetration в допуске, restitution работает

### Ограничения
- Не писать клиентское сглаживание в этой задаче.
- Не добавлять фичи вне ТЗ.

### Ожидаемый результат
- Список файлов и их назначение.
- Полный код модулей.
- Команды для запуска тестов.
- Краткая заметка (1–2 абзаца): где в коде точка расширения под клиентское сглаживание.

