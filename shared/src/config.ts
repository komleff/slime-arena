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

export type MassCurveType = "power" | "log";

export interface MassCurveConfig {
    type: MassCurveType;
    exp?: number;
    k?: number;
    minValue?: number;
    maxValue?: number;
}

export interface SlimeConfig {
    id: string;
    name: string;
    geometry: {
        baseMassKg: number;
        baseRadiusM: number;
        inertiaFactor: number;
    };
    propulsion: {
        thrustForwardN: number;
        thrustReverseN: number;
        thrustLateralN: number;
        turnTorqueNm: number;
    };
    limits: {
        speedLimitForwardMps: number;
        speedLimitReverseMps: number;
        speedLimitLateralMps: number;
        angularSpeedLimitRadps: number;
    };
    assist: {
        comfortableBrakingTimeS: number;
        angularStopTimeS: number;
        autoBrakeMaxThrustFraction: number;
        overspeedDampingRate: number;
        yawFullDeflectionAngleRad: number;
        yawOscillationWindowFrames: number;
        yawOscillationSignFlipsThreshold: number;
        yawDampingBoostFactor: number;
        yawCmdEps: number;
        // Параметры fly-by-wire управления
        angularDeadzoneRad: number;
        yawRateGain: number;
        reactionTimeS: number;
        accelTimeS: number;
        velocityErrorThreshold: number;
        inputMagnitudeThreshold: number;
    };
    combat: {
        biteDamagePctOfMass: number;
        biteVictimMassGainPct: number;
        orbBitePctOfMass: number;
    };
    massScaling: {
        minMassFactor: number;
        thrustForwardN: MassCurveConfig;
        thrustReverseN: MassCurveConfig;
        thrustLateralN: MassCurveConfig;
        turnTorqueNm: MassCurveConfig;
        speedLimitForwardMps: MassCurveConfig;
        speedLimitReverseMps: MassCurveConfig;
        speedLimitLateralMps: MassCurveConfig;
        angularSpeedLimitRadps: MassCurveConfig;
    };
}

export interface WorldPhysicsConfig {
    linearDragK: number;
    angularDragK: number;
    restitution: number;
    maxPositionCorrectionM: number;
    worldShape: "rectangle" | "circle";
    widthM?: number;
    heightM?: number;
    radiusM?: number;
}

