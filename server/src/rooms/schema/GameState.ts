import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class Player extends Schema {
    @type("string") id: string = "";
    @type("string") name: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") vx: number = 0;
    @type("number") vy: number = 0;
    @type("number") angle: number = 0;
    @type("number") angVel: number = 0;
    @type("number") mass: number = 0;
    @type("number") level: number = 0;
    @type("number") classId: number = 0;
    @type("number") talentsAvailable: number = 0;
    @type("number") flags: number = 0;
    @type("number") abilityCooldownTick: number = 0;
    @type("number") biteResistPct: number = 0; // Накопленный бонус от талантов

    // Server-only state (not synced)
    inputX: number = 0;
    inputY: number = 0;
    lastProcessedSeq: number = 0;
    lastInputTick: number = 0;
    isDead: boolean = false;
    isDrifting: boolean = false;
    driftEndTick: number = 0;
    driftCooldownEndTick: number = 0;
    lastBiteTick: number = 0;
    lastAttackTick: number = 0;
    invulnerableUntilTick: number = 0;
    respawnAtTick: number = 0;
    gcdReadyTick: number = 0;
    queuedAbilitySlot: number | null = null;
    queuedAbilityTick: number = 0;
    abilitySlotPressed: number | null = null;
    talentChoicePressed: number | null = null;
    isLastBreath: boolean = false;
    lastBreathEndTick: number = 0;
    yawSignHistory: number[] = [];
    assistFx: number = 0;
    assistFy: number = 0;
    assistTorque: number = 0;
    
    // Ability state (server-only)
    dashEndTick: number = 0;
    dashTargetX: number = 0;
    dashTargetY: number = 0;
    shieldEndTick: number = 0;
    magnetEndTick: number = 0;
}

export class Orb extends Schema {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") vx: number = 0;
    @type("number") vy: number = 0;
    @type("number") mass: number = 0;
    @type("number") colorId: number = 0;
}

export class Chest extends Schema {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") vx: number = 0;
    @type("number") vy: number = 0;
    @type("number") type: number = 0;
}

export class HotZone extends Schema {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") radius: number = 0;
    @type("number") spawnMultiplier: number = 1;
}

export class Projectile extends Schema {
    @type("string") id: string = "";
    @type("string") ownerId: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") vx: number = 0;
    @type("number") vy: number = 0;
    @type("number") radius: number = 8;
    @type("number") damagePct: number = 0.10;
    
    // Server-only
    spawnTick: number = 0;
    maxRangeM: number = 300;
    startX: number = 0;
    startY: number = 0;
}

export class GameState extends Schema {
    @type("string") phase: string = "Spawn";
    @type("number") timeRemaining: number = 0;
    @type("number") serverTick: number = 0;
    @type("string") rebelId: string = "";
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: Orb }) orbs = new MapSchema<Orb>();
    @type({ map: Chest }) chests = new MapSchema<Chest>();
    @type({ map: HotZone }) hotZones = new MapSchema<HotZone>();
    @type({ map: Projectile }) projectiles = new MapSchema<Projectile>();
    @type({ array: "string" }) leaderboard = new ArraySchema<string>();
}
