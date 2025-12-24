# U2-стиль сглаживания: предиктивная визуализация

**Версия:** 1.0  
**Дата:** декабрь 2025  
**Статус:** реализовано  

---

## 1. Обзор

Система сглаживания в Slime Arena основана на подходе из игры U2 (FA:Mobile). Ключевой принцип: **визуальное состояние (visual state)** отделено от **серверного состояния** и плавно «догоняет» целевую точку.

### 1.1. Почему U2-стиль?

Классическая интерполяция между снапшотами имеет проблемы:
- **Задержка:** рендер всегда «в прошлом» на N миллисекунд
- **Рывки:** при потере пакетов или джиттере
- **Сложность:** нужно хранить и синхронизировать несколько снапшотов

U2-стиль решает эти проблемы:
- **Один снапшот:** используем только последний полученный
- **Предсказание:** экстраполируем на `lookAheadMs` вперёд
- **Плавность:** visual state сам движется, корректируя ошибку постепенно

### 1.2. Ключевое отличие

| Аспект | Классическая интерполяция | U2-стиль |
|--------|--------------------------|----------|
| Буфер снапшотов | 3-6 | 1 (последний) |
| Рендер-время | В прошлом | В настоящем/будущем |
| Движение | Интерполяция A→B | Visual state + catch-up |
| Потеря пакетов | Экстраполяция/замедление | Плавное продолжение |
| Сложность | Высокая | Низкая |

---

## 2. Архитектура

### 2.1. Структура данных

```typescript
type VisualEntity = {
    x: number;       // Визуальная позиция X
    y: number;       // Визуальная позиция Y
    vx: number;      // Интерполированная скорость X
    vy: number;      // Интерполированная скорость Y
    angle: number;   // Визуальный угол
    lastUpdateMs: number;  // Время последнего обновления
};

// Хранилище визуальных состояний
const visualPlayers = new Map<string, VisualEntity>();
const visualOrbs = new Map<string, VisualEntity>();
```

### 2.2. Константы сглаживания

```typescript
// Вес интеграции скорости vs catch-up коррекции
// 0 = только catch-up, 1 = только интеграция velocity
// Оптимально 0.6-0.8 для Slime Arena
const VELOCITY_WEIGHT = 0.7;

// Скорость догоняния (единиц/сек на единицу ошибки)
const CATCH_UP_SPEED = 10.0;

// Максимальная скорость коррекции (м/с)
const MAX_CATCH_UP_SPEED = 800;

// Порог телепорта (метры) - если ошибка больше, мгновенный перенос
const TELEPORT_THRESHOLD = 100;

// Скорость догоняния угла (рад/сек на радиан ошибки)
const ANGLE_CATCH_UP_SPEED = 12.0;
```

### 2.3. Конфигурация в balance.json

```json
{
  "clientNetSmoothing": {
    "lookAheadMs": 150
  }
}
```

**lookAheadMs** — единственный параметр из конфига. Остальные константы захардкожены в клиенте для простоты и оптимальности.

---

## 3. Алгоритм smoothStep

### 3.1. Псевдокод

```
1. Рассчитать ошибку позиции (error = расстояние от visual до target)
2. Если error > TELEPORT_THRESHOLD: телепорт
3. Интегрировать velocity: velocityMove = targetV * dt
4. Рассчитать коррекцию: correction = направление_к_цели * catchUpSpeed * dt
5. Комбинировать: visual += velocityMove * VELOCITY_WEIGHT + correction * (1 - VELOCITY_WEIGHT)
6. Интерполировать visual.velocity к целевой
7. Сгладить угол с ANGLE_CATCH_UP_SPEED
```

### 3.2. Реализация (client/src/main.ts)

```typescript
const smoothStep = (
    visual: VisualEntity,
    targetX: number,
    targetY: number,
    targetVx: number,
    targetVy: number,
    targetAngle: number,
    dtSec: number
): void => {
    // Calculate position error
    const dx = targetX - visual.x;
    const dy = targetY - visual.y;
    const error = Math.sqrt(dx * dx + dy * dy);
    
    // Teleport if error is too large (e.g., respawn)
    if (error > TELEPORT_THRESHOLD) {
        visual.x = targetX;
        visual.y = targetY;
        visual.vx = targetVx;
        visual.vy = targetVy;
        visual.angle = targetAngle;
        return;
    }
    
    // Интегрируем целевую velocity (предсказуемое движение по серверной скорости)
    // Используем targetVx, а не visual.vx, чтобы первый кадр был корректным
    const velocityMoveX = targetVx * dtSec;
    const velocityMoveY = targetVy * dtSec;
    
    // Вычисляем catch-up коррекцию (устранение ошибки)
    let correctionX = 0;
    let correctionY = 0;
    if (error > 0.01) {
        const catchUpSpeed = Math.min(error * CATCH_UP_SPEED, MAX_CATCH_UP_SPEED);
        correctionX = (dx / error) * catchUpSpeed * dtSec;
        correctionY = (dy / error) * catchUpSpeed * dtSec;
        
        // Don't overshoot
        if (Math.abs(correctionX) > Math.abs(dx)) correctionX = dx;
        if (Math.abs(correctionY) > Math.abs(dy)) correctionY = dy;
    }
    
    // Комбинируем движение и коррекцию (сумма весов = 1.0)
    visual.x += velocityMoveX * VELOCITY_WEIGHT + correctionX * (1 - VELOCITY_WEIGHT);
    visual.y += velocityMoveY * VELOCITY_WEIGHT + correctionY * (1 - VELOCITY_WEIGHT);
    
    // Интерполируем visual velocity к серверной (для следующей итерации)
    const velocityLerp = clamp(dtSec * 8, 0, 1);
    visual.vx = lerp(visual.vx, targetVx, velocityLerp);
    visual.vy = lerp(visual.vy, targetVy, velocityLerp);
    
    // Сглаживание угла
    const angleDelta = wrapAngle(targetAngle - visual.angle);
    const angleError = Math.abs(angleDelta);
    if (angleError > 0.001) {
        const angleCatchUp = Math.min(angleError * ANGLE_CATCH_UP_SPEED, Math.PI * 4) * dtSec;
        if (angleCatchUp >= angleError) {
            visual.angle = targetAngle;
        } else {
            visual.angle = wrapAngle(visual.angle + Math.sign(angleDelta) * angleCatchUp);
        }
    }
};
```

