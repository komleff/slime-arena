import { FLAG_ABILITY_SHIELD } from "@slime-arena/shared";

export function abilitySystem(room: any) {
    const currentTick = room.tick;
    for (const player of room.state.players.values()) {
        if (player.isDead || player.isLastBreath) {
            player.abilitySlotPressed = null;
            player.talentChoicePressed = null;
            continue;
        }
        if (player.stunEndTick > currentTick) {
            player.abilitySlotPressed = null;
            player.queuedAbilitySlot = null;
            continue;
        }

        if (player.talentChoicePressed !== null) {
            if (player.talentsAvailable > 0) {
                player.talentsAvailable = Math.max(0, player.talentsAvailable - 1);
                room.applyTalentChoice(player, player.talentChoicePressed);
            }
            player.talentChoicePressed = null;
        }

        const pressed = player.abilitySlotPressed;
        const gcdReady = currentTick >= player.gcdReadyTick;

        if (gcdReady && pressed !== null) {
            room.activateAbility(player, pressed);
        } else if (gcdReady && player.queuedAbilitySlot !== null) {
            room.activateAbility(player, player.queuedAbilitySlot);
            player.queuedAbilitySlot = null;
        } else if (!gcdReady && pressed !== null && room.balance.server.abilityQueueSize > 0) {
            if (player.queuedAbilitySlot === null) {
                player.queuedAbilitySlot = pressed;
                player.queuedAbilityTick = currentTick;
            }
        }

        player.abilitySlotPressed = null;
    }
}

export function abilityCardSystem(room: any) {
    const currentTick = room.tick;

    for (const player of room.state.players.values()) {
        // Очистка cardChoicePressed если нет активной карточки (Codex fix)
        if (!player.pendingAbilityCard && player.cardChoicePressed !== null) {
            player.cardChoicePressed = null;
        }

        if (player.isDead || !player.pendingAbilityCard) continue;

        const card = player.pendingAbilityCard;

        // Обработка выбора игрока
        if (player.cardChoicePressed !== null) {
            room.applyAbilityCardChoice(player, player.cardChoicePressed);
            player.cardChoicePressed = null;
            continue;
        }

        // Автовыбор по таймауту
        if (currentTick >= card.expiresAtTick) {
            room.applyAbilityCardChoice(player, 0); // Автовыбор первого варианта
        }
    }
}

