# AI Agent Guide — Работа с Production Сервером

Это руководство для ИИ-агентов (включая Claude/Copilot), которые помогают управлять production сервером Slime Arena.

## 🔒 Security First

**НИКОГДА не запрашивайте и не выводите в открытом виде:**
- Значения из `JWT_SECRET`
- `MATCH_SERVER_TOKEN`
- `YANDEX_CLIENT_SECRET`
- Другие токены и ключи

Если нужны эти значения — **попросите пользователя**.

---

## 📍 Что вам доступно без пароля

### В GitHub репозитории (открытые данные):

```
📁 docs/operations/
├── SERVER_SETUP.md           ✅ Используйте для инструкций
├── PRODUCTION_CONFIG_BACKUP.md (если существует — СТАРЫЙ, игнорируйте)
└── .env.production.example   ✅ Шаблон переменных (без реальных значений)
```

### Информация о сервере:
- **IP:** 147.45.147.175
- **Домен:** slime-arena.overmobile.space
- **ОС:** Ubuntu 20.04+
- **SSH ключ:** `/root/.ssh/deploy_key` (у пользователя на машине)
- **Docker:** Установлен
- **Контейнер:** `slime-arena`
- **Volumes:** `slime-arena-pgdata`, `slime-arena-redisdata`
- **Порты:** 3000 (Meta), 2567 (Game), 5173 (Client)

### Команды для проверки (без секретов):

```bash
# Подключение по SSH (пользователь должен иметь ключ)
ssh -i ~/.ssh/deploy_key root@147.45.147.175

# Внутри контейнера
docker ps
docker logs -f slime-arena --tail 50
docker inspect slime-arena  # только структура, без env vars

# Health checks
curl https://slime-arena.overmobile.space/health
curl -X POST https://slime-arena.overmobile.space/api/v1/auth/guest -H "Content-Type: application/json" -d '{}'
```

---

## 🔐 Что требует пользователя

### Данные, которые ВСЕГДА должны быть у пользователя локально:

```
/root/.env.production (на сервере)
```

Содержит:
- `JWT_SECRET` — 48+ символов
- `MATCH_SERVER_TOKEN` — 48+ символов
- `CLAIM_TOKEN_TTL_MINUTES` — обычно 60
- `YANDEX_CLIENT_ID` — Yandex OAuth ID
- `YANDEX_CLIENT_SECRET` — Yandex OAuth Secret
- `OAUTH_YANDEX_ENABLED` — true/false

**Когда просить у пользователя:**
1. **При обновлении контейнера** на новую версию
2. **При восстановлении сервера** после сбоя
3. **При добавлении нового сервиса**, требующего переменных

---

## 📋 Типичные операции

### 1️⃣ Проверка статуса сервера

```bash
ssh -i ~/.ssh/deploy_key root@147.45.147.175 'docker ps -a'
```

**Что смотреть:**
- Status: `Up` = работает
- Status: `Exited` = упал
- Uptime: сколько прошло времени

### 2️⃣ Просмотр логов

```bash
ssh -i ~/.ssh/deploy_key root@147.45.147.175 'docker logs slime-arena -f --tail 100'
```

**Red flags:**
- `[MetaServer] Environment: production` когда должно быть `development`
- `Cannot allocate memory` — переполнение памяти
- `Connection refused` — что-то не слушает
- `EACCES` — проблема с правами доступа

### 3️⃣ Обновление на новую версию

```bash
# 1. Спросить пользователя о текущих переменных из .env.production
# 2. Выполнить:

ssh -i ~/.ssh/deploy_key root@147.45.147.175 << 'EOF'
  source /root/.env.production
  docker pull ghcr.io/komleff/slime-arena-monolith-full:0.8.0
  docker stop slime-arena && docker rm slime-arena
  docker run -d \
    --name slime-arena \
    --restart unless-stopped \
    -p 3000:3000 -p 2567:2567 -p 5173:5173 \
    -v slime-arena-pgdata:/var/lib/postgresql/data \
    -v slime-arena-redisdata:/var/lib/redis \
    -e JWT_SECRET="$JWT_SECRET" \
    -e MATCH_SERVER_TOKEN="$MATCH_SERVER_TOKEN" \
    -e CLAIM_TOKEN_TTL_MINUTES="$CLAIM_TOKEN_TTL_MINUTES" \
    -e YANDEX_CLIENT_ID="$YANDEX_CLIENT_ID" \
    -e YANDEX_CLIENT_SECRET="$YANDEX_CLIENT_SECRET" \
    -e OAUTH_YANDEX_ENABLED=true \
    ghcr.io/komleff/slime-arena-monolith-full:0.8.0
  sleep 5
  docker logs slime-arena --tail 50
EOF
```

### 4️⃣ Откат на предыдущую версию