---

## 4. Вычисление целевой точки

### 4.1. Экстраполяция на lookAhead

```typescript
const getSmoothedRenderState = (nowMs: number): RenderState | null => {
    const newest = snapshotBuffer[snapshotBuffer.length - 1];
    const lookAheadSec = lookAheadMs / 1000;
    
    for (const [id, player] of newest.players.entries()) {
        // Целевая позиция = серверная + velocity * lookAhead
        const targetX = player.x + player.vx * lookAheadSec;
        const targetY = player.y + player.vy * lookAheadSec;
        const targetAngle = wrapAngle(player.angle + player.angVel * lookAheadSec);
        
        // Сглаживаем visual к цели
        smoothStep(visual, targetX, targetY, player.vx, player.vy, targetAngle, dtSec);
    }
};
```

### 4.2. Почему lookAhead = 150ms?

- **Компенсация сетевой задержки:** снапшот «из прошлого» на ~50-100ms
- **Предсказуемость:** при постоянной скорости позиция почти точная
- **Резерв:** небольшой запас на джиттер

---

## 5. Особенности реализации

### 5.1. Отдельная обработка сущностей

**Игроки (slimes):**
- Полное сглаживание позиции, скорости и угла
- Угол важен для боёвки (пасть/хвост)
- `ANGLE_CATCH_UP_SPEED = 12.0` — быстрее позиции

**Пузыри (orbs):**
- Упрощённое сглаживание только позиции
- Скорость копируется напрямую
- `CATCH_UP_SPEED * 1.5` — быстрее догоняют

**Сундуки (chests):**
- Без сглаживания — напрямую из снапшота
- Редко и медленно двигаются

### 5.2. Удаление исчезнувших сущностей

```typescript
// Чистим visual state для удалённых игроков
for (const id of visualPlayers.keys()) {
    if (!newest.players.has(id)) {
        visualPlayers.delete(id);
    }
}
```

### 5.3. Инициализация новых сущностей

При первом появлении сущности visual state инициализируется серверной позицией:

```typescript
if (!visual) {
    visual = {
        x: player.x,
        y: player.y,
        vx: player.vx,
        vy: player.vy,
        angle: player.angle,
        lastUpdateMs: nowMs,
    };
    visualPlayers.set(id, visual);
}
```

---

## 6. Сравнение с предыдущей реализацией

### 6.1. Что было удалено

| Параметр | Назначение | Статус |
|----------|-----------|--------|
| `maxDeviationM` | Макс. отклонение для ускоренной коррекции | Заменено на TELEPORT_THRESHOLD |
| `catchUpMin/catchUpMax` | Диапазон скорости догоняния | Заменено на CATCH_UP_SPEED + MAX |
| `maxExtrapolationMs` | Лимит экстраполяции без снапшотов | Не нужно (visual сам движется) |
| `transitionDurationMs` | Время затухания при потере пакетов | Не нужно |
| `angleMaxDeviationRad` | Лимит угловой девиации | Не нужно |

### 6.2. Преимущества U2-подхода

1. **Простота:** меньше параметров, меньше багов
2. **Плавность:** velocity integration даёт естественное движение
3. **Отзывчивость:** lookAhead компенсирует задержку
4. **Стабильность:** нет зависимости от количества снапшотов

---

## 7. Тюнинг параметров

### 7.1. VELOCITY_WEIGHT

| Значение | Поведение |
|----------|-----------|
| 0.0 | Только catch-up (как lerp к цели) |
| 0.5 | Баланс точности и плавности |
| 0.7 | **Рекомендовано** — точное направление движения |
| 1.0 | Только velocity (может накапливать ошибку) |

### 7.2. CATCH_UP_SPEED

| Значение | Поведение |
|----------|-----------|
| 5.0 | Очень плавно, может отставать |
| 10.0 | **Рекомендовано** — быстрая коррекция без рывков |
| 20.0 | Агрессивно, может дёргаться |

### 7.3. lookAheadMs

| Значение | Поведение |
|----------|-----------|
| 50 | Минимальная экстраполяция |
| 150 | **Рекомендовано** — баланс |
| 300 | Сильное предсказание, может промахиваться |

---

## 8. Связанные файлы

| Файл | Роль |
|------|------|
| [client/src/main.ts](../../../client/src/main.ts) | Реализация smoothStep и getSmoothedRenderState |
| [shared/src/config.ts](../../../shared/src/config.ts) | Тип ClientNetSmoothingConfig |
| [config/balance.json](../../../config/balance.json) | lookAheadMs |

---

## 9. История изменений

### v1.0 (декабрь 2025)
- Первая реализация U2-стиля
- Удалены устаревшие параметры из ClientNetSmoothingConfig
- Добавлена интеграция velocity с весом VELOCITY_WEIGHT
- Параметры сглаживания захардкожены в клиенте
