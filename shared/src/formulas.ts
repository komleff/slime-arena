import { BalanceConfig, SlimeConfig, MassCurveConfig } from "./config.js";

export function getSlimeDamage(mass: number, formulas: BalanceConfig["formulas"]): number {
    return formulas.damage.base + formulas.damage.scale * Math.log(1 + mass / formulas.damage.divisor);
}

export function getSlimeRadius(mass: number, formulas: BalanceConfig["formulas"]): number {
    const divisor = formulas.radius.divisor > 0 ? formulas.radius.divisor : 1;
    return formulas.radius.base * Math.sqrt(1 + (formulas.radius.scale * mass) / divisor);
}

export function getOrbRadius(orbMass: number, density: number, _minRadius: number): number {
    // Честная физика: та же формула что у слайма, но с учётом плотности.
    // density=1.0 означает "такая же плотность как у слайма".
    // Формула: radius = baseRadius × √(mass / baseMass / density)
    // Слайм: baseMass=100, baseRadius=10
    // Орб с mass=100 и density=1.0 → radius=10 (как слайм)
    const slimeBaseMass = 100;
    const slimeBaseRadius = 10;
    const safeDensity = density > 0 ? density : 1;
    return slimeBaseRadius * Math.sqrt(Math.max(0, orbMass) / slimeBaseMass / safeDensity);
}

export function getSpeedMultiplier(mass: number, formulas: BalanceConfig["formulas"]): number {
    return formulas.speed.base / (1 + formulas.speed.scale * Math.log(1 + mass / formulas.speed.divisor));
}

export function getTurnRateDeg(mass: number, baseTurnRateDeg: number, turnDivisor: number): number {
    return baseTurnRateDeg / (1 + Math.log(1 + mass / turnDivisor));
}

export function getSlimeRadiusFromConfig(mass: number, config: SlimeConfig): number {
    const baseMass = config.geometry.baseMassKg > 0 ? config.geometry.baseMassKg : 1;
    const safeMass = Math.max(mass, baseMass * config.massScaling.minMassFactor);
    return config.geometry.baseRadiusM * Math.sqrt(safeMass / baseMass);
}

export function getSlimeInertia(mass: number, config: SlimeConfig): number {
    const radius = getSlimeRadiusFromConfig(mass, config);
    return config.geometry.inertiaFactor * mass * radius * radius;
}

export function scaleSlimeValue(
    baseValue: number,
    mass: number,
    config: SlimeConfig,
    curve: MassCurveConfig
): number {
    const baseMass = config.geometry.baseMassKg > 0 ? config.geometry.baseMassKg : 1;
    const minMass = baseMass * config.massScaling.minMassFactor;
    const safeMass = Math.max(mass, minMass);
    const ratio = safeMass / baseMass;
    let value = baseValue;
    if (curve.type === "power") {
        const exp = curve.exp ?? 0;
        value = baseValue * Math.pow(ratio, exp);
    } else if (curve.type === "log") {
        const k = curve.k ?? 0;
        value = baseValue * (1 + k * Math.log(ratio));
    }
    if (curve.minValue !== undefined) {
        value = Math.max(curve.minValue, value);
    }
    if (curve.maxValue !== undefined) {
        value = Math.min(curve.maxValue, value);
    }
    return value;
}
