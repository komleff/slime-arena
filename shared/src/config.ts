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
        angularBrakeBoostFactor: number;
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
        levelThresholds: number[];       // [100, 200, 300, 500, 800]
        slotUnlockLevels: number[];      // [1, 3, 5]
        cardChoiceTimeoutSec: number;    // 12
        abilityPool: string[];           // ["pull", "projectile", "spit", ...]
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
            biteResistPct: number;
            swallowLimit: number;
            biteFraction: number;
        };
        warrior: {
            speedMult: number;
            biteResistPct: number;
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
        slow: {
            massCostPct: number;
            cooldownSec: number;
            durationSec: number;
            radiusM: number;
            slowPct: number;
        };
        projectile: {
            massCostPct: number;
            cooldownSec: number;
            speedMps: number;
            rangeM: number;
            damagePct: number;
            radiusM: number;
        };
        spit: {
            massCostPct: number;
            cooldownSec: number;
            speedMps: number;
            rangeM: number;
            damagePct: number;
            radiusM: number;
            projectileCount: number;
            spreadAngleDeg: number;
        };
        bomb: {
            massCostPct: number;
            cooldownSec: number;
            speedMps: number;
            rangeM: number;
            damagePct: number;
            radiusM: number;
            explosionRadiusM: number;
        };
        push: {
            massCostPct: number;
            cooldownSec: number;
            radiusM: number;
            impulseNs: number;
            minSpeedMps: number;
            maxSpeedMps: number;
        };
        mine: {
            massCostPct: number;
            cooldownSec: number;
            damagePct: number;
            radiusM: number;
            durationSec: number;
            maxMines: number;
        };
    };
    chests: {
        maxCount: number;
        spawnIntervalSec: number;
        mass: number;
        radius: number;
        rewards: {
            scatterTotalMassPct: number[];
            scatterBubbleCount: number[];
            scatterInnerFrac: number[];
            scatterInnerSpeedMpsMin: number[];
            scatterInnerSpeedMpsMax: number[];
            scatterOuterSpeedMpsMin: number[];
            scatterOuterSpeedMpsMax: number[];
            scatterSmallBubbleSpeedMul: number;
            talentRarityWeights: {
                rare: { common: number; rare: number; epic: number };
                epic: { common: number; rare: number; epic: number };
                gold: { common: number; rare: number; epic: number };
            };
        };
        types?: {
            rare?: { armorRings: number; mass: number };
            epic?: { armorRings: number; mass: number };
            gold?: { armorRings: number; mass: number };
        };
        phaseWeights?: {
            Growth?: { rare: number; epic: number; gold: number };
            Hunt?: { rare: number; epic: number; gold: number };
            Final?: { rare: number; epic: number; gold: number };
        };
    };
    hotZones: {
        chaosCount: number;
        finalCount: number;
        radius: number;
        spawnMultiplierChaos: number;
        spawnMultiplierFinal: number;
    };
    toxicPools: {
        radiusM: number;
        durationSec: number;
        damagePctPerSec: number;
        slowPct: number;
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
    talents: {
        cardChoiceTimeoutSec: number;
        talentPool: {
            common: string[];
            rare: string[];
            epic: string[];
        };
        common: Record<string, TalentConfig>;
        rare: Record<string, TalentConfig>;
        epic: Record<string, TalentConfig>;
    };
}

