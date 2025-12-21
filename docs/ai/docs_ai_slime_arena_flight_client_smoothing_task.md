# SlimeArena Flight — Client Smoothing Task (AI Coder)

**Куда положить:** `docs/ai/SlimeArena_Flight_Client_Smoothing_Task.md`

**Как использовать:**
1) Сначала отправить ИИ‑кодеру `docs/ai/SlimeArena_Flight_AI_Coder_Prompt.md`.
2) Затем отправить этот файл.
3) Приложить/вставить ТЗ **“SlimeArena Flight TZ (Merged)”**.

---

## ЗАДАЧА

Реализовать клиентское сетевое сглаживание для сущностей слаймов по разделу 13 ТЗ.

### Требования
1) Реализовать конфиг `ClientNetSmoothingConfig` (клиентский):
- `lookAheadMs`, `maxDeviationM`, `catchUpMin`, `catchUpMax`, `maxExtrapolationMs`, `transitionDurationMs`, `angleMaxDeviationRad`

2) Реализовать модули:
- `SnapshotStore` — хранение последних снапшотов, доступ к актуальному
- `PredictionEngine` — расчёт `targetPos` и режимы экстраполяции/затухания
- `HermiteSpline` — интерполяция позиции (кубическая Эрмита)
- `EntitySmoother` — применение сглаживания к render‑state

3) Логика позиции (каждый кадр):
- `targetPos = snapshot.pos + snapshot.vel * ((t + lookAheadMs)/1000)`
- Эрмит до `targetPos` с учётом `snapshot.vel`
- `catchUpFactor` как функция `dev = |renderPos - targetPos|` между `catchUpMin..catchUpMax`
- если `dev > maxDeviationM`: быстрое выравнивание за 2–3 кадра (без телепорта)

4) Пропуски снапшотов:
- до `maxExtrapolationMs`: экстраполяция
- после: затухание скорости к нулю за `transitionDurationMs`

5) Угол (приоритет точности):
- разность углов нормализовать в `[-π..π]`
- угол догонять быстрее позиции
- если `|deltaAngle| > angleMaxDeviationRad`: повышенное догоняние

### Ограничения
- Не менять серверную симуляцию.
- Не добавлять автоприцел/цели.

### Ожидаемый результат
- Список файлов и назначение.
- Реализация модулей.
- Мини‑демо/инструмент отладки (dev‑режим): отображение `dev`, режима (interp/extrap/fade), и текущего `catchUpFactor`.

