import { Room, Client } from "colyseus";
import { GameState, Player, Orb, Chest, HotZone } from "./schema/GameState";
import {
    InputCommand,
    MatchPhaseId,
    getSlimeDamage,
    getSlimeHp,
    getSlimeRadius,
    getOrbRadius,
    getSpeedMultiplier,
    getTurnRateDeg,
    FLAG_RESPAWN_SHIELD,
    FLAG_LAST_BREATH,
    FLAG_IS_REBEL,
    FLAG_IS_DEAD,
    ResolvedBalanceConfig,
} from "@slime-arena/shared";
import { loadBalanceConfig } from "../config/loadBalanceConfig";
import { Rng } from "../utils/rng";

type ContactZone = "mouth" | "tail" | "side";

interface ClassStats {
    speedMult: number;
    hpMult: number;
    radiusMult: number;
    damageMult: number;
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
    private lastOrbSpawnTick = 0;
    private lastChestSpawnTick = 0;
    private lastPhaseId: MatchPhaseId | null = null;
    private lastRebelUpdateTick = 0;
    private metricsAccumulatorMs = 0;
    private metricsTickCount = 0;
    private metricsIntervalTicks = 0;
    private maxTalentQueue = 3;

    private attackCooldownTicks = 0;
    private invulnerableTicks = 0;
    private biteCooldownTicks = 0;
    private respawnShieldTicks = 0;
    private respawnDelayTicks = 0;
    private driftDurationTicks = 0;
    private driftCooldownTicks = 0;
    private orbSpawnIntervalTicks = 0;
    private chestSpawnIntervalTicks = 0;
    private lastBreathTicks = 0;
    private rebelUpdateIntervalTicks = 0;

    onCreate(options: { seed?: number } = {}) {
        this.balance = loadBalanceConfig();
        this.maxClients = this.balance.server.maxPlayers;
        this.rng = new Rng(Number(options.seed ?? Date.now()));

        this.attackCooldownTicks = this.secondsToTicks(this.balance.combat.attackCooldownSec);
        this.invulnerableTicks = this.secondsToTicks(this.balance.combat.damageInvulnSec);
        this.biteCooldownTicks = this.secondsToTicks(this.balance.combat.biteCooldownSec);
        this.respawnShieldTicks = this.secondsToTicks(this.balance.combat.respawnShieldSec);
        this.respawnDelayTicks = this.secondsToTicks(this.balance.death.respawnDelaySec);
        this.driftDurationTicks = this.secondsToTicks(this.balance.movement.driftDurationSec);
        this.driftCooldownTicks = this.secondsToTicks(this.balance.movement.driftCooldownSec);
        this.orbSpawnIntervalTicks = this.secondsToTicks(this.balance.orbs.respawnIntervalSec);
        this.chestSpawnIntervalTicks = this.secondsToTicks(this.balance.chests.spawnIntervalSec);
        this.lastBreathTicks = this.secondsToTicks(this.balance.combat.lastBreathDurationSec);
        this.rebelUpdateIntervalTicks = this.secondsToTicks(this.balance.rebel.updateIntervalSec);
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

            const abilitySlot = data.abilitySlot;
            if (
                typeof abilitySlot === "number" &&
                Number.isInteger(abilitySlot) &&
                abilitySlot >= 0 &&
                abilitySlot <= 2
            ) {
                player.abilitySlotPressed = abilitySlot;
            } else {
                player.abilitySlotPressed = null;
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
        });

        this.setSimulationInterval(() => this.onTick(), this.balance.server.simulationIntervalMs);

