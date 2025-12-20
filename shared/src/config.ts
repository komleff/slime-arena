import { MatchPhaseId, MATCH_PHASES } from "./types.js";

export interface FormulaConfig {
    base: number;
    scale: number;
    divisor: number;
}

export interface MatchPhaseConfig {
    id: MatchPhaseId;
    startSec: number;
    endSec: number;
}

export interface BalanceConfig {
    world: {
        mapSize: number;
    };
    server: {
        maxPlayers: number;
        tickRate: number;
        simulationIntervalMs: number;
        globalCooldownMs: number;
        abilityQueueSize: number;
    };
    match: {
        durationSec: number;
        phases: MatchPhaseConfig[];
    };
    physics: {
        environmentDrag: number;
        collisionRestitution: number;
        collisionImpulseCap: number;
        slimeLinearDamping: number;
        orbLinearDamping: number;
        speedDampingRate: number;
        minSlimeMass: number;
        maxSlimeSpeed: number;
        maxOrbSpeed: number;
    };
    controls: {
        joystickMode: "adaptive" | "fixed";
        joystickRadius: number;
        joystickDeadzone: number;
        joystickSensitivity: number;
        joystickFollowSpeed: number;
    };
    slime: {
        initialMass: number;
        initialLevel: number;
        initialClassId: number;
    };
    movement: {
        baseSpeed: number;
        baseTurnRateDeg: number;
        turnDivisor: number;
        driftTurnRateDeg: number;
        driftThresholdAngleDeg: number;
        driftDurationSec: number;
        driftSpeedLoss: number;
        driftCooldownSec: number;
    };
    combat: {
        mouthArcDeg: number;
        tailArcDeg: number;
        tailDamageMultiplier: number;
        attackCooldownSec: number;
        damageInvulnSec: number;
        biteCooldownSec: number;
        respawnShieldSec: number;
        lastBreathDurationSec: number;
        lastBreathDamageMult: number;
        lastBreathSpeedMult: number;
        massStealPercent: number;
    };
    death: {
        respawnDelaySec: number;
        massLostPercent: number;
        massToOrbsPercent: number;
        orbsCount: number;
        minRespawnMass: number;
    };
    orbs: {
        initialCount: number;
        maxCount: number;
        respawnIntervalSec: number;
        minMass: number;
        minRadius: number;
        pushForce: number;
        types: Array<{
            id: string;
            weight: number;
            density: number;
            massRange: [number, number];
        }>;
    };
    formulas: {
        hp: FormulaConfig;
        damage: FormulaConfig;
        speed: FormulaConfig;
        radius: FormulaConfig;
    };
    classes: {
        hunter: {
            speedMult: number;
            hpMult: number;
            swallowLimit: number;
            biteFraction: number;
        };
        warrior: {
            speedMult: number;
            hpMult: number;
            damageVsSlimeMult: number;
            swallowLimit: number;
            biteFraction: number;
        };
        collector: {
            radiusMult: number;
            eatingPowerMult: number;
            swallowLimit: number;
            biteFraction: number;
        };
    };
    chests: {
        maxCount: number;
        spawnIntervalSec: number;
        mass: number;
        radius: number;
        rewards: {
            massPercent: number[];
            talentChance: number;
        };
    };
    hotZones: {
        chaosCount: number;
        finalCount: number;
        radius: number;
        spawnMultiplierChaos: number;
        spawnMultiplierFinal: number;
    };
    hunger: {
        baseDrainPerSec: number;
        scalingPerMass: number;
        maxDrainPerSec: number;
        minMass: number;
    };
    rebel: {
        updateIntervalSec: number;
        massThresholdMultiplier: number;
    };
}

export interface ResolvedBalanceConfig extends BalanceConfig {
    server: BalanceConfig["server"] & {
        globalCooldownTicks: number;
    };
}

