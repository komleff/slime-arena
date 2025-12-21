# Архитектура проекта Slime Arena

## Содержание

1. [Обзор](#обзор)
2. [Выбор технологического стека](#выбор-технологического-стека)
3. [Архитектура игры](#архитектура-игры)
4. [Структура модулей](#структура-модулей)
5. [Системы игры](#системы-игры)
6. [Паттерны проектирования](#паттерны-проектирования)
7. [Производительность](#производительность)
8. [Масштабируемость](#масштабируемость)

## Обзор

Slime Arena - это аркадная игра-арена, где игрок сражается с волнами слаймов. Архитектура должна обеспечивать:
- Высокую производительность игрового цикла
- Простоту добавления новых врагов и механик
- Модульность и возможность переиспользования кода
- Легкость тестирования

## Выбор технологического стека

### Вариант 1: JavaScript/TypeScript + Phaser 3 (Рекомендуется)

**Преимущества:**
- Быстрая разработка и прототипирование
- Мощный игровой движок с богатым функционалом
- Кроссплатформенность (браузер, мобильные через Cordova/Capacitor)
- Большое сообщество и документация
- TypeScript для типобезопасности

**Технологии:**
- **Язык**: TypeScript
- **Движок**: Phaser 3
- **Сборка**: Vite или Webpack
- **Тесты**: Jest + @testing-library
- **Линтеры**: ESLint + Prettier

**Структура проекта:**
```
slime-arena/
├── src/
│   ├── config/          # Конфигурация игры
│   ├── entities/        # Игровые сущности
│   ├── scenes/          # Сцены Phaser
│   ├── systems/         # Игровые системы
│   ├── ui/              # UI компоненты
│   ├── utils/           # Вспомогательные функции
│   └── main.ts          # Точка входа
├── assets/              # Игровые ресурсы
├── tests/               # Тесты
└── public/              # Статические файлы
```

### Вариант 2: Python + Pygame

**Преимущества:**
- Простота изучения
- Хорошо для обучения разработке игр
- Быстрое прототипирование

**Технологии:**
- **Язык**: Python 3.11+
- **Фреймворк**: Pygame
- **Тесты**: pytest
- **Линтеры**: pylint, black, mypy

**Структура проекта:**
```
slime-arena/
├── slime_arena/
│   ├── config/          # Конфигурация
│   ├── entities/        # Игровые объекты
│   ├── scenes/          # Сцены игры
│   ├── systems/         # Системы
│   ├── utils/           # Утилиты
│   └── main.py          # Точка входа
├── assets/              # Ресурсы
└── tests/               # Тесты
```

### Вариант 3: Unity + C#

**Преимущества:**
- Профессиональный игровой движок
- Отличные инструменты разработки
- Легкий экспорт на все платформы
- Визуальный редактор

**Недостатки:**
- Более сложная настройка CI/CD
- Больше размер финального билда
- Требует Unity установленный локально

## Архитектура игры

### Общая архитектура (Entity-Component-System)

```
┌─────────────────────────────────────────────────────┐
│                   Game Loop                         │
│  ┌──────────────────────────────────────────────┐  │
│  │  Update (dt) → Render → Repeat               │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │  Scenes  │    │ Systems  │    │ Entities │
  └──────────┘    └──────────┘    └──────────┘
        │                │                │
        │                │                │
    ┌───┴────┐       ┌───┴────┐      ┌───┴────┐
    │ Menu   │       │Physics │      │ Player │
    │ Game   │       │Collision│     │ Enemy  │
    │GameOver│       │ Input  │      │Projectile│
    └────────┘       └────────┘      └────────┘
```

### Слоистая архитектура

```
┌────────────────────────────────────┐
│     Presentation Layer             │  UI, Rendering
├────────────────────────────────────┤
│     Game Logic Layer               │  Game Rules, State
├────────────────────────────────────┤
│     Systems Layer                  │  Physics, Collision
├────────────────────────────────────┤
│     Entity Layer                   │  Game Objects
├────────────────────────────────────┤
│     Core Layer                     │  Engine, Utils
└────────────────────────────────────┘
```

## Структура модулей

### 1. Core Module (Ядро)

**Ответственность**: Базовая функциональность, используемая всеми модулями

```typescript
// core/GameEngine.ts
class GameEngine {
    private running: boolean;
    private lastTime: number;
    
    start(): void;
    stop(): void;
    update(deltaTime: number): void;
    render(): void;
}

// core/EventBus.ts
class EventBus {
    on(event: string, callback: Function): void;
    emit(event: string, data?: any): void;
    off(event: string, callback: Function): void;
}
```

### 2. Entity Module (Сущности)

**Ответственность**: Игровые объекты и их поведение

```typescript
// entities/Entity.ts
abstract class Entity {
    id: string;
    position: Vector2;
    velocity: Vector2;
    
    abstract update(dt: number): void;
    abstract render(context: RenderContext): void;
}

// entities/Player.ts
class Player extends Entity {
    health: number;
    maxHealth: number;
    speed: number;
    weapon: Weapon;
    
    takeDamage(amount: number): void;
    shoot(direction: Vector2): void;
    move(direction: Vector2): void;
}

// entities/Enemy.ts
abstract class Enemy extends Entity {
    health: number;
    damage: number;
    scoreValue: number;
    
    abstract attackPlayer(player: Player): void;
}

// entities/Slime.ts
class BasicSlime extends Enemy {
    // Базовый слайм - простой враг
}

class FastSlime extends Enemy {
    // Быстрый слайм
}

class TankSlime extends Enemy {
    // Медленный, но выносливый слайм
}
```

### 3. Systems Module (Системы)

**Ответственность**: Обработка логики, не привязанной к конкретным сущностям

```typescript
// systems/PhysicsSystem.ts
class PhysicsSystem {
    update(entities: Entity[], dt: number): void {
        // Обновление позиций на основе скорости
        // Применение гравитации (если нужно)
    }
}

// systems/CollisionSystem.ts
class CollisionSystem {
    checkCollisions(entities: Entity[]): CollisionPair[] {
        // Broad phase: Space partitioning (QuadTree)
        // Narrow phase: Precise collision detection
    }
    
    resolveCollision(a: Entity, b: Entity): void {
        // Разрешение столкновений
    }
}

// systems/AISystem.ts
class AISystem {
    update(enemies: Enemy[], player: Player, dt: number): void {
        // Поиск пути
        // Принятие решений
        // Выполнение действий
    }
}

// systems/SpawnSystem.ts
class SpawnSystem {
    private waveNumber: number;
    private enemiesAlive: number;
    
    update(dt: number): void {
        // Спаун врагов волнами
        // Увеличение сложности
    }
}

// systems/InputSystem.ts
class InputSystem {
    private keys: Map<string, boolean>;
    private mouse: MouseState;
    
    update(): void {
        // Обработка ввода
        // Генерация команд
    }
    
    getCommand(): Command | null {
        // Паттерн Command
    }
}
```

### 4. Scenes Module (Сцены)

**Ответственность**: Управление состоянием игры

```typescript
// scenes/Scene.ts
abstract class Scene {
    abstract init(): void;
    abstract update(dt: number): void;
    abstract render(): void;
    abstract destroy(): void;
}

// scenes/MenuScene.ts
class MenuScene extends Scene {
    // Главное меню
    // Настройки
    // Таблица лидеров
}

// scenes/GameScene.ts
class GameScene extends Scene {
    private player: Player;
    private enemies: Enemy[];
    private systems: System[];
    
    // Основной геймплей
}

// scenes/GameOverScene.ts
class GameOverScene extends Scene {
    // Экран завершения игры
    // Итоговая статистика
}
```

### 5. UI Module (Пользовательский интерфейс)

```typescript
// ui/HUD.ts
class HUD {
    displayHealth(health: number, maxHealth: number): void;
    displayScore(score: number): void;
    displayWave(wave: number): void;
}

// ui/Menu.ts
class Menu {
    // Меню паузы
    // Настройки
}
```

## Системы игры

### Игровой цикл

```typescript
class Game {
    private scene: Scene;
    private systems: System[];
    
    gameLoop(currentTime: number): void {
        const deltaTime = currentTime - this.lastTime;
        
        // Обработка ввода
        this.inputSystem.update();
        
        // Обновление систем
        this.systems.forEach(system => {
            system.update(deltaTime);
        });
        
        // Обновление сцены
        this.scene.update(deltaTime);
        
        // Рендеринг
        this.scene.render();
        
        // Следующий кадр
        this.lastTime = currentTime;
        requestAnimationFrame(this.gameLoop.bind(this));
    }
}
```

### Система столкновений с QuadTree

```typescript
class QuadTree {
    private boundary: Rectangle;
    private capacity: number;
    private entities: Entity[];
    private divided: boolean;
    
    insert(entity: Entity): boolean {
        // Вставка объекта в дерево
    }
    
    query(range: Rectangle): Entity[] {
        // Получение объектов в области
    }
    
    private subdivide(): void {
        // Разделение узла на 4 части
    }
}
```

### Система спауна волн

```typescript
interface WaveConfig {
    enemyTypes: Array<{
        type: typeof Enemy;
        count: number;
        spawnDelay: number;
    }>;
    waveDelay: number;
}

class WaveManager {
    private currentWave: number = 0;
    private waves: WaveConfig[];
    
    startNextWave(): void {
        this.currentWave++;
        const config = this.generateWaveConfig(this.currentWave);
        this.spawnWave(config);
    }
    
    private generateWaveConfig(waveNumber: number): WaveConfig {
        // Генерация конфигурации волны
        // Масштабирование сложности
    }
}
```

## Паттерны проектирования

### 1. Observer Pattern (Система событий)

```typescript
// Использование для коммуникации между компонентами
eventBus.on('enemy:killed', (enemy: Enemy) => {
    score.add(enemy.scoreValue);
    particles.emit(enemy.position);
});

eventBus.on('player:hit', (damage: number) => {
    player.takeDamage(damage);
    camera.shake();
});
```

### 2. Object Pool Pattern (Пул объектов)

```typescript
class ObjectPool<T> {
    private available: T[] = [];
    private inUse: Set<T> = new Set();
    
    acquire(): T {
        if (this.available.length > 0) {
            const obj = this.available.pop()!;
            this.inUse.add(obj);
            return obj;
        }
        return this.create();
    }
    
    release(obj: T): void {
        this.inUse.delete(obj);
        this.available.push(obj);
        this.reset(obj);
    }
    
    protected abstract create(): T;
    protected abstract reset(obj: T): void;
}

// Использование для снарядов, частиц, врагов
const projectilePool = new ProjectilePool(100);
```

### 3. State Pattern (Состояния игры)

```typescript
interface GameState {
    enter(): void;
    update(dt: number): void;
    exit(): void;
}

class PlayingState implements GameState {
    enter(): void { /* Начало игры */ }
    update(dt: number): void { /* Игровой процесс */ }
    exit(): void { /* Выход из игры */ }
}

class PausedState implements GameState {
    enter(): void { /* Пауза */ }
    update(dt: number): void { /* Меню паузы */ }
    exit(): void { /* Возврат в игру */ }
}
```

### 4. Command Pattern (Команды)

```typescript
interface Command {
    execute(player: Player): void;
}

class MoveCommand implements Command {
    constructor(private direction: Vector2) {}
    execute(player: Player): void {
        player.move(this.direction);
    }
}

class ShootCommand implements Command {
    constructor(private direction: Vector2) {}
    execute(player: Player): void {
        player.shoot(this.direction);
    }
}
```

### 5. Factory Pattern (Создание врагов)

```typescript
class EnemyFactory {
    create(type: EnemyType, position: Vector2): Enemy {
        switch(type) {
            case EnemyType.BASIC:
                return new BasicSlime(position);
            case EnemyType.FAST:
                return new FastSlime(position);
            case EnemyType.TANK:
                return new TankSlime(position);
            default:
                throw new Error(`Unknown enemy type: ${type}`);
        }
    }
}
```

## Производительность

### Оптимизации

1. **Object Pooling** - переиспользование объектов
2. **Spatial Partitioning** - QuadTree для столкновений
3. **Dirty Flag** - обновление только изменившихся объектов
4. **Level of Detail** - упрощение отдаленных объектов
5. **Culling** - не рендерить объекты за кадром

### Метрики производительности

- **FPS**: минимум 60 FPS на целевых платформах
- **Update time**: < 10ms на кадр
- **Draw calls**: < 100 на кадр
- **Memory usage**: < 200MB

### Профилирование

```typescript
class Profiler {
    private metrics: Map<string, number[]> = new Map();
    
    start(label: string): void {
        performance.mark(`${label}-start`);
    }
    
    end(label: string): void {
        performance.mark(`${label}-end`);
        performance.measure(label, `${label}-start`, `${label}-end`);
    }
    
    report(): void {
        // Вывод статистики производительности
    }
}
```

## Масштабируемость

### Добавление новых типов врагов

```typescript
// 1. Создать класс врага
class NewEnemy extends Enemy {
    // Реализация
}

// 2. Добавить в фабрику
// 3. Добавить в конфигурацию волн
// 4. Готово!
```

### Добавление новых систем

```typescript
// 1. Реализовать интерфейс System
class NewSystem implements System {
    update(dt: number): void {
        // Логика системы
    }
}

// 2. Зарегистрировать в игре
game.addSystem(new NewSystem());
```

### Модификация игрового процесса

```typescript
// Конфигурационные файлы для:
// - Баланса игры
// - Волн врагов
// - Характеристик оружия
// - Настроек сложности

// config/balance.json
{
    "player": {
        "health": 100,
        "speed": 200,
        "damageMultiplier": 1.0
    },
    "enemies": {
        "basicSlime": {
            "health": 30,
            "speed": 50,
            "damage": 10
        }
    }
}
```

## Заключение

Предложенная архитектура обеспечивает:
- ✅ Модульность и разделение ответственности
- ✅ Простоту добавления нового контента
- ✅ Высокую производительность
- ✅ Возможность тестирования
- ✅ Масштабируемость проекта

Рекомендуется начать с варианта TypeScript + Phaser 3 для быстрого прототипирования и последующего развития проекта.
