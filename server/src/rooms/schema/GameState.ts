import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

// Талант игрока (GDD-Talents.md)
export class Talent extends Schema {
    @type("string") id: string = "";       // ID таланта (fastLegs, sharpTeeth, etc.)
    @type("number") level: number = 1;     // Уровень таланта (1-3)
}

// Карточка выбора таланта
export class TalentCard extends Schema {
    @type("string") option0: string = "";   // Первый вариант таланта
    @type("string") option1: string = "";   // Второй вариант таланта
    @type("string") option2: string = "";   // Третий вариант таланта
    @type("number") rarity0: number = 0;    // Редкость: 0=common, 1=rare, 2=epic
    @type("number") rarity1: number = 0;
    @type("number") rarity2: number = 0;
    @type("number") expiresAtTick: number = 0;
}

export class AbilityCard extends Schema {
    @type("number") slotIndex: number = 0;  // Какой слот открывается (1 или 2)
    @type("string") option0: string = "";   // Первый вариант умения
    @type("string") option1: string = "";   // Второй вариант умения  
    @type("string") option2: string = "";   // Третий вариант умения
    @type("number") expiresAtTick: number = 0;  // Автовыбор после этого тика
}

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
    @type("number") killCount: number = 0;
    @type("number") level: number = 0;
    @type("number") classId: number = 0;
    @type("number") talentsAvailable: number = 0;
    @type("number") flags: number = 0;
    @type("number") abilityCooldownTick: number = 0;
    @type("number") abilityCooldownStartTick0: number = 0;
    @type("number") abilityCooldownEndTick0: number = 0;
    @type("number") abilityCooldownStartTick1: number = 0;
    @type("number") abilityCooldownEndTick1: number = 0;
    @type("number") abilityCooldownStartTick2: number = 0;
    @type("number") abilityCooldownEndTick2: number = 0;
    @type("number") biteResistPct: number = 0; // Накопленный бонус от талантов
    
    // Слоты умений (GDD v3.3 1.3)
    @type("string") abilitySlot0: string = "";  // Классовое умение
    @type("string") abilitySlot1: string = "";  // Слот 2 (level 3)
    @type("string") abilitySlot2: string = "";  // Слот 3 (level 5)
    @type("number") abilityLevel0: number = 0;  // Уровень умения слота 1
    @type("number") abilityLevel1: number = 0;  // Уровень умения слота 2
    @type("number") abilityLevel2: number = 0;  // Уровень умения слота 3
    @type(AbilityCard) pendingAbilityCard: AbilityCard | null = null;
    @type("number") pendingCardCount: number = 0;  // Кол-во карточек в очереди (синхронизируется)
    
    // Таланты (GDD-Talents.md)
    @type({ array: Talent }) talents = new ArraySchema<Talent>();
    @type(TalentCard) pendingTalentCard: TalentCard | null = null;
    @type("number") pendingTalentCount: number = 0;  // Кол-во талантов в очереди
    @type("string") boostType: string = "";
    @type("number") boostEndTick: number = 0;
    @type("number") boostCharges: number = 0;
    @type("number") pendingLavaScatterMass: number = 0;

    // Server-only state (not synced)
    userId: string = "";  // User ID from joinToken (for registered users)
    guestSubjectId: string = "";  // Guest subject ID from joinToken (for standalone guests)
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
    stunEndTick: number = 0;
    frostEndTick: number = 0;
    frostSlowPct: number = 0;
    poisonEndTick: number = 0;
    poisonDamagePctPerSec: number = 0;
    poisonTickAccumulator: number = 0;
    invisibleEndTick: number = 0;
    lastDamagedById: string = "";
    lastDamagedAtTick: number = 0;
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
    slowPct: number = 0;
    doubleAbilityWindowEndTick: number = 0;
    doubleAbilitySlot: number | null = null;
    doubleAbilitySecondUsed: boolean = false;
    
    // Ability state (server-only)
    dashEndTick: number = 0;
    dashTargetX: number = 0;
    dashTargetY: number = 0;
    shieldEndTick: number = 0;
    magnetEndTick: number = 0;
    pushEndTick: number = 0;
    
    // Card choice (server-only)
    cardChoicePressed: number | null = null;  // 0, 1, 2 — выбор из карточки
    pendingCardSlots: number[] = [];  // Очередь слотов, ожидающих карточки
    
    // Talent choice (server-only)
    talentChoicePressed2: number | null = null;  // 0, 1, 2 — выбор таланта
    pendingTalentQueue: number[] = [];  // Очередь талантов
    
    // Talent modifiers (server-only, computed from talents)
    mod_speedLimitBonus: number = 0;
    mod_turnBonus: number = 0;
    mod_biteDamageBonus: number = 0;
    mod_damageBonus: number = 0;
    mod_damageTakenBonus: number = 0;
    mod_orbMassBonus: number = 0;
    mod_abilityCostReduction: number = 0;
    mod_cooldownReduction: number = 0;
    mod_allDamageReduction: number = 0;
    mod_thrustForwardBonus: number = 0;
    mod_thrustReverseBonus: number = 0;
    mod_thrustLateralBonus: number = 0;
    mod_killMassBonus: number = 0;
    mod_respawnMass: number = 100;  // Default spawn mass
    mod_dashDistanceBonus: number = 0;
    mod_vacuumRadius: number = 0;
    mod_vacuumSpeed: number = 0;
    mod_poisonDamagePctPerSec: number = 0;
    mod_poisonDurationSec: number = 0;
    mod_frostSlowPct: number = 0;
    mod_frostDurationSec: number = 0;
    mod_vampireSideGainPct: number = 0;
    mod_vampireTailGainPct: number = 0;
    mod_projectileRicochet: number = 0;
    mod_projectilePiercingDamagePct: number = 0;
    mod_projectilePiercingHits: number = 0;
    mod_lightningSpeedBonus: number = 0;
    mod_lightningStunSec: number = 0;
    mod_doubleAbilityWindowSec: number = 0;
    mod_doubleAbilitySecondCostMult: number = 0;
    mod_deathExplosionRadiusM: number = 0;
    mod_deathExplosionDamagePct: number = 0;
    mod_leviathanRadiusMul: number = 1;
    mod_leviathanMouthMul: number = 1;
    mod_invisibleDurationSec: number = 0;
    mod_deathNeedlesCount: number = 0;
    
    mod_deathNeedlesDamagePct: number = 0;
    mod_toxicPoolBonus: number = 1;
    
    // New class talent modifiers
    mod_thornsDamage: number = 0;        // Warrior: reflect damage on bite
    mod_ambushDamage: number = 0;        // Hunter: bonus damage from invisibility
    mod_parasiteMass: number = 0;        // Collector: mass steal on damage
    mod_magnetRadius: number = 0;        // Collector: orb attraction radius
    mod_magnetSpeed: number = 0;         // Collector: orb attraction speed
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
    @type("number") armorRings: number = 0;
}

