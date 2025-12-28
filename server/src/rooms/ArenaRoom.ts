import { Room, Client } from "colyseus";
import { GameState, Player, Orb, Chest, HotZone, SlowZone, Projectile, Mine, Talent, TalentCard } from "./schema/GameState";
import {
    InputCommand,
    MatchPhaseId,
    getSlimeInertia,
    getSlimeRadiusFromConfig,
    scaleSlimeValue,
    getOrbRadius,
    FLAG_RESPAWN_SHIELD,
    FLAG_ABILITY_SHIELD,
    FLAG_LAST_BREATH,
    FLAG_IS_REBEL,
    FLAG_IS_DEAD,
    FLAG_DASHING,
    FLAG_MAGNETIZING,
    FLAG_SLOWED,
    ResolvedBalanceConfig,
    SlimeConfig,
    generateUniqueName,
    TalentConfig,
} from "@slime-arena/shared";
import { loadBalanceConfig } from "../config/loadBalanceConfig";
import { Rng } from "../utils/rng";

type ContactZone = "mouth" | "tail" | "side";

interface ClassStats {
    radiusMult: number;
    damageMult: number;
    biteResistPct: number;
    swallowLimit: number;
    biteFraction: number;
    eatingPowerMult: number;
}

export class ArenaRoom extends Room<GameState> {
    maxClients = 20;

    private balance!: ResolvedBalanceConfig;
    private rng!: Rng;
    private tick = 0;
    private orbIdCounter = 0;
    private chestIdCounter = 0;
    private hotZoneIdCounter = 0;
    private slowZoneIdCounter = 0;
    private projectileIdCounter = 0;
    private mineIdCounter = 0;
    private lastOrbSpawnTick = 0;
    private lastChestSpawnTick = 0;
    private lastPhaseId: MatchPhaseId | null = null;
    private lastRebelUpdateTick = 0;
    private metricsAccumulatorMs = 0;
    private metricsTickCount = 0;
    private metricsIntervalTicks = 0;
    private metricsMaxTickMs = 0;
    private maxTalentQueue = 3;

    private attackCooldownTicks = 0;
    private invulnerableTicks = 0;
    private biteCooldownTicks = 0;
    private respawnShieldTicks = 0;
    private respawnDelayTicks = 0;
    private orbSpawnIntervalTicks = 0;
    private chestSpawnIntervalTicks = 0;
    private lastBreathTicks = 0;
    private rebelUpdateIntervalTicks = 0;
    private inputTimeoutTicks = 0;
    private resultsDurationTicks = 0;
    private restartDelayTicks = 0;
    private resultsStartTick = 0;
    private isMatchEnded = false;

    onCreate(options: { seed?: number } = {}) {
        this.balance = loadBalanceConfig();
        this.maxClients = this.balance.server.maxPlayers;
        this.rng = new Rng(Number(options.seed ?? Date.now()));

        this.attackCooldownTicks = this.secondsToTicks(this.balance.combat.attackCooldownSec);
        this.invulnerableTicks = this.secondsToTicks(this.balance.combat.damageInvulnSec);
        this.biteCooldownTicks = this.secondsToTicks(this.balance.combat.biteCooldownSec);
        this.respawnShieldTicks = this.secondsToTicks(this.balance.combat.respawnShieldSec);
        this.respawnDelayTicks = this.secondsToTicks(this.balance.death.respawnDelaySec);
        this.orbSpawnIntervalTicks = this.secondsToTicks(this.balance.orbs.respawnIntervalSec);
        this.chestSpawnIntervalTicks = this.secondsToTicks(this.balance.chests.spawnIntervalSec);
        this.lastBreathTicks = this.secondsToTicks(this.balance.combat.lastBreathDurationSec);
        this.rebelUpdateIntervalTicks = this.secondsToTicks(this.balance.rebel.updateIntervalSec);
        this.inputTimeoutTicks = this.msToTicks(this.balance.controls.inputTimeoutMs);
        this.resultsDurationTicks = this.secondsToTicks(this.balance.match.resultsDurationSec);
        this.restartDelayTicks = this.secondsToTicks(this.balance.match.restartDelaySec);
        this.metricsIntervalTicks = this.balance.server.tickRate;

        this.setState(new GameState());
        this.state.phase = "Spawn";
        this.state.timeRemaining = this.balance.match.durationSec;

        this.onMessage("input", (client, data: InputCommand) => {
            const player = this.state.players.get(client.sessionId);
            if (!player || !data) return;

            const seq = Number(data.seq);
            if (!Number.isFinite(seq) || seq <= player.lastProcessedSeq) return;
            player.lastProcessedSeq = seq;

            let moveX = Number(data.moveX);
            let moveY = Number(data.moveY);
            if (!Number.isFinite(moveX)) moveX = 0;
            if (!Number.isFinite(moveY)) moveY = 0;
            moveX = Math.max(-1, Math.min(1, moveX));
            moveY = Math.max(-1, Math.min(1, moveY));
            const length = Math.hypot(moveX, moveY);
            if (length > 1e-6) {
                if (length > 1) {
                    moveX /= length;
                    moveY /= length;
                }
            } else {
                moveX = 0;
                moveY = 0;
            }

            player.inputX = moveX;
            player.inputY = moveY;
            player.lastInputTick = this.tick;

            // Обрабатываем abilitySlot только если он явно передан в пакете
            // Не сбрасываем, если поле отсутствует — чтобы обычные input'ы движения не перезатирали нажатие
            if ("abilitySlot" in data) {
                const abilitySlot = data.abilitySlot;
                if (
                    typeof abilitySlot === "number" &&
                    Number.isInteger(abilitySlot) &&
                    abilitySlot >= 0 &&
                    abilitySlot <= 2
                ) {
                    player.abilitySlotPressed = abilitySlot;
                }
            }

            const talentChoice = data.talentChoice;
            if (
                typeof talentChoice === "number" &&
                Number.isInteger(talentChoice) &&
                talentChoice >= 0 &&
                talentChoice <= 2
            ) {
                player.talentChoicePressed = talentChoice;
            } else {
                player.talentChoicePressed = null;
            }
            
            // Выбор из карточки умений (GDD v3.3 §1.3)
            if ("cardChoice" in data) {
                const cardChoice = data.cardChoice;
                if (
                    typeof cardChoice === "number" &&
                    Number.isInteger(cardChoice) &&
                    cardChoice >= 0 &&
                    cardChoice <= 2
                ) {
                    player.cardChoicePressed = cardChoice;
                }
            }
            
            // Выбор из карточки талантов (GDD-Talents.md)
            if ("talentChoice" in data) {
                const talentChoice = data.talentChoice;
                if (
                    typeof talentChoice === "number" &&
                    Number.isInteger(talentChoice) &&
                    talentChoice >= 0 &&
                    talentChoice <= 2
                ) {
                    player.talentChoicePressed2 = talentChoice;
                }
            }
        });

        this.setSimulationInterval(() => this.onTick(), this.balance.server.simulationIntervalMs);

        this.spawnInitialOrbs();
        console.log("ArenaRoom created!");
    }

    onJoin(client: Client, options: { name?: string; classId?: number } = {}) {
        const player = new Player();
        player.id = client.sessionId;
        // Генерируем юмористическое имя если не указано
        if (options.name && options.name.trim().length > 0) {
            player.name = options.name.trim().slice(0, 24);
        } else {
            // Собираем существующие имена для проверки уникальности
            const existingNames: string[] = [];
            this.state.players.forEach((p) => existingNames.push(p.name));
            
            // Генерируем seed из sessionId игрока, не изменяя состояние RNG симуляции
            let nameSeed = 0;
            for (let i = 0; i < client.sessionId.length; i++) {
                nameSeed = (nameSeed * 31 + client.sessionId.charCodeAt(i)) >>> 0;
            }
            nameSeed = nameSeed % 2147483647;
            player.name = generateUniqueName(nameSeed, existingNames);
        }
        const spawn = this.randomPointInMap();
        player.x = spawn.x;
        player.y = spawn.y;
        player.mass = this.balance.slime.initialMass;
        player.level = this.balance.slime.initialLevel;
        
        // Класс: 0 = Hunter, 1 = Warrior, 2 = Collector
        // Если classId не передан или некорректен, используем случайный класс
        let rawClassId = typeof options.classId === "number" ? options.classId : -1;
        if (rawClassId < 0 || rawClassId > 2) {
            // Используем RNG для случайного выбора класса (детерминированно)
            rawClassId = this.rng.int(0, 3); // int(0,3) → 0,1,2
        }
        player.classId = rawClassId;
        
        // Классовое умение в слот 0 (GDD v3.3 §1.3)
        const classAbilities = ["dash", "shield", "slow"];
        player.abilitySlot0 = classAbilities[player.classId] || "dash";
        player.abilitySlot1 = "";  // Разблокируется на level 3
        player.abilitySlot2 = "";  // Разблокируется на level 5
        player.pendingAbilityCard = null;
        
        player.talentsAvailable = 0;
        player.angle = 0;
        player.angVel = 0;
        player.isDrifting = false;
        player.gcdReadyTick = this.tick;
        player.lastInputTick = this.tick;
        
        // Если матч завершён (фаза Results), игрок ждёт следующий раунд
        // Помечаем как isDead, чтобы не попал в таблицу лидеров текущего матча
        if (this.isMatchEnded || this.state.phase === "Results") {
            player.isDead = true;
        } else {
            player.isDead = false;
        }
        
        this.state.players.set(client.sessionId, player);
        
        // Не обновляем таблицу лидеров если матч завершён
        if (!this.isMatchEnded && this.state.phase !== "Results") {
            this.updateLeaderboard();
        }
        
        client.send("balance", this.balance);
        console.log(`${client.sessionId} joined!`);
    }

    onLeave(client: Client) {
        this.state.players.delete(client.sessionId);
        this.updateLeaderboard();
        console.log(`${client.sessionId} left!`);
    }

    onDispose() {
        console.log("room", this.roomId, "disposing...");
    }

    private onTick() {
        const tickStartMs = Date.now();
        this.tick += 1;
        this.state.serverTick = this.tick;

        this.updateMatchPhase();
        
        // Results phase: полная заморозка симуляции
        if (this.isMatchEnded) {
            // Только обновляем orbs для визуального эффекта (они замедляются)
            this.updateOrbsVisual();
            this.updatePlayerFlags();
            this.reportMetrics(tickStartMs);
            return;
        }
        
        this.collectInputs();
        this.applyInputs();
        this.abilitySystem();
        this.abilityCardSystem();  // GDD v3.3: обработка карточек выбора умений
        this.talentCardSystem();   // GDD-Talents: обработка карточек выбора талантов
        this.updateOrbs();
        this.updateChests();
        this.slowZoneSystem();  // GDD v3.3: до flightAssist чтобы FLAG_SLOWED был актуален
        this.flightAssistSystem();
        this.physicsSystem();
        this.collisionSystem();
        this.projectileSystem();
        this.mineSystem();
        this.chestSystem();
        this.deathSystem();
        this.hungerSystem();
        this.rebelSystem();
        this.updatePlayerFlags();
        this.reportMetrics(tickStartMs);
    }

    private collectInputs() {
        // Inputs are captured in onMessage, nothing else to do here yet.
    }

    private applyInputs() {
        const deadzone = this.balance.controls.joystickDeadzone;
        const timeoutTick = this.inputTimeoutTicks > 0 ? this.tick - this.inputTimeoutTicks : null;
        for (const player of this.state.players.values()) {
            if (player.isDead) {
                player.inputX = 0;
                player.inputY = 0;
                continue;
            }
            if (timeoutTick !== null && player.lastInputTick <= timeoutTick) {
                player.inputX = 0;
                player.inputY = 0;
                continue;
            }

            let x = player.inputX;
            let y = player.inputY;
            const len = Math.hypot(x, y);
            if (len <= deadzone) {
                player.inputX = 0;
                player.inputY = 0;
                continue;
            }

            const normalized = 1 / Math.max(len, 1e-6);
            const mag = Math.min(1, (len - deadzone) / Math.max(1 - deadzone, 1e-6));
            x = x * normalized * mag;
            y = y * normalized * mag;
            player.inputX = x;
            player.inputY = y;
        }
    }

    private abilitySystem() {
        const currentTick = this.tick;
        for (const player of this.state.players.values()) {
            if (player.isDead || player.isLastBreath) {
                player.abilitySlotPressed = null;
                player.talentChoicePressed = null;
                continue;
            }

            if (player.talentChoicePressed !== null) {
                if (player.talentsAvailable > 0) {
                    player.talentsAvailable = Math.max(0, player.talentsAvailable - 1);
                    this.applyTalentChoice(player, player.talentChoicePressed);
                }
                player.talentChoicePressed = null;
            }

            const pressed = player.abilitySlotPressed;
            const gcdReady = currentTick >= player.gcdReadyTick;

            if (gcdReady && pressed !== null) {
                this.activateAbility(player, pressed);
            } else if (gcdReady && player.queuedAbilitySlot !== null) {
                this.activateAbility(player, player.queuedAbilitySlot);
                player.queuedAbilitySlot = null;
            } else if (!gcdReady && pressed !== null && this.balance.server.abilityQueueSize > 0) {
                if (player.queuedAbilitySlot === null) {
                    player.queuedAbilitySlot = pressed;
                    player.queuedAbilityTick = currentTick;
                }
            }

            player.abilitySlotPressed = null;
        }
    }

