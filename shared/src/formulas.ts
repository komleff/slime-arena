import { BalanceConfig } from "./config.js";

export function getSlimeHp(mass: number, formulas: BalanceConfig["formulas"]): number {
    return formulas.hp.base + formulas.hp.scale * Math.log(1 + mass / formulas.hp.divisor);
}

export function getSlimeDamage(mass: number, formulas: BalanceConfig["formulas"]): number {
    return formulas.damage.base + formulas.damage.scale * Math.log(1 + mass / formulas.damage.divisor);
}

export function getSlimeRadius(mass: number, formulas: BalanceConfig["formulas"]): number {
    return (
        formulas.radius.base *
        Math.sqrt(1 + formulas.radius.scale * Math.log(1 + mass / formulas.radius.divisor))
    );
}

export function getOrbRadius(orbMass: number, density: number, minRadius: number): number {
    const safeDensity = density > 0 ? density : 1;
    return minRadius * Math.sqrt(orbMass / safeDensity);
}

export function getSpeedMultiplier(mass: number, formulas: BalanceConfig["formulas"]): number {
    return formulas.speed.base / (1 + formulas.speed.scale * Math.log(1 + mass / formulas.speed.divisor));
}

export function getTurnRateDeg(mass: number, baseTurnRateDeg: number, turnDivisor: number): number {
    return baseTurnRateDeg / (1 + Math.log(1 + mass / turnDivisor));
}