export class HotZone extends Schema {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") radius: number = 0;
    @type("number") spawnMultiplier: number = 1;
}

export class SlowZone extends Schema {
    @type("string") id: string = "";
    @type("string") ownerId: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") radius: number = 0;
    @type("number") slowPct: number = 0.3;
    
    // Server-only
    endTick: number = 0;
}

export class ToxicPool extends Schema {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") radius: number = 20;
    @type("number") slowPct: number = 0.2;
    @type("number") damagePctPerSec: number = 0.01;
    
    // Server-only
    endTick: number = 0;
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
    @type("number") projectileType: number = 0;  // 0 = normal, 1 = bomb
    
    // Server-only
    spawnTick: number = 0;
    maxRangeM: number = 300;
    startX: number = 0;
    startY: number = 0;
    explosionRadiusM: number = 0;  // For bomb type
    remainingRicochets: number = 0;
    remainingPierces: number = 0;
    piercingDamagePct: number = 0;
    lastHitId: string = "";
    allowDeadOwner: boolean = false;
}

export class Mine extends Schema {
    @type("string") id: string = "";
    @type("string") ownerId: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") radius: number = 15;
    @type("number") damagePct: number = 0.15;
    
    // Server-only
    endTick: number = 0;
}

export class Zone extends Schema {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") radius: number = 0;
    @type("number") type: number = 0; // ZONE_TYPE_*
}

export class Obstacle extends Schema {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") radius: number = 0;
    @type("number") type: number = 0; // OBSTACLE_TYPE_*
}

export class SafeZone extends Schema {
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") radius: number = 0;
}

export class GameState extends Schema {
    @type("string") phase: string = "Spawn";
    @type("number") timeRemaining: number = 0;
    @type("number") serverTick: number = 0;
    @type("string") rebelId: string = "";
    // Codex P1: UUID матча для /match-results/claim (не путать с roomId)
    @type("string") matchId: string = "";
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: Orb }) orbs = new MapSchema<Orb>();
    @type({ map: Chest }) chests = new MapSchema<Chest>();
    @type({ map: HotZone }) hotZones = new MapSchema<HotZone>();
    @type({ map: SlowZone }) slowZones = new MapSchema<SlowZone>();
    @type({ map: ToxicPool }) toxicPools = new MapSchema<ToxicPool>();
    @type({ map: Projectile }) projectiles = new MapSchema<Projectile>();
    @type({ map: Mine }) mines = new MapSchema<Mine>();
    @type({ map: Zone }) zones = new MapSchema<Zone>();
    @type({ map: Obstacle }) obstacles = new MapSchema<Obstacle>();
    @type({ array: SafeZone }) safeZones = new ArraySchema<SafeZone>();
    @type({ array: "string" }) leaderboard = new ArraySchema<string>();
    /** Timestamp (ms) когда сервер будет перезагружен. 0 = нет перезагрузки. */
    @type("number") shutdownAt: number = 0;
}

