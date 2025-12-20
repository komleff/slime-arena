import { Room, Client } from "colyseus";
import { GameState, Player, Orb, OrbColor } from "./schema/GameState";
import { GAME_CONFIG, InputData, getSlimeRadius, getSlimeDamage, getSlimeHP } from "@slime-arena/shared";

export class ArenaRoom extends Room<GameState> {
    maxClients = GAME_CONFIG.MAX_PLAYERS;
    private orbIdCounter = 0;
    private lastOrbSpawnTime = 0;

    onCreate(options: any) {
        this.setState(new GameState());

        this.onMessage("input", (client, data: InputData) => {
            const player = this.state.players.get(client.sessionId);
            if (!player || !data) return;

            // Валидация seq
            const seq = Number(data.seq);
            if (!Number.isFinite(seq) || seq < 0) return;
            if (seq <= player.lastProcessedSeq) return;
            player.lastProcessedSeq = seq;

            // Валидация и нормализация вектора движения
            let moveX = Number(data.moveX);
            let moveY = Number(data.moveY);
            if (!Number.isFinite(moveX)) moveX = 0;
            if (!Number.isFinite(moveY)) moveY = 0;
            moveX = Math.max(-1, Math.min(1, moveX));
            moveY = Math.max(-1, Math.min(1, moveY));
            const length = Math.sqrt(moveX * moveX + moveY * moveY);

            if (length > 1) {
                moveX /= length;
                moveY /= length;
            }

            player.inputX = moveX;
            player.inputY = moveY;
            
            // Обработка умений (пока просто логируем)
            if (Number.isInteger(data.abilitySlot)) {
                console.log(`Player ${client.sessionId} used ability ${data.abilitySlot}`);
            }
        });

        // Установка игрового цикла (30 Гц)
        this.setSimulationInterval((deltaTime) => this.update(deltaTime), 1000 / GAME_CONFIG.TICK_RATE);

        // Начальный спавн пузырей
        this.spawnInitialOrbs();

        console.log("ArenaRoom created!");
    }

    private spawnInitialOrbs() {
        const initialCount = Math.floor(GAME_CONFIG.ORB_MAX_COUNT * 0.7);
        for (let i = 0; i < initialCount; i++) {
            this.spawnOrb();
        }
    }

    private getRandomOrbColor(): OrbColor {
        const weights = GAME_CONFIG.ORB_SPAWN_WEIGHTS;
        const total = weights.GREEN + weights.BLUE + weights.RED + weights.GOLD;
        const rand = Math.random() * total;
        
        if (rand < weights.GREEN) return OrbColor.GREEN;
        if (rand < weights.GREEN + weights.BLUE) return OrbColor.BLUE;
        if (rand < weights.GREEN + weights.BLUE + weights.RED) return OrbColor.RED;
        return OrbColor.GOLD;
    }

    private spawnOrb(x?: number, y?: number, mass?: number, color?: OrbColor): Orb | null {
        if (this.state.orbs.size >= GAME_CONFIG.ORB_MAX_COUNT) return null;

        const orb = new Orb();
        orb.id = `orb_${this.orbIdCounter++}`;
        orb.x = x ?? Math.random() * GAME_CONFIG.MAP_SIZE;
        orb.y = y ?? Math.random() * GAME_CONFIG.MAP_SIZE;
        orb.mass = mass ?? GAME_CONFIG.ORB_MIN_MASS + Math.random() * (GAME_CONFIG.ORB_MAX_MASS - GAME_CONFIG.ORB_MIN_MASS);
        orb.color = color ?? this.getRandomOrbColor();
        orb.vx = 0;
        orb.vy = 0;

        this.state.orbs.set(orb.id, orb);
        return orb;
    }

    onJoin(client: Client, options: any) {
        console.log(client.sessionId, "joined!");

        const player = new Player();
        player.id = client.sessionId;
        player.name = options.name || `Slime_${client.sessionId.substring(0, 4)}`;
        player.x = Math.random() * GAME_CONFIG.MAP_SIZE;
        player.y = Math.random() * GAME_CONFIG.MAP_SIZE;
        player.mass = GAME_CONFIG.INITIAL_MASS;
        player.angle = 0;
        player.hp = getSlimeHP(GAME_CONFIG.INITIAL_MASS);
        player.maxHp = player.hp;

        this.state.players.set(client.sessionId, player);
    }