    private activateAbility(player: Player, slot: number) {
        // GDD v3.3 §1.3: Слоты 0-2, проверяем наличие умения в слоте
        if (slot < 0 || slot > 2) return;
        
        // Получаем ID умения из слота
        const slotAbilities = [player.abilitySlot0, player.abilitySlot1, player.abilitySlot2];
        const abilityId = slotAbilities[slot];
        
        // Слот пустой — не активируем
        if (!abilityId) return;
        
        // Проверка кулдауна способности
        if (this.tick < player.abilityCooldownTick) return;
        
        const abilities = this.balance.abilities;
        const tickRate = this.balance.server.tickRate;
        
        // Активация по ID умения
        switch (abilityId) {
            case "dash":
                this.activateDash(player, abilities.dash, tickRate);
                break;
            case "shield":
                this.activateShield(player, abilities.shield, tickRate);
                break;
            case "slow":
                this.activateSlow(player, abilities.slow, tickRate);
                break;
            case "projectile":
                this.activateProjectile(player, abilities.projectile, tickRate);
                break;
            case "pull":
                this.activateMagnet(player, abilities.magnet, tickRate);
                break;
            case "spit":
                this.activateSpit(player, abilities.spit, tickRate);
                break;
            case "bomb":
                this.activateBomb(player, abilities.bomb, tickRate);
                break;
            case "push":
                this.activatePush(player, abilities.push, tickRate);
                break;
            case "mine":
                this.activateMine(player, abilities.mine, tickRate);
                break;
            default:
                return;  // Неизвестное умение
        }
        
        player.gcdReadyTick = this.tick + this.balance.server.globalCooldownTicks;
        player.queuedAbilitySlot = null;
    }
    
    private activateDash(player: Player, config: typeof this.balance.abilities.dash, tickRate: number) {
        const massCost = player.mass * config.massCostPct;
        if (player.mass - massCost < this.balance.physics.minSlimeMass) return;
        
        // Списываем массу
        this.applyMassDelta(player, -massCost);
        
        // Устанавливаем кулдаун
        player.abilityCooldownTick = this.tick + Math.round(config.cooldownSec * tickRate);
        
        // Расчёт направления рывка (по текущему углу слайма)
        const angle = player.angle;
        const distance = config.distanceM;
        player.dashTargetX = player.x + Math.cos(angle) * distance;
        player.dashTargetY = player.y + Math.sin(angle) * distance;
        player.dashEndTick = this.tick + Math.round(config.durationSec * tickRate);
        
        // Устанавливаем флаг
        player.flags |= FLAG_DASHING;
    }
    
    private activateShield(player: Player, config: typeof this.balance.abilities.shield, tickRate: number) {
        const massCost = player.mass * config.massCostPct;
        if (player.mass - massCost < this.balance.physics.minSlimeMass) return;
        
        // Списываем массу
        this.applyMassDelta(player, -massCost);
        
        // Устанавливаем кулдаун
        player.abilityCooldownTick = this.tick + Math.round(config.cooldownSec * tickRate);
        
        // Устанавливаем длительность щита
        player.shieldEndTick = this.tick + Math.round(config.durationSec * tickRate);
        
        // Устанавливаем флаг
        player.flags |= FLAG_ABILITY_SHIELD;
    }
    
    private activateMagnet(player: Player, config: typeof this.balance.abilities.magnet, tickRate: number) {
        const massCost = player.mass * config.massCostPct;
        if (player.mass - massCost < this.balance.physics.minSlimeMass) return;
        
        // Списываем массу
        this.applyMassDelta(player, -massCost);
        
        // Устанавливаем кулдаун
        player.abilityCooldownTick = this.tick + Math.round(config.cooldownSec * tickRate);
        
        // Устанавливаем длительность притяжения
        player.magnetEndTick = this.tick + Math.round(config.durationSec * tickRate);
        
        // Устанавливаем флаг
        player.flags |= FLAG_MAGNETIZING;
    }
    
    private activateSlow(player: Player, config: typeof this.balance.abilities.slow, tickRate: number) {
        const massCost = player.mass * config.massCostPct;
        if (player.mass - massCost < this.balance.physics.minSlimeMass) return;
        
        // Списываем массу
        this.applyMassDelta(player, -massCost);
        
        // Устанавливаем кулдаун
        player.abilityCooldownTick = this.tick + Math.round(config.cooldownSec * tickRate);
        
        // Создаём зону замедления
        const zone = new SlowZone();
        zone.id = `slow_${++this.slowZoneIdCounter}`;
        zone.ownerId = player.id;
        zone.x = player.x;
        zone.y = player.y;
        zone.radius = config.radiusM;
        zone.slowPct = config.slowPct;
        zone.endTick = this.tick + Math.round(config.durationSec * tickRate);
        
        this.state.slowZones.set(zone.id, zone);
    }
    
    private activateProjectile(player: Player, config: typeof this.balance.abilities.projectile, tickRate: number) {
        const massCost = player.mass * config.massCostPct;
        if (player.mass - massCost < this.balance.physics.minSlimeMass) return;
        
        // Списываем массу
        this.applyMassDelta(player, -massCost);
        
        // Устанавливаем кулдаун
        player.abilityCooldownTick = this.tick + Math.round(config.cooldownSec * tickRate);
        
        // Создаём снаряд
        const proj = new Projectile();
        proj.id = `proj_${++this.projectileIdCounter}`;
        proj.ownerId = player.id;
        proj.x = player.x;
        proj.y = player.y;
        proj.startX = player.x;
        proj.startY = player.y;
        proj.vx = Math.cos(player.angle) * config.speedMps;
        proj.vy = Math.sin(player.angle) * config.speedMps;
        proj.radius = config.radiusM;
        proj.damagePct = config.damagePct;
        proj.spawnTick = this.tick;
        proj.maxRangeM = config.rangeM;
        
        this.state.projectiles.set(proj.id, proj);
    }

    private activateSpit(player: Player, config: typeof this.balance.abilities.spit, tickRate: number) {
        const massCost = player.mass * config.massCostPct;
        if (player.mass - massCost < this.balance.physics.minSlimeMass) return;
        
        // Списываем массу
        this.applyMassDelta(player, -massCost);
        
        // Устанавливаем кулдаун
        player.abilityCooldownTick = this.tick + Math.round(config.cooldownSec * tickRate);
        
        // Создаём веер снарядов
        const count = config.projectileCount;
        const spreadRad = (config.spreadAngleDeg * Math.PI) / 180;
        const startAngle = player.angle - spreadRad / 2;
        const angleStep = count > 1 ? spreadRad / (count - 1) : 0;
        
        for (let i = 0; i < count; i++) {
            const angle = startAngle + angleStep * i;
            const proj = new Projectile();
            proj.id = `proj_${++this.projectileIdCounter}`;
            proj.ownerId = player.id;
            proj.x = player.x;
            proj.y = player.y;
            proj.startX = player.x;
            proj.startY = player.y;
            proj.vx = Math.cos(angle) * config.speedMps;
            proj.vy = Math.sin(angle) * config.speedMps;
            proj.radius = config.radiusM;
            proj.damagePct = config.damagePct;
            proj.spawnTick = this.tick;
            proj.maxRangeM = config.rangeM;
            proj.projectileType = 0;
            
            this.state.projectiles.set(proj.id, proj);
        }
    }

    private activateBomb(player: Player, config: typeof this.balance.abilities.bomb, tickRate: number) {
        const massCost = player.mass * config.massCostPct;
        if (player.mass - massCost < this.balance.physics.minSlimeMass) return;
        
        // Списываем массу
        this.applyMassDelta(player, -massCost);
        
        // Устанавливаем кулдаун
        player.abilityCooldownTick = this.tick + Math.round(config.cooldownSec * tickRate);
        
        // Создаём бомбу (медленный снаряд с AoE)
        const proj = new Projectile();
        proj.id = `proj_${++this.projectileIdCounter}`;
        proj.ownerId = player.id;
        proj.x = player.x;
        proj.y = player.y;
        proj.startX = player.x;
        proj.startY = player.y;
        proj.vx = Math.cos(player.angle) * config.speedMps;
        proj.vy = Math.sin(player.angle) * config.speedMps;
        proj.radius = config.radiusM;
        proj.damagePct = config.damagePct;
        proj.spawnTick = this.tick;
        proj.maxRangeM = config.rangeM;
        proj.projectileType = 1;  // Bomb type
        proj.explosionRadiusM = config.explosionRadiusM;
        
        this.state.projectiles.set(proj.id, proj);
    }

    private activatePush(player: Player, config: typeof this.balance.abilities.push, tickRate: number) {
        const massCost = player.mass * config.massCostPct;
        if (player.mass - massCost < this.balance.physics.minSlimeMass) return;
        
        // Списываем массу
        this.applyMassDelta(player, -massCost);
        
        // Устанавливаем кулдаун
        player.abilityCooldownTick = this.tick + Math.round(config.cooldownSec * tickRate);
        
        const radiusSq = config.radiusM * config.radiusM;
        
        // Отталкиваем игроков в радиусе
        for (const other of this.state.players.values()) {
            if (other.id === player.id || other.isDead) continue;
            
            const dx = other.x - player.x;
            const dy = other.y - player.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq > radiusSq || distSq < 0.01) continue;
            
            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const ny = dy / dist;
            
            // Скорость = impulse / mass, но с ограничением
            const otherMass = Math.max(other.mass, this.balance.physics.minSlimeMass);
            const speed = this.clamp(config.impulseNs / otherMass, 30, 120);
            
            other.vx += nx * speed;
            other.vy += ny * speed;
        }
        
        // Отталкиваем орбы в радиусе
        for (const orb of this.state.orbs.values()) {
            const dx = orb.x - player.x;
            const dy = orb.y - player.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq > radiusSq || distSq < 0.01) continue;
            
            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const ny = dy / dist;
            
            // Орбы легче — отталкиваются сильнее
            const orbMass = Math.max(orb.mass, 1);
            const speed = this.clamp(config.impulseNs / orbMass, 50, 200);
            