// Конфиг отдельного таланта
export interface TalentConfig {
    name: string;
    maxLevel: number;
    values: number[] | number[][] | number;  // Значения по уровням
    effect: string;
    requirement?: string | null;
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
        durationSec: 180,
        resultsDurationSec: 12,
        restartDelaySec: 3,
        phases: [
            { id: "Growth", startSec: 0, endSec: 60 },
            { id: "Hunt", startSec: 60, endSec: 120 },
            { id: "Final", startSec: 120, endSec: 180 },
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
                angularBrakeBoostFactor: 1.0,
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
                angularBrakeBoostFactor: 1.0,
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
                angularBrakeBoostFactor: 1.0,
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
                angularBrakeBoostFactor: 1.0,
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
        levelThresholds: [100, 200, 300, 500, 800],
        slotUnlockLevels: [1, 3, 5],
        cardChoiceTimeoutSec: 12,
        abilityPool: ["pull", "projectile", "spit", "bomb", "push", "mine"],
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
            biteResistPct: 0,
            swallowLimit: 50,
            biteFraction: 0.3,
        },
        warrior: {
            speedMult: 0.9,
            biteResistPct: 0.15,
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
            massCostPct: 0.02,
            cooldownSec: 7,
            durationSec: 1.5,
            radiusM: 120,
            pullSpeedMps: 50,
        },
        slow: {
            massCostPct: 0.02,
            cooldownSec: 7,
            durationSec: 2,
            radiusM: 80,
            slowPct: 0.30,
        },
        projectile: {
            massCostPct: 0.02,
            cooldownSec: 3,
            speedMps: 400,
            rangeM: 300,
            damagePct: 0.10,
            radiusM: 8,
        },
        spit: {
            massCostPct: 0.03,
            cooldownSec: 4,
            speedMps: 350,
            rangeM: 200,
            damagePct: 0.08,
            radiusM: 6,
            projectileCount: 3,
            spreadAngleDeg: 30,
        },
        bomb: {
            massCostPct: 0.04,
            cooldownSec: 6,
            speedMps: 200,
            rangeM: 250,
            damagePct: 0.12,
            radiusM: 10,
            explosionRadiusM: 50,
        },
        push: {
            massCostPct: 0.03,
            cooldownSec: 6,
            radiusM: 80,
            impulseNs: 50000,
            minSpeedMps: 30,
            maxSpeedMps: 120,
        },
        mine: {
            massCostPct: 0.02,
            cooldownSec: 10,
            damagePct: 0.15,
            radiusM: 15,
            durationSec: 20,
            maxMines: 1,
        },
    },
    chests: {
        maxCount: 3,
        spawnIntervalSec: 20,
        mass: 200,
        radius: 14,
        rewards: {
            scatterTotalMassPct: [0.12, 0.18, 0.28],
            scatterBubbleCount: [10, 16, 24],
            scatterInnerFrac: [0.30, 0.30, 0.25],
            scatterInnerSpeedMpsMin: [25, 25, 25],
            scatterInnerSpeedMpsMax: [45, 45, 40],
            scatterOuterSpeedMpsMin: [55, 65, 75],
            scatterOuterSpeedMpsMax: [75, 85, 95],
            scatterSmallBubbleSpeedMul: 1.25,
            talentRarityWeights: {
                rare: { common: 80, rare: 20, epic: 0 },
                epic: { common: 30, rare: 60, epic: 10 },
                gold: { common: 0, rare: 40, epic: 60 },
            },
        },
    },
    hotZones: {
        chaosCount: 2,
        finalCount: 1,
        radius: 110,
        spawnMultiplierChaos: 3,
        spawnMultiplierFinal: 5,
    },
    toxicPools: {
        radiusM: 20,
        durationSec: 3,
        damagePctPerSec: 0.01,
        slowPct: 0.2,
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
    talents: {
        cardChoiceTimeoutSec: 12,
        talentPool: {
            common: ["fastLegs", "spinner", "sharpTeeth", "glutton", "thickSkin", "economical", "recharge", "aggressor", "sturdy", "accelerator", "anchor", "crab", "bloodlust", "secondWind"],
            rare: ["poison", "frost", "vampire", "vacuum", "motor", "ricochet", "piercing", "longDash", "backNeedles", "toxic"],
            epic: ["lightning", "doubleActivation", "explosion", "leviathan", "invisible"],
        },
        common: {
            fastLegs: { name: "Быстрые ноги", maxLevel: 3, values: [0.10, 0.18, 0.25], effect: "speedLimitBonus" },
            spinner: { name: "Юла", maxLevel: 3, values: [0.10, 0.18, 0.25], effect: "turnBonus" },
            sharpTeeth: { name: "Острые зубы", maxLevel: 3, values: [0.15, 0.25, 0.35], effect: "biteDamageBonus" },
            glutton: { name: "Обжора", maxLevel: 3, values: [0.20, 0.35, 0.50], effect: "orbMassBonus" },
            thickSkin: { name: "Толстая шкура", maxLevel: 3, values: [0.12, 0.20, 0.27], effect: "biteResistBonus" },
            economical: { name: "Экономный", maxLevel: 3, values: [0.15, 0.25, 0.33], effect: "abilityCostReduction" },
            recharge: { name: "Перезарядка", maxLevel: 3, values: [0.15, 0.25, 0.33], effect: "cooldownReduction" },
            aggressor: { name: "Агрессор", maxLevel: 1, values: [0.12], effect: "aggressorDual" },
            sturdy: { name: "Стойкий", maxLevel: 1, values: [0.10], effect: "allDamageReduction" },
            accelerator: { name: "Ускоритель", maxLevel: 1, values: [0.15], effect: "thrustForwardBonus" },
            anchor: { name: "Якорь", maxLevel: 1, values: [0.20], effect: "thrustReverseBonus" },
            crab: { name: "Краб", maxLevel: 1, values: [0.15], effect: "thrustLateralBonus" },
            bloodlust: { name: "Кровожадность", maxLevel: 1, values: [0.15], effect: "killMassBonus" },
            secondWind: { name: "Второе дыхание", maxLevel: 1, values: [150], effect: "respawnMass" },
        },
        rare: {
            poison: { name: "Яд", maxLevel: 2, values: [[0.02, 3], [0.03, 3]], effect: "poisonOnBite", requirement: null },
            frost: { name: "Мороз", maxLevel: 2, values: [[0.30, 2], [0.40, 2.5]], effect: "frostOnBite", requirement: null },
            vampire: { name: "Вампир", maxLevel: 1, values: [[0.20, 0.25]], effect: "vampireBite", requirement: null },
            vacuum: { name: "Вакуум", maxLevel: 2, values: [[40, 15], [60, 20]], effect: "vacuumOrbs", requirement: null },
            motor: { name: "Мотор", maxLevel: 1, values: [0.25], effect: "allThrustBonus", requirement: null },
            ricochet: { name: "Рикошет", maxLevel: 1, values: [1], effect: "projectileRicochet", requirement: "projectile" },
            piercing: { name: "Пробивание", maxLevel: 1, values: [[1.0, 0.6]], effect: "projectilePiercing", requirement: "projectile" },
            longDash: { name: "Длинный рывок", maxLevel: 1, values: [0.40], effect: "dashDistanceBonus", requirement: "dash" },
            backNeedles: { name: "Иглы назад", maxLevel: 1, values: [[3, 0.10]], effect: "deathNeedles", requirement: null },
            toxic: { name: "Токсичный", maxLevel: 1, values: [2.0], effect: "toxicPoolBonus", requirement: null },
        },
        epic: {
            lightning: { name: "Молния", maxLevel: 1, values: [[0.25, 0.3]], effect: "lightningSpeed", requirement: null },
            doubleActivation: { name: "Двойная активация", maxLevel: 1, values: [[1.0, 0.80]], effect: "doubleAbility", requirement: null },
            explosion: { name: "Взрыв", maxLevel: 1, values: [[60, 0.08]], effect: "deathExplosion", requirement: null },
            leviathan: { name: "Левиафан", maxLevel: 1, values: [[1.3, 1.5]], effect: "leviathanSize", requirement: null },
            invisible: { name: "Невидимка", maxLevel: 1, values: [1.5], effect: "invisibleAfterDash", requirement: "dash" },
        },
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

function readStringArray(value: unknown, fallback: string[], path: string): string[] {
    if (value === undefined || value === null) return fallback;
    if (!Array.isArray(value)) {
        throw new Error(`Invalid array at ${path}`);
    }
    return value.map((item, index) => {
        if (typeof item !== "string") {
            throw new Error(`Invalid string at ${path}[${index}]`);
        }
        return item;
    });
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
            angularBrakeBoostFactor: readNumber(
                assist.angularBrakeBoostFactor,
                fallback.assist.angularBrakeBoostFactor,
                `${path}.assist.angularBrakeBoostFactor`
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
    const toxicPools = isRecord(data.toxicPools) ? data.toxicPools : {};
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
    const chestRewardWeights = isRecord(chestRewards.talentRarityWeights)
        ? chestRewards.talentRarityWeights
        : {};
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
            levelThresholds: Array.isArray(slime.levelThresholds)
                ? slime.levelThresholds.map((v: unknown, i: number) =>
                    readNumber(v, DEFAULT_BALANCE_CONFIG.slime.levelThresholds[i] ?? 100, `slime.levelThresholds[${i}]`))
                : DEFAULT_BALANCE_CONFIG.slime.levelThresholds,
            slotUnlockLevels: Array.isArray(slime.slotUnlockLevels)
                ? slime.slotUnlockLevels.map((v: unknown, i: number) =>
                    readNumber(v, DEFAULT_BALANCE_CONFIG.slime.slotUnlockLevels[i] ?? 1, `slime.slotUnlockLevels[${i}]`))
                : DEFAULT_BALANCE_CONFIG.slime.slotUnlockLevels,
            cardChoiceTimeoutSec: readNumber(
                slime.cardChoiceTimeoutSec,
                DEFAULT_BALANCE_CONFIG.slime.cardChoiceTimeoutSec,
                "slime.cardChoiceTimeoutSec"
            ),
            abilityPool: Array.isArray(slime.abilityPool)
                ? slime.abilityPool.filter((v: unknown) => typeof v === "string") as string[]
                : DEFAULT_BALANCE_CONFIG.slime.abilityPool,
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
                biteResistPct: readNumber(
                    hunter.biteResistPct,
                    DEFAULT_BALANCE_CONFIG.classes.hunter.biteResistPct,
                    "classes.hunter.biteResistPct"
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
                biteResistPct: readNumber(
                    warrior.biteResistPct,
                    DEFAULT_BALANCE_CONFIG.classes.warrior.biteResistPct,
                    "classes.warrior.biteResistPct"
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
            const slow = isRecord(abilities.slow) ? abilities.slow : {};
            const projectile = isRecord(abilities.projectile) ? abilities.projectile : {};
            const spit = isRecord(abilities.spit) ? abilities.spit : {};
            const bomb = isRecord(abilities.bomb) ? abilities.bomb : {};
            const push = isRecord(abilities.push) ? abilities.push : {};
            const mine = isRecord(abilities.mine) ? abilities.mine : {};
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
                slow: {
                    massCostPct: readNumber(slow.massCostPct, DEFAULT_BALANCE_CONFIG.abilities.slow.massCostPct, "abilities.slow.massCostPct"),
                    cooldownSec: readNumber(slow.cooldownSec, DEFAULT_BALANCE_CONFIG.abilities.slow.cooldownSec, "abilities.slow.cooldownSec"),
                    durationSec: readNumber(slow.durationSec, DEFAULT_BALANCE_CONFIG.abilities.slow.durationSec, "abilities.slow.durationSec"),
                    radiusM: readNumber(slow.radiusM, DEFAULT_BALANCE_CONFIG.abilities.slow.radiusM, "abilities.slow.radiusM"),
                    slowPct: readNumber(slow.slowPct, DEFAULT_BALANCE_CONFIG.abilities.slow.slowPct, "abilities.slow.slowPct"),
                },
                projectile: {
                    massCostPct: readNumber(projectile.massCostPct, DEFAULT_BALANCE_CONFIG.abilities.projectile.massCostPct, "abilities.projectile.massCostPct"),
                    cooldownSec: readNumber(projectile.cooldownSec, DEFAULT_BALANCE_CONFIG.abilities.projectile.cooldownSec, "abilities.projectile.cooldownSec"),
                    speedMps: readNumber(projectile.speedMps, DEFAULT_BALANCE_CONFIG.abilities.projectile.speedMps, "abilities.projectile.speedMps"),
                    rangeM: readNumber(projectile.rangeM, DEFAULT_BALANCE_CONFIG.abilities.projectile.rangeM, "abilities.projectile.rangeM"),
                    damagePct: readNumber(projectile.damagePct, DEFAULT_BALANCE_CONFIG.abilities.projectile.damagePct, "abilities.projectile.damagePct"),
                    radiusM: readNumber(projectile.radiusM, DEFAULT_BALANCE_CONFIG.abilities.projectile.radiusM, "abilities.projectile.radiusM"),
                },
                spit: {
                    massCostPct: readNumber(spit.massCostPct, DEFAULT_BALANCE_CONFIG.abilities.spit.massCostPct, "abilities.spit.massCostPct"),
                    cooldownSec: readNumber(spit.cooldownSec, DEFAULT_BALANCE_CONFIG.abilities.spit.cooldownSec, "abilities.spit.cooldownSec"),
                    speedMps: readNumber(spit.speedMps, DEFAULT_BALANCE_CONFIG.abilities.spit.speedMps, "abilities.spit.speedMps"),
                    rangeM: readNumber(spit.rangeM, DEFAULT_BALANCE_CONFIG.abilities.spit.rangeM, "abilities.spit.rangeM"),
                    damagePct: readNumber(spit.damagePct, DEFAULT_BALANCE_CONFIG.abilities.spit.damagePct, "abilities.spit.damagePct"),
                    radiusM: readNumber(spit.radiusM, DEFAULT_BALANCE_CONFIG.abilities.spit.radiusM, "abilities.spit.radiusM"),
                    projectileCount: readNumber(spit.projectileCount, DEFAULT_BALANCE_CONFIG.abilities.spit.projectileCount, "abilities.spit.projectileCount"),
                    spreadAngleDeg: readNumber(spit.spreadAngleDeg, DEFAULT_BALANCE_CONFIG.abilities.spit.spreadAngleDeg, "abilities.spit.spreadAngleDeg"),
                },
                bomb: {
                    massCostPct: readNumber(bomb.massCostPct, DEFAULT_BALANCE_CONFIG.abilities.bomb.massCostPct, "abilities.bomb.massCostPct"),
                    cooldownSec: readNumber(bomb.cooldownSec, DEFAULT_BALANCE_CONFIG.abilities.bomb.cooldownSec, "abilities.bomb.cooldownSec"),
                    speedMps: readNumber(bomb.speedMps, DEFAULT_BALANCE_CONFIG.abilities.bomb.speedMps, "abilities.bomb.speedMps"),
                    rangeM: readNumber(bomb.rangeM, DEFAULT_BALANCE_CONFIG.abilities.bomb.rangeM, "abilities.bomb.rangeM"),
                    damagePct: readNumber(bomb.damagePct, DEFAULT_BALANCE_CONFIG.abilities.bomb.damagePct, "abilities.bomb.damagePct"),
                    radiusM: readNumber(bomb.radiusM, DEFAULT_BALANCE_CONFIG.abilities.bomb.radiusM, "abilities.bomb.radiusM"),
                    explosionRadiusM: readNumber(bomb.explosionRadiusM, DEFAULT_BALANCE_CONFIG.abilities.bomb.explosionRadiusM, "abilities.bomb.explosionRadiusM"),
                },
                push: {
                    massCostPct: readNumber(push.massCostPct, DEFAULT_BALANCE_CONFIG.abilities.push.massCostPct, "abilities.push.massCostPct"),
                    cooldownSec: readNumber(push.cooldownSec, DEFAULT_BALANCE_CONFIG.abilities.push.cooldownSec, "abilities.push.cooldownSec"),
                    radiusM: readNumber(push.radiusM, DEFAULT_BALANCE_CONFIG.abilities.push.radiusM, "abilities.push.radiusM"),
                    impulseNs: readNumber(push.impulseNs, DEFAULT_BALANCE_CONFIG.abilities.push.impulseNs, "abilities.push.impulseNs"),
                    minSpeedMps: readNumber(push.minSpeedMps, DEFAULT_BALANCE_CONFIG.abilities.push.minSpeedMps, "abilities.push.minSpeedMps"),
                    maxSpeedMps: readNumber(push.maxSpeedMps, DEFAULT_BALANCE_CONFIG.abilities.push.maxSpeedMps, "abilities.push.maxSpeedMps"),
                },
                mine: {
                    massCostPct: readNumber(mine.massCostPct, DEFAULT_BALANCE_CONFIG.abilities.mine.massCostPct, "abilities.mine.massCostPct"),
                    cooldownSec: readNumber(mine.cooldownSec, DEFAULT_BALANCE_CONFIG.abilities.mine.cooldownSec, "abilities.mine.cooldownSec"),
                    damagePct: readNumber(mine.damagePct, DEFAULT_BALANCE_CONFIG.abilities.mine.damagePct, "abilities.mine.damagePct"),
                    radiusM: readNumber(mine.radiusM, DEFAULT_BALANCE_CONFIG.abilities.mine.radiusM, "abilities.mine.radiusM"),
                    durationSec: readNumber(mine.durationSec, DEFAULT_BALANCE_CONFIG.abilities.mine.durationSec, "abilities.mine.durationSec"),
                    maxMines: readNumber(mine.maxMines, DEFAULT_BALANCE_CONFIG.abilities.mine.maxMines, "abilities.mine.maxMines"),
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
                scatterTotalMassPct: readNumberArray(
                    chestRewards.scatterTotalMassPct,
                    DEFAULT_BALANCE_CONFIG.chests.rewards.scatterTotalMassPct,
                    "chests.rewards.scatterTotalMassPct"
                ),
                scatterBubbleCount: readNumberArray(
                    chestRewards.scatterBubbleCount,
                    DEFAULT_BALANCE_CONFIG.chests.rewards.scatterBubbleCount,
                    "chests.rewards.scatterBubbleCount"
                ),
                scatterInnerFrac: readNumberArray(
                    chestRewards.scatterInnerFrac,
                    DEFAULT_BALANCE_CONFIG.chests.rewards.scatterInnerFrac,
                    "chests.rewards.scatterInnerFrac"
                ),
                scatterInnerSpeedMpsMin: readNumberArray(
                    chestRewards.scatterInnerSpeedMpsMin,
                    DEFAULT_BALANCE_CONFIG.chests.rewards.scatterInnerSpeedMpsMin,
                    "chests.rewards.scatterInnerSpeedMpsMin"
                ),
                scatterInnerSpeedMpsMax: readNumberArray(
                    chestRewards.scatterInnerSpeedMpsMax,
                    DEFAULT_BALANCE_CONFIG.chests.rewards.scatterInnerSpeedMpsMax,
                    "chests.rewards.scatterInnerSpeedMpsMax"
                ),
                scatterOuterSpeedMpsMin: readNumberArray(
                    chestRewards.scatterOuterSpeedMpsMin,
                    DEFAULT_BALANCE_CONFIG.chests.rewards.scatterOuterSpeedMpsMin,
                    "chests.rewards.scatterOuterSpeedMpsMin"
                ),
                scatterOuterSpeedMpsMax: readNumberArray(
                    chestRewards.scatterOuterSpeedMpsMax,
                    DEFAULT_BALANCE_CONFIG.chests.rewards.scatterOuterSpeedMpsMax,
                    "chests.rewards.scatterOuterSpeedMpsMax"
                ),
                scatterSmallBubbleSpeedMul: readNumber(
                    chestRewards.scatterSmallBubbleSpeedMul,
                    DEFAULT_BALANCE_CONFIG.chests.rewards.scatterSmallBubbleSpeedMul,
                    "chests.rewards.scatterSmallBubbleSpeedMul"
                ),
                talentRarityWeights: {
                    rare: (() => {
                        const entry = isRecord(chestRewardWeights.rare) ? chestRewardWeights.rare : {};
                        const fallback = DEFAULT_BALANCE_CONFIG.chests.rewards.talentRarityWeights.rare;
                        return {
                            common: readNumber(entry.common, fallback.common, "chests.rewards.talentRarityWeights.rare.common"),
                            rare: readNumber(entry.rare, fallback.rare, "chests.rewards.talentRarityWeights.rare.rare"),
                            epic: readNumber(entry.epic, fallback.epic, "chests.rewards.talentRarityWeights.rare.epic"),
                        };
                    })(),
                    epic: (() => {
                        const entry = isRecord(chestRewardWeights.epic) ? chestRewardWeights.epic : {};
                        const fallback = DEFAULT_BALANCE_CONFIG.chests.rewards.talentRarityWeights.epic;
                        return {
                            common: readNumber(entry.common, fallback.common, "chests.rewards.talentRarityWeights.epic.common"),
                            rare: readNumber(entry.rare, fallback.rare, "chests.rewards.talentRarityWeights.epic.rare"),
                            epic: readNumber(entry.epic, fallback.epic, "chests.rewards.talentRarityWeights.epic.epic"),
                        };
                    })(),
                    gold: (() => {
                        const entry = isRecord(chestRewardWeights.gold) ? chestRewardWeights.gold : {};
                        const fallback = DEFAULT_BALANCE_CONFIG.chests.rewards.talentRarityWeights.gold;
                        return {
                            common: readNumber(entry.common, fallback.common, "chests.rewards.talentRarityWeights.gold.common"),
                            rare: readNumber(entry.rare, fallback.rare, "chests.rewards.talentRarityWeights.gold.rare"),
                            epic: readNumber(entry.epic, fallback.epic, "chests.rewards.talentRarityWeights.gold.epic"),
                        };
                    })(),
                },
            },
            // GDD v3.3: типы сундуков и фазовые веса
            types: isRecord(chests.types) ? chests.types as BalanceConfig["chests"]["types"] : undefined,
            phaseWeights: isRecord(chests.phaseWeights) ? chests.phaseWeights as BalanceConfig["chests"]["phaseWeights"] : undefined,
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
        toxicPools: {
            radiusM: readNumber(toxicPools.radiusM, DEFAULT_BALANCE_CONFIG.toxicPools.radiusM, "toxicPools.radiusM"),
            durationSec: readNumber(
                toxicPools.durationSec,
                DEFAULT_BALANCE_CONFIG.toxicPools.durationSec,
                "toxicPools.durationSec"
            ),
            damagePctPerSec: readNumber(
                toxicPools.damagePctPerSec,
                DEFAULT_BALANCE_CONFIG.toxicPools.damagePctPerSec,
                "toxicPools.damagePctPerSec"
            ),
            slowPct: readNumber(toxicPools.slowPct, DEFAULT_BALANCE_CONFIG.toxicPools.slowPct, "toxicPools.slowPct"),
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
        talents: (() => {
            const talents = isRecord(data.talents) ? data.talents : {};
            const talentPool = isRecord(talents.talentPool) ? talents.talentPool : {};
            
            // Parse talent configs from JSON, falling back to defaults
            const parseTalentRecord = (
                source: unknown,
                defaults: Record<string, TalentConfig>
            ): Record<string, TalentConfig> => {
                if (!isRecord(source)) return defaults;
                const result: Record<string, TalentConfig> = {};
                for (const key of Object.keys(defaults)) {
                    const src = isRecord(source[key]) ? source[key] : {};
                    const def = defaults[key];
                    result[key] = {
                        name: typeof src.name === "string" ? src.name : def.name,
                        maxLevel: typeof src.maxLevel === "number" ? src.maxLevel : def.maxLevel,
                        values: Array.isArray(src.values) ? src.values : def.values,
                        effect: typeof src.effect === "string" ? src.effect : def.effect,
                        requirement: src.requirement !== undefined ? src.requirement as string | null : def.requirement,
                    };
                }
                return result;
            };
            
            return {
                cardChoiceTimeoutSec: readNumber(
                    talents.cardChoiceTimeoutSec,
                    DEFAULT_BALANCE_CONFIG.talents.cardChoiceTimeoutSec,
                    "talents.cardChoiceTimeoutSec"
                ),
                talentPool: {
                    common: readStringArray(talentPool.common, DEFAULT_BALANCE_CONFIG.talents.talentPool.common, "talents.talentPool.common"),
                    rare: readStringArray(talentPool.rare, DEFAULT_BALANCE_CONFIG.talents.talentPool.rare, "talents.talentPool.rare"),
                    epic: readStringArray(talentPool.epic, DEFAULT_BALANCE_CONFIG.talents.talentPool.epic, "talents.talentPool.epic"),
                },
                common: parseTalentRecord(talents.common, DEFAULT_BALANCE_CONFIG.talents.common),
                rare: parseTalentRecord(talents.rare, DEFAULT_BALANCE_CONFIG.talents.rare),
                epic: parseTalentRecord(talents.epic, DEFAULT_BALANCE_CONFIG.talents.epic),
            };
        })(),
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