export function projectileSystem(room: any) {
    const dt = 1 / room.balance.server.tickRate;
    const toRemove: string[] = [];
    const mapSize = room.balance.world.mapSize;
    const worldHalfW = mapSize / 2;
    const worldHalfH = mapSize / 2;
    const obstacles = Array.from(room.state.obstacles.values()) as any[];

    for (const [projId, proj] of room.state.projectiles.entries()) {
        // Движение
        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;

        // Проверка дистанции
        const dx = proj.x - proj.startX;
        const dy = proj.y - proj.startY;
        const distSq = dx * dx + dy * dy;
        const maxDistReached = distSq > proj.maxRangeM * proj.maxRangeM;

        // Проверка границ мира
        const outX = Math.abs(proj.x) > worldHalfW;
        const outY = Math.abs(proj.y) > worldHalfH;
        const outOfBounds = outX || outY;

        if (outOfBounds && proj.projectileType === 0 && proj.remainingRicochets > 0) {
            if (outX) {
                proj.vx = -proj.vx;
                proj.x = Math.sign(proj.x) * worldHalfW;
            }
            if (outY) {
                proj.vy = -proj.vy;
                proj.y = Math.sign(proj.y) * worldHalfH;
            }
            proj.remainingRicochets -= 1;
            proj.startX = proj.x;
            proj.startY = proj.y;
            continue;
        }

        // Bomb взрывается при достижении макс. дистанции
        if (maxDistReached || outOfBounds) {
            if (proj.projectileType === 1 && proj.explosionRadiusM > 0) {
                room.explodeBomb(proj);
            }
            toRemove.push(projId);
            continue;
        }

        let hitObstacle = false;
        for (const obstacle of obstacles) {
            const odx = proj.x - obstacle.x;
            const ody = proj.y - obstacle.y;
            const touchDist = obstacle.radius + proj.radius;
            if (odx * odx + ody * ody <= touchDist * touchDist) {
                if (proj.projectileType === 1 && proj.explosionRadiusM > 0) {
                    room.explodeBomb(proj);
                }
                toRemove.push(projId);
                hitObstacle = true;
                break;
            }
        }
        if (hitObstacle) continue;

        // Столкновение со слаймами (кроме владельца)
        let hitPlayer = false;
        for (const player of room.state.players.values()) {
            if (player.isDead || player.id === proj.ownerId) continue;
            if (player.isLastBreath) continue;
            if (room.tick < player.invulnerableUntilTick) continue;
            if (proj.lastHitId && proj.lastHitId === player.id) continue;

            // Щит блокирует снаряд
            if ((player.flags & FLAG_ABILITY_SHIELD) !== 0) {
                // Щит снимается при попадании
                player.shieldEndTick = 0;
                player.flags &= ~FLAG_ABILITY_SHIELD;
                // Bomb взрывается даже при попадании в щит
                if (proj.projectileType === 1 && proj.explosionRadiusM > 0) {
                    room.explodeBomb(proj);
                }
                toRemove.push(projId);
                hitPlayer = true;
                break;
            }

            const playerRadius = room.getPlayerRadius(player);
            const pdx = proj.x - player.x;
            const pdy = proj.y - player.y;
            const pdistSq = pdx * pdx + pdy * pdy;
            const touchDist = playerRadius + proj.radius;

            if (pdistSq <= touchDist * touchDist) {
                // Попадание!
                if (proj.projectileType === 1 && proj.explosionRadiusM > 0) {
                    // Bomb - AoE взрыв
                    room.explodeBomb(proj);
                } else {
                    // Обычный снаряд - прямой урон
                    const owner = room.state.players.get(proj.ownerId);
                    if (owner && (!owner.isDead || proj.allowDeadOwner)) {
                        room.applyProjectileDamage(owner, player, proj.damagePct);
                    }
                }
                proj.lastHitId = player.id;
                if (proj.remainingPierces > 0) {
                    proj.remainingPierces -= 1;
                    if (proj.remainingPierces === 1 && proj.piercingDamagePct > 0) {
                        proj.damagePct *= proj.piercingDamagePct;
                    }
                    if (proj.remainingPierces > 0) {
                        hitPlayer = true;
                        continue;
                    }
                }
                toRemove.push(projId);
                hitPlayer = true;
                break;
            }
        }

        if (hitPlayer) continue;
    }

    // Удаляем снаряды
    for (const id of toRemove) {
        room.state.projectiles.delete(id);
    }
}

export function mineSystem(room: any) {
    const toRemove: string[] = [];

    for (const [mineId, mine] of room.state.mines.entries()) {
        // Проверка истечения срока
        if (room.tick >= mine.endTick) {
            toRemove.push(mineId);
            continue;
        }

        const owner = room.state.players.get(mine.ownerId);
        const radiusSq = mine.radius * mine.radius;

        // Проверка коллизий со всеми игроками (включая владельца)
        for (const player of room.state.players.values()) {
            if (player.isDead) continue;
            if (player.isLastBreath) continue;
            if (room.tick < player.invulnerableUntilTick) continue;
            if (player.id === mine.ownerId) continue;

            const playerRadius = room.getPlayerRadius(player);
            const dx = player.x - mine.x;
            const dy = player.y - mine.y;
            const distSq = dx * dx + dy * dy;
            const touchDist = playerRadius + mine.radius;

            if (distSq <= touchDist * touchDist) {
                // Детонация!

                // Щит блокирует мину
                if ((player.flags & FLAG_ABILITY_SHIELD) !== 0) {
                    player.shieldEndTick = 0;
                    player.flags &= ~FLAG_ABILITY_SHIELD;
                } else if (owner && !owner.isDead) {
                    // Урон врагу с передачей массы владельцу
                    room.applyProjectileDamage(owner, player, mine.damagePct);
                }

                toRemove.push(mineId);
                break;
            }
        }
    }

    for (const mineId of toRemove) {
        room.state.mines.delete(mineId);
    }
}
