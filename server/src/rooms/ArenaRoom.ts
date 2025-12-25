import { Room, Client } from "colyseus";
import { GameState, Player, Orb, Chest, HotZone } from "./schema/GameState";
import {
    InputCommand,
    MatchPhaseId,
    getSlimeBiteDamage,
    getSlimeInertia,
    getSlimeRadiusFromConfig,
    scaleSlimeValue,
    getOrbRadius,
    FLAG_RESPAWN_SHIELD,
    FLAG_LAST_BREATH,
    FLAG_IS_REBEL,
    FLAG_IS_DEAD,
    ResolvedBalanceConfig,
    SlimeConfig,
    generateUniqueName,
} from "@slime-arena/shared";
import { loadBalanceConfig } from "../config/loadBalanceConfig";
import { Rng } from "../utils/rng";

type ContactZone = "mouth" | "tail" | "side";

interface ClassStats {
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
    private metricsMaxTickMs = 0;
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
        this.driftDurationTicks = this.secondsToTicks(this.balance.movement.driftDurationSec);
        this.driftCooldownTicks = this.secondsToTicks(this.balance.movement.driftCooldownSec);
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
        // Генерируем юмористическое имя если не указано
        if (options.name && options.name.trim().length > 0) {
            player.name = options.name.trim().slice(0, 20);
        } else {
            // Собираем существующие имена для проверки уникальности
            const existingNames: string[] = [];
            this.state.players.forEach((p) => existingNames.push(p.name));
            
            // Используем seed от RNG для детерминированности
            const nameSeed = this.rng.int(0, 2147483647);
            player.name = generateUniqueName(nameSeed, existingNames);
        }
        const spawn = this.randomPointInMap();
        player.x = spawn.x;
        player.y = spawn.y;
        player.mass = this.balance.slime.initialMass;
        player.level = this.balance.slime.initialLevel;
        player.classId = this.balance.slime.initialClassId;
        player.talentsAvailable = 0;
        player.angle = 0;
        player.angVel = 0;
        player.isDead = false;
        player.isDrifting = false;
        player.gcdReadyTick = this.tick;
        player.lastInputTick = this.tick;
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
        this.state.serverTick = this.tick;

        this.updateMatchPhase();
        this.collectInputs();
        this.applyInputs();
        this.abilitySystem();
        this.updateOrbs();
        this.updateChests();
        this.flightAssistSystem();
        this.physicsSystem();
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
        // Блокируем ввод во время фазы Results
        if (this.isMatchEnded) {
            for (const player of this.state.players.values()) {
                player.inputX = 0;
                player.inputY = 0;
            }
            return;
        }

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
        player.gcdReadyTick = this.tick + this.balance.server.globalCooldownTicks;
        player.queuedAbilitySlot = null;
        console.log(`Player ${player.id} used ability ${slot}`);
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
        const iterations = 4;
        const slop = 0.001;
        const percent = 0.8;
        const restitution = this.balance.worldPhysics.restitution;
        const maxCorrection = this.balance.worldPhysics.maxPositionCorrectionM;