        this.spawnInitialOrbs();
        console.log("ArenaRoom created!");
    }

    onJoin(client: Client, options: { name?: string } = {}) {
        const player = new Player();
        player.id = client.sessionId;
        player.name = options.name ?? `Slime_${client.sessionId.slice(0, 4)}`;
        const spawn = this.randomPointInMap();
        player.x = spawn.x;
        player.y = spawn.y;
        player.mass = this.balance.slime.initialMass;
        player.level = this.balance.slime.initialLevel;
        player.classId = this.balance.slime.initialClassId;
        player.talentsAvailable = 0;
        player.angle = 0;
        player.isDead = false;
        player.isDrifting = false;
        player.gcdReadyTick = this.tick;
        this.updateMaxHpForMass(player);
        player.hp = player.maxHp;
        this.state.players.set(client.sessionId, player);
        this.updateLeaderboard();
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

        this.updateMatchPhase();
        this.collectInputs();
        this.applyInputs();
        this.abilitySystem();
        this.updateOrbs();
        this.updateChests();
        this.movementSystem();
        this.boundsSystem();
        this.collisionSystem();
        this.chestSystem();
        this.pickupSystem();
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
        for (const player of this.state.players.values()) {
            if (player.isDead) continue;
            const len = Math.hypot(player.inputX, player.inputY);
            if (len < deadzone) {
                player.inputX = 0;
                player.inputY = 0;
            }
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
        player.gcdReadyTick = this.tick + this.balance.server.globalCooldownTicks;
        player.queuedAbilitySlot = null;
        console.log(`Player ${player.id} used ability ${slot}`);
    }

    private applyTalentChoice(player: Player, choice: number) {
        const applyMassBonus = (bonus: number) => {
            if (bonus <= 0) return;
            const hpRatio = player.maxHp > 0 ? player.hp / player.maxHp : 1;
            player.mass += player.mass * bonus;
            this.updateMaxHpForMass(player);
            player.hp = Math.min(player.maxHp, player.maxHp * hpRatio);
        };

        switch (choice) {
            case 0:
                applyMassBonus(0.05);
                break;
            case 1: {
                const heal = player.maxHp * 0.3;
                player.hp = Math.min(player.maxHp, player.hp + heal);
                break;
            }
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

    private movementSystem() {
        const dt = 1 / this.balance.server.tickRate;
        for (const player of this.state.players.values()) {
            if (player.isDead) continue;

            const classStats = this.getClassStats(player);
            const speedMult = getSpeedMultiplier(player.mass, this.balance.formulas) * classStats.speedMult;
            const turnRateDeg = getTurnRateDeg(
                player.mass,
                this.balance.movement.baseTurnRateDeg,
                this.balance.movement.turnDivisor
            );

            if (player.inputX !== 0 || player.inputY !== 0) {
                const targetAngle = Math.atan2(player.inputY, player.inputX) * (180 / Math.PI);
                let diff = this.normalizeAngle(targetAngle - player.angle);

                if (
                    !player.isDrifting &&
                    this.tick >= player.driftCooldownEndTick &&
                    Math.abs(diff) > this.balance.movement.driftThresholdAngleDeg
                ) {
                    player.isDrifting = true;
                    player.driftEndTick = this.tick + this.driftDurationTicks;
                    player.driftCooldownEndTick = this.tick + this.driftDurationTicks + this.driftCooldownTicks;
                    const loss = Math.max(0, 1 - this.balance.movement.driftSpeedLoss);
                    player.vx *= loss;
                    player.vy *= loss;
                }

                let currentTurnRate = turnRateDeg;
                if (player.isDrifting) {
                    currentTurnRate = this.balance.movement.driftTurnRateDeg;
                }

                const maxTurn = currentTurnRate * dt;
                if (Math.abs(diff) <= maxTurn) {
                    player.angle = targetAngle;
                } else {
                    player.angle += Math.sign(diff) * maxTurn;
                }
                player.angle = this.normalizeAngle(player.angle);
            }

            if (player.isDrifting && this.tick >= player.driftEndTick) {
                player.isDrifting = false;
            }

            const inputMag = Math.hypot(player.inputX, player.inputY);
            if (inputMag > 0) {
                const baseSpeed = this.balance.movement.baseSpeed;
                let accel = baseSpeed * speedMult * inputMag;
                let maxSpeed = this.balance.physics.maxSlimeSpeed * speedMult;
                if (player.isLastBreath) {
                    accel *= this.balance.combat.lastBreathSpeedPenalty;
                    maxSpeed *= this.balance.combat.lastBreathSpeedPenalty;
                }
                const angleRad = player.angle * (Math.PI / 180);
                player.vx += Math.cos(angleRad) * accel * dt;
                player.vy += Math.sin(angleRad) * accel * dt;

                this.applySpeedCap(player, maxSpeed);
            }

            const damping = Math.max(
                0,
                1 - this.balance.physics.environmentDrag - this.balance.physics.slimeLinearDamping
            );
            player.vx *= damping;
            player.vy *= damping;

            player.x += player.vx * dt;
            player.y += player.vy * dt;
        }
    }

    private boundsSystem() {
        const mapSize = this.balance.world.mapSize;
        for (const player of this.state.players.values()) {
            if (player.isDead) continue;
            const radius = this.getPlayerRadius(player);
            this.applyBounds(player, radius, mapSize);
        }
        for (const orb of this.state.orbs.values()) {
            const type = this.balance.orbs.types[orb.colorId] ?? this.balance.orbs.types[0];
            const radius = getOrbRadius(orb.mass, type.density, this.balance.orbs.minRadius);
            this.applyBounds(orb, radius, mapSize);
        }
        for (const chest of this.state.chests.values()) {
            this.applyBounds(chest, this.balance.chests.radius, mapSize);
        }
    }

    private collisionSystem() {
        const players = Array.from(this.state.players.values());
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

                const dist = Math.sqrt(distSq) || 1;
                const nx = dx / dist;
                const ny = dy / dist;
                const overlap = minDist - dist;
                const totalMass = p1.mass + p2.mass;
                const p1Ratio = p2.mass / totalMass;
                const p2Ratio = p1.mass / totalMass;
                p1.x -= nx * overlap * p1Ratio;
                p1.y -= ny * overlap * p1Ratio;
                p2.x += nx * overlap * p2Ratio;
                p2.y += ny * overlap * p2Ratio;

                const rvx = p2.vx - p1.vx;
                const rvy = p2.vy - p1.vy;
                const velAlongNormal = rvx * nx + rvy * ny;
                if (velAlongNormal < 0) {
                    let impulse = -(1 + this.balance.physics.collisionRestitution) * velAlongNormal;
                    impulse /= 1 / p1.mass + 1 / p2.mass;
                    impulse = Math.min(impulse, this.balance.physics.collisionImpulseCap);
                    const ix = impulse * nx;
                    const iy = impulse * ny;
                    p1.vx -= (1 / p1.mass) * ix;
                    p1.vy -= (1 / p1.mass) * iy;
                    p2.vx += (1 / p2.mass) * ix;
                    p2.vy += (1 / p2.mass) * iy;
                }

                this.processCombat(p1, p2, dx, dy);
                this.processCombat(p2, p1, -dx, -dy);
            }
        }
    }

    private processCombat(attacker: Player, defender: Player, dx: number, dy: number) {
        if (attacker.isDead || defender.isDead) return;
        if (this.tick < attacker.lastAttackTick + this.attackCooldownTicks) return;
        if (this.tick < defender.invulnerableUntilTick) return;

        const attackerZone = this.getContactZone(attacker, dx, dy);
        if (attackerZone !== "mouth") return;

        const defenderZone = this.getContactZone(defender, -dx, -dy);
        let damageMultiplier = 1;
        if (defenderZone === "tail") {
            damageMultiplier = this.balance.combat.tailDamageMultiplier;
        } else if (defenderZone === "mouth") {
            damageMultiplier = 0.5;
        }

        const classStats = this.getClassStats(attacker);
        let damage = getSlimeDamage(attacker.mass, this.balance.formulas) * damageMultiplier * classStats.damageMult;
        if (attacker.isLastBreath) {
            damage *= this.balance.combat.lastBreathDamageMult;
        }

        attacker.lastAttackTick = this.tick;

        if (
            defender.hp - damage <= 0 &&
            !defender.isLastBreath &&
            this.lastBreathTicks > 0 &&
            !defender.isDead
        ) {
            defender.isLastBreath = true;
            defender.lastBreathEndTick = this.tick + this.lastBreathTicks;
            defender.invulnerableUntilTick = defender.lastBreathEndTick;
            defender.hp = 0;
            return;
        }

        defender.hp = Math.max(0, defender.hp - damage);

        const stolenMass = damage * this.balance.combat.massStealPercent;
        attacker.mass += stolenMass;
        defender.mass = Math.max(this.balance.physics.minSlimeMass, defender.mass - stolenMass);
        this.updateMaxHpForMass(attacker);
        this.updateMaxHpForMass(defender);

        defender.invulnerableUntilTick = this.tick + this.invulnerableTicks;
    }

    private pickupSystem() {
        const dt = 1 / this.balance.server.tickRate;
        const orbEntries = Array.from(this.state.orbs.entries());
        for (const player of this.state.players.values()) {
            if (player.isDead) continue;
            if (this.tick < player.lastBiteTick + this.biteCooldownTicks) continue;

            const classStats = this.getClassStats(player);
            const playerRadius = this.getPlayerRadius(player);
            const mouthHalf = (this.balance.combat.mouthArcDeg / 2) * (Math.PI / 180);
            const playerAngleRad = player.angle * (Math.PI / 180);

            for (const [orbId, orb] of orbEntries) {
                if (!this.state.orbs.has(orbId)) continue;
                const dx = orb.x - player.x;
                const dy = orb.y - player.y;
                const distSq = dx * dx + dy * dy;
                const type = this.balance.orbs.types[orb.colorId] ?? this.balance.orbs.types[0];
                const orbRadius = getOrbRadius(orb.mass, type.density, this.balance.orbs.minRadius);
                const touchDist = playerRadius + orbRadius;
                if (distSq > touchDist * touchDist) continue;

                const angleToOrb = Math.atan2(dy, dx);
                let angleDiff = angleToOrb - playerAngleRad;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                if (Math.abs(angleDiff) > mouthHalf) continue;

                player.lastBiteTick = this.tick;

                const biteFraction = Math.min(1, classStats.biteFraction * classStats.eatingPowerMult);
                const canSwallow = orb.mass <= classStats.swallowLimit;
                const biteMass = canSwallow ? orb.mass : orb.mass * biteFraction;

                if (orb.mass - biteMass <= this.balance.orbs.minMass) {
                    player.mass += orb.mass;
                    this.state.orbs.delete(orbId);
                } else {
                    orb.mass -= biteMass;
                    player.mass += biteMass;
                    const dist = Math.sqrt(distSq) || 1;
                    const push = this.balance.orbs.pushForce;
                    orb.vx += (dx / dist) * push * dt;
                    orb.vy += (dy / dist) * push * dt;
                }

                player.mass = Math.max(this.balance.physics.minSlimeMass, player.mass);
                this.updateMaxHpForMass(player);
                if (player.hp > player.maxHp) {
                    player.hp = player.maxHp;
                }
            }
        }
    }

    private chestSystem() {
        const dt = 1 / this.balance.server.tickRate;
        const chestEntries = Array.from(this.state.chests.entries());
        for (const player of this.state.players.values()) {
            if (player.isDead) continue;
            const playerRadius = this.getPlayerRadius(player);
            const playerAngleRad = player.angle * (Math.PI / 180);
            const mouthHalf = (this.balance.combat.mouthArcDeg / 2) * (Math.PI / 180);

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

                if (isMouthHit && this.tick >= player.lastBiteTick + this.biteCooldownTicks) {
                    this.openChest(player, chestId);
                    player.lastBiteTick = this.tick;
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
            player.mass += gain;
            this.updateMaxHpForMass(player);
            if (player.hp > player.maxHp) {
                player.hp = player.maxHp;
            }
        }

        this.state.chests.delete(chestId);
    }

    private grantTalent(player: Player): boolean {
        if (player.talentsAvailable >= this.maxTalentQueue) return false;
        player.talentsAvailable += 1;
        return true;
    }

    private deathSystem() {
        for (const player of this.state.players.values()) {
            if (player.isLastBreath && this.tick >= player.lastBreathEndTick) {
                player.isLastBreath = false;
            }

            if (!player.isDead && player.hp <= 0 && !player.isLastBreath) {
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
        this.updateMaxHpForMass(player);
        player.hp = player.maxHp;
        const spawn = this.randomPointInMap();
        player.x = spawn.x;
        player.y = spawn.y;
        player.vx = 0;
        player.vy = 0;
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

        for (const orb of this.state.orbs.values()) {
            const damping = Math.max(
                0,
                1 - this.balance.physics.environmentDrag - this.balance.physics.orbLinearDamping
            );
            orb.vx *= damping;
            orb.vy *= damping;
            this.applySpeedCap(orb, this.balance.physics.maxOrbSpeed);
            orb.x += orb.vx * dt;
            orb.y += orb.vy * dt;
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
        }
    }

    private hungerSystem() {
        const phase = this.state.phase as MatchPhaseId;
        if (phase !== "Chaos" && phase !== "Final") return;
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
            player.mass = Math.max(this.balance.hunger.minMass, player.mass - drain);
            this.updateMaxHpForMass(player);
            if (player.hp > player.maxHp) {
                player.hp = player.maxHp;
            }
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
            .slice(0, 3);
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
            player.flags = flags;
        }
    }

    private updateMatchPhase() {
        const elapsedSec = this.tick / this.balance.server.tickRate;
        this.state.timeRemaining = Math.max(0, this.balance.match.durationSec - elapsedSec);

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

    private handlePhaseChange(phase: MatchPhaseId) {
        this.state.hotZones.clear();
        if (phase === "Chaos") {
            this.spawnHotZones(this.balance.hotZones.chaosCount, this.balance.hotZones.spawnMultiplierChaos);
        } else if (phase === "Final") {
            this.spawnHotZones(this.balance.hotZones.finalCount, this.balance.hotZones.spawnMultiplierFinal, true);
        }
    }

    private spawnHotZones(count: number, spawnMultiplier: number, centerFirst = false) {
        const mapSize = this.balance.world.mapSize;
        const radius = this.balance.hotZones.radius;
        for (let i = 0; i < count; i += 1) {
            const zone = new HotZone();
            zone.id = `hot_${this.hotZoneIdCounter++}`;
            if (centerFirst && i === 0) {
                zone.x = mapSize / 2;
                zone.y = mapSize / 2;
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
            return {
                x: Math.max(0, Math.min(this.balance.world.mapSize, x)),
                y: Math.max(0, Math.min(this.balance.world.mapSize, y)),
            };
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
        const typePick = this.pickOrbType();
        const orb = new Orb();
        orb.id = `orb_${this.orbIdCounter++}`;
        orb.x = x ?? this.rng.range(0, this.balance.world.mapSize);
        orb.y = y ?? this.rng.range(0, this.balance.world.mapSize);
        orb.mass =
            massOverride ??
            this.rng.range(typePick.type.massRange[0], typePick.type.massRange[1]);
        orb.colorId = typePick.index;
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
        const classStats = this.getClassStats(player);
        return getSlimeRadius(player.mass, this.balance.formulas) * classStats.radiusMult;
    }

    private getClassStats(player: Player): ClassStats {
        switch (player.classId) {
            case 1:
                return {
                    speedMult: this.balance.classes.warrior.speedMult,
                    hpMult: this.balance.classes.warrior.hpMult,
                    radiusMult: 1,
                    damageMult: this.balance.classes.warrior.damageVsSlimeMult,
                    swallowLimit: this.balance.classes.warrior.swallowLimit,
                    biteFraction: this.balance.classes.warrior.biteFraction,
                    eatingPowerMult: 1,
                };
            case 2:
                return {
                    speedMult: 1,
                    hpMult: 1,
                    radiusMult: this.balance.classes.collector.radiusMult,
                    damageMult: 1,
                    swallowLimit: this.balance.classes.collector.swallowLimit,
                    biteFraction: this.balance.classes.collector.biteFraction,
                    eatingPowerMult: this.balance.classes.collector.eatingPowerMult,
                };
            case 0:
            default:
                return {
                    speedMult: this.balance.classes.hunter.speedMult,
                    hpMult: this.balance.classes.hunter.hpMult,
                    radiusMult: 1,
                    damageMult: 1,
                    swallowLimit: this.balance.classes.hunter.swallowLimit,
                    biteFraction: this.balance.classes.hunter.biteFraction,
                    eatingPowerMult: 1,
                };
        }
    }

    private updateMaxHpForMass(player: Player) {
        const classStats = this.getClassStats(player);
        const maxHp = getSlimeHp(player.mass, this.balance.formulas) * classStats.hpMult;
        if (player.maxHp !== maxHp) {
            player.maxHp = maxHp;
        }
        if (player.hp > player.maxHp) {
            player.hp = player.maxHp;
        }
    }

    private getContactZone(attacker: Player, dx: number, dy: number): ContactZone {
        const angleToTarget = Math.atan2(dy, dx) * (180 / Math.PI);
        const diff = this.normalizeAngle(angleToTarget - attacker.angle);
        const mouthHalf = this.balance.combat.mouthArcDeg / 2;
        const tailHalf = this.balance.combat.tailArcDeg / 2;
        if (Math.abs(diff) <= mouthHalf) return "mouth";
        if (Math.abs(diff) >= 180 - tailHalf) return "tail";
        return "side";
    }

    private normalizeAngle(angle: number): number {
        let value = angle;
        while (value < -180) value += 360;
        while (value > 180) value -= 360;
        return value;
    }

    private secondsToTicks(seconds: number): number {
        if (!Number.isFinite(seconds) || seconds <= 0) return 0;
        return Math.max(1, Math.round(seconds * this.balance.server.tickRate));
    }

    private randomPointInMap() {
        const size = this.balance.world.mapSize;
        return {
            x: this.rng.range(0, size),
            y: this.rng.range(0, size),
        };
    }

    private applyBounds(entity: { x: number; y: number; vx: number; vy: number }, radius: number, mapSize: number) {
        const restitution = this.balance.physics.collisionRestitution;
        if (entity.x - radius < 0) {
            entity.x = radius;
            entity.vx = Math.abs(entity.vx) * restitution;
        } else if (entity.x + radius > mapSize) {
            entity.x = mapSize - radius;
            entity.vx = -Math.abs(entity.vx) * restitution;
        }
        if (entity.y - radius < 0) {
            entity.y = radius;
            entity.vy = Math.abs(entity.vy) * restitution;
        } else if (entity.y + radius > mapSize) {
            entity.y = mapSize - radius;
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
        if (this.metricsTickCount >= this.metricsIntervalTicks) {
            const avg = this.metricsAccumulatorMs / this.metricsTickCount;
            console.log(
                `tick=${this.tick} dt_avg_ms=${avg.toFixed(2)} players=${this.state.players.size} orbs=${this.state.orbs.size}`
            );
            this.metricsAccumulatorMs = 0;
            this.metricsTickCount = 0;
        }
    }
}