export interface ClientNetSmoothingConfig {
    lookAheadMs: number;
    velocityWeight: number;
    catchUpSpeed: number;
    maxCatchUpSpeed: number;
    teleportThreshold: number;
    angleCatchUpSpeed: number;
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
        resultsDurationSec: number;
        restartDelaySec: number;
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
        inputTimeoutMs: number;
        mouseDeadzone: number;
        mouseMaxDist: number;
    };
    slimeConfigs: {
        base: SlimeConfig;
        hunter: SlimeConfig;
        warrior: SlimeConfig;
        collector: SlimeConfig;
    };
    worldPhysics: WorldPhysicsConfig;
    clientNetSmoothing: ClientNetSmoothingConfig;
    slime: {
        initialMass: number;
        initialLevel: number;
        initialClassId: number;
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
        lastBreathSpeedPenalty: number;
        pvpBiteVictimLossPct: number;
        pvpBiteAttackerGainPct: number;
        pvpBiteScatterPct: number;
        pvpBiteScatterOrbCount: number;
        pvpBiteScatterSpeed: number;
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
    abilities: {
        dash: {
            massCostPct: number;
            cooldownSec: number;
            distanceM: number;
            durationSec: number;
            collisionDamageMult: number;
        };
        shield: {
            massCostPct: number;
            cooldownSec: number;
            durationSec: number;
        };
        magnet: {
            massCostPct: number;
            cooldownSec: number;
            durationSec: number;
            radiusM: number;
            pullSpeedMps: number;
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
        mapSize: 1000,
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
        resultsDurationSec: 10,
        restartDelaySec: 3,
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
        inputTimeoutMs: 200,
        mouseDeadzone: 30,
        mouseMaxDist: 200,
    },
    slimeConfigs: {
        base: {
            id: "base",
            name: "Base Slime",
            geometry: {
                baseMassKg: 100,
                baseRadiusM: 10.0,
                inertiaFactor: 0.5,
            },
            propulsion: {
                thrustForwardN: 9000,
                thrustReverseN: 6750,
                thrustLateralN: 8500,
                turnTorqueNm: 17500,
            },
            limits: {
                speedLimitForwardMps: 260,
                speedLimitReverseMps: 180,
                speedLimitLateralMps: 220,
                angularSpeedLimitRadps: (80 * Math.PI) / 180,
            },
            assist: {
                comfortableBrakingTimeS: 3.5,
                angularStopTimeS: 1.0,
                autoBrakeMaxThrustFraction: 0.6,
                overspeedDampingRate: 0.2,
                yawFullDeflectionAngleRad: Math.PI / 2,
                yawOscillationWindowFrames: 12,
                yawOscillationSignFlipsThreshold: 4,
                yawDampingBoostFactor: 2.0,
                yawCmdEps: 0.001,
                angularDeadzoneRad: 0.02,
                yawRateGain: 2.0,
                reactionTimeS: 0.15,
                accelTimeS: 0.5,
                velocityErrorThreshold: 0.1,
                inputMagnitudeThreshold: 0.01,
            },
            combat: {
                biteDamagePctOfMass: 0.15,
                biteVictimMassGainPct: 0.25,
                orbBitePctOfMass: 0.05,
            },
            massScaling: {
                minMassFactor: 0.1,
                thrustForwardN: { type: "power", exp: 0.5 },
                thrustReverseN: { type: "power", exp: 0.5 },
                thrustLateralN: { type: "power", exp: 0.5 },
                turnTorqueNm: { type: "power", exp: 1.5 },
                speedLimitForwardMps: { type: "power", exp: 0 },
                speedLimitReverseMps: { type: "power", exp: 0 },
                speedLimitLateralMps: { type: "power", exp: 0 },
                angularSpeedLimitRadps: { type: "power", exp: 0 },
            },
        },
        hunter: {
            id: "hunter",
            name: "Hunter",
            geometry: {
                baseMassKg: 100,
                baseRadiusM: 10.0,
                inertiaFactor: 0.5,
            },
            propulsion: {
                thrustForwardN: 9000,
                thrustReverseN: 6750,
                thrustLateralN: 8500,
                turnTorqueNm: 17500,
            },
            limits: {
                speedLimitForwardMps: 260,
                speedLimitReverseMps: 180,
                speedLimitLateralMps: 220,
                angularSpeedLimitRadps: (80 * Math.PI) / 180,
            },
            assist: {
                comfortableBrakingTimeS: 3.5,
                angularStopTimeS: 1.0,
                autoBrakeMaxThrustFraction: 0.6,
                overspeedDampingRate: 0.2,
                yawFullDeflectionAngleRad: Math.PI / 2,
                yawOscillationWindowFrames: 12,
                yawOscillationSignFlipsThreshold: 4,
                yawDampingBoostFactor: 2.0,
                yawCmdEps: 0.001,
                angularDeadzoneRad: 0.02,
                yawRateGain: 2.0,
                reactionTimeS: 0.15,
                accelTimeS: 0.5,
                velocityErrorThreshold: 0.1,
                inputMagnitudeThreshold: 0.01,
            },
            combat: {
                biteDamagePctOfMass: 0.15,
                biteVictimMassGainPct: 0.25,
                orbBitePctOfMass: 0.05,
            },
            massScaling: {
                minMassFactor: 0.1,
                thrustForwardN: { type: "power", exp: 0.5 },
                thrustReverseN: { type: "power", exp: 0.5 },
                thrustLateralN: { type: "power", exp: 0.5 },
                turnTorqueNm: { type: "power", exp: 1.5 },
                speedLimitForwardMps: { type: "power", exp: 0 },
                speedLimitReverseMps: { type: "power", exp: 0 },
                speedLimitLateralMps: { type: "power", exp: 0 },
                angularSpeedLimitRadps: { type: "power", exp: 0 },
            },
        },
        warrior: {
            id: "warrior",
            name: "Warrior",
            geometry: {
                baseMassKg: 100,
                baseRadiusM: 10.0,
                inertiaFactor: 0.5,
            },
            propulsion: {
                thrustForwardN: 9000,
                thrustReverseN: 6750,
                thrustLateralN: 8500,
                turnTorqueNm: 17500,
            },
            limits: {
                speedLimitForwardMps: 260,
                speedLimitReverseMps: 180,
                speedLimitLateralMps: 220,
                angularSpeedLimitRadps: (80 * Math.PI) / 180,
            },
            assist: {
                comfortableBrakingTimeS: 3.5,
                angularStopTimeS: 1.0,
                autoBrakeMaxThrustFraction: 0.6,
                overspeedDampingRate: 0.2,
                yawFullDeflectionAngleRad: Math.PI / 2,
                yawOscillationWindowFrames: 12,
                yawOscillationSignFlipsThreshold: 4,
                yawDampingBoostFactor: 2.0,
                yawCmdEps: 0.001,
                angularDeadzoneRad: 0.02,
                yawRateGain: 2.0,
                reactionTimeS: 0.15,
                accelTimeS: 0.5,
                velocityErrorThreshold: 0.1,
                inputMagnitudeThreshold: 0.01,
            },
            combat: {
                biteDamagePctOfMass: 0.15,
                biteVictimMassGainPct: 0.25,
                orbBitePctOfMass: 0.05,
            },
            massScaling: {
                minMassFactor: 0.1,
                thrustForwardN: { type: "power", exp: 0.5 },
                thrustReverseN: { type: "power", exp: 0.5 },
                thrustLateralN: { type: "power", exp: 0.5 },
                turnTorqueNm: { type: "power", exp: 1.5 },
                speedLimitForwardMps: { type: "power", exp: 0 },
                speedLimitReverseMps: { type: "power", exp: 0 },
                speedLimitLateralMps: { type: "power", exp: 0 },
                angularSpeedLimitRadps: { type: "power", exp: 0 },
            },
        },
        collector: {
            id: "collector",
            name: "Collector",
            geometry: {
                baseMassKg: 100,
                baseRadiusM: 10.0,
                inertiaFactor: 0.5,
            },
            propulsion: {
                thrustForwardN: 9000,
                thrustReverseN: 6750,
                thrustLateralN: 8500,
                turnTorqueNm: 17500,
            },
            limits: {
                speedLimitForwardMps: 260,
                speedLimitReverseMps: 180,
                speedLimitLateralMps: 220,
                angularSpeedLimitRadps: (80 * Math.PI) / 180,
            },
            assist: {
                comfortableBrakingTimeS: 3.5,
                angularStopTimeS: 1.0,
                autoBrakeMaxThrustFraction: 0.6,
                overspeedDampingRate: 0.2,
                yawFullDeflectionAngleRad: Math.PI / 2,
                yawOscillationWindowFrames: 12,
                yawOscillationSignFlipsThreshold: 4,
                yawDampingBoostFactor: 2.0,
                yawCmdEps: 0.001,
                angularDeadzoneRad: 0.02,
                yawRateGain: 2.0,
                reactionTimeS: 0.15,
                accelTimeS: 0.5,
                velocityErrorThreshold: 0.1,
                inputMagnitudeThreshold: 0.01,
            },
            combat: {
                biteDamagePctOfMass: 0.15,
                biteVictimMassGainPct: 0.25,
                orbBitePctOfMass: 0.05,
            },
            massScaling: {
                minMassFactor: 0.1,
                thrustForwardN: { type: "power", exp: 0.5 },
                thrustReverseN: { type: "power", exp: 0.5 },
                thrustLateralN: { type: "power", exp: 0.5 },
                turnTorqueNm: { type: "power", exp: 1.5 },
                speedLimitForwardMps: { type: "power", exp: 0 },
                speedLimitReverseMps: { type: "power", exp: 0 },
                speedLimitLateralMps: { type: "power", exp: 0 },
                angularSpeedLimitRadps: { type: "power", exp: 0 },
            },
        },
    },
    worldPhysics: {
        linearDragK: 0.1,
        angularDragK: 0.0,
        restitution: 0.9,
        maxPositionCorrectionM: 0.5,
        worldShape: "rectangle",
        widthM: 1000,
        heightM: 1000,
    },
    clientNetSmoothing: {
        lookAheadMs: 150,
        velocityWeight: 0.7,
        catchUpSpeed: 10.0,
        maxCatchUpSpeed: 800,
        teleportThreshold: 100,
        angleCatchUpSpeed: 12.0,
    },
    slime: {
        initialMass: 100,
        initialLevel: 1,
        initialClassId: 0,
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
        lastBreathSpeedPenalty: 0.8,
        pvpBiteVictimLossPct: 0.20,
        pvpBiteAttackerGainPct: 0.10,
        pvpBiteScatterPct: 0.10,
        pvpBiteScatterOrbCount: 3,
        pvpBiteScatterSpeed: 200,
    },
    death: {
        respawnDelaySec: 2,
        massLostPercent: 0.5,
        massToOrbsPercent: 0.3,
        orbsCount: 4,
        minRespawnMass: 100,
    },
    orbs: {
        initialCount: 100,
        maxCount: 150,
        respawnIntervalSec: 0.5,
        minMass: 3,
        minRadius: 2.5,
        pushForce: 100,
        types: [
            { id: "green", weight: 40, density: 0.8, massRange: [5, 15] },
            { id: "blue", weight: 30, density: 1.0, massRange: [20, 40] },
            { id: "red", weight: 20, density: 1.0, massRange: [20, 40] },
            { id: "gold", weight: 10, density: 1.5, massRange: [50, 100] },
        ],
    },
    formulas: {
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
    abilities: {
        dash: {
            massCostPct: 0.03,
            cooldownSec: 5,
            distanceM: 150,
            durationSec: 0.2,
            collisionDamageMult: 1.5,
        },
        shield: {
            massCostPct: 0.04,
            cooldownSec: 8,
            durationSec: 2.0,
        },
        magnet: {
            massCostPct: 0.015,
            cooldownSec: 6,
            durationSec: 1.5,
            radiusM: 150,
            pullSpeedMps: 50,
        },
    },
    chests: {
        maxCount: 3,
        spawnIntervalSec: 20,
        mass: 200,
        radius: 14,
        rewards: {
            massPercent: [0.1, 0.2, 0.3],
            talentChance: 0.4,
        },
    },
    hotZones: {
        chaosCount: 2,
        finalCount: 1,
        radius: 110,
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

function readOptionalNumber(value: unknown, path: string): number | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Invalid number at ${path}`);
    }
    return value;
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

function readCurveConfig(value: unknown, fallback: MassCurveConfig, path: string): MassCurveConfig {
    if (!isRecord(value)) return fallback;
    const type = readString(value.type, fallback.type, `${path}.type`) as MassCurveType;
    return {
        type,
        exp: readOptionalNumber(value.exp, `${path}.exp`) ?? fallback.exp,
        k: readOptionalNumber(value.k, `${path}.k`) ?? fallback.k,
        minValue: readOptionalNumber(value.minValue, `${path}.minValue`) ?? fallback.minValue,
        maxValue: readOptionalNumber(value.maxValue, `${path}.maxValue`) ?? fallback.maxValue,
    };
}

function readSlimeConfig(value: unknown, fallback: SlimeConfig, path: string): SlimeConfig {
    const data = isRecord(value) ? value : {};
    const geometry = isRecord(data.geometry) ? data.geometry : {};
    const propulsion = isRecord(data.propulsion) ? data.propulsion : {};
    const limits = isRecord(data.limits) ? data.limits : {};
    const assist = isRecord(data.assist) ? data.assist : {};
    const combat = isRecord(data.combat) ? data.combat : {};
    const massScaling = isRecord(data.massScaling) ? data.massScaling : {};

    const angularSpeedLimitDegps = readOptionalNumber(limits.angularSpeedLimitDegps, `${path}.limits.angularSpeedLimitDegps`);
    const angularSpeedLimitRadps =
        readOptionalNumber(limits.angularSpeedLimitRadps, `${path}.limits.angularSpeedLimitRadps`) ??
        (angularSpeedLimitDegps !== undefined ? (angularSpeedLimitDegps * Math.PI) / 180 : fallback.limits.angularSpeedLimitRadps);

    const yawFullDeflectionAngleDeg = readOptionalNumber(
        assist.yawFullDeflectionAngleDeg,
        `${path}.assist.yawFullDeflectionAngleDeg`
    );
    const yawFullDeflectionAngleRad =
        readOptionalNumber(assist.yawFullDeflectionAngleRad, `${path}.assist.yawFullDeflectionAngleRad`) ??
        (yawFullDeflectionAngleDeg !== undefined
            ? (yawFullDeflectionAngleDeg * Math.PI) / 180
            : fallback.assist.yawFullDeflectionAngleRad);

    return {
        id: readString(data.id, fallback.id, `${path}.id`),
        name: readString(data.name, fallback.name, `${path}.name`),
        geometry: {
            baseMassKg: readNumber(geometry.baseMassKg, fallback.geometry.baseMassKg, `${path}.geometry.baseMassKg`),
            baseRadiusM: readNumber(geometry.baseRadiusM, fallback.geometry.baseRadiusM, `${path}.geometry.baseRadiusM`),
            inertiaFactor: readNumber(geometry.inertiaFactor, fallback.geometry.inertiaFactor, `${path}.geometry.inertiaFactor`),
        },
        propulsion: {
            thrustForwardN: readNumber(
                propulsion.thrustForwardN,
                fallback.propulsion.thrustForwardN,
                `${path}.propulsion.thrustForwardN`
            ),
            thrustReverseN: readNumber(
                propulsion.thrustReverseN,
                fallback.propulsion.thrustReverseN,
                `${path}.propulsion.thrustReverseN`
            ),
            thrustLateralN: readNumber(
                propulsion.thrustLateralN,
                fallback.propulsion.thrustLateralN,
                `${path}.propulsion.thrustLateralN`
            ),
            turnTorqueNm: readNumber(
                propulsion.turnTorqueNm,
                fallback.propulsion.turnTorqueNm,
                `${path}.propulsion.turnTorqueNm`
            ),
        },
        limits: {
            speedLimitForwardMps: readNumber(
                limits.speedLimitForwardMps,
                fallback.limits.speedLimitForwardMps,
                `${path}.limits.speedLimitForwardMps`
            ),
            speedLimitReverseMps: readNumber(
                limits.speedLimitReverseMps,
                fallback.limits.speedLimitReverseMps,
                `${path}.limits.speedLimitReverseMps`
            ),
            speedLimitLateralMps: readNumber(
                limits.speedLimitLateralMps,
                fallback.limits.speedLimitLateralMps,
                `${path}.limits.speedLimitLateralMps`
            ),
            angularSpeedLimitRadps,
        },
        assist: {
            comfortableBrakingTimeS: readNumber(
                assist.comfortableBrakingTimeS,
                fallback.assist.comfortableBrakingTimeS,
                `${path}.assist.comfortableBrakingTimeS`
            ),
            angularStopTimeS: readNumber(
                assist.angularStopTimeS,
                fallback.assist.angularStopTimeS,
                `${path}.assist.angularStopTimeS`
            ),
            autoBrakeMaxThrustFraction: readNumber(
                assist.autoBrakeMaxThrustFraction,
                fallback.assist.autoBrakeMaxThrustFraction,
                `${path}.assist.autoBrakeMaxThrustFraction`
            ),
            overspeedDampingRate: readNumber(
                assist.overspeedDampingRate,
                fallback.assist.overspeedDampingRate,
                `${path}.assist.overspeedDampingRate`
            ),
            yawFullDeflectionAngleRad,
            yawOscillationWindowFrames: readNumber(
                assist.yawOscillationWindowFrames,
                fallback.assist.yawOscillationWindowFrames,
                `${path}.assist.yawOscillationWindowFrames`
            ),
            yawOscillationSignFlipsThreshold: readNumber(
                assist.yawOscillationSignFlipsThreshold,
                fallback.assist.yawOscillationSignFlipsThreshold,
                `${path}.assist.yawOscillationSignFlipsThreshold`
            ),
            yawDampingBoostFactor: readNumber(
                assist.yawDampingBoostFactor,
                fallback.assist.yawDampingBoostFactor,
                `${path}.assist.yawDampingBoostFactor`
            ),
            yawCmdEps: readNumber(assist.yawCmdEps, fallback.assist.yawCmdEps, `${path}.assist.yawCmdEps`),
            angularDeadzoneRad: readNumber(
                assist.angularDeadzoneRad,
                fallback.assist.angularDeadzoneRad,
                `${path}.assist.angularDeadzoneRad`
            ),
            yawRateGain: readNumber(
                assist.yawRateGain,
                fallback.assist.yawRateGain,
                `${path}.assist.yawRateGain`
            ),
            reactionTimeS: readNumber(
                assist.reactionTimeS,
                fallback.assist.reactionTimeS,
                `${path}.assist.reactionTimeS`
            ),
            accelTimeS: readNumber(
                assist.accelTimeS,
                fallback.assist.accelTimeS,
                `${path}.assist.accelTimeS`
            ),
            velocityErrorThreshold: readNumber(
                assist.velocityErrorThreshold,
                fallback.assist.velocityErrorThreshold,
                `${path}.assist.velocityErrorThreshold`
            ),
            inputMagnitudeThreshold: readNumber(
                assist.inputMagnitudeThreshold,
                fallback.assist.inputMagnitudeThreshold,
                `${path}.assist.inputMagnitudeThreshold`
            ),
        },
        combat: {
            biteDamagePctOfMass: readNumber(
                combat.biteDamagePctOfMass,
                fallback.combat.biteDamagePctOfMass,
                `${path}.combat.biteDamagePctOfMass`
            ),
            biteVictimMassGainPct: readNumber(
                combat.biteVictimMassGainPct,
                fallback.combat.biteVictimMassGainPct,
                `${path}.combat.biteVictimMassGainPct`
            ),
            orbBitePctOfMass: readNumber(
                combat.orbBitePctOfMass,
                fallback.combat.orbBitePctOfMass,
                `${path}.combat.orbBitePctOfMass`
            ),
        },
        massScaling: {
            minMassFactor: readNumber(
                massScaling.minMassFactor,
                fallback.massScaling.minMassFactor,
                `${path}.massScaling.minMassFactor`
            ),
            thrustForwardN: readCurveConfig(
                massScaling.thrustForwardN,
                fallback.massScaling.thrustForwardN,
                `${path}.massScaling.thrustForwardN`
            ),
            thrustReverseN: readCurveConfig(
                massScaling.thrustReverseN,
                fallback.massScaling.thrustReverseN,
                `${path}.massScaling.thrustReverseN`
            ),
            thrustLateralN: readCurveConfig(
                massScaling.thrustLateralN,
                fallback.massScaling.thrustLateralN,
                `${path}.massScaling.thrustLateralN`
            ),
            turnTorqueNm: readCurveConfig(
                massScaling.turnTorqueNm,
                fallback.massScaling.turnTorqueNm,
                `${path}.massScaling.turnTorqueNm`
            ),
            speedLimitForwardMps: readCurveConfig(
                massScaling.speedLimitForwardMps,
                fallback.massScaling.speedLimitForwardMps,
                `${path}.massScaling.speedLimitForwardMps`
            ),
            speedLimitReverseMps: readCurveConfig(
                massScaling.speedLimitReverseMps,
                fallback.massScaling.speedLimitReverseMps,
                `${path}.massScaling.speedLimitReverseMps`
            ),
            speedLimitLateralMps: readCurveConfig(
                massScaling.speedLimitLateralMps,
                fallback.massScaling.speedLimitLateralMps,
                `${path}.massScaling.speedLimitLateralMps`
            ),
            angularSpeedLimitRadps: readCurveConfig(
                massScaling.angularSpeedLimitRadps,
                fallback.massScaling.angularSpeedLimitRadps,
                `${path}.massScaling.angularSpeedLimitRadps`
            ),
        },
    };
}

export function resolveBalanceConfig(raw: unknown): ResolvedBalanceConfig {
    const data = isRecord(raw) ? raw : {};

    const world = isRecord(data.world) ? data.world : {};
    const server = isRecord(data.server) ? data.server : {};
    const match = isRecord(data.match) ? data.match : {};
    const physics = isRecord(data.physics) ? data.physics : {};
    const controls = isRecord(data.controls) ? data.controls : {};
    const slimeConfigs = isRecord(data.slimeConfigs) ? data.slimeConfigs : {};
    const worldPhysics = isRecord(data.worldPhysics) ? data.worldPhysics : {};
    const clientNetSmoothing = isRecord(data.clientNetSmoothing) ? data.clientNetSmoothing : {};
    const slime = isRecord(data.slime) ? data.slime : {};
    const combat = isRecord(data.combat) ? data.combat : {};
    const death = isRecord(data.death) ? data.death : {};
    const orbs = isRecord(data.orbs) ? data.orbs : {};
    const formulas = isRecord(data.formulas) ? data.formulas : {};
    const classes = isRecord(data.classes) ? data.classes : {};
    const chests = isRecord(data.chests) ? data.chests : {};
    const hotZones = isRecord(data.hotZones) ? data.hotZones : {};
    const hunger = isRecord(data.hunger) ? data.hunger : {};
    const rebel = isRecord(data.rebel) ? data.rebel : {};
    const baseSlime = isRecord(slimeConfigs.base) ? slimeConfigs.base : {};
    const hunterSlime = isRecord(slimeConfigs.hunter) ? slimeConfigs.hunter : {};
    const warriorSlime = isRecord(slimeConfigs.warrior) ? slimeConfigs.warrior : {};
    const collectorSlime = isRecord(slimeConfigs.collector) ? slimeConfigs.collector : {};
    const worldShape = readString(
        worldPhysics.worldShape,
        DEFAULT_BALANCE_CONFIG.worldPhysics.worldShape,
        "worldPhysics.worldShape"
    ) as WorldPhysicsConfig["worldShape"];
    const hunter = isRecord(classes.hunter) ? classes.hunter : {};
    const warrior = isRecord(classes.warrior) ? classes.warrior : {};
    const collector = isRecord(classes.collector) ? classes.collector : {};
    const chestRewards = isRecord(chests.rewards) ? chests.rewards : {};
    const worldMapSize = readNumber(world.mapSize, DEFAULT_BALANCE_CONFIG.world.mapSize, "world.mapSize");

    const resolved: BalanceConfig = {
        world: {
            mapSize: worldMapSize,
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
            resultsDurationSec: readNumber(
                match.resultsDurationSec,
                DEFAULT_BALANCE_CONFIG.match.resultsDurationSec,
                "match.resultsDurationSec"
            ),
            restartDelaySec: readNumber(
                match.restartDelaySec,
                DEFAULT_BALANCE_CONFIG.match.restartDelaySec,
                "match.restartDelaySec"
            ),
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
            inputTimeoutMs: readNumber(
                controls.inputTimeoutMs,
                DEFAULT_BALANCE_CONFIG.controls.inputTimeoutMs,
                "controls.inputTimeoutMs"
            ),
            mouseDeadzone: Math.max(0, readNumber(
                controls.mouseDeadzone,
                DEFAULT_BALANCE_CONFIG.controls.mouseDeadzone,
                "controls.mouseDeadzone"
            )),
            mouseMaxDist: Math.max(1, readNumber(
                controls.mouseMaxDist,
                DEFAULT_BALANCE_CONFIG.controls.mouseMaxDist,
                "controls.mouseMaxDist"
            )),
        },
        slimeConfigs: {
            base: readSlimeConfig(baseSlime, DEFAULT_BALANCE_CONFIG.slimeConfigs.base, "slimeConfigs.base"),
            hunter: readSlimeConfig(hunterSlime, DEFAULT_BALANCE_CONFIG.slimeConfigs.hunter, "slimeConfigs.hunter"),
            warrior: readSlimeConfig(warriorSlime, DEFAULT_BALANCE_CONFIG.slimeConfigs.warrior, "slimeConfigs.warrior"),
            collector: readSlimeConfig(
                collectorSlime,
                DEFAULT_BALANCE_CONFIG.slimeConfigs.collector,
                "slimeConfigs.collector"
            ),
        },
        worldPhysics: {
            linearDragK: readNumber(
                worldPhysics.linearDragK,
                DEFAULT_BALANCE_CONFIG.worldPhysics.linearDragK,
                "worldPhysics.linearDragK"
            ),
            angularDragK: readNumber(
                worldPhysics.angularDragK,
                DEFAULT_BALANCE_CONFIG.worldPhysics.angularDragK,
                "worldPhysics.angularDragK"
            ),
            restitution: readNumber(
                worldPhysics.restitution,
                DEFAULT_BALANCE_CONFIG.worldPhysics.restitution,
                "worldPhysics.restitution"
            ),
            maxPositionCorrectionM: readNumber(
                worldPhysics.maxPositionCorrectionM,
                DEFAULT_BALANCE_CONFIG.worldPhysics.maxPositionCorrectionM,
                "worldPhysics.maxPositionCorrectionM"
            ),
            worldShape,
            widthM: readNumber(
                worldPhysics.widthM,
                worldMapSize,
                "worldPhysics.widthM"
            ),
            heightM: readNumber(
                worldPhysics.heightM,
                worldMapSize,
                "worldPhysics.heightM"
            ),
            radiusM: readNumber(
                worldPhysics.radiusM,
                worldMapSize / 2,
                "worldPhysics.radiusM"
            ),
        },
        clientNetSmoothing: {
            lookAheadMs: Math.max(0, readNumber(
                clientNetSmoothing.lookAheadMs,
                DEFAULT_BALANCE_CONFIG.clientNetSmoothing.lookAheadMs,
                "clientNetSmoothing.lookAheadMs"
            )),
            velocityWeight: Math.max(0, Math.min(1, readNumber(
                clientNetSmoothing.velocityWeight,
                DEFAULT_BALANCE_CONFIG.clientNetSmoothing.velocityWeight,
                "clientNetSmoothing.velocityWeight"
            ))),
            catchUpSpeed: Math.max(0, readNumber(
                clientNetSmoothing.catchUpSpeed,
                DEFAULT_BALANCE_CONFIG.clientNetSmoothing.catchUpSpeed,
                "clientNetSmoothing.catchUpSpeed"
            )),
            maxCatchUpSpeed: Math.max(0, readNumber(
                clientNetSmoothing.maxCatchUpSpeed,
                DEFAULT_BALANCE_CONFIG.clientNetSmoothing.maxCatchUpSpeed,
                "clientNetSmoothing.maxCatchUpSpeed"
            )),
            teleportThreshold: Math.max(1, readNumber(
                clientNetSmoothing.teleportThreshold,
                DEFAULT_BALANCE_CONFIG.clientNetSmoothing.teleportThreshold,
                "clientNetSmoothing.teleportThreshold"
            )),
            angleCatchUpSpeed: Math.max(0, readNumber(
                clientNetSmoothing.angleCatchUpSpeed,
                DEFAULT_BALANCE_CONFIG.clientNetSmoothing.angleCatchUpSpeed,
                "clientNetSmoothing.angleCatchUpSpeed"
            )),
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
            lastBreathSpeedPenalty: readNumber(
                combat.lastBreathSpeedPenalty ?? combat.lastBreathSpeedMult,
                DEFAULT_BALANCE_CONFIG.combat.lastBreathSpeedPenalty,
                "combat.lastBreathSpeedPenalty"
            ),
            pvpBiteVictimLossPct: readNumber(
                combat.pvpBiteVictimLossPct,
                DEFAULT_BALANCE_CONFIG.combat.pvpBiteVictimLossPct,
                "combat.pvpBiteVictimLossPct"
            ),
            pvpBiteAttackerGainPct: readNumber(
                combat.pvpBiteAttackerGainPct,
                DEFAULT_BALANCE_CONFIG.combat.pvpBiteAttackerGainPct,
                "combat.pvpBiteAttackerGainPct"
            ),
            pvpBiteScatterPct: readNumber(
                combat.pvpBiteScatterPct,
                DEFAULT_BALANCE_CONFIG.combat.pvpBiteScatterPct,
                "combat.pvpBiteScatterPct"
            ),
            pvpBiteScatterOrbCount: readNumber(
                combat.pvpBiteScatterOrbCount,
                DEFAULT_BALANCE_CONFIG.combat.pvpBiteScatterOrbCount,
                "combat.pvpBiteScatterOrbCount"
            ),
            pvpBiteScatterSpeed: readNumber(
                combat.pvpBiteScatterSpeed,
                DEFAULT_BALANCE_CONFIG.combat.pvpBiteScatterSpeed,
                "combat.pvpBiteScatterSpeed"
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
        abilities: (() => {
            const abilities = isRecord(data.abilities) ? data.abilities : {};
            const dash = isRecord(abilities.dash) ? abilities.dash : {};
            const shield = isRecord(abilities.shield) ? abilities.shield : {};
            const magnet = isRecord(abilities.magnet) ? abilities.magnet : {};
            return {
                dash: {
                    massCostPct: readNumber(dash.massCostPct, DEFAULT_BALANCE_CONFIG.abilities.dash.massCostPct, "abilities.dash.massCostPct"),
                    cooldownSec: readNumber(dash.cooldownSec, DEFAULT_BALANCE_CONFIG.abilities.dash.cooldownSec, "abilities.dash.cooldownSec"),
                    distanceM: readNumber(dash.distanceM, DEFAULT_BALANCE_CONFIG.abilities.dash.distanceM, "abilities.dash.distanceM"),
                    durationSec: readNumber(dash.durationSec, DEFAULT_BALANCE_CONFIG.abilities.dash.durationSec, "abilities.dash.durationSec"),
                    collisionDamageMult: readNumber(dash.collisionDamageMult, DEFAULT_BALANCE_CONFIG.abilities.dash.collisionDamageMult, "abilities.dash.collisionDamageMult"),
                },
                shield: {
                    massCostPct: readNumber(shield.massCostPct, DEFAULT_BALANCE_CONFIG.abilities.shield.massCostPct, "abilities.shield.massCostPct"),
                    cooldownSec: readNumber(shield.cooldownSec, DEFAULT_BALANCE_CONFIG.abilities.shield.cooldownSec, "abilities.shield.cooldownSec"),
                    durationSec: readNumber(shield.durationSec, DEFAULT_BALANCE_CONFIG.abilities.shield.durationSec, "abilities.shield.durationSec"),
                },
                magnet: {
                    massCostPct: readNumber(magnet.massCostPct, DEFAULT_BALANCE_CONFIG.abilities.magnet.massCostPct, "abilities.magnet.massCostPct"),
                    cooldownSec: readNumber(magnet.cooldownSec, DEFAULT_BALANCE_CONFIG.abilities.magnet.cooldownSec, "abilities.magnet.cooldownSec"),
                    durationSec: readNumber(magnet.durationSec, DEFAULT_BALANCE_CONFIG.abilities.magnet.durationSec, "abilities.magnet.durationSec"),
                    radiusM: readNumber(magnet.radiusM, DEFAULT_BALANCE_CONFIG.abilities.magnet.radiusM, "abilities.magnet.radiusM"),
                    pullSpeedMps: readNumber(magnet.pullSpeedMps, DEFAULT_BALANCE_CONFIG.abilities.magnet.pullSpeedMps, "abilities.magnet.pullSpeedMps"),
                },
            };
        })(),
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