        for (let iter = 0; iter < iterations; iter += 1) {
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

            for (const player of players) {
                if (player.isDead) continue;
                this.applyWorldBounds(player, this.getPlayerRadius(player));
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

        const slimeConfig = this.getSlimeConfig(attacker);
        const classStats = this.getClassStats(attacker);
        
        // Усиленный PvP урон: % от массы атакующего + % от массы жертвы
        const baseDamage = getSlimeBiteDamage(attacker.mass, slimeConfig);
        const safeAttackerMass = Math.max(0, attacker.mass);
        const safeDefenderMass = Math.max(0, defender.mass);
        const pvpAttackerBonus = safeAttackerMass * this.balance.combat.pvpBiteDamageAttackerMassPct;
        const pvpVictimBonus = safeDefenderMass * this.balance.combat.pvpBiteDamageVictimMassPct;
        let damage = (baseDamage + pvpAttackerBonus + pvpVictimBonus) * damageMultiplier * classStats.damageMult;
        
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
        if (stolenMass > 0) {
            this.applyMassDelta(attacker, stolenMass);
            this.applyMassDelta(defender, -stolenMass);
        }

        defender.invulnerableUntilTick = this.tick + this.invulnerableTicks;
    }

    private pickupSystem() {
        const dt = 1 / this.balance.server.tickRate;
        const orbEntries = Array.from(this.state.orbs.entries());
        for (const player of this.state.players.values()) {
            if (player.isDead) continue;
            if (this.tick < player.lastBiteTick + this.biteCooldownTicks) continue;

            const slimeConfig = this.getSlimeConfig(player);
            const classStats = this.getClassStats(player);
            const playerRadius = this.getPlayerRadius(player);
            const mouthHalf = (this.balance.combat.mouthArcDeg * Math.PI) / 360;
            const playerAngleRad = player.angle;

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
                const maxBite = Math.max(0, player.mass * slimeConfig.combat.orbBitePctOfMass);
                const biteMassRaw = canSwallow ? orb.mass : orb.mass * biteFraction;
                const biteMass = maxBite > 0 ? Math.min(biteMassRaw, maxBite) : biteMassRaw;

                if (orb.mass - biteMass <= this.balance.orbs.minMass) {
                    this.applyMassDelta(player, orb.mass);
                    this.state.orbs.delete(orbId);
                } else {
                    orb.mass -= biteMass;
                    this.applyMassDelta(player, biteMass);
                    const dist = Math.sqrt(distSq) || 1;
                    const push = this.balance.orbs.pushForce;
                    const density = type.density > 0 ? type.density : 1;
                    const physicsMass = Math.max(orb.mass * density, this.balance.orbs.minMass);
                    const accel = push / Math.max(physicsMass, 1e-6);
                    orb.vx += (dx / dist) * accel * dt;
                    orb.vy += (dy / dist) * accel * dt;
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
            this.applyMassDelta(player, gain);
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
        player.maxHp = Math.max(0, player.mass);
        player.hp = player.maxHp;
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

        for (const orb of this.state.orbs.values()) {
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
            const radius = getOrbRadius(orb.mass, type.density, this.balance.orbs.minRadius);
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

        // Очистка состояния
        this.state.orbs.clear();
        this.state.chests.clear();
        this.state.hotZones.clear();
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
            this.updateMaxHpForMass(player);
            player.hp = player.maxHp;
        }

        this.spawnInitialOrbs();
        this.updateLeaderboard();
        console.log("Match restarted!");
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
        const spawn = x !== undefined && y !== undefined ? { x, y } : this.randomPointInMap();
        const typePick = this.pickOrbType();
        const orb = new Orb();
        orb.id = `orb_${this.orbIdCounter++}`;
        orb.x = x ?? spawn.x;
        orb.y = y ?? spawn.y;
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
                    swallowLimit: this.balance.classes.warrior.swallowLimit,
                    biteFraction: this.balance.classes.warrior.biteFraction,
                    eatingPowerMult: 1,
                };
            case 2:
                return {
                    radiusMult: this.balance.classes.collector.radiusMult,
                    damageMult: 1,
                    swallowLimit: this.balance.classes.collector.swallowLimit,
                    biteFraction: this.balance.classes.collector.biteFraction,
                    eatingPowerMult: this.balance.classes.collector.eatingPowerMult,
                };
            case 0:
            default:
                return {
                    radiusMult: 1,
                    damageMult: 1,
                    swallowLimit: this.balance.classes.hunter.swallowLimit,
                    biteFraction: this.balance.classes.hunter.biteFraction,
                    eatingPowerMult: 1,
                };
        }
    }

    private updateMaxHpForMass(player: Player) {
        const maxHp = Math.max(0, player.mass);
        if (player.maxHp !== maxHp) {
            player.maxHp = maxHp;
        }
        if (player.hp > player.maxHp) {
            player.hp = player.maxHp;
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
        const applied = nextMass - player.mass;
        if (applied === 0) return;

        player.mass = nextMass;
        player.maxHp = Math.max(0, player.mass);
        if (applied > 0) {
            player.hp = Math.min(player.maxHp, player.hp + applied);
        } else if (player.hp > player.maxHp) {
            player.hp = player.maxHp;
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
