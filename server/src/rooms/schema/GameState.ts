import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class Player extends Schema {
    @type("string") id: string = "";
    @type("string") name: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") vx: number = 0;
    @type("number") vy: number = 0;
    @type("number") angle: number = 0;
    @type("number") mass: number = 0;
    @type("number") hp: number = 0;
    @type("number") maxHp: number = 0;
    @type("number") level: number = 0;
    @type("number") classId: number = 0;
    @type("number") talentsAvailable: number = 0;
    @type("number") flags: number = 0;

    // Server-only state (not synced)
    inputX: number = 0;
    inputY: number = 0;
    lastProcessedSeq: number = 0;
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

export class GameState extends Schema {
    @type("string") phase: string = "Spawn";
    @type("number") timeRemaining: number = 0;
    @type("string") rebelId: string = "";
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: Orb }) orbs = new MapSchema<Orb>();
    @type({ map: Chest }) chests = new MapSchema<Chest>();
    @type({ map: HotZone }) hotZones = new MapSchema<HotZone>();
    @type({ array: "string" }) leaderboard = new ArraySchema<string>();
}