            orb.vx += nx * speed;
            orb.vy += ny * speed;
        }
        
        // Отталкиваем сундуки в радиусе (та же формула, но они тяжелее)
        for (const chest of this.state.chests.values()) {
            const dx = chest.x - player.x;
            const dy = chest.y - player.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq > radiusSq || distSq < 0.01) continue;
            
            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const ny = dy / dist;
            
            // Сундуки тяжелее орбов — используем массу сундука
            const chestMass = Math.max(this.balance.chests.mass, 100);
            const speed = this.clamp(config.impulseNs / chestMass, 20, 80);
            
            chest.vx += nx * speed;
            chest.vy += ny * speed;
        }
    }

    private activateMine(player: Player, config: typeof this.balance.abilities.mine, tickRate: number) {
        const massCost = player.mass * config.massCostPct;
        if (player.mass - massCost < this.balance.physics.minSlimeMass) return;
        
        // Проверяем лимит мин
        let mineCount = 0;
        for (const mine of this.state.mines.values()) {
            if (mine.ownerId === player.id) mineCount++;
        }
        
        // Удаляем старую мину если достигнут лимит
        if (mineCount >= config.maxMines) {
            for (const [id, mine] of this.state.mines.entries()) {
                if (mine.ownerId === player.id) {
                    this.state.mines.delete(id);
                    break;
                }
            }
        }
        
        // Списываем массу
        this.applyMassDelta(player, -massCost);
        
        // Устанавливаем кулдаун
        player.abilityCooldownTick = this.tick + Math.round(config.cooldownSec * tickRate);
        
        // Создаём мину
        const mine = new Mine();
        mine.id = `mine_${++this.mineIdCounter}`;
        mine.ownerId = player.id;
        mine.x = player.x;
        mine.y = player.y;
        mine.radius = config.radiusM;
        mine.damagePct = config.damagePct;
        mine.endTick = this.tick + Math.round(config.durationSec * tickRate);
        
        this.state.mines.set(mine.id, mine);
    }

    private applyTalentChoice(player: Player, choice: number) {
        const applyMassBonus = (bonus: number) => {
            if (bonus <= 0) return;
            this.applyMassDelta(player, player.mass * bonus);
        };

        switch (choice) {
            case 0:
                applyMassBonus(0.05);
                break;
            case 1:
                // Mass Boost (ранее Vital Burst): +30% массы
                applyMassBonus(0.30);
                break;
            case 2:
                applyMassBonus(0.03);
                player.invulnerableUntilTick = Math.max(
                    player.invulnerableUntilTick,
                    this.tick + this.invulnerableTicks
                );
                break;
            default:
                break;
        }
    }

    private flightAssistSystem() {
        const dt = 1 / this.balance.server.tickRate;
        for (const player of this.state.players.values()) {
            if (player.isDead) {
                player.assistFx = 0;
                player.assistFy = 0;
                player.assistTorque = 0;
                continue;
            }

            const slimeConfig = this.getSlimeConfig(player);
            const classStats = this.getClassStats(player);
            const mass = Math.max(player.mass, this.balance.physics.minSlimeMass);
            const inertia = this.getSlimeInertiaForPlayer(player, slimeConfig, classStats);

            // Масштабируем параметры тяги по массе
            let thrustForward = scaleSlimeValue(
                slimeConfig.propulsion.thrustForwardN,
                mass,
                slimeConfig,
                slimeConfig.massScaling.thrustForwardN
            );
            let thrustReverse = scaleSlimeValue(
                slimeConfig.propulsion.thrustReverseN,
                mass,
                slimeConfig,
                slimeConfig.massScaling.thrustReverseN
            );
            let thrustLateral = scaleSlimeValue(
                slimeConfig.propulsion.thrustLateralN,
                mass,
                slimeConfig,
                slimeConfig.massScaling.thrustLateralN
            );
            const turnTorque = scaleSlimeValue(
                slimeConfig.propulsion.turnTorqueNm,
                mass,
                slimeConfig,
                slimeConfig.massScaling.turnTorqueNm
            );

            // Масштабируем лимиты скорости по массе
            let speedLimitForward = scaleSlimeValue(
                slimeConfig.limits.speedLimitForwardMps,
                mass,
                slimeConfig,
                slimeConfig.massScaling.speedLimitForwardMps
            );
            let speedLimitReverse = scaleSlimeValue(
                slimeConfig.limits.speedLimitReverseMps,
                mass,
                slimeConfig,
                slimeConfig.massScaling.speedLimitReverseMps
            );
            let speedLimitLateral = scaleSlimeValue(
                slimeConfig.limits.speedLimitLateralMps,
                mass,
                slimeConfig,
                slimeConfig.massScaling.speedLimitLateralMps
            );
            let angularLimit = scaleSlimeValue(
                slimeConfig.limits.angularSpeedLimitRadps,
                mass,
                slimeConfig,
                slimeConfig.massScaling.angularSpeedLimitRadps
            );

            // Штраф last-breath применяется ко всем лимитам
            if (player.isLastBreath) {
                const penalty = this.balance.combat.lastBreathSpeedPenalty;
                thrustForward *= penalty;
                thrustReverse *= penalty;
                thrustLateral *= penalty;
                speedLimitForward *= penalty;
                speedLimitReverse *= penalty;
                speedLimitLateral *= penalty;
                angularLimit *= penalty;
            }

            // Замедление от SlowZone (GDD v3.3: влияет только на вражеских слаймов)
            if ((player.flags & FLAG_SLOWED) !== 0) {
                // Найдём максимальное замедление среди активных зон
                let maxSlowPct = 0;
                for (const zone of this.state.slowZones.values()) {
                    if (zone.ownerId === player.id) continue;
                    const dx = player.x - zone.x;
                    const dy = player.y - zone.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < zone.radius * zone.radius) {
                        maxSlowPct = Math.max(maxSlowPct, zone.slowPct);
                    }
                }
                const slowMult = 1 - maxSlowPct;
                speedLimitForward *= slowMult;
                speedLimitReverse *= slowMult;
                speedLimitLateral *= slowMult;
            }

            // Максимальное угловое ускорение из ТТХ
            const maxAngularAccel = turnTorque / inertia;

            // Читаем ввод джойстика
            const inputX = player.inputX;
            const inputY = player.inputY;
            const inputMag = Math.hypot(inputX, inputY);
            const hasInput = inputMag > slimeConfig.assist.inputMagnitudeThreshold;

            // Локальные оси слайма
            const forwardX = Math.cos(player.angle);
            const forwardY = Math.sin(player.angle);
            const rightX = -forwardY;
            const rightY = forwardX;

            // === ПОВОРОТ (fly-by-wire с честной физикой) ===
            let yawCmd = 0;
            if (hasInput) {
                const targetAngle = Math.atan2(inputY, inputX);
                const angleDelta = this.normalizeAngle(targetAngle - player.angle);

                const angularDeadzone = slimeConfig.assist.angularDeadzoneRad;
                if (Math.abs(angleDelta) > angularDeadzone) {
                    const yawFull = slimeConfig.assist.yawFullDeflectionAngleRad;
                    if (yawFull > 1e-6) {
                        yawCmd = this.clamp(angleDelta / yawFull, -1, 1);
                        yawCmd = this.clamp(yawCmd * slimeConfig.assist.yawRateGain, -1, 1);
                        yawCmd = this.applyYawOscillationDamping(player, yawCmd, slimeConfig);
                    }
                } else {
                    player.yawSignHistory.length = 0;
                }
            } else {
                player.yawSignHistory.length = 0;
            }

            const hasYawInput = hasInput && Math.abs(yawCmd) >= slimeConfig.assist.yawCmdEps;
            let torque = 0;
            if (hasYawInput) {
                const desiredAngVel = yawCmd * angularLimit;
                const angVelError = desiredAngVel - player.angVel;
                // Минимум 1мс для избежания деления на слишком малое значение
                const reactionTime = Math.max(slimeConfig.assist.reactionTimeS, 0.001);
                const desiredAlpha = angVelError / reactionTime;
                const clampedAlpha = this.clamp(desiredAlpha, -maxAngularAccel, maxAngularAccel);
                torque = inertia * clampedAlpha;
            } else if (Math.abs(player.angVel) > 1e-3) {
                const brakeTime = Math.max(slimeConfig.assist.angularStopTimeS, dt);
                const desiredAlpha = -player.angVel / brakeTime;
                const clampedAlpha = this.clamp(desiredAlpha, -maxAngularAccel, maxAngularAccel);
                torque = inertia * clampedAlpha;
            }

            // === ДВИЖЕНИЕ (fly-by-wire с честной физикой) ===
            // Проецируем желаемую скорость на локальные оси слайма
            let desiredVx = 0;
            let desiredVy = 0;
            
            if (hasInput) {
                const inputDirX = inputX / inputMag;
                const inputDirY = inputY / inputMag;
                
                // Проекция направления ввода на оси слайма
                const inputForward = inputDirX * forwardX + inputDirY * forwardY;
                const inputRight = inputDirX * rightX + inputDirY * rightY;
                
                // Желаемая скорость по каждой оси с учётом лимитов
                const desiredForwardSpeed = inputForward >= 0 
                    ? inputForward * inputMag * speedLimitForward 
                    : inputForward * inputMag * speedLimitReverse;
                const desiredLateralSpeed = inputRight * inputMag * speedLimitLateral;
                
                // Переводим обратно в мировые координаты
                desiredVx = forwardX * desiredForwardSpeed + rightX * desiredLateralSpeed;
                desiredVy = forwardY * desiredForwardSpeed + rightY * desiredLateralSpeed;
            }

            // Ошибка скорости в мировых координатах
            const vErrorX = desiredVx - player.vx;
            const vErrorY = desiredVy - player.vy;

            // Проецируем ошибку на локальные оси
            const errorForward = vErrorX * forwardX + vErrorY * forwardY;
            const errorRight = vErrorX * rightX + vErrorY * rightY;

            let forceForward = 0;
            let forceRight = 0;

            // Время разгона/торможения
            const accelTime = hasInput ? slimeConfig.assist.accelTimeS : slimeConfig.assist.comfortableBrakingTimeS;

            // Сила по оси forward (вперёд/назад)
            if (Math.abs(errorForward) > slimeConfig.assist.velocityErrorThreshold) {
                const desiredAccelForward = errorForward / Math.max(accelTime, dt);
                // Выбираем лимит тяги в зависимости от направления
                const thrustLimit = errorForward >= 0 ? thrustForward : thrustReverse;
                const maxAccelForward = thrustLimit / mass;
                const clampedAccelForward = this.clamp(desiredAccelForward, -maxAccelForward, maxAccelForward);
                forceForward = mass * clampedAccelForward;
            }

            // Сила по оси right (боковое движение)
            if (Math.abs(errorRight) > slimeConfig.assist.velocityErrorThreshold) {
                const desiredAccelRight = errorRight / Math.max(accelTime, dt);
                const maxAccelRight = thrustLateral / mass;
                const clampedAccelRight = this.clamp(desiredAccelRight, -maxAccelRight, maxAccelRight);
                forceRight = mass * clampedAccelRight;
            }

            const overspeedRate = slimeConfig.assist.overspeedDampingRate;
            if (overspeedRate > 0) {
                const vForward = player.vx * forwardX + player.vy * forwardY;
                const forwardLimit = vForward >= 0 ? speedLimitForward : speedLimitReverse;
                const forwardExcess = Math.abs(vForward) - forwardLimit;
                if (forwardExcess > 0) {
                    const dvTarget = -Math.sign(vForward) * forwardExcess * overspeedRate;
                    const desiredAccelForward = dvTarget / dt;
                    const thrustLimit = vForward >= 0 ? thrustReverse : thrustForward;
                    const maxAccelForward = thrustLimit / mass;
                    let brakeForce = mass * this.clamp(desiredAccelForward, -maxAccelForward, maxAccelForward);
                    if (!hasInput) {
                        brakeForce *= slimeConfig.assist.autoBrakeMaxThrustFraction;
                    }
                    forceForward += brakeForce;
                }

                const vRight = player.vx * rightX + player.vy * rightY;
                const lateralExcess = Math.abs(vRight) - speedLimitLateral;
                if (lateralExcess > 0) {
                    const dvTarget = -Math.sign(vRight) * lateralExcess * overspeedRate;
                    const desiredAccelRight = dvTarget / dt;
                    const maxAccelRight = thrustLateral / mass;
                    let brakeForce = mass * this.clamp(desiredAccelRight, -maxAccelRight, maxAccelRight);
                    if (!hasInput) {
                        brakeForce *= slimeConfig.assist.autoBrakeMaxThrustFraction;
                    }
                    forceRight += brakeForce;
                }
            }

            forceForward = this.clamp(forceForward, -thrustReverse, thrustForward);
            forceRight = this.clamp(forceRight, -thrustLateral, thrustLateral);

            // Переводим силу в мировые координаты
            const forceX = forwardX * forceForward + rightX * forceRight;
            const forceY = forwardY * forceForward + rightY * forceRight;

            player.assistFx = forceX;
            player.assistFy = forceY;
            player.assistTorque = torque;
        }
    }

    private physicsSystem() {
        const dt = 1 / this.balance.server.tickRate;
        const world = this.balance.worldPhysics;
        for (const player of this.state.players.values()) {
            if (player.isDead) continue;

            // Dash movement: линейная интерполяция к цели
            if ((player.flags & FLAG_DASHING) !== 0 && player.dashEndTick > 0) {
                const dashConfig = this.balance.abilities.dash;
                const dashDurationTicks = Math.round(dashConfig.durationSec * this.balance.server.tickRate);
                const ticksRemaining = player.dashEndTick - this.tick;
                const progress = 1 - ticksRemaining / dashDurationTicks;
                
                // Линейное движение к цели
                const startX = player.dashTargetX - Math.cos(player.angle) * dashConfig.distanceM;
                const startY = player.dashTargetY - Math.sin(player.angle) * dashConfig.distanceM;
                player.x = startX + (player.dashTargetX - startX) * progress;
                player.y = startY + (player.dashTargetY - startY) * progress;
                
                // Обнуляем скорость во время рывка, потом восстановим в направлении
                const dashSpeed = dashConfig.distanceM / dashConfig.durationSec;
                player.vx = Math.cos(player.angle) * dashSpeed;
                player.vy = Math.sin(player.angle) * dashSpeed;
                continue;
            }

            const slimeConfig = this.getSlimeConfig(player);
            const classStats = this.getClassStats(player);
            const mass = Math.max(player.mass, this.balance.physics.minSlimeMass);
            const inertia = this.getSlimeInertiaForPlayer(player, slimeConfig, classStats);

            const dragFx = -mass * world.linearDragK * player.vx;
            const dragFy = -mass * world.linearDragK * player.vy;
            const dragTorque = -inertia * world.angularDragK * player.angVel;

            const totalFx = player.assistFx + dragFx;
            const totalFy = player.assistFy + dragFy;
            player.vx += (totalFx / mass) * dt;
            player.vy += (totalFy / mass) * dt;
            player.x += player.vx * dt;
            player.y += player.vy * dt;

            const totalTorque = player.assistTorque + dragTorque;
            player.angVel += (totalTorque / Math.max(inertia, 1e-6)) * dt;
            let angularLimit = scaleSlimeValue(
                slimeConfig.limits.angularSpeedLimitRadps,
                mass,
                slimeConfig,
                slimeConfig.massScaling.angularSpeedLimitRadps
            );
            // Штраф last-breath применяется и к угловому лимиту
            if (player.isLastBreath) {
                angularLimit *= this.balance.combat.lastBreathSpeedPenalty;
            }
            if (angularLimit > 0 && Math.abs(player.angVel) > angularLimit) {
                player.angVel = Math.sign(player.angVel) * angularLimit;
            }
            player.angle = this.normalizeAngle(player.angle + player.angVel * dt);
        }
    }

    private collisionSystem() {
        const players = Array.from(this.state.players.values());
        const orbs = Array.from(this.state.orbs.entries());
        const iterations = 4;
        const slop = 0.001;
        const percent = 0.8;
        const restitution = this.balance.worldPhysics.restitution;
        const maxCorrection = this.balance.worldPhysics.maxPositionCorrectionM;

        for (let iter = 0; iter < iterations; iter += 1) {
            // Столкновения слайм-слайм
            for (let i = 0; i < players.length; i += 1) {
                const p1 = players[i];
                if (p1.isDead) continue;
                for (let j = i + 1; j < players.length; j += 1) {
                    const p2 = players[j];
                    if (p2.isDead) continue;

                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const r1 = this.getPlayerRadius(p1);
                    const r2 = this.getPlayerRadius(p2);
                    const minDist = r1 + r2;
                    const distSq = dx * dx + dy * dy;
                    if (distSq >= minDist * minDist) continue;

                    const dist = Math.sqrt(distSq);
                    const nx = dist > 0 ? dx / dist : 1;
                    const ny = dist > 0 ? dy / dist : 0;
                    const penetration = minDist - (dist || 0);
                    const invMass1 = p1.mass > 0 ? 1 / p1.mass : 0;
                    const invMass2 = p2.mass > 0 ? 1 / p2.mass : 0;
                    const invMassSum = invMass1 + invMass2;

                    if (invMassSum > 0) {
                        const corrRaw = (Math.max(penetration - slop, 0) / invMassSum) * percent;
                        const corrMag = Math.min(corrRaw, maxCorrection);
                        const corrX = nx * corrMag;
                        const corrY = ny * corrMag;
                        p1.x -= corrX * invMass1;
                        p1.y -= corrY * invMass1;
                        p2.x += corrX * invMass2;
                        p2.y += corrY * invMass2;

                        const rvx = p2.vx - p1.vx;
                        const rvy = p2.vy - p1.vy;
                        const velAlongNormal = rvx * nx + rvy * ny;
                        if (velAlongNormal <= 0) {
                            const jImpulse = (-(1 + restitution) * velAlongNormal) / invMassSum;
                            const impulseX = nx * jImpulse;
                            const impulseY = ny * jImpulse;
                            p1.vx -= impulseX * invMass1;
                            p1.vy -= impulseY * invMass1;
                            p2.vx += impulseX * invMass2;
                            p2.vy += impulseY * invMass2;
                        }
                    }

                    this.processCombat(p1, p2, dx, dy);
                    this.processCombat(p2, p1, -dx, -dy);
                }
            }

            // Столкновения слайм-орб (физика + поедание ртом)
            for (const player of players) {
                if (player.isDead) continue;
                const playerRadius = this.getPlayerRadius(player);
                const playerAngleRad = player.angle;
                const mouthHalf = (this.balance.combat.mouthArcDeg * Math.PI) / 360;

                for (const [orbId, orb] of orbs) {
                    if (!this.state.orbs.has(orbId)) continue;

                    const dx = orb.x - player.x;
                    const dy = orb.y - player.y;
                    const type = this.balance.orbs.types[orb.colorId] ?? this.balance.orbs.types[0];
                    const orbRadius = getOrbRadius(orb.mass, type.density);
                    const minDist = playerRadius + orbRadius;
                    const distSq = dx * dx + dy * dy;
                    if (distSq >= minDist * minDist) continue;

                    const dist = Math.sqrt(distSq);
                    const nx = dist > 0 ? dx / dist : 1;
                    const ny = dist > 0 ? dy / dist : 0;
                    const penetration = minDist - (dist || 0);

                    // Физическая масса орба = пищевая масса (без множителя density)
                    const invMassPlayer = player.mass > 0 ? 1 / player.mass : 0;
                    const invMassOrb = orb.mass > 0 ? 1 / orb.mass : 0;
                    const invMassSum = invMassPlayer + invMassOrb;

                    if (invMassSum > 0) {
                        // Позиционная коррекция
                        const corrRaw = (Math.max(penetration - slop, 0) / invMassSum) * percent;
                        const corrMag = Math.min(corrRaw, maxCorrection);
                        const corrX = nx * corrMag;
                        const corrY = ny * corrMag;
                        player.x -= corrX * invMassPlayer;
                        player.y -= corrY * invMassPlayer;
                        orb.x += corrX * invMassOrb;
                        orb.y += corrY * invMassOrb;

                        // Импульсное отталкивание (закон сохранения импульса)
                        const rvx = orb.vx - player.vx;
                        const rvy = orb.vy - player.vy;
                        const velAlongNormal = rvx * nx + rvy * ny;
                        if (velAlongNormal <= 0) {
                            const jImpulse = (-(1 + restitution) * velAlongNormal) / invMassSum;
                            const impulseX = nx * jImpulse;
                            const impulseY = ny * jImpulse;
                            player.vx -= impulseX * invMassPlayer;
                            player.vy -= impulseY * invMassPlayer;
                            orb.vx += impulseX * invMassOrb;
                            orb.vy += impulseY * invMassOrb;
                        }
                    }

                    // Проверка поедания ртом
                    const angleToOrb = Math.atan2(dy, dx);
                    let angleDiff = angleToOrb - playerAngleRad;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    const isMouthHit = Math.abs(angleDiff) <= mouthHalf;

                    // GDD v3.3: GCD между умениями и укусами
                    const gcdReady = this.tick >= player.gcdReadyTick;
                    if (isMouthHit && gcdReady && this.tick >= player.lastBiteTick + this.biteCooldownTicks) {
                        this.tryEatOrb(player, orbId, orb);
                    }
                }
            }

            for (const player of players) {
                if (player.isDead) continue;
                this.applyWorldBounds(player, this.getPlayerRadius(player));
            }

            // Столкновения орб-орб
            this.orbOrbCollisions(restitution);
        }
    }

    /**
     * Попытка съесть орб (вызывается при столкновении ртом).
     */
    private tryEatOrb(player: Player, orbId: string, orb: Orb) {
        player.lastBiteTick = this.tick;
        // GDD v3.3: GCD после укуса
        player.gcdReadyTick = this.tick + this.balance.server.globalCooldownTicks;

        const slimeConfig = this.getSlimeConfig(player);
        const bitePct = slimeConfig.combat.orbBitePctOfMass;

        // Если orb.mass <= bitePct * player.mass → проглотить целиком
        // Иначе → откусить bitePct * player.mass
        const swallowThreshold = player.mass * bitePct;
        const canSwallow = orb.mass <= swallowThreshold;

        if (canSwallow || orb.mass <= this.balance.orbs.minMass) {
            this.applyMassDelta(player, orb.mass);
            this.state.orbs.delete(orbId);
        } else {
            const biteMass = swallowThreshold;
            orb.mass -= biteMass;
            this.applyMassDelta(player, biteMass);
        }
    }

    /**
     * Обрабатывает столкновения между орбами.
     */
    private orbOrbCollisions(restitution: number) {
        const orbs = Array.from(this.state.orbs.values());
        const slop = 0.001;
        const percent = 0.8;

        for (let i = 0; i < orbs.length; i++) {
            const o1 = orbs[i];
            const type1 = this.balance.orbs.types[o1.colorId] ?? this.balance.orbs.types[0];
            const r1 = getOrbRadius(o1.mass, type1.density);

            for (let j = i + 1; j < orbs.length; j++) {
                const o2 = orbs[j];
                const type2 = this.balance.orbs.types[o2.colorId] ?? this.balance.orbs.types[0];
                const r2 = getOrbRadius(o2.mass, type2.density);

                const dx = o2.x - o1.x;
                const dy = o2.y - o1.y;
                const minDist = r1 + r2;
                const distSq = dx * dx + dy * dy;
                if (distSq >= minDist * minDist) continue;

                const dist = Math.sqrt(distSq);
                const nx = dist > 0 ? dx / dist : 1;
                const ny = dist > 0 ? dy / dist : 0;
                const penetration = minDist - (dist || 0);

                // Физическая масса = пищевая масса
                const invMass1 = o1.mass > 0 ? 1 / o1.mass : 0;
                const invMass2 = o2.mass > 0 ? 1 / o2.mass : 0;
                const invMassSum = invMass1 + invMass2;

                if (invMassSum > 0) {
                    // Позиционная коррекция
                    const corrRaw = (Math.max(penetration - slop, 0) / invMassSum) * percent;
                    const corrX = nx * corrRaw;
                    const corrY = ny * corrRaw;
                    o1.x -= corrX * invMass1;
                    o1.y -= corrY * invMass1;
                    o2.x += corrX * invMass2;
                    o2.y += corrY * invMass2;

                    // Импульсное отталкивание
                    const rvx = o2.vx - o1.vx;
                    const rvy = o2.vy - o1.vy;
                    const velAlongNormal = rvx * nx + rvy * ny;
                    if (velAlongNormal <= 0) {
                        const jImpulse = (-(1 + restitution) * velAlongNormal) / invMassSum;
                        const impulseX = nx * jImpulse;
                        const impulseY = ny * jImpulse;
                        o1.vx -= impulseX * invMass1;
                        o1.vy -= impulseY * invMass1;
                        o2.vx += impulseX * invMass2;
                        o2.vy += impulseY * invMass2;
                    }
                }
            }
        }
    }

    private processCombat(attacker: Player, defender: Player, dx: number, dy: number) {
        if (attacker.isDead || defender.isDead) return;
        if (this.tick < attacker.lastAttackTick + this.attackCooldownTicks) return;
        // GDD v3.3: GCD между умениями и укусами
        if (this.tick < attacker.gcdReadyTick) return;
        
        // Неуязвимость защитника — укус не проходит, но GCD применяется
        if (this.tick < defender.invulnerableUntilTick) {
            attacker.lastAttackTick = this.tick;
            attacker.gcdReadyTick = this.tick + this.balance.server.globalCooldownTicks;
            return;
        }
        
        // Щит блокирует урон полностью — GCD применяется
        if ((defender.flags & FLAG_ABILITY_SHIELD) !== 0) {
            // Щит снимается при атаке (согласно GDD)
            defender.shieldEndTick = 0;
            defender.flags &= ~FLAG_ABILITY_SHIELD; // Очищаем флаг сразу
            attacker.lastAttackTick = this.tick; // Атака уходит на кулдаун
            attacker.gcdReadyTick = this.tick + this.balance.server.globalCooldownTicks;
            return;
        }

        const attackerZone = this.getContactZone(attacker, dx, dy);
        if (attackerZone !== "mouth") return;

        const defenderZone = this.getContactZone(defender, -dx, -dy);
        let zoneMultiplier = 1;
        if (defenderZone === "tail") {
            zoneMultiplier = this.balance.combat.tailDamageMultiplier;
        } else if (defenderZone === "mouth") {
            zoneMultiplier = 0.5;
        }

        const classStats = this.getClassStats(attacker);
        const defenderClassStats = this.getClassStats(defender);
        const minSlimeMass = this.balance.physics.minSlimeMass;
        
        // Mass-as-HP: укус отбирает % массы жертвы
        // Инвариант: massLoss = attackerGain + scatterMass (масса не создаётся из воздуха)
        const victimMassBefore = Math.max(0, defender.mass);
        const multiplier = zoneMultiplier * classStats.damageMult;
        
        // Защита от укусов: класс + талант (cap 50%)
        const totalResist = Math.min(0.5, defenderClassStats.biteResistPct + defender.biteResistPct);
        let massLoss = victimMassBefore * this.balance.combat.pvpBiteVictimLossPct * multiplier * (1 - totalResist);

        attacker.lastAttackTick = this.tick;
        // GDD v3.3: GCD после укуса слайма
        attacker.gcdReadyTick = this.tick + this.balance.server.globalCooldownTicks;

        // Проверка Last Breath: если масса упадёт ниже минимума
        const newDefenderMass = defender.mass - massLoss;
        const triggersLastBreath =
            newDefenderMass <= minSlimeMass &&
            !defender.isLastBreath &&
            this.lastBreathTicks > 0 &&
            !defender.isDead;

        // При Last Breath ограничиваем потерю до (mass - minSlimeMass)
        // Награды масштабируются пропорционально фактической потере
        if (triggersLastBreath) {
            massLoss = Math.max(0, defender.mass - minSlimeMass);
        }

        // Рассчитываем награды от ФАКТИЧЕСКОЙ потери массы (не от массы до укуса)
        // Это гарантирует: massLoss = attackerGain + scatterMass
        const attackerGainPct = this.balance.combat.pvpBiteAttackerGainPct;
        const scatterPct = this.balance.combat.pvpBiteScatterPct;
        const totalRewardPct = attackerGainPct + scatterPct;
        const attackerGain = totalRewardPct > 0 ? massLoss * (attackerGainPct / totalRewardPct) : 0;
        const scatterMass = totalRewardPct > 0 ? massLoss * (scatterPct / totalRewardPct) : 0;

        // Применяем изменения массы
        this.applyMassDelta(defender, -massLoss);
        this.applyMassDelta(attacker, attackerGain);
        
        // Scatter orbs: разлёт пузырей цвета жертвы
        if (scatterMass > 0) {
            this.spawnPvPBiteOrbs(defender.x, defender.y, scatterMass, defender.classId + 10);
        }

        // Активируем Last Breath после применения массы
        if (triggersLastBreath) {
            defender.isLastBreath = true;
            defender.lastBreathEndTick = this.tick + this.lastBreathTicks;
            defender.invulnerableUntilTick = defender.lastBreathEndTick;
            return;
        }

        defender.invulnerableUntilTick = this.tick + this.invulnerableTicks;
    }

    /**
     * Создаёт орбы, разлетающиеся от точки укуса PvP.
     * Эти орбы игнорируют maxCount — боевая механика важнее лимита.
     * @param colorId - colorId орбов (classId + 10 для цвета жертвы)
     */
    private spawnPvPBiteOrbs(x: number, y: number, totalMass: number, colorId?: number): void {
        const count = this.balance.combat.pvpBiteScatterOrbCount;
        if (count <= 0 || totalMass <= 0) return;
        
        const perOrbMass = totalMass / count;
        const angleStep = (Math.PI * 2) / count;
        const speed = this.balance.combat.pvpBiteScatterSpeed;
        
        for (let i = 0; i < count; i++) {
            const angle = i * angleStep + this.rng.range(-0.3, 0.3);
            // Force spawn: scatter orbs игнорируют maxCount
            const orb = this.forceSpawnOrb(x, y, perOrbMass, colorId);
            orb.vx = Math.cos(angle) * speed;
            orb.vy = Math.sin(angle) * speed;
        }
    }
    
    private projectileSystem() {
        const dt = 1 / this.balance.server.tickRate;
        const toRemove: string[] = [];
        const mapSize = this.balance.world.mapSize;
        const worldHalfW = mapSize / 2;
        const worldHalfH = mapSize / 2;
        
        for (const [projId, proj] of this.state.projectiles.entries()) {
            // Движение
            proj.x += proj.vx * dt;
            proj.y += proj.vy * dt;
            
            // Проверка дистанции
            const dx = proj.x - proj.startX;
            const dy = proj.y - proj.startY;
            const distSq = dx * dx + dy * dy;
            const maxDistReached = distSq > proj.maxRangeM * proj.maxRangeM;
            
            // Проверка границ мира
            const outOfBounds = Math.abs(proj.x) > worldHalfW || Math.abs(proj.y) > worldHalfH;
            
            // Bomb взрывается при достижении макс. дистанции
            if (maxDistReached || outOfBounds) {
                if (proj.projectileType === 1 && proj.explosionRadiusM > 0) {
                    this.explodeBomb(proj);
                }
                toRemove.push(projId);
                continue;
            }
            
            // Столкновение со слаймами (кроме владельца)
            let hitPlayer = false;
            for (const player of this.state.players.values()) {
                if (player.isDead || player.id === proj.ownerId) continue;
                if (player.isLastBreath) continue;
                if (this.tick < player.invulnerableUntilTick) continue;
                
                // Щит блокирует снаряд
                if ((player.flags & FLAG_ABILITY_SHIELD) !== 0) {
                    // Щит снимается при попадании
                    player.shieldEndTick = 0;
                    player.flags &= ~FLAG_ABILITY_SHIELD;
                    // Bomb взрывается даже при попадании в щит
                    if (proj.projectileType === 1 && proj.explosionRadiusM > 0) {
                        this.explodeBomb(proj);
                    }
                    toRemove.push(projId);
                    hitPlayer = true;
                    break;
                }
                
                const playerRadius = this.getPlayerRadius(player);
                const pdx = proj.x - player.x;
                const pdy = proj.y - player.y;
                const pdistSq = pdx * pdx + pdy * pdy;
                const touchDist = playerRadius + proj.radius;
                
                if (pdistSq <= touchDist * touchDist) {
                    // Попадание! 
                    if (proj.projectileType === 1 && proj.explosionRadiusM > 0) {
                        // Bomb — AoE взрыв
                        this.explodeBomb(proj);
                    } else {
                        // Обычный снаряд — прямой урон
                        const owner = this.state.players.get(proj.ownerId);
                        if (owner && !owner.isDead) {
                            this.applyProjectileDamage(owner, player, proj.damagePct);
                        }
                    }
                    toRemove.push(projId);
                    hitPlayer = true;
                    break;
                }
            }
            
            if (hitPlayer) continue;
        }
        
        // Удаляем снаряды
        for (const id of toRemove) {
            this.state.projectiles.delete(id);
        }
    }
    
    /**
     * Взрыв бомбы — AoE урон всем в радиусе
     */
    private explodeBomb(proj: Projectile) {
        const owner = this.state.players.get(proj.ownerId);
        if (!owner || owner.isDead) return;
        
        const radiusSq = proj.explosionRadiusM * proj.explosionRadiusM;
        
        for (const player of this.state.players.values()) {
            if (player.isDead || player.id === proj.ownerId) continue;
            if (player.isLastBreath) continue;
            if (this.tick < player.invulnerableUntilTick) continue;
            
            // Щит блокирует взрыв
            if ((player.flags & FLAG_ABILITY_SHIELD) !== 0) {
                player.shieldEndTick = 0;
                player.flags &= ~FLAG_ABILITY_SHIELD;
                continue;
            }
            
            const dx = player.x - proj.x;
            const dy = player.y - proj.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq <= radiusSq) {
                this.applyProjectileDamage(owner, player, proj.damagePct);
            }
        }
    }
    
    /**
     * Система мин — детонация при контакте с врагами
     */
    private mineSystem() {
        const toRemove: string[] = [];
        
        for (const [mineId, mine] of this.state.mines.entries()) {
            // Проверка истечения срока
            if (this.tick >= mine.endTick) {
                toRemove.push(mineId);
                continue;
            }
            
            const owner = this.state.players.get(mine.ownerId);
            const radiusSq = mine.radius * mine.radius;
            
            // Проверка коллизий с врагами
            for (const player of this.state.players.values()) {
                if (player.isDead || player.id === mine.ownerId) continue;
                if (player.isLastBreath) continue;
                if (this.tick < player.invulnerableUntilTick) continue;
                
                const playerRadius = this.getPlayerRadius(player);
                const dx = player.x - mine.x;
                const dy = player.y - mine.y;
                const distSq = dx * dx + dy * dy;
                const touchDist = playerRadius + mine.radius;
                
                if (distSq <= touchDist * touchDist) {
                    // Детонация!
                    
                    // Щит блокирует мину
                    if ((player.flags & FLAG_ABILITY_SHIELD) !== 0) {
                        player.shieldEndTick = 0;
                        player.flags &= ~FLAG_ABILITY_SHIELD;
                    } else if (owner && !owner.isDead) {
                        this.applyProjectileDamage(owner, player, mine.damagePct);
                    }
                    
                    toRemove.push(mineId);
                    break;
                }
            }
        }
        
        // Удаляем сдетонировавшие/истекшие мины
        for (const id of toRemove) {
            this.state.mines.delete(id);
        }
    }
    
    private applyProjectileDamage(attacker: Player, defender: Player, damagePct: number) {
        const minSlimeMass = this.balance.physics.minSlimeMass;
        
        // Защита от укусов применяется и к снарядам
        const defenderClassStats = this.getClassStats(defender);
        const totalResist = Math.min(0.5, defenderClassStats.biteResistPct + defender.biteResistPct);
        
        let massLoss = defender.mass * damagePct * (1 - totalResist);
        
        // Last Breath check
        const newDefenderMass = defender.mass - massLoss;
        const triggersLastBreath =
            newDefenderMass <= minSlimeMass &&
            !defender.isLastBreath &&
            this.lastBreathTicks > 0 &&
            !defender.isDead;
        
        if (triggersLastBreath) {
            massLoss = Math.max(0, defender.mass - minSlimeMass);
        }
        
        // Снаряд не даёт массу атакующему (только урон)
        this.applyMassDelta(defender, -massLoss);
        
        // Scatter orbs цвета жертвы от урона снаряда
        if (massLoss > 0) {
            this.spawnPvPBiteOrbs(defender.x, defender.y, massLoss * 0.5, defender.classId + 10);
        }
        
        if (triggersLastBreath) {
            defender.isLastBreath = true;
            defender.lastBreathEndTick = this.tick + this.lastBreathTicks;
            defender.invulnerableUntilTick = defender.lastBreathEndTick;
            return;
        }
        
        defender.invulnerableUntilTick = this.tick + this.invulnerableTicks;
    }

    private chestSystem() {
        const dt = 1 / this.balance.server.tickRate;
        const chestEntries = Array.from(this.state.chests.entries());
        for (const player of this.state.players.values()) {
            if (player.isDead) continue;
            const playerRadius = this.getPlayerRadius(player);
            const playerAngleRad = player.angle;
            const mouthHalf = (this.balance.combat.mouthArcDeg * Math.PI) / 360;

            for (const [chestId, chest] of chestEntries) {
                if (!this.state.chests.has(chestId)) continue;
                const dx = chest.x - player.x;
                const dy = chest.y - player.y;
                const distSq = dx * dx + dy * dy;
                const touchDist = playerRadius + this.balance.chests.radius;
                if (distSq > touchDist * touchDist) continue;

                const angleToChest = Math.atan2(dy, dx);
                let angleDiff = angleToChest - playerAngleRad;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                const isMouthHit = Math.abs(angleDiff) <= mouthHalf;

                // GDD v3.3: GCD между умениями и укусами
                const gcdReady = this.tick >= player.gcdReadyTick;
                if (isMouthHit && gcdReady && this.tick >= player.lastBiteTick + this.biteCooldownTicks) {
                    this.openChest(player, chestId);
                    player.lastBiteTick = this.tick;
                    // GDD v3.3: GCD после укуса
                    player.gcdReadyTick = this.tick + this.balance.server.globalCooldownTicks;
                } else {
                    const dist = Math.sqrt(distSq) || 1;
                    const push = this.balance.orbs.pushForce;
                    chest.vx += (dx / dist) * push * dt;
                    chest.vy += (dy / dist) * push * dt;
                }
            }
        }
    }

    private openChest(player: Player, chestId: string) {
        const grantedTalent =
            this.rng.next() < this.balance.chests.rewards.talentChance && this.grantTalent(player);
        if (!grantedTalent) {
            const rewards = this.balance.chests.rewards.massPercent;
            const rewardIndex = this.rng.int(0, rewards.length);
            const gain = player.mass * rewards[rewardIndex];
            this.applyMassDelta(player, gain);
        }

        this.state.chests.delete(chestId);
    }

    private grantTalent(player: Player): boolean {
        // Выдаём карточку таланта через новую систему
        this.awardTalentToPlayer(player);
        return true;
    }

    private deathSystem() {
        const minSlimeMass = this.balance.physics.minSlimeMass;
        for (const player of this.state.players.values()) {
            if (player.isLastBreath && this.tick >= player.lastBreathEndTick) {
                player.isLastBreath = false;
            }

            // Mass-as-HP: смерть при массе <= minSlimeMass
            if (!player.isDead && player.mass <= minSlimeMass && !player.isLastBreath) {
                this.handlePlayerDeath(player);
            }

            if (player.isDead && this.tick >= player.respawnAtTick) {
                this.handlePlayerRespawn(player);
            }
        }
    }

    private handlePlayerDeath(player: Player) {
        player.isDead = true;
        player.isLastBreath = false;
        player.lastBreathEndTick = 0;
        player.respawnAtTick = this.tick + this.respawnDelayTicks;
        player.vx = 0;
        player.vy = 0;
        player.inputX = 0;
        player.inputY = 0;

        const massForOrbs = player.mass * this.balance.death.massToOrbsPercent;
        const perOrbMass = massForOrbs / Math.max(1, this.balance.death.orbsCount);
        const count = Math.min(
            this.balance.death.orbsCount,
            this.balance.orbs.maxCount - this.state.orbs.size
        );
        if (count <= 0) return;

        for (let i = 0; i < count; i += 1) {
            const angle = (i / count) * Math.PI * 2;
            const spread = 30;
            const orbX = player.x + Math.cos(angle) * spread;
            const orbY = player.y + Math.sin(angle) * spread;
            const orb = this.spawnOrb(orbX, orbY, perOrbMass);
            if (orb) {
                const spreadSpeed = 150;
                orb.vx = Math.cos(angle) * spreadSpeed;
                orb.vy = Math.sin(angle) * spreadSpeed;
            }
        }
    }

    private handlePlayerRespawn(player: Player) {
        player.isDead = false;
        player.isLastBreath = false;
        player.lastBreathEndTick = 0;
        const respawnMass = Math.max(
            this.balance.death.minRespawnMass,
            player.mass * (1 - this.balance.death.massLostPercent)
        );
        player.mass = respawnMass;
        const spawn = this.randomPointInMap();
        player.x = spawn.x;
        player.y = spawn.y;
        player.vx = 0;
        player.vy = 0;
        player.angVel = 0;
        player.invulnerableUntilTick = this.tick + this.respawnShieldTicks;
        player.gcdReadyTick = this.tick;
        player.queuedAbilitySlot = null;
    }

    private updateOrbs() {
        const dt = 1 / this.balance.server.tickRate;
        if (
            this.tick - this.lastOrbSpawnTick >= this.orbSpawnIntervalTicks &&
            this.state.orbs.size < this.balance.orbs.maxCount
        ) {
            const spawnMultiplier = this.getOrbSpawnMultiplier();
            let spawnCount = Math.floor(spawnMultiplier);
            if (this.rng.next() < spawnMultiplier - spawnCount) {
                spawnCount += 1;
            }
            spawnCount = Math.max(1, spawnCount);
            const remaining = this.balance.orbs.maxCount - this.state.orbs.size;
            spawnCount = Math.min(spawnCount, remaining);

            for (let i = 0; i < spawnCount; i += 1) {
                const spawn = this.randomOrbSpawnPoint();
                this.spawnOrb(spawn.x, spawn.y);
            }
            this.lastOrbSpawnTick = this.tick;
        }

        // Притяжение орбов к игрокам с активным магнитом
        const magnetConfig = this.balance.abilities.magnet;
        const magnetPlayers: Player[] = [];
        for (const player of this.state.players.values()) {
            if (!player.isDead && (player.flags & FLAG_MAGNETIZING) !== 0) {
                magnetPlayers.push(player);
            }
        }

        for (const orb of this.state.orbs.values()) {
            // Magnet pull
            for (const player of magnetPlayers) {
                const dx = player.x - orb.x;
                const dy = player.y - orb.y;
                const distSq = dx * dx + dy * dy;
                const magnetRadiusSq = magnetConfig.radiusM * magnetConfig.radiusM;
                
                if (distSq < magnetRadiusSq && distSq > 1) {
                    const dist = Math.sqrt(distSq);
                    const nx = dx / dist;
                    const ny = dy / dist;
                    // Сила притяжения
                    orb.vx += nx * magnetConfig.pullSpeedMps * dt * 2;
                    orb.vy += ny * magnetConfig.pullSpeedMps * dt * 2;
                }
            }
            
            // Orbs keep the simplified damping model to avoid extra force calculations.
            const damping = Math.max(
                0,
                1 - this.balance.physics.environmentDrag - this.balance.physics.orbLinearDamping
            );
            orb.vx *= damping;
            orb.vy *= damping;
            this.applySpeedCap(orb, this.balance.physics.maxOrbSpeed);
            orb.x += orb.vx * dt;
            orb.y += orb.vy * dt;
            const type = this.balance.orbs.types[orb.colorId] ?? this.balance.orbs.types[0];
            const radius = getOrbRadius(orb.mass, type.density);
            this.applyWorldBounds(orb, radius);
        }
    }

    /**
     * Визуальное обновление орбов во время фазы Results (без спауна).
     * Орбы только замедляются и останавливаются у границ.
     */
    private updateOrbsVisual(): void {
        const dt = 1 / this.balance.server.tickRate;
        const damping = Math.max(
            0,
            1 - this.balance.physics.environmentDrag - this.balance.physics.orbLinearDamping
        );
        for (const orb of this.state.orbs.values()) {
            orb.vx *= damping;
            orb.vy *= damping;
            orb.x += orb.vx * dt;
            orb.y += orb.vy * dt;
            const type = this.balance.orbs.types[orb.colorId] ?? this.balance.orbs.types[0];
            const radius = getOrbRadius(orb.mass, type.density);
            this.applyWorldBounds(orb, radius);
        }
    }

    private updateChests() {
        const dt = 1 / this.balance.server.tickRate;
        if (
            this.tick - this.lastChestSpawnTick >= this.chestSpawnIntervalTicks &&
            this.state.chests.size < this.balance.chests.maxCount
        ) {
            this.spawnChest();
            this.lastChestSpawnTick = this.tick;
        }

        const damping = Math.max(
            0,
            1 - this.balance.physics.environmentDrag - this.balance.physics.orbLinearDamping
        );
        for (const chest of this.state.chests.values()) {
            chest.vx *= damping;
            chest.vy *= damping;
            chest.x += chest.vx * dt;
            chest.y += chest.vy * dt;
            this.applyWorldBounds(chest, this.balance.chests.radius);
        }
    }

    private slowZoneSystem() {
        // Удаляем истекшие зоны
        const expiredZones: string[] = [];
        for (const zone of this.state.slowZones.values()) {
            if (this.tick >= zone.endTick) {
                expiredZones.push(zone.id);
            }
        }
        for (const id of expiredZones) {
            this.state.slowZones.delete(id);
        }

        // Применяем замедление к вражеским слаймам (не владельцу)
        for (const player of this.state.players.values()) {
            if (player.isDead) continue;
            
            let isSlowed = false;
            let maxSlowPct = 0;
            
            for (const zone of this.state.slowZones.values()) {
                // Не замедляем владельца зоны
                if (zone.ownerId === player.id) continue;
                
                const dx = player.x - zone.x;
                const dy = player.y - zone.y;
                const distSq = dx * dx + dy * dy;
                const radiusSq = zone.radius * zone.radius;
                
                if (distSq < radiusSq) {
                    isSlowed = true;
                    maxSlowPct = Math.max(maxSlowPct, zone.slowPct);
                }
            }
            
            // Устанавливаем/снимаем флаг замедления
            if (isSlowed) {
                player.flags |= FLAG_SLOWED;
            } else {
                player.flags &= ~FLAG_SLOWED;
            }
        }
    }

    private hungerSystem() {
        const phase = this.state.phase as MatchPhaseId;
        // GDD v3.3: Hunger активен в Hunt и Final
        if (phase !== "Hunt" && phase !== "Final") return;
        if (this.state.hotZones.size === 0) return;

        const dt = 1 / this.balance.server.tickRate;
        for (const player of this.state.players.values()) {
            if (player.isDead) continue;
            const inHotZone = this.isInsideHotZone(player);
            if (inHotZone) continue;

            const drainPerSec = Math.min(
                this.balance.hunger.maxDrainPerSec,
                this.balance.hunger.baseDrainPerSec + this.balance.hunger.scalingPerMass * (player.mass / 100)
            );
            const drain = drainPerSec * dt;
            const minMass = Math.max(this.balance.hunger.minMass, this.balance.physics.minSlimeMass);
            const targetMass = Math.max(minMass, player.mass - drain);
            this.applyMassDelta(player, targetMass - player.mass);
        }
    }

    private rebelSystem() {
        if (this.tick - this.lastRebelUpdateTick < this.rebelUpdateIntervalTicks) return;
        this.lastRebelUpdateTick = this.tick;

        const alivePlayers = Array.from(this.state.players.values()).filter((player) => !player.isDead);
        if (alivePlayers.length === 0) {
            this.state.rebelId = "";
            this.updateLeaderboard();
            return;
        }

        let totalMass = 0;
        let leader = alivePlayers[0];
        for (const player of alivePlayers) {
            totalMass += player.mass;
            if (player.mass > leader.mass) leader = player;
        }
        const avgMass = totalMass / alivePlayers.length;
        if (leader.mass >= avgMass * this.balance.rebel.massThresholdMultiplier) {
            this.state.rebelId = leader.id;
        } else {
            this.state.rebelId = "";
        }
        this.updateLeaderboard();
    }

    private updateLeaderboard() {
        const sorted = Array.from(this.state.players.values())
            .filter((player) => !player.isDead)
            .sort((a, b) => b.mass - a.mass)
            .slice(0, 10);
        this.state.leaderboard.length = 0;
        for (const player of sorted) {
            this.state.leaderboard.push(player.id);
        }
    }

    private updatePlayerFlags() {
        for (const player of this.state.players.values()) {
            let flags = 0;
            if (player.isDead) {
                flags |= FLAG_IS_DEAD;
            }
            if (player.isLastBreath) {
                flags |= FLAG_LAST_BREATH;
            }
            if (!player.isDead && !player.isLastBreath && this.tick < player.invulnerableUntilTick) {
                flags |= FLAG_RESPAWN_SHIELD;
            }
            if (this.state.rebelId && player.id === this.state.rebelId) {
                flags |= FLAG_IS_REBEL;
            }
            
            // Ability flags
            if (this.tick < player.dashEndTick) {
                flags |= FLAG_DASHING;
            } else if (player.dashEndTick > 0) {
                // Dash ended
                player.dashEndTick = 0;
            }
            
            if (this.tick < player.shieldEndTick) {
                flags |= FLAG_ABILITY_SHIELD;
            } else if (player.shieldEndTick > 0) {
                // Shield ended
                player.shieldEndTick = 0;
            }
            
            if (this.tick < player.magnetEndTick) {
                flags |= FLAG_MAGNETIZING;
            } else if (player.magnetEndTick > 0) {
                // Magnet ended
                player.magnetEndTick = 0;
            }
            
            // FLAG_SLOWED устанавливается в slowZoneSystem() и должен сохраняться
            if ((player.flags & FLAG_SLOWED) !== 0) {
                flags |= FLAG_SLOWED;
            }
            
            player.flags = flags;
        }
    }

    private updateMatchPhase() {
        // Если матч завершён и в фазе Results — проверяем время для перезапуска
        if (this.isMatchEnded) {
            const ticksSinceResults = this.tick - this.resultsStartTick;
            const totalResultsTicks = this.resultsDurationTicks + this.restartDelayTicks;
            this.state.timeRemaining = Math.max(0, (totalResultsTicks - ticksSinceResults) / this.balance.server.tickRate);
            
            if (ticksSinceResults >= totalResultsTicks) {
                this.restartMatch();
            }
            return;
        }

        const elapsedSec = this.tick / this.balance.server.tickRate;
        this.state.timeRemaining = Math.max(0, this.balance.match.durationSec - elapsedSec);

        // Проверяем завершение матча
        if (elapsedSec >= this.balance.match.durationSec) {
            this.endMatch();
            return;
        }

        let nextPhase: MatchPhaseId = "Final";
        for (const phase of this.balance.match.phases) {
            if (elapsedSec >= phase.startSec && elapsedSec < phase.endSec) {
                nextPhase = phase.id;
                break;
            }
        }

        if (this.lastPhaseId !== nextPhase) {
            console.log(`Phase: ${this.lastPhaseId ?? "none"} -> ${nextPhase}`);
            this.lastPhaseId = nextPhase;
            this.state.phase = nextPhase;
            this.handlePhaseChange(nextPhase);
        } else {
            this.state.phase = nextPhase;
        }
    }

    private endMatch() {
        this.isMatchEnded = true;
        this.resultsStartTick = this.tick;
        this.state.phase = "Results";
        this.lastPhaseId = "Results";
        this.updateLeaderboard();
        console.log("Match ended! Phase: Results");
        
        // Останавливаем всех игроков
        for (const player of this.state.players.values()) {
            player.inputX = 0;
            player.inputY = 0;
            player.vx = 0;
            player.vy = 0;
            player.angVel = 0;
        }
    }

    private restartMatch() {
        console.log("Restarting match...");
        this.isMatchEnded = false;
        this.resultsStartTick = 0;
        this.tick = 0;
        this.lastPhaseId = null;
        this.lastOrbSpawnTick = 0;
        this.lastChestSpawnTick = 0;
        this.lastRebelUpdateTick = 0;
        this.orbIdCounter = 0;
        this.chestIdCounter = 0;
        this.hotZoneIdCounter = 0;
        this.slowZoneIdCounter = 0;

        // Очистка состояния
        this.state.orbs.clear();
        this.state.chests.clear();
        this.state.hotZones.clear();
        this.state.slowZones.clear();
        this.state.projectiles.clear();
        this.state.rebelId = "";
        this.state.phase = "Spawn";
        this.state.timeRemaining = this.balance.match.durationSec;
        this.state.serverTick = 0;

        // Респавн всех игроков
        for (const player of this.state.players.values()) {
            const spawn = this.randomPointInMap();
            player.x = spawn.x;
            player.y = spawn.y;
            player.vx = 0;
            player.vy = 0;
            player.angVel = 0;
            player.angle = 0;
            player.mass = this.balance.slime.initialMass;
            player.level = this.balance.slime.initialLevel;
            player.isDead = false;
            player.isLastBreath = false;
            player.lastBreathEndTick = 0;
            player.invulnerableUntilTick = this.tick + this.respawnShieldTicks;
            player.respawnAtTick = 0;
            player.gcdReadyTick = this.tick;
            player.queuedAbilitySlot = null;
            player.talentsAvailable = 0;
            player.lastAttackTick = 0;
            player.lastBiteTick = 0;
            player.inputX = 0;
            player.inputY = 0;
            
            // GDD v3.3: Сброс слотов умений между матчами
            const classAbilities = ["dash", "shield", "slow"];
            player.abilitySlot0 = classAbilities[player.classId] || "dash";
            player.abilitySlot1 = "";
            player.abilitySlot2 = "";
            player.pendingAbilityCard = null;
            player.cardChoicePressed = null;
            player.pendingCardSlots = [];
            player.pendingCardCount = 0;
        }

        this.spawnInitialOrbs();
        this.updateLeaderboard();
        console.log("Match restarted!");
    }

    private handlePhaseChange(phase: MatchPhaseId) {
        this.state.hotZones.clear();
        // GDD v3.3: Hot zones появляются в Hunt и Final
        if (phase === "Hunt") {
            this.spawnHotZones(this.balance.hotZones.chaosCount, this.balance.hotZones.spawnMultiplierChaos);
        } else if (phase === "Final") {
            this.spawnHotZones(this.balance.hotZones.finalCount, this.balance.hotZones.spawnMultiplierFinal, true);
        }
    }

    private spawnHotZones(count: number, spawnMultiplier: number, centerFirst = false) {
        const radius = this.balance.hotZones.radius;
        for (let i = 0; i < count; i += 1) {
            const zone = new HotZone();
            zone.id = `hot_${this.hotZoneIdCounter++}`;
            if (centerFirst && i === 0) {
                zone.x = 0;
                zone.y = 0;
            } else {
                const point = this.randomPointInMap();
                zone.x = point.x;
                zone.y = point.y;
            }
            zone.radius = radius;
            zone.spawnMultiplier = spawnMultiplier;
            this.state.hotZones.set(zone.id, zone);
        }
    }

    private isInsideHotZone(player: Player): boolean {
        for (const zone of this.state.hotZones.values()) {
            const dx = player.x - zone.x;
            const dy = player.y - zone.y;
            if (dx * dx + dy * dy <= zone.radius * zone.radius) {
                return true;
            }
        }
        return false;
    }

    private getOrbSpawnMultiplier(): number {
        let multiplier = 1;
        for (const zone of this.state.hotZones.values()) {
            multiplier = Math.max(multiplier, zone.spawnMultiplier);
        }
        return multiplier;
    }

    private randomOrbSpawnPoint() {
        if (this.state.hotZones.size > 0) {
            const zones = Array.from(this.state.hotZones.values());
            const zone = zones[this.rng.int(0, zones.length)];
            const angle = this.rng.range(0, Math.PI * 2);
            const radius = Math.sqrt(this.rng.next()) * zone.radius;
            const x = zone.x + Math.cos(angle) * radius;
            const y = zone.y + Math.sin(angle) * radius;
            return this.clampPointToWorld(x, y);
        }
        return this.randomPointInMap();
    }

    private spawnInitialOrbs() {
        const count = Math.min(this.balance.orbs.initialCount, this.balance.orbs.maxCount);
        for (let i = 0; i < count; i += 1) {
            const spawn = this.randomPointInMap();
            this.spawnOrb(spawn.x, spawn.y);
        }
    }

    private spawnOrb(x?: number, y?: number, massOverride?: number): Orb | null {
        if (this.state.orbs.size >= this.balance.orbs.maxCount) return null;
        return this.forceSpawnOrb(x, y, massOverride);
    }

    /**
     * Создаёт орб без проверки maxCount (для scatter orbs и death orbs).
     */
    private forceSpawnOrb(x?: number, y?: number, massOverride?: number, colorId?: number): Orb {
        const spawn = x !== undefined && y !== undefined ? { x, y } : this.randomPointInMap();
        const typePick = this.pickOrbType();
        const orb = new Orb();
        orb.id = `orb_${this.orbIdCounter++}`;
        orb.x = x ?? spawn.x;
        orb.y = y ?? spawn.y;
        orb.mass =
            massOverride ??
            this.rng.range(typePick.type.massRange[0], typePick.type.massRange[1]);
        orb.colorId = colorId ?? typePick.index;
        orb.vx = 0;
        orb.vy = 0;
        this.state.orbs.set(orb.id, orb);
        return orb;
    }

    private pickOrbType() {
        const types = this.balance.orbs.types;
        let total = 0;
        for (const type of types) total += type.weight;
        let roll = this.rng.range(0, total);
        for (let i = 0; i < types.length; i += 1) {
            const type = types[i];
            if (roll < type.weight) {
                return { type, index: i };
            }
            roll -= type.weight;
        }
        return { type: types[types.length - 1], index: types.length - 1 };
    }

    private spawnChest() {
        if (this.state.chests.size >= this.balance.chests.maxCount) return;
        const chest = new Chest();
        chest.id = `chest_${this.chestIdCounter++}`;
        const spawn = this.randomPointInMap();
        chest.x = spawn.x;
        chest.y = spawn.y;
        chest.vx = 0;
        chest.vy = 0;
        chest.type = this.rng.int(0, this.balance.chests.rewards.massPercent.length);
        this.state.chests.set(chest.id, chest);
    }

    private getPlayerRadius(player: Player): number {
        const slimeConfig = this.getSlimeConfig(player);
        const classStats = this.getClassStats(player);
        return getSlimeRadiusFromConfig(player.mass, slimeConfig) * classStats.radiusMult;
    }

    private getClassStats(player: Player): ClassStats {
        switch (player.classId) {
            case 1:
                return {
                    radiusMult: 1,
                    damageMult: this.balance.classes.warrior.damageVsSlimeMult,
                    biteResistPct: this.balance.classes.warrior.biteResistPct,
                    swallowLimit: this.balance.classes.warrior.swallowLimit,
                    biteFraction: this.balance.classes.warrior.biteFraction,
                    eatingPowerMult: 1,
                };
            case 2:
                return {
                    radiusMult: this.balance.classes.collector.radiusMult,
                    damageMult: 1,
                    biteResistPct: 0,
                    swallowLimit: this.balance.classes.collector.swallowLimit,
                    biteFraction: this.balance.classes.collector.biteFraction,
                    eatingPowerMult: this.balance.classes.collector.eatingPowerMult,
                };
            case 0:
            default:
                return {
                    radiusMult: 1,
                    damageMult: 1,
                    biteResistPct: this.balance.classes.hunter.biteResistPct,
                    swallowLimit: this.balance.classes.hunter.swallowLimit,
                    biteFraction: this.balance.classes.hunter.biteFraction,
                    eatingPowerMult: 1,
                };
        }
    }

    private getContactZone(attacker: Player, dx: number, dy: number): ContactZone {
        const angleToTarget = Math.atan2(dy, dx);
        const diff = this.normalizeAngle(angleToTarget - attacker.angle);
        const mouthHalf = (this.balance.combat.mouthArcDeg * Math.PI) / 360;
        const tailHalf = (this.balance.combat.tailArcDeg * Math.PI) / 360;
        if (Math.abs(diff) <= mouthHalf) return "mouth";
        if (Math.abs(diff) >= Math.PI - tailHalf) return "tail";
        return "side";
    }

    private normalizeAngle(angle: number): number {
        let value = angle;
        while (value < -Math.PI) value += Math.PI * 2;
        while (value > Math.PI) value -= Math.PI * 2;
        return value;
    }

    private applyYawOscillationDamping(player: Player, yawCmd: number, slimeConfig: SlimeConfig): number {
        const windowFrames = slimeConfig.assist.yawOscillationWindowFrames;
        const threshold = slimeConfig.assist.yawOscillationSignFlipsThreshold;
        const boost = slimeConfig.assist.yawDampingBoostFactor;
        if (windowFrames <= 0 || threshold <= 0 || boost <= 1) return yawCmd;

        const sign = yawCmd === 0 ? 0 : Math.sign(yawCmd);
        if (sign === 0) return yawCmd;

        const history = player.yawSignHistory;
        history.push(sign);
        if (history.length > windowFrames) {
            history.splice(0, history.length - windowFrames);
        }

        let flips = 0;
        let lastSign = 0;
        for (const s of history) {
            if (s === 0) continue;
            if (lastSign !== 0 && s !== lastSign) {
                flips += 1;
            }
            lastSign = s;
        }

        if (flips >= threshold) {
            return yawCmd / boost;
        }

        return yawCmd;
    }

    private getSlimeConfig(player: Player): SlimeConfig {
        switch (player.classId) {
            case 1:
                return this.balance.slimeConfigs.warrior;
            case 2:
                return this.balance.slimeConfigs.collector;
            case 0:
                return this.balance.slimeConfigs.hunter;
            default:
                return this.balance.slimeConfigs.base;
        }
    }

    private getSlimeInertiaForPlayer(player: Player, config: SlimeConfig, classStats: ClassStats): number {
        const baseInertia = getSlimeInertia(player.mass, config);
        const radiusMult = Math.max(classStats.radiusMult, 0.01);
        const inertia = baseInertia * radiusMult * radiusMult;
        return Math.max(inertia, 1e-6);
    }

    private applyMassDelta(player: Player, delta: number) {
        if (!Number.isFinite(delta) || delta === 0) return;
        const minMass = this.balance.physics.minSlimeMass;
        const nextMass = Math.max(minMass, player.mass + delta);
        if (nextMass === player.mass) return;
        const oldMass = player.mass;
        player.mass = nextMass;
        
        // Проверяем изменение уровня при росте массы
        if (nextMass > oldMass) {
            this.updatePlayerLevel(player);
        }
    }
    
    /**
     * Обновляет уровень игрока по массе (GDD v3.3 §1.3)
     * При достижении level 3/5 открываются слоты 2/3 и показывается карточка выбора
     */
    private updatePlayerLevel(player: Player) {
        const thresholds = this.balance.slime.levelThresholds;
        const slotUnlockLevels = this.balance.slime.slotUnlockLevels;
        
        // Вычисляем текущий уровень по массе
        let newLevel = 1;
        for (let i = 0; i < thresholds.length; i++) {
            if (player.mass >= thresholds[i]) {
                newLevel = i + 1;
            }
        }
        
        if (newLevel <= player.level) return;
        
        const oldLevel = player.level;
        player.level = newLevel;
        
        // Проверяем разблокировку слотов
        // slotUnlockLevels = [1, 3, 5] => slot 0 на level 1, slot 1 на level 3, slot 2 на level 5
        for (let slotIdx = 1; slotIdx < slotUnlockLevels.length; slotIdx++) {
            const unlockLevel = slotUnlockLevels[slotIdx];
            // Если перешли через порог разблокировки и слот ещё пустой
            if (oldLevel < unlockLevel && newLevel >= unlockLevel) {
                const slotProp = slotIdx === 1 ? "abilitySlot1" : "abilitySlot2";
                if (player[slotProp] === "") {
                    // Добавляем слот в очередь (карточка сгенерируется после предыдущей)
                    if (!player.pendingCardSlots.includes(slotIdx)) {
                        player.pendingCardSlots.push(slotIdx);
                        player.pendingCardCount = player.pendingCardSlots.length;
                    }
                }
            }
        }
        
        // Генерируем карточку для первого слота в очереди (если нет активной)
        this.tryGenerateNextCard(player);
    }
    
    /**
     * Пытается сгенерировать следующую карточку из очереди
     */
    private tryGenerateNextCard(player: Player) {
        if (player.pendingAbilityCard !== null) return;
        if (player.pendingCardSlots.length === 0) return;
        
        const nextSlot = player.pendingCardSlots.shift()!;
        player.pendingCardCount = player.pendingCardSlots.length;
        this.generateAbilityCard(player, nextSlot);
    }
    
    /**
     * Генерирует карточку выбора умения для слота (GDD v3.3 §1.3)
     */
    private generateAbilityCard(player: Player, slotIndex: number) {
        // Уже есть активная карточка — не генерируем новую
        if (player.pendingAbilityCard !== null) return;
        
        const pool = this.balance.slime.abilityPool;
        const usedAbilities = new Set([player.abilitySlot0, player.abilitySlot1, player.abilitySlot2]);
        
        // Фильтруем доступные умения (которых ещё нет у игрока)
        const available = pool.filter(ab => !usedAbilities.has(ab));
        if (available.length === 0) return;
        
        // Выбираем 3 случайных (или меньше если не хватает)
        const shuffled = [...available];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng.next() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        const { AbilityCard } = require("./schema/GameState");
        const card = new AbilityCard();
        card.slotIndex = slotIndex;
        card.option0 = shuffled[0] || "";
        card.option1 = shuffled[1] || "";
        card.option2 = shuffled[2] || "";
        card.expiresAtTick = this.tick + this.secondsToTicks(this.balance.slime.cardChoiceTimeoutSec);
        
        player.pendingAbilityCard = card;
    }
    
    /**
     * Система обработки карточек умений
     */
    private abilityCardSystem() {
        const currentTick = this.tick;
        
        for (const player of this.state.players.values()) {
            // Очистка cardChoicePressed если нет активной карточки (Codex fix)
            if (!player.pendingAbilityCard && player.cardChoicePressed !== null) {
                player.cardChoicePressed = null;
            }
            
            if (player.isDead || !player.pendingAbilityCard) continue;
            
            const card = player.pendingAbilityCard;
            
            // Обработка выбора игрока
            if (player.cardChoicePressed !== null) {
                this.applyAbilityCardChoice(player, player.cardChoicePressed);
                player.cardChoicePressed = null;
                continue;
            }
            
            // Автовыбор по таймауту
            if (currentTick >= card.expiresAtTick) {
                this.applyAbilityCardChoice(player, 0);  // Автовыбор первого варианта
            }
        }
    }
    
    /**
     * Применяет выбор из карточки умений
     */
    private applyAbilityCardChoice(player: Player, choiceIndex: number) {
        const card = player.pendingAbilityCard;
        if (!card) return;
        
        const options = [card.option0, card.option1, card.option2];
        const chosen = options[choiceIndex] || options[0] || "";
        
        if (!chosen) {
            player.pendingAbilityCard = null;
            return;
        }
        
        // Присваиваем умение в соответствующий слот
        if (card.slotIndex === 1) {
            player.abilitySlot1 = chosen;
        } else if (card.slotIndex === 2) {
            player.abilitySlot2 = chosen;
        }
        
        player.pendingAbilityCard = null;
        
        // Генерируем следующую карточку из очереди (если есть)
        this.tryGenerateNextCard(player);
    }
    
    /**
     * Система обработки карточек талантов (GDD-Talents.md)
     */
    private talentCardSystem() {
        const currentTick = this.tick;
        
        for (const player of this.state.players.values()) {
            // Очистка talentChoicePressed если нет активной карточки
            if (!player.pendingTalentCard && player.talentChoicePressed2 !== null) {
                player.talentChoicePressed2 = null;
            }
            
            if (player.isDead || !player.pendingTalentCard) continue;
            
            const card = player.pendingTalentCard;
            
            // Обработка выбора игрока
            if (player.talentChoicePressed2 !== null) {
                this.applyTalentCardChoice(player, player.talentChoicePressed2);
                player.talentChoicePressed2 = null;
                continue;
            }
            
            // Автовыбор по таймауту
            if (currentTick >= card.expiresAtTick) {
                this.applyTalentCardChoice(player, 0);  // Автовыбор первого варианта
            }
        }
    }
    
    /**
     * Применяет выбор таланта и пересчитывает модификаторы
     */
    private applyTalentCardChoice(player: Player, choiceIndex: number) {
        const card = player.pendingTalentCard;
        if (!card) return;
        
        const options = [card.option0, card.option1, card.option2];
        const chosen = options[choiceIndex] || options[0] || "";
        
        if (!chosen) {
            player.pendingTalentCard = null;
            return;
        }
        
        // Добавляем или повышаем уровень таланта
        this.addTalentToPlayer(player, chosen);
        
        player.pendingTalentCard = null;
        
        // Генерируем следующую карточку талантов из очереди (если есть)
        this.tryGenerateNextTalentCard(player);
    }
    
    /**
     * Добавляет талант игроку или повышает уровень существующего
     */
    private addTalentToPlayer(player: Player, talentId: string) {
        // Найдём существующий талант
        let existingTalent: Talent | null = null;
        for (const t of player.talents) {
            if (t.id === talentId) {
                existingTalent = t;
                break;
            }
        }
        
        // Получаем конфиг таланта
        const talentConfig = this.getTalentConfig(talentId);
        if (!talentConfig) return;
        
        if (existingTalent) {
            // Повышаем уровень если возможно
            if (existingTalent.level < talentConfig.maxLevel) {
                existingTalent.level += 1;
            }
        } else {
            // Добавляем новый талант
            const newTalent = new Talent();
            newTalent.id = talentId;
            newTalent.level = 1;
            player.talents.push(newTalent);
        }
        
        // Пересчитываем модификаторы
        this.recalculateTalentModifiers(player);
    }
    
    /**
     * Получает конфиг таланта по ID
     */
    private getTalentConfig(talentId: string): TalentConfig | null {
        const talents = this.balance.talents;
        if (talents.common[talentId]) return talents.common[talentId];
        if (talents.rare[talentId]) return talents.rare[talentId];
        if (talents.epic[talentId]) return talents.epic[talentId];
        return null;
    }
    
    /**
     * Определяет редкость таланта (0=common, 1=rare, 2=epic)
     */
    private getTalentRarity(talentId: string): number {
        const talents = this.balance.talents;
        if (talents.common[talentId]) return 0;
        if (talents.rare[talentId]) return 1;
        if (talents.epic[talentId]) return 2;
        return 0;
    }
    
    /**
     * Пересчитывает все модификаторы игрока на основе его талантов
     */
    private recalculateTalentModifiers(player: Player) {
        // Сбрасываем модификаторы
        player.mod_speedLimitBonus = 0;
        player.mod_turnBonus = 0;
        player.mod_biteDamageBonus = 0;
        player.mod_orbMassBonus = 0;
        player.mod_abilityCostReduction = 0;
        player.mod_cooldownReduction = 0;
        player.mod_allDamageReduction = 0;
        player.mod_thrustForwardBonus = 0;
        player.mod_thrustReverseBonus = 0;
        player.mod_thrustLateralBonus = 0;
        player.mod_killMassBonus = 0;
        player.mod_respawnMass = 100;  // Default
        player.biteResistPct = 0;
        
        // Применяем каждый талант
        for (const talent of player.talents) {
            const config = this.getTalentConfig(talent.id);
            if (!config) continue;
            
            const level = talent.level;
            const values = config.values;
            
            // Получаем значение для текущего уровня
            let value: number | number[] = 0;
            if (Array.isArray(values)) {
                if (level <= values.length) {
                    value = values[level - 1];
                }
            } else {
                value = values;
            }
            
            // Применяем эффект
            switch (config.effect) {
                case "speedLimitBonus":
                    player.mod_speedLimitBonus += typeof value === "number" ? value : 0;
                    break;
                case "turnBonus":
                    player.mod_turnBonus += typeof value === "number" ? value : 0;
                    break;
                case "biteDamageBonus":
                    player.mod_biteDamageBonus += typeof value === "number" ? value : 0;
                    break;
                case "orbMassBonus":
                    player.mod_orbMassBonus += typeof value === "number" ? value : 0;
                    break;
                case "biteResistBonus":
                    player.biteResistPct += typeof value === "number" ? value : 0;
                    break;
                case "abilityCostReduction":
                    player.mod_abilityCostReduction += typeof value === "number" ? value : 0;
                    break;
                case "cooldownReduction":
                    player.mod_cooldownReduction += typeof value === "number" ? value : 0;
                    break;
                case "allDamageReduction":
                    player.mod_allDamageReduction += typeof value === "number" ? value : 0;
                    break;
                case "thrustForwardBonus":
                    player.mod_thrustForwardBonus += typeof value === "number" ? value : 0;
                    break;
                case "thrustReverseBonus":
                    player.mod_thrustReverseBonus += typeof value === "number" ? value : 0;
                    break;
                case "thrustLateralBonus":
                    player.mod_thrustLateralBonus += typeof value === "number" ? value : 0;
                    break;
                case "killMassBonus":
                    player.mod_killMassBonus += typeof value === "number" ? value : 0;
                    break;
                case "respawnMass":
                    player.mod_respawnMass = typeof value === "number" ? value : 100;
                    break;
                case "aggressorDual":
                    // +damage, +loss — обрабатывается отдельно в processCombat
                    player.mod_biteDamageBonus += typeof value === "number" ? value : 0;
                    break;
                case "allThrustBonus":
                    // motor: +25% ко всем двигателям
                    const motorBonus = typeof value === "number" ? value : 0;
                    player.mod_thrustForwardBonus += motorBonus;
                    player.mod_thrustReverseBonus += motorBonus;
                    player.mod_thrustLateralBonus += motorBonus;
                    break;
            }
        }
        
        // Применяем cap на biteResistPct (max 50%)
        player.biteResistPct = Math.min(player.biteResistPct, 0.5);
    }
    
    /**
     * Генерирует карточку выбора таланта для игрока
     */
    private generateTalentCard(player: Player) {
        const talents = this.balance.talents;
        const tickRate = this.balance.server.tickRate;
        const timeoutTicks = this.secondsToTicks(talents.cardChoiceTimeoutSec);
        
        // Собираем доступные таланты (без дубликатов на макс. уровне)
        const availableTalents: { id: string; rarity: number }[] = [];
        
        const addFromPool = (pool: string[], configs: Record<string, TalentConfig>, rarity: number) => {
            for (const id of pool) {
                const config = configs[id];
                if (!config) continue;
                
                // Проверяем требование
                if (config.requirement) {
                    const hasRequirement = 
                        player.abilitySlot0 === config.requirement ||
                        player.abilitySlot1 === config.requirement ||
                        player.abilitySlot2 === config.requirement;
                    if (!hasRequirement) continue;
                }
                
                // Проверяем не на макс. уровне ли уже
                let currentLevel = 0;
                for (const t of player.talents) {
                    if (t.id === id) {
                        currentLevel = t.level;
                        break;
                    }
                }
                
                if (currentLevel < config.maxLevel) {
                    availableTalents.push({ id, rarity });
                }
            }
        };
        
        addFromPool(talents.talentPool.common, talents.common, 0);
        addFromPool(talents.talentPool.rare, talents.rare, 1);
        addFromPool(talents.talentPool.epic, talents.epic, 2);
        
        if (availableTalents.length === 0) return;
        
        // Выбираем 3 случайных (или меньше если мало)
        const shuffled = [...availableTalents];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng.next() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        const selected = shuffled.slice(0, 3);
        
        const card = new TalentCard();
        card.option0 = selected[0]?.id || "";
        card.option1 = selected[1]?.id || "";
        card.option2 = selected[2]?.id || "";
        card.rarity0 = selected[0]?.rarity ?? 0;
        card.rarity1 = selected[1]?.rarity ?? 0;
        card.rarity2 = selected[2]?.rarity ?? 0;
        card.expiresAtTick = this.tick + timeoutTicks;
        
        player.pendingTalentCard = card;
    }
    
    /**
     * Пытается сгенерировать следующую карточку таланта из очереди
     */
    private tryGenerateNextTalentCard(player: Player) {
        if (player.pendingTalentQueue.length > 0 && !player.pendingTalentCard) {
            player.pendingTalentQueue.shift();
            this.generateTalentCard(player);
        }
        player.pendingTalentCount = player.pendingTalentQueue.length;
    }
    
    /**
     * Выдаёт игроку талант (например, из сундука)
     */
    private awardTalentToPlayer(player: Player) {
        if (player.pendingTalentCard) {
            // Уже есть активная карточка — добавляем в очередь
            player.pendingTalentQueue.push(1);
            player.pendingTalentCount = player.pendingTalentQueue.length;
        } else {
            this.generateTalentCard(player);
        }
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    private secondsToTicks(seconds: number): number {
        if (!Number.isFinite(seconds) || seconds <= 0) return 0;
        return Math.max(1, Math.round(seconds * this.balance.server.tickRate));
    }

    private msToTicks(ms: number): number {
        if (!Number.isFinite(ms) || ms <= 0) return 0;
        const msPerTick = 1000 / this.balance.server.tickRate;
        return Math.max(1, Math.round(ms / msPerTick));
    }

    private randomPointInMap() {
        const world = this.balance.worldPhysics;
        if (world.worldShape === "circle") {
            const radius = world.radiusM ?? this.balance.world.mapSize / 2;
            const angle = this.rng.range(0, Math.PI * 2);
            const r = Math.sqrt(this.rng.next()) * radius;
            return {
                x: Math.cos(angle) * r,
                y: Math.sin(angle) * r,
            };
        }

        const width = world.widthM ?? this.balance.world.mapSize;
        const height = world.heightM ?? this.balance.world.mapSize;
        return {
            x: this.rng.range(-width / 2, width / 2),
            y: this.rng.range(-height / 2, height / 2),
        };
    }

    private clampPointToWorld(x: number, y: number) {
        const world = this.balance.worldPhysics;
        if (world.worldShape === "circle") {
            const radius = world.radiusM ?? this.balance.world.mapSize / 2;
            const dist = Math.hypot(x, y);
            if (dist > radius && dist > 0) {
                const scale = radius / dist;
                return { x: x * scale, y: y * scale };
            }
            return { x, y };
        }

        const width = world.widthM ?? this.balance.world.mapSize;
        const height = world.heightM ?? this.balance.world.mapSize;
        return {
            x: this.clamp(x, -width / 2, width / 2),
            y: this.clamp(y, -height / 2, height / 2),
        };
    }

    private applyWorldBounds(entity: { x: number; y: number; vx: number; vy: number }, radius: number) {
        const world = this.balance.worldPhysics;
        const restitution = world.restitution;
        if (world.worldShape === "circle") {
            const limit = world.radiusM ?? this.balance.world.mapSize / 2;
            const dist = Math.hypot(entity.x, entity.y);
            if (dist + radius > limit) {
                const nx = dist > 1e-6 ? entity.x / dist : 1;
                const ny = dist > 1e-6 ? entity.y / dist : 0;
                entity.x = nx * (limit - radius);
                entity.y = ny * (limit - radius);
                const velAlongNormal = entity.vx * nx + entity.vy * ny;
                entity.vx -= (1 + restitution) * velAlongNormal * nx;
                entity.vy -= (1 + restitution) * velAlongNormal * ny;
            }
            return;
        }

        const width = world.widthM ?? this.balance.world.mapSize;
        const height = world.heightM ?? this.balance.world.mapSize;
        const halfW = width / 2;
        const halfH = height / 2;
        if (entity.x - radius < -halfW) {
            entity.x = -halfW + radius;
            entity.vx = Math.abs(entity.vx) * restitution;
        } else if (entity.x + radius > halfW) {
            entity.x = halfW - radius;
            entity.vx = -Math.abs(entity.vx) * restitution;
        }
        if (entity.y - radius < -halfH) {
            entity.y = -halfH + radius;
            entity.vy = Math.abs(entity.vy) * restitution;
        } else if (entity.y + radius > halfH) {
            entity.y = halfH - radius;
            entity.vy = -Math.abs(entity.vy) * restitution;
        }
    }

    private applySpeedCap(entity: { vx: number; vy: number }, maxSpeed: number) {
        const speedSq = entity.vx * entity.vx + entity.vy * entity.vy;
        const maxSpeedSq = maxSpeed * maxSpeed;
        if (speedSq <= maxSpeedSq || maxSpeedSq <= 0) return;
        const speed = Math.sqrt(speedSq);
        const dampedSpeed = maxSpeed + (speed - maxSpeed) * (1 - this.balance.physics.speedDampingRate);
        const scale = dampedSpeed / speed;
        entity.vx *= scale;
        entity.vy *= scale;
    }

    private reportMetrics(startMs: number) {
        const dt = Date.now() - startMs;
        this.metricsAccumulatorMs += dt;
        this.metricsTickCount += 1;
        if (dt > this.metricsMaxTickMs) {
            this.metricsMaxTickMs = dt;
        }
        
        // Предупреждаем, если тик стабильно приближается к исчерпанию бюджета (≈85%)
        const tickBudgetMs = this.balance.server.simulationIntervalMs;
        const warnThresholdMs = tickBudgetMs * 0.85;
        if (dt > warnThresholdMs) {
            console.warn(`[PERF] tick=${this.tick} took ${dt.toFixed(1)}ms (budget: ${tickBudgetMs.toFixed(1)}ms, warn ≥ ${warnThresholdMs.toFixed(1)}ms)`);
        }
        
        if (this.metricsTickCount >= this.metricsIntervalTicks) {
            const avg = this.metricsAccumulatorMs / this.metricsTickCount;
            console.log(
                `tick=${this.tick} dt_avg=${avg.toFixed(2)}ms dt_max=${this.metricsMaxTickMs.toFixed(2)}ms players=${this.state.players.size} orbs=${this.state.orbs.size} chests=${this.state.chests.size}`
            );
            this.metricsAccumulatorMs = 0;
            this.metricsTickCount = 0;
            this.metricsMaxTickMs = 0;
        }
    }
}