    onLeave(client: Client, consented: boolean) {
        console.log(client.sessionId, "left!");
        this.state.players.delete(client.sessionId);
    }

    update(deltaTime: number) {
        const dt = deltaTime / 1000;
        const now = Date.now();

        // Спавн новых пузырей
        if (now - this.lastOrbSpawnTime > GAME_CONFIG.ORB_SPAWN_INTERVAL) {
            this.spawnOrb();
            this.lastOrbSpawnTime = now;
        }

        // Обновление пузырей (физика)
        this.state.orbs.forEach((orb) => {
            // Применяем трение
            orb.vx *= GAME_CONFIG.ORB_FRICTION;
            orb.vy *= GAME_CONFIG.ORB_FRICTION;

            // Движение
            orb.x += orb.vx * dt;
            orb.y += orb.vy * dt;

            // Отскок от стен
            const orbRadius = this.getOrbRadius(orb);
            if (orb.x - orbRadius < 0) {
                orb.x = orbRadius;
                orb.vx *= -GAME_CONFIG.WALL_RESTITUTION;
            } else if (orb.x + orbRadius > GAME_CONFIG.MAP_SIZE) {
                orb.x = GAME_CONFIG.MAP_SIZE - orbRadius;
                orb.vx *= -GAME_CONFIG.WALL_RESTITUTION;
            }
            if (orb.y - orbRadius < 0) {
                orb.y = orbRadius;
                orb.vy *= -GAME_CONFIG.WALL_RESTITUTION;
            } else if (orb.y + orbRadius > GAME_CONFIG.MAP_SIZE) {
                orb.y = GAME_CONFIG.MAP_SIZE - orbRadius;
                orb.vy *= -GAME_CONFIG.WALL_RESTITUTION;
            }
        });

        this.state.players.forEach((player) => {
            // Пропускаем мёртвых игроков
            if (player.isDead) return;

            // 1. Расчет множителей от массы
            const speedMult = 1 / (1 + Math.log(1 + player.mass / 500));
            const rotSpeed = (GAME_CONFIG.BASE_ROTATION / (1 + Math.log(1 + player.mass / 200))) * dt;

            // 2. Поворот и Дрифт
            if (player.inputX !== 0 || player.inputY !== 0) {
                const targetAngle = Math.atan2(player.inputY, player.inputX) * (180 / Math.PI);
                let diff = targetAngle - player.angle;
                while (diff < -180) diff += 360;
                while (diff > 180) diff -= 360;

                // Проверка на начало дрифта
                if (!player.isDrifting && now > player.driftCooldownEndTime && Math.abs(diff) > GAME_CONFIG.DRIFT_THRESHOLD) {
                    player.isDrifting = true;
                    player.driftEndTime = now + GAME_CONFIG.DRIFT_DURATION;
                    player.driftCooldownEndTime = now + GAME_CONFIG.DRIFT_DURATION + GAME_CONFIG.DRIFT_COOLDOWN;
                    
                    // Потеря скорости
                    player.vx *= (1 - GAME_CONFIG.DRIFT_SPEED_LOSS);
                    player.vy *= (1 - GAME_CONFIG.DRIFT_SPEED_LOSS);
                }

                // Определение скорости поворота
                let currentRotSpeed = rotSpeed;
                if (player.isDrifting) {
                    // В дрифте поворачиваем очень быстро
                    currentRotSpeed = 720 * dt; // 720 градусов в секунду при дрифте
                }

                if (Math.abs(diff) < currentRotSpeed) {
                    player.angle = targetAngle;
                } else {
                    player.angle += Math.sign(diff) * currentRotSpeed;
                }

                // Нормализация угла
                while (player.angle < -180) player.angle += 360;
                while (player.angle > 180) player.angle -= 360;
            }

            // Окончание дрифта
            if (player.isDrifting && now > player.driftEndTime) {
                player.isDrifting = false;
            }

            // 3. Ускорение
            const inputMag = Math.sqrt(player.inputX * player.inputX + player.inputY * player.inputY);
            if (inputMag > 0) {
                // Применяем ускорение в направлении текущего угла слайма
                const accel = GAME_CONFIG.BASE_SPEED * speedMult * inputMag * dt * 10; 
                const angleRad = player.angle * (Math.PI / 180);
                player.vx += Math.cos(angleRad) * accel;
                player.vy += Math.sin(angleRad) * accel;
            }

            // 4. Трение (линейное затухание)
            const friction = Math.pow(GAME_CONFIG.FRICTION, dt * 30);
            player.vx *= friction;
            player.vy *= friction;

            // 5. Движение
            player.x += player.vx * dt;
            player.y += player.vy * dt;

            // 6. Отражение от границ карты (Elastic Walls)
            const radius = 10 * Math.sqrt(1 + Math.log(1 + player.mass / 50));
            
            if (player.x - radius < 0) {
                player.x = radius;
                player.vx *= -GAME_CONFIG.WALL_RESTITUTION;
            } else if (player.x + radius > GAME_CONFIG.MAP_SIZE) {
                player.x = GAME_CONFIG.MAP_SIZE - radius;
                player.vx *= -GAME_CONFIG.WALL_RESTITUTION;
            }

            if (player.y - radius < 0) {
                player.y = radius;
                player.vy *= -GAME_CONFIG.WALL_RESTITUTION;
            } else if (player.y + radius > GAME_CONFIG.MAP_SIZE) {
                player.y = GAME_CONFIG.MAP_SIZE - radius;
                player.vy *= -GAME_CONFIG.WALL_RESTITUTION;
            }
        });

        // 7. Столкновения между игроками + боевая система
        const players = Array.from(this.state.players.values());
        for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
                const p1 = players[i];
                const p2 = players[j];

                // Пропускаем мёртвых игроков
                if (p1.isDead || p2.isDead) continue;

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distSq = dx * dx + dy * dy;
                const r1 = getSlimeRadius(p1.mass);
                const r2 = getSlimeRadius(p2.mass);
                const minDist = r1 + r2;

                if (distSq < minDist * minDist) {
                    const dist = Math.sqrt(distSq) || 1;
                    const nx = dx / dist;
                    const ny = dy / dist;

                    // 1. Разведение (Overlap resolution)
                    const overlap = minDist - dist;
                    const totalMass = p1.mass + p2.mass;
                    const m1Ratio = p2.mass / totalMass;
                    const m2Ratio = p1.mass / totalMass;

                    p1.x -= nx * overlap * m1Ratio;
                    p1.y -= ny * overlap * m1Ratio;
                    p2.x += nx * overlap * m2Ratio;
                    p2.y += ny * overlap * m2Ratio;

                    // 2. Отскок (Elastic collision)
                    const rvx = p2.vx - p1.vx;
                    const rvy = p2.vy - p1.vy;
                    const velAlongNormal = rvx * nx + rvy * ny;

                    if (velAlongNormal <= 0) {
                        const restitution = 0.8; 
                        let j_impulse = -(1 + restitution) * velAlongNormal;
                        j_impulse /= (1 / p1.mass + 1 / p2.mass);

                        const impulseX = j_impulse * nx;
                        const impulseY = j_impulse * ny;

                        p1.vx -= (1 / p1.mass) * impulseX;
                        p1.vy -= (1 / p1.mass) * impulseY;
                        p2.vx += (1 / p2.mass) * impulseX;
                        p2.vy += (1 / p2.mass) * impulseY;
                    }

                    // 3. Боевая система - проверка зон атаки
                    this.processCombat(p1, p2, dx, dy, dist, now);
                    this.processCombat(p2, p1, -dx, -dy, dist, now);
                }
            }
        }

        // Обновление I-frames
        this.state.players.forEach((player) => {
            if (player.isInvulnerable && now > player.invulnerableEndTime) {
                player.isInvulnerable = false;
            }
        });

        // 9. Проверка смерти и респаун
        this.state.players.forEach((player, playerId) => {
            // Проверка смерти
            if (!player.isDead && player.hp <= 0) {
                this.handlePlayerDeath(player, now);
            }

            // Проверка респауна
            if (player.isDead && now >= player.respawnTime) {
                this.handlePlayerRespawn(player, now);
            }
        });

        // 8. Поедание пузырей
        this.state.players.forEach((player) => {
            if (player.isDead) return; // Мёртвые не едят
            if (now - player.lastBiteTime < GAME_CONFIG.BITE_COOLDOWN) return;

            const playerRadius = getSlimeRadius(player.mass);
            const mouthAngleRad = (GAME_CONFIG.MOUTH_ANGLE / 2) * (Math.PI / 180);
            const playerAngleRad = player.angle * (Math.PI / 180);

            this.state.orbs.forEach((orb, orbId) => {
                const dx = orb.x - player.x;
                const dy = orb.y - player.y;
                const distSq = dx * dx + dy * dy;
                const orbRadius = this.getOrbRadius(orb);
                const touchDist = playerRadius + orbRadius;

                if (distSq < touchDist * touchDist) {
                    // Проверяем, что пузырь в зоне пасти
                    const angleToOrb = Math.atan2(dy, dx);
                    let angleDiff = angleToOrb - playerAngleRad;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

                    if (Math.abs(angleDiff) < mouthAngleRad) {
                        // Укус!
                        player.lastBiteTime = now;

                        const biteAmount = orb.mass * GAME_CONFIG.BITE_AMOUNT;
                        
                        if (orb.mass - biteAmount < GAME_CONFIG.BITE_MIN_REMAINDER) {
                            // Полное поглощение
                            player.mass += orb.mass;
                            this.state.orbs.delete(orbId);
                            this.updateMaxHpForMass(player);
                        } else {
                            // Откусывание части
                            player.mass += biteAmount;
                            orb.mass -= biteAmount;
                            this.updateMaxHpForMass(player);
                            
                            // Пузырь отлетает от слайма
                            const dist = Math.sqrt(distSq) || 1;
                            const pushForce = 100;
                            orb.vx += (dx / dist) * pushForce;
                            orb.vy += (dy / dist) * pushForce;
                        }
                    }
                }
            });
        });
    }

    private getOrbRadius(orb: Orb): number {
        const densities = [
            GAME_CONFIG.ORB_DENSITY.GREEN,
            GAME_CONFIG.ORB_DENSITY.BLUE,
            GAME_CONFIG.ORB_DENSITY.RED,
            GAME_CONFIG.ORB_DENSITY.GOLD,
        ];
        const density = densities[orb.color] || 1;
        return GAME_CONFIG.ORB_BASE_RADIUS * Math.sqrt(orb.mass / density);
    }

    private updateMaxHpForMass(player: Player) {
        const maxHp = getSlimeHP(player.mass);
        if (player.maxHp !== maxHp) {
            player.maxHp = maxHp;
            if (player.hp > maxHp) {
                player.hp = maxHp;
            }
        }
    }

    /**
     * Определяет зону контакта: 'mouth' (пасть), 'tail' (хвост), 'side' (бок)
     */
    private getContactZone(attacker: Player, dx: number, dy: number): 'mouth' | 'tail' | 'side' {
        const angleToTarget = Math.atan2(dy, dx) * (180 / Math.PI);
        const attackerAngle = attacker.angle;
        
        let diff = angleToTarget - attackerAngle;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;

        const mouthHalf = GAME_CONFIG.MOUTH_ANGLE / 2;
        const tailHalf = GAME_CONFIG.TAIL_ANGLE / 2;

        if (Math.abs(diff) < mouthHalf) {
            return 'mouth';
        } else if (Math.abs(diff) > 180 - tailHalf) {
            return 'tail';
        }
        return 'side';
    }

    /**
     * Обрабатывает боевое взаимодействие между двумя игроками
     */
    private processCombat(attacker: Player, defender: Player, dx: number, dy: number, dist: number, now: number) {
        // Проверяем кулдаун атаки
        if (now - attacker.lastAttackTime < GAME_CONFIG.ATTACK_COOLDOWN) return;
        
        // Проверяем I-frames защитника
        if (defender.isInvulnerable) return;

        const attackerZone = this.getContactZone(attacker, dx, dy);
        const defenderZone = this.getContactZone(defender, -dx, -dy);

        // Урон наносится только если атакующий бьёт пастью
        if (attackerZone !== 'mouth') return;

        // Множитель урона в зависимости от зоны попадания
        let damageMultiplier = 1.0;
        if (defenderZone === 'tail') {
            damageMultiplier = 1.5; // Критический урон в хвост
        } else if (defenderZone === 'mouth') {
            damageMultiplier = 0.5; // Уменьшенный урон пасть-в-пасть
        }
        // side = 1.0 (обычный урон)

        const baseDamage = getSlimeDamage(attacker.mass);
        const damage = baseDamage * damageMultiplier;

        attacker.lastAttackTime = now;
        defender.hp = Math.max(0, defender.hp - damage);

        // Воровство массы
        const massStolen = damage * GAME_CONFIG.MASS_STEAL_PERCENT;
        attacker.mass += massStolen;
        defender.mass = Math.max(50, defender.mass - massStolen);
        this.updateMaxHpForMass(attacker);
        this.updateMaxHpForMass(defender);

        // Включаем I-frames для защитника
        defender.isInvulnerable = true;
        defender.invulnerableEndTime = now + GAME_CONFIG.I_FRAMES_DURATION;
    }

    /**
     * Обработка смерти игрока
     */
    private handlePlayerDeath(player: Player, now: number) {
        player.isDead = true;
        player.respawnTime = now + GAME_CONFIG.RESPAWN_TIME;

        // Расчёт массы для пузырей
        const massForOrbs = player.mass * GAME_CONFIG.DEATH_MASS_TO_ORBS;
        const orbMass = massForOrbs / GAME_CONFIG.DEATH_ORBS_COUNT;

        // Спавн пузырей на месте смерти
        for (let i = 0; i < GAME_CONFIG.DEATH_ORBS_COUNT; i++) {
            const angle = (i / GAME_CONFIG.DEATH_ORBS_COUNT) * Math.PI * 2;
            const spreadDist = 30;
            const orbX = player.x + Math.cos(angle) * spreadDist;
            const orbY = player.y + Math.sin(angle) * spreadDist;
            
            // Скорость разлёта
            const spreadSpeed = 150;
            const vx = Math.cos(angle) * spreadSpeed;
            const vy = Math.sin(angle) * spreadSpeed;

            const orb = this.spawnOrb(orbX, orbY, orbMass, this.getRandomOrbColor());
            if (orb) {
                orb.vx = vx;
                orb.vy = vy;
            }
        }

        // Обнуляем скорость мёртвого игрока
        player.vx = 0;
        player.vy = 0;
        player.inputX = 0;
        player.inputY = 0;
    }

    /**
     * Обработка респауна игрока
     */
    private handlePlayerRespawn(player: Player, now: number) {
        player.isDead = false;
        
        // Масса при респауне: 20% от предыдущей или минимум
        const respawnMass = Math.max(
            GAME_CONFIG.MIN_RESPAWN_MASS,
            player.mass * (1 - GAME_CONFIG.DEATH_MASS_LOST)
        );
        player.mass = respawnMass;

        // Восстанавливаем HP
        player.hp = getSlimeHP(respawnMass);
        player.maxHp = player.hp;

        // Случайная позиция респауна
        player.x = Math.random() * GAME_CONFIG.MAP_SIZE;
        player.y = Math.random() * GAME_CONFIG.MAP_SIZE;

        // Щит при респауне
        player.isInvulnerable = true;
        player.invulnerableEndTime = now + GAME_CONFIG.RESPAWN_SHIELD_DURATION;
    }

    onDispose() {
        console.log("room", this.roomId, "disposing...");
    }
}