export const DEFAULT_BALANCE_CONFIG: BalanceConfig = {
    world: {
        mapSize: 2000,
    },
    server: {
        maxPlayers: 20,
        tickRate: 30,
        simulationIntervalMs: 1000 / 30,
        globalCooldownMs: 100,
        abilityQueueSize: 1,
    },
    match: {
        durationSec: 150,
        phases: [
            { id: "Spawn", startSec: 0, endSec: 15 },
            { id: "Collect", startSec: 15, endSec: 60 },
            { id: "Hunt", startSec: 60, endSec: 90 },
            { id: "Chaos", startSec: 90, endSec: 120 },
            { id: "Final", startSec: 120, endSec: 150 },
        ],
    },
    physics: {
        environmentDrag: 0.03,
        collisionRestitution: 0.5,
        collisionImpulseCap: 10000,
        slimeLinearDamping: 0.02,
        orbLinearDamping: 0.08,
        speedDampingRate: 0.2,
        minSlimeMass: 50,
        maxSlimeSpeed: 500,
        maxOrbSpeed: 1000,
    },
    controls: {
        joystickMode: "adaptive",
        joystickRadius: 100,
        joystickDeadzone: 0.1,
        joystickSensitivity: 1.0,
        joystickFollowSpeed: 0.8,
    },
    slime: {
        initialMass: 100,
        initialLevel: 1,
        initialClassId: 0,
    },
    movement: {
        baseSpeed: 300,
        baseTurnRateDeg: 180,
        turnDivisor: 200,
        driftTurnRateDeg: 720,
        driftThresholdAngleDeg: 120,
        driftDurationSec: 0.3,
        driftSpeedLoss: 0.5,
        driftCooldownSec: 0.5,
    },
    combat: {
        mouthArcDeg: 120,
        tailArcDeg: 120,
        tailDamageMultiplier: 1.5,
        attackCooldownSec: 0.2,
        damageInvulnSec: 0.2,
        biteCooldownSec: 0.1,
        respawnShieldSec: 5,
        lastBreathDurationSec: 0.5,
        lastBreathDamageMult: 0.5,
        lastBreathSpeedMult: 0.8,
        massStealPercent: 0.1,
    },
    death: {
        respawnDelaySec: 2,
        massLostPercent: 0.5,
        massToOrbsPercent: 0.3,
        orbsCount: 4,
        minRespawnMass: 50,
    },
    orbs: {
        initialCount: 100,
        maxCount: 150,
        respawnIntervalSec: 0.5,
        minMass: 3,
        minRadius: 5,
        pushForce: 100,
        types: [
            { id: "green", weight: 40, density: 0.8, massRange: [5, 15] },
            { id: "blue", weight: 30, density: 1.0, massRange: [20, 40] },
            { id: "red", weight: 20, density: 1.0, massRange: [20, 40] },
            { id: "gold", weight: 10, density: 1.5, massRange: [50, 100] },
        ],
    },
    formulas: {
        hp: { base: 50, scale: 50, divisor: 100 },
        damage: { base: 10, scale: 10, divisor: 100 },
        speed: { base: 1.0, scale: 1.0, divisor: 500 },
        radius: { base: 10, scale: 1.0, divisor: 50 },
    },
    classes: {
        hunter: {
            speedMult: 1.15,
            hpMult: 0.9,
            swallowLimit: 50,
            biteFraction: 0.3,
        },
        warrior: {
            speedMult: 0.9,
            hpMult: 1.15,
            damageVsSlimeMult: 1.1,
            swallowLimit: 45,
            biteFraction: 0.35,
        },
        collector: {
            radiusMult: 1.25,
            eatingPowerMult: 1.15,
            swallowLimit: 70,
            biteFraction: 0.5,
        },
    },
    chests: {
        maxCount: 3,
        spawnIntervalSec: 20,
        mass: 200,
        radius: 28,
        rewards: {
            massPercent: [0.1, 0.2, 0.3],
            talentChance: 0.3,
        },
    },
    hotZones: {
        chaosCount: 2,
        finalCount: 1,
        radius: 220,
        spawnMultiplierChaos: 3,
        spawnMultiplierFinal: 5,
    },
    hunger: {
        baseDrainPerSec: 2,
        scalingPerMass: 0.01,
        maxDrainPerSec: 12,
        minMass: 50,
    },
    rebel: {
        updateIntervalSec: 5,
        massThresholdMultiplier: 1.2,
    },
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown, fallback: number, path: string): number {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Invalid number at ${path}`);
    }
    return value;
}

function readString(value: unknown, fallback: string, path: string): string {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== "string") {
        throw new Error(`Invalid string at ${path}`);
    }
    return value;
}

function readNumberArray(value: unknown, fallback: number[], path: string): number[] {
    if (value === undefined || value === null) return fallback;
    if (!Array.isArray(value)) {
        throw new Error(`Invalid array at ${path}`);
    }
    return value.map((item, index) => readNumber(item, fallback[index] ?? 0, `${path}[${index}]`));
}

function readPhaseId(value: unknown, fallback: MatchPhaseId, path: string): MatchPhaseId {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== "string" || !MATCH_PHASES.includes(value as MatchPhaseId)) {
        throw new Error(`Invalid phase id at ${path}`);
    }
    return value as MatchPhaseId;
}

function readPhases(value: unknown, fallback: MatchPhaseConfig[], path: string): MatchPhaseConfig[] {
    if (value === undefined || value === null) return fallback;
    if (!Array.isArray(value)) {
        throw new Error(`Invalid array at ${path}`);
    }
    return value.map((item, index) => {
        if (!isRecord(item)) {
            throw new Error(`Invalid phase at ${path}[${index}]`);
        }
        const fallbackPhase = fallback[index] ?? fallback[0];
        return {
            id: readPhaseId(item.id, fallbackPhase.id, `${path}[${index}].id`),
            startSec: readNumber(item.startSec, fallbackPhase.startSec, `${path}[${index}].startSec`),
            endSec: readNumber(item.endSec, fallbackPhase.endSec, `${path}[${index}].endSec`),
        };
    });
}

function readFormula(value: unknown, fallback: FormulaConfig, path: string): FormulaConfig {
    if (!isRecord(value)) return fallback;
    return {
        base: readNumber(value.base, fallback.base, `${path}.base`),
        scale: readNumber(value.scale, fallback.scale, `${path}.scale`),
        divisor: readNumber(value.divisor, fallback.divisor, `${path}.divisor`),
    };
}

export function resolveBalanceConfig(raw: unknown): ResolvedBalanceConfig {
    const data = isRecord(raw) ? raw : {};

    const world = isRecord(data.world) ? data.world : {};
    const server = isRecord(data.server) ? data.server : {};
    const match = isRecord(data.match) ? data.match : {};
    const physics = isRecord(data.physics) ? data.physics : {};
    const controls = isRecord(data.controls) ? data.controls : {};
    const slime = isRecord(data.slime) ? data.slime : {};
    const movement = isRecord(data.movement) ? data.movement : {};
    const combat = isRecord(data.combat) ? data.combat : {};
    const death = isRecord(data.death) ? data.death : {};
    const orbs = isRecord(data.orbs) ? data.orbs : {};
    const formulas = isRecord(data.formulas) ? data.formulas : {};
    const classes = isRecord(data.classes) ? data.classes : {};
    const chests = isRecord(data.chests) ? data.chests : {};
    const hotZones = isRecord(data.hotZones) ? data.hotZones : {};
    const hunger = isRecord(data.hunger) ? data.hunger : {};
    const rebel = isRecord(data.rebel) ? data.rebel : {};
    const hunter = isRecord(classes.hunter) ? classes.hunter : {};
    const warrior = isRecord(classes.warrior) ? classes.warrior : {};
    const collector = isRecord(classes.collector) ? classes.collector : {};
    const chestRewards = isRecord(chests.rewards) ? chests.rewards : {};

    const resolved: BalanceConfig = {
        world: {
            mapSize: readNumber(world.mapSize, DEFAULT_BALANCE_CONFIG.world.mapSize, "world.mapSize"),
        },
        server: {
            maxPlayers: readNumber(server.maxPlayers, DEFAULT_BALANCE_CONFIG.server.maxPlayers, "server.maxPlayers"),
            tickRate: readNumber(server.tickRate, DEFAULT_BALANCE_CONFIG.server.tickRate, "server.tickRate"),
            simulationIntervalMs: readNumber(
                server.simulationIntervalMs,
                DEFAULT_BALANCE_CONFIG.server.simulationIntervalMs,
                "server.simulationIntervalMs"
            ),
            globalCooldownMs: readNumber(
                server.globalCooldownMs,
                DEFAULT_BALANCE_CONFIG.server.globalCooldownMs,
                "server.globalCooldownMs"
            ),
            abilityQueueSize: readNumber(
                server.abilityQueueSize,
                DEFAULT_BALANCE_CONFIG.server.abilityQueueSize,
                "server.abilityQueueSize"
            ),
        },
        match: {
            durationSec: readNumber(match.durationSec, DEFAULT_BALANCE_CONFIG.match.durationSec, "match.durationSec"),
            phases: readPhases(match.phases, DEFAULT_BALANCE_CONFIG.match.phases, "match.phases"),
        },
        physics: {
            environmentDrag: readNumber(
                physics.environmentDrag,
                DEFAULT_BALANCE_CONFIG.physics.environmentDrag,
                "physics.environmentDrag"
            ),
            collisionRestitution: readNumber(
                physics.collisionRestitution,
                DEFAULT_BALANCE_CONFIG.physics.collisionRestitution,
                "physics.collisionRestitution"
            ),
            collisionImpulseCap: readNumber(
                physics.collisionImpulseCap,
                DEFAULT_BALANCE_CONFIG.physics.collisionImpulseCap,
                "physics.collisionImpulseCap"
            ),
            slimeLinearDamping: readNumber(
                physics.slimeLinearDamping,
                DEFAULT_BALANCE_CONFIG.physics.slimeLinearDamping,
                "physics.slimeLinearDamping"
            ),
            orbLinearDamping: readNumber(
                physics.orbLinearDamping,
                DEFAULT_BALANCE_CONFIG.physics.orbLinearDamping,
                "physics.orbLinearDamping"
            ),
            speedDampingRate: readNumber(
                physics.speedDampingRate,
                DEFAULT_BALANCE_CONFIG.physics.speedDampingRate,
                "physics.speedDampingRate"
            ),
            minSlimeMass: readNumber(
                physics.minSlimeMass,
                DEFAULT_BALANCE_CONFIG.physics.minSlimeMass,
                "physics.minSlimeMass"
            ),
            maxSlimeSpeed: readNumber(
                physics.maxSlimeSpeed,
                DEFAULT_BALANCE_CONFIG.physics.maxSlimeSpeed,
                "physics.maxSlimeSpeed"
            ),
            maxOrbSpeed: readNumber(
                physics.maxOrbSpeed,
                DEFAULT_BALANCE_CONFIG.physics.maxOrbSpeed,
                "physics.maxOrbSpeed"
            ),
        },
        controls: {
            joystickMode: readString(
                controls.joystickMode,
                DEFAULT_BALANCE_CONFIG.controls.joystickMode,
                "controls.joystickMode"
            ) as BalanceConfig["controls"]["joystickMode"],
            joystickRadius: readNumber(
                controls.joystickRadius,
                DEFAULT_BALANCE_CONFIG.controls.joystickRadius,
                "controls.joystickRadius"
            ),
            joystickDeadzone: readNumber(
                controls.joystickDeadzone,
                DEFAULT_BALANCE_CONFIG.controls.joystickDeadzone,
                "controls.joystickDeadzone"
            ),
            joystickSensitivity: readNumber(
                controls.joystickSensitivity,
                DEFAULT_BALANCE_CONFIG.controls.joystickSensitivity,
                "controls.joystickSensitivity"
            ),
            joystickFollowSpeed: readNumber(
                controls.joystickFollowSpeed,
                DEFAULT_BALANCE_CONFIG.controls.joystickFollowSpeed,
                "controls.joystickFollowSpeed"
            ),
        },
        slime: {
            initialMass: readNumber(
                slime.initialMass,
                DEFAULT_BALANCE_CONFIG.slime.initialMass,
                "slime.initialMass"
            ),
            initialLevel: readNumber(
                slime.initialLevel,
                DEFAULT_BALANCE_CONFIG.slime.initialLevel,
                "slime.initialLevel"
            ),
            initialClassId: readNumber(
                slime.initialClassId,
                DEFAULT_BALANCE_CONFIG.slime.initialClassId,
                "slime.initialClassId"
            ),
        },
        movement: {
            baseSpeed: readNumber(
                movement.baseSpeed,
                DEFAULT_BALANCE_CONFIG.movement.baseSpeed,
                "movement.baseSpeed"
            ),
            baseTurnRateDeg: readNumber(
                movement.baseTurnRateDeg,
                DEFAULT_BALANCE_CONFIG.movement.baseTurnRateDeg,
                "movement.baseTurnRateDeg"
            ),
            turnDivisor: readNumber(
                movement.turnDivisor,
                DEFAULT_BALANCE_CONFIG.movement.turnDivisor,
                "movement.turnDivisor"
            ),
            driftTurnRateDeg: readNumber(
                movement.driftTurnRateDeg,
                DEFAULT_BALANCE_CONFIG.movement.driftTurnRateDeg,
                "movement.driftTurnRateDeg"
            ),
            driftThresholdAngleDeg: readNumber(
                movement.driftThresholdAngleDeg,
                DEFAULT_BALANCE_CONFIG.movement.driftThresholdAngleDeg,
                "movement.driftThresholdAngleDeg"
            ),
            driftDurationSec: readNumber(
                movement.driftDurationSec,
                DEFAULT_BALANCE_CONFIG.movement.driftDurationSec,
                "movement.driftDurationSec"
            ),
            driftSpeedLoss: readNumber(
                movement.driftSpeedLoss,
                DEFAULT_BALANCE_CONFIG.movement.driftSpeedLoss,
                "movement.driftSpeedLoss"
            ),
            driftCooldownSec: readNumber(
                movement.driftCooldownSec,
                DEFAULT_BALANCE_CONFIG.movement.driftCooldownSec,
                "movement.driftCooldownSec"
            ),
        },
        combat: {
            mouthArcDeg: readNumber(
                combat.mouthArcDeg,
                DEFAULT_BALANCE_CONFIG.combat.mouthArcDeg,
                "combat.mouthArcDeg"
            ),
            tailArcDeg: readNumber(
                combat.tailArcDeg,
                DEFAULT_BALANCE_CONFIG.combat.tailArcDeg,
                "combat.tailArcDeg"
            ),
            tailDamageMultiplier: readNumber(
                combat.tailDamageMultiplier,
                DEFAULT_BALANCE_CONFIG.combat.tailDamageMultiplier,
                "combat.tailDamageMultiplier"
            ),
            attackCooldownSec: readNumber(
                combat.attackCooldownSec,
                DEFAULT_BALANCE_CONFIG.combat.attackCooldownSec,
                "combat.attackCooldownSec"
            ),
            damageInvulnSec: readNumber(
                combat.damageInvulnSec,
                DEFAULT_BALANCE_CONFIG.combat.damageInvulnSec,
                "combat.damageInvulnSec"
            ),
            biteCooldownSec: readNumber(
                combat.biteCooldownSec,
                DEFAULT_BALANCE_CONFIG.combat.biteCooldownSec,
                "combat.biteCooldownSec"
            ),
            respawnShieldSec: readNumber(
                combat.respawnShieldSec,
                DEFAULT_BALANCE_CONFIG.combat.respawnShieldSec,
                "combat.respawnShieldSec"
            ),
            lastBreathDurationSec: readNumber(
                combat.lastBreathDurationSec,
                DEFAULT_BALANCE_CONFIG.combat.lastBreathDurationSec,
                "combat.lastBreathDurationSec"
            ),
            lastBreathDamageMult: readNumber(
                combat.lastBreathDamageMult,
                DEFAULT_BALANCE_CONFIG.combat.lastBreathDamageMult,
                "combat.lastBreathDamageMult"
            ),
            lastBreathSpeedMult: readNumber(
                combat.lastBreathSpeedMult,
                DEFAULT_BALANCE_CONFIG.combat.lastBreathSpeedMult,
                "combat.lastBreathSpeedMult"
            ),
            massStealPercent: readNumber(
                combat.massStealPercent,
                DEFAULT_BALANCE_CONFIG.combat.massStealPercent,
                "combat.massStealPercent"
            ),
        },
        death: {
            respawnDelaySec: readNumber(
                death.respawnDelaySec,
                DEFAULT_BALANCE_CONFIG.death.respawnDelaySec,
                "death.respawnDelaySec"
            ),
            massLostPercent: readNumber(
                death.massLostPercent,
                DEFAULT_BALANCE_CONFIG.death.massLostPercent,
                "death.massLostPercent"
            ),
            massToOrbsPercent: readNumber(
                death.massToOrbsPercent,
                DEFAULT_BALANCE_CONFIG.death.massToOrbsPercent,
                "death.massToOrbsPercent"
            ),
            orbsCount: readNumber(
                death.orbsCount,
                DEFAULT_BALANCE_CONFIG.death.orbsCount,
                "death.orbsCount"
            ),
            minRespawnMass: readNumber(
                death.minRespawnMass,
                DEFAULT_BALANCE_CONFIG.death.minRespawnMass,
                "death.minRespawnMass"
            ),
        },
        orbs: {
            initialCount: readNumber(
                orbs.initialCount,
                DEFAULT_BALANCE_CONFIG.orbs.initialCount,
                "orbs.initialCount"
            ),
            maxCount: readNumber(orbs.maxCount, DEFAULT_BALANCE_CONFIG.orbs.maxCount, "orbs.maxCount"),
            respawnIntervalSec: readNumber(
                orbs.respawnIntervalSec,
                DEFAULT_BALANCE_CONFIG.orbs.respawnIntervalSec,
                "orbs.respawnIntervalSec"
            ),
            minMass: readNumber(orbs.minMass, DEFAULT_BALANCE_CONFIG.orbs.minMass, "orbs.minMass"),
            minRadius: readNumber(orbs.minRadius, DEFAULT_BALANCE_CONFIG.orbs.minRadius, "orbs.minRadius"),
            types: (() => {
                if (!Array.isArray(orbs.types)) return DEFAULT_BALANCE_CONFIG.orbs.types;
                return orbs.types.map((entry: unknown, index: number) => {
                    if (!isRecord(entry)) {
                        throw new Error(`Invalid orb type at orbs.types[${index}]`);
                    }
                    const fallback = DEFAULT_BALANCE_CONFIG.orbs.types[index] ?? DEFAULT_BALANCE_CONFIG.orbs.types[0];
                    const massRange = Array.isArray(entry.massRange) ? entry.massRange : [];
                    return {
                        id: readString(entry.id, fallback.id, `orbs.types[${index}].id`),
                        weight: readNumber(entry.weight, fallback.weight, `orbs.types[${index}].weight`),
                        density: readNumber(entry.density, fallback.density, `orbs.types[${index}].density`),
                        massRange: [
                            readNumber(massRange[0], fallback.massRange[0], `orbs.types[${index}].massRange[0]`),
                            readNumber(massRange[1], fallback.massRange[1], `orbs.types[${index}].massRange[1]`),
                        ],
                    };
                });
            })(),
            pushForce: readNumber(orbs.pushForce, DEFAULT_BALANCE_CONFIG.orbs.pushForce, "orbs.pushForce"),
        },
        formulas: {
            hp: readFormula(formulas.hp, DEFAULT_BALANCE_CONFIG.formulas.hp, "formulas.hp"),
            damage: readFormula(formulas.damage, DEFAULT_BALANCE_CONFIG.formulas.damage, "formulas.damage"),
            speed: readFormula(formulas.speed, DEFAULT_BALANCE_CONFIG.formulas.speed, "formulas.speed"),
            radius: readFormula(formulas.radius, DEFAULT_BALANCE_CONFIG.formulas.radius, "formulas.radius"),
        },
        classes: {
            hunter: {
                speedMult: readNumber(
                    hunter.speedMult,
                    DEFAULT_BALANCE_CONFIG.classes.hunter.speedMult,
                    "classes.hunter.speedMult"
                ),
                hpMult: readNumber(
                    hunter.hpMult,
                    DEFAULT_BALANCE_CONFIG.classes.hunter.hpMult,
                    "classes.hunter.hpMult"
                ),
                swallowLimit: readNumber(
                    hunter.swallowLimit,
                    DEFAULT_BALANCE_CONFIG.classes.hunter.swallowLimit,
                    "classes.hunter.swallowLimit"
                ),
                biteFraction: readNumber(
                    hunter.biteFraction,
                    DEFAULT_BALANCE_CONFIG.classes.hunter.biteFraction,
                    "classes.hunter.biteFraction"
                ),
            },
            warrior: {
                speedMult: readNumber(
                    warrior.speedMult,
                    DEFAULT_BALANCE_CONFIG.classes.warrior.speedMult,
                    "classes.warrior.speedMult"
                ),
                hpMult: readNumber(
                    warrior.hpMult,
                    DEFAULT_BALANCE_CONFIG.classes.warrior.hpMult,
                    "classes.warrior.hpMult"
                ),
                damageVsSlimeMult: readNumber(
                    warrior.damageVsSlimeMult,
                    DEFAULT_BALANCE_CONFIG.classes.warrior.damageVsSlimeMult,
                    "classes.warrior.damageVsSlimeMult"
                ),
                swallowLimit: readNumber(
                    warrior.swallowLimit,
                    DEFAULT_BALANCE_CONFIG.classes.warrior.swallowLimit,
                    "classes.warrior.swallowLimit"
                ),
                biteFraction: readNumber(
                    warrior.biteFraction,
                    DEFAULT_BALANCE_CONFIG.classes.warrior.biteFraction,
                    "classes.warrior.biteFraction"
                ),
            },
            collector: {
                radiusMult: readNumber(
                    collector.radiusMult,
                    DEFAULT_BALANCE_CONFIG.classes.collector.radiusMult,
                    "classes.collector.radiusMult"
                ),
                eatingPowerMult: readNumber(
                    collector.eatingPowerMult,
                    DEFAULT_BALANCE_CONFIG.classes.collector.eatingPowerMult,
                    "classes.collector.eatingPowerMult"
                ),
                swallowLimit: readNumber(
                    collector.swallowLimit,
                    DEFAULT_BALANCE_CONFIG.classes.collector.swallowLimit,
                    "classes.collector.swallowLimit"
                ),
                biteFraction: readNumber(
                    collector.biteFraction,
                    DEFAULT_BALANCE_CONFIG.classes.collector.biteFraction,
                    "classes.collector.biteFraction"
                ),
            },
        },
        chests: {
            maxCount: readNumber(chests.maxCount, DEFAULT_BALANCE_CONFIG.chests.maxCount, "chests.maxCount"),
            spawnIntervalSec: readNumber(
                chests.spawnIntervalSec,
                DEFAULT_BALANCE_CONFIG.chests.spawnIntervalSec,
                "chests.spawnIntervalSec"
            ),
            mass: readNumber(chests.mass, DEFAULT_BALANCE_CONFIG.chests.mass, "chests.mass"),
            radius: readNumber(chests.radius, DEFAULT_BALANCE_CONFIG.chests.radius, "chests.radius"),
            rewards: {
                massPercent: readNumberArray(
                    chestRewards.massPercent,
                    DEFAULT_BALANCE_CONFIG.chests.rewards.massPercent,
                    "chests.rewards.massPercent"
                ),
                talentChance: readNumber(
                    chestRewards.talentChance,
                    DEFAULT_BALANCE_CONFIG.chests.rewards.talentChance,
                    "chests.rewards.talentChance"
                ),
            },
        },
        hotZones: {
            chaosCount: readNumber(
                hotZones.chaosCount,
                DEFAULT_BALANCE_CONFIG.hotZones.chaosCount,
                "hotZones.chaosCount"
            ),
            finalCount: readNumber(
                hotZones.finalCount,
                DEFAULT_BALANCE_CONFIG.hotZones.finalCount,
                "hotZones.finalCount"
            ),
            radius: readNumber(hotZones.radius, DEFAULT_BALANCE_CONFIG.hotZones.radius, "hotZones.radius"),
            spawnMultiplierChaos: readNumber(
                hotZones.spawnMultiplierChaos,
                DEFAULT_BALANCE_CONFIG.hotZones.spawnMultiplierChaos,
                "hotZones.spawnMultiplierChaos"
            ),
            spawnMultiplierFinal: readNumber(
                hotZones.spawnMultiplierFinal,
                DEFAULT_BALANCE_CONFIG.hotZones.spawnMultiplierFinal,
                "hotZones.spawnMultiplierFinal"
            ),
        },
        hunger: {
            baseDrainPerSec: readNumber(
                hunger.baseDrainPerSec,
                DEFAULT_BALANCE_CONFIG.hunger.baseDrainPerSec,
                "hunger.baseDrainPerSec"
            ),
            scalingPerMass: readNumber(
                hunger.scalingPerMass,
                DEFAULT_BALANCE_CONFIG.hunger.scalingPerMass,
                "hunger.scalingPerMass"
            ),
            maxDrainPerSec: readNumber(
                hunger.maxDrainPerSec,
                DEFAULT_BALANCE_CONFIG.hunger.maxDrainPerSec,
                "hunger.maxDrainPerSec"
            ),
            minMass: readNumber(
                hunger.minMass,
                DEFAULT_BALANCE_CONFIG.hunger.minMass,
                "hunger.minMass"
            ),
        },
        rebel: {
            updateIntervalSec: readNumber(
                rebel.updateIntervalSec,
                DEFAULT_BALANCE_CONFIG.rebel.updateIntervalSec,
                "rebel.updateIntervalSec"
            ),
            massThresholdMultiplier: readNumber(
                rebel.massThresholdMultiplier,
                DEFAULT_BALANCE_CONFIG.rebel.massThresholdMultiplier,
                "rebel.massThresholdMultiplier"
            ),
        },
    };

    const globalCooldownTicks = Math.max(
        1,
        Math.round(resolved.server.globalCooldownMs / (1000 / resolved.server.tickRate))
    );

    return {
        ...resolved,
        server: {
            ...resolved.server,
            globalCooldownTicks,
        },
    };
}
