import { Schema, type, MapSchema } from "@colyseus/schema";

export enum OrbColor {
    GREEN = 0,
    BLUE = 1,
    RED = 2,
    GOLD = 3,
}

export class Orb extends Schema {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") mass: number = 0;
    @type("number") color: number = 0;
    @type("number") vx: number = 0;
    @type("number") vy: number = 0;
}

export class Player extends Schema {
    @type("string") id: string = "";
    @type("string") name: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") mass: number = 0;
    @type("number") angle: number = 0;
    @type("number") hp: number = 0;
    @type("number") maxHp: number = 0;
    @type("number") lastProcessedSeq: number = 0;
    @type("number") inputX: number = 0;
    @type("number") inputY: number = 0;
    @type("number") vx: number = 0;
    @type("number") vy: number = 0;
    @type("boolean") isDrifting: boolean = false;
    @type("boolean") isInvulnerable: boolean = false;
    @type("boolean") isDead: boolean = false;
    @type("number") respawnTime: number = 0;
    driftEndTime: number = 0;
    driftCooldownEndTime: number = 0;
    lastBiteTime: number = 0;
    lastAttackTime: number = 0;
    invulnerableEndTime: number = 0;
}

export class GameState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: Orb }) orbs = new MapSchema<Orb>();
}
