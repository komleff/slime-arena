# Active Context
Текущее состояние проекта и фокус работы.

## Текущее состояние
Завершена реализация U2-стиля предиктивного сглаживания на клиенте. Ветка `fix/flighttz-smoothing-orb-density` готова к мержу в `main`.

## Последние изменения (24.12.2025)
- **U2-стиль предиктивного сглаживания**:
  - Визуальное состояние отделено от серверного (`visualPlayers`, `visualOrbs`)
  - `smoothStep()` — плавное догоняние цели со скоростью пропорциональной ошибке
  - Предиктивная цель: `server_pos + velocity * lookAheadMs`
  - Телепортация при ошибке > 100м
  - Удалён устаревший код интерполяции между снапшотами
- **Flight-TZ параметры на сервере**:
  - `angularDeadzoneRad`, `yawRateGain`, `reactionTimeS`, `accelTimeS`
  - `velocityErrorThreshold`, `inputMagnitudeThreshold`
  - Overspeed damping для превышения лимитов скорости
- **Плотность орбов**: `density` учитывается в физике отталкивания
- **Фаза Results**: автоматический перезапуск матча после показа результатов

## Ветка fix/flighttz-smoothing-orb-density
Изменённые файлы:
- `client/src/main.ts` — U2-стиль сглаживания
- `server/src/rooms/ArenaRoom.ts` — Flight-TZ, overspeed, density, Results
- `shared/src/config.ts` — новые assist-параметры
- `config/balance.json` — параметры для всех классов

## Ближайшие шаги
- [ ] Создать PR и смержить ветку в `main`
- [ ] Тестирование на мобильных устройствах
- [ ] Тюнинг констант сглаживания (`CATCH_UP_SPEED`, `lookAheadMs`)