```bash
ssh -i ~/.ssh/deploy_key root@147.45.147.175 << 'EOF'
  source /root/.env.production
  docker pull ghcr.io/komleff/slime-arena-monolith-full:0.7.8
  docker stop slime-arena && docker rm slime-arena
  docker run -d \
    --name slime-arena \
    --restart unless-stopped \
    -p 3000:3000 -p 2567:2567 -p 5173:5173 \
    -v slime-arena-pgdata:/var/lib/postgresql/data \
    -v slime-arena-redisdata:/var/lib/redis \
    -e JWT_SECRET="$JWT_SECRET" \
    -e MATCH_SERVER_TOKEN="$MATCH_SERVER_TOKEN" \
    -e CLAIM_TOKEN_TTL_MINUTES="$CLAIM_TOKEN_TTL_MINUTES" \
    -e YANDEX_CLIENT_ID="$YANDEX_CLIENT_ID" \
    -e YANDEX_CLIENT_SECRET="$YANDEX_CLIENT_SECRET" \
    -e OAUTH_YANDEX_ENABLED=true \
    ghcr.io/komleff/slime-arena-monolith-full:0.7.8
EOF
```

### 5️⃣ Полная проверка здоровья

```bash
echo "=== Container Status ===" && \
ssh -i ~/.ssh/deploy_key root@147.45.147.175 'docker ps --format "{{.Status}}"' && \
echo "=== Health Endpoint ===" && \
curl -s https://slime-arena.overmobile.space/health | jq . && \
echo "=== Guest Auth ===" && \
curl -s -X POST https://slime-arena.overmobile.space/api/v1/auth/guest \
  -H "Content-Type: application/json" -d '{}' | jq .status
```

---

## ⚠️ ЗАПРЕТЫ

### ❌ НИКОГДА:

1. **Выводить реальные значения ключей** даже в приватных логах
   ```bash
   # ❌ ПЛОХО:
   docker inspect slime-arena --format='{{json .Config.Env}}'
   # Покажет все переменные с реальными значениями!
   
   # ✅ ХОРОШО:
   docker ps --filter name=slime-arena
   ```

2. **Удалять volumes** с данными
   ```bash
   # ❌ НИКОГДА:
   docker volume rm slime-arena-pgdata slime-arena-redisdata
   ```

3. **Менять restart policy** без согласования
   ```bash
   # ❌ ПЛОХО:
   docker update --restart=no slime-arena
   ```

4. **Запускать контейнер без проверки переменных**
   - Всегда проверить наличие всех нужных env vars перед запуском

5. **Писать логин/пароль** в терминальные команды
   - Использовать только SSH ключи

6. **Делать ssh без проверки хоста**
   - Всегда использовать `StrictHostKeyChecking` или сохранять known_hosts

---

## 📞 Когда просить помощь пользователя

| Сценарий | Действие |
|----------|----------|
| Контейнер не стартует | Показать логи, попросить проверить переменные в `.env.production` |
| Нужно обновить версию | Запросить текущие значения всех ENV переменных |
| Контейнер "упал" | Попросить проверить размер диска (`df -h`) и RAM (`free -h`) |
| Нужно менять Nginx конфиг | Попросить проверить и отредактировать вручную |
| SSL сертификат истёк | Попросить обновить через acme.sh (требует знаний) |
| Проблемы с БД/Redis | Может потребоваться ручной вход в контейнер и проверка |

---

## 🔍 Диагностика проблем

### Проблема: "Нет доступа по SSH"
```bash
# Проверить ключ
ls -la ~/.ssh/deploy_key
chmod 600 ~/.ssh/deploy_key

# Проверить подключение
ssh -vvv -i ~/.ssh/deploy_key root@147.45.147.175 'echo OK'
```

### Проблема: "Контейнер не поднимается"
```bash
# 1. Проверить образ
docker images | grep slime-arena

# 2. Попробовать запустить без -d для видения ошибок
docker run --rm \
  -e JWT_SECRET="$JWT_SECRET" \
  -e MATCH_SERVER_TOKEN="$MATCH_SERVER_TOKEN" \
  ... \
  ghcr.io/komleff/slime-arena-monolith-full:0.8.0

# 3. Проверить логи
docker logs slime-arena
```

### Проблема: "Память/диск переполнен"
```bash
# На сервере
df -h          # Размер диска
free -h        # Память
du -sh /var/lib/docker/volumes/*/  # Размер volumes
```

---

## 📚 Ссылки

- [SERVER_SETUP.md](SERVER_SETUP.md) — Полная инструкция по запуску
- [.env.production.example](../../.env.production.example) — Шаблон переменных
- [Dockerfile](../../docker/monolith-full.Dockerfile) — Как собирается образ
- [Docker Compose](../../docker/docker-compose.monolith-full.yml) — Альтернативный способ запуска

---

## 💡 Best Practices

1. **Всегда проверять статус перед и после изменений**
   ```bash
   # ДО
   docker ps
   
   # ДЕЙСТВИЕ
   docker restart slime-arena
   
   # ПОСЛЕ
   docker ps && curl https://slime-arena.overmobile.space/health
   ```

2. **Сохранять backup перед обновлением**
   ```bash
   ssh -i ~/.ssh/deploy_key root@147.45.147.175 \
     'docker exec slime-arena pg_dump -U slime slime_arena > /root/backup-$(date +%s).sql'
   ```

3. **Тестировать на локальной машине перед production**
   - Используйте локальный docker для тестирования новых контейнеров

4. **Документировать изменения**
   - Создавайте issues в GitHub при изменении конфигурации

---

**Последнее обновление:** 2026-02-04  
**Версия сервера:** 0.7.8+ (актуально для 0.8.0+)  
**Контактная информация:** GitHub Issues с тегом `ops`
