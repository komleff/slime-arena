#!/bin/bash
# Удалённый бэкап PostgreSQL для Slime Arena
# Подключается к production серверу по SSH, делает pg_dump, скачивает дамп локально.
#
# Использование:
#   ./scripts/backup-remote.sh [OUTPUT_DIR]
#
# Требования:
#   - SSH-ключ настроен для root@SERVER_IP
#   - Docker запущен на сервере с контейнером slime-arena

set -euo pipefail

# --- Конфигурация ---
SERVER_IP="${SERVER_IP:-147.45.147.175}"
SERVER_USER="root"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
CONTAINER_NAME="${CONTAINER_NAME:-slime-arena}"
DB_USER="${DB_USER:-slime}"
DB_NAME="${DB_NAME:-slime_arena}"
OUTPUT_DIR="${1:-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

echo "=== Slime Arena — Удалённый бэкап ==="
echo ""

# Проверка SSH-ключа
if [ ! -f "$SSH_KEY" ]; then
    echo "Ошибка: SSH-ключ не найден: $SSH_KEY"
    echo "Укажите путь через переменную SSH_KEY:"
    echo "  SSH_KEY=~/.ssh/deploy_key ./scripts/backup-remote.sh"
    exit 1
fi

# Создание локальной директории
mkdir -p "$OUTPUT_DIR"

# Имя файла с датой и временем
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REMOTE_FILE="/tmp/slime_arena_${TIMESTAMP}.sql.gz"
LOCAL_FILE="${OUTPUT_DIR}/slime_arena_${TIMESTAMP}.sql.gz"

echo "Сервер:    ${SERVER_USER}@${SERVER_IP}"
echo "Контейнер: ${CONTAINER_NAME}"
echo "БД:        ${DB_NAME} (пользователь: ${DB_USER})"
echo "Файл:      ${LOCAL_FILE}"
echo ""

# --- Шаг 1: pg_dump на сервере ---
echo "[1/3] Создание дампа на сервере..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "${SERVER_USER}@${SERVER_IP}" \
    "set -o pipefail; docker exec '${CONTAINER_NAME}' pg_dump -U '${DB_USER}' '${DB_NAME}' | gzip > '${REMOTE_FILE}'"

echo "      Дамп создан: ${REMOTE_FILE}"

# --- Шаг 2: Скачивание дампа ---
echo "[2/3] Скачивание дампа..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "${SERVER_USER}@${SERVER_IP}:${REMOTE_FILE}" "${LOCAL_FILE}"

# Проверка размера файла (защита от пустого дампа)
if [ ! -s "${LOCAL_FILE}" ]; then
    echo "ОШИБКА: Скачанный файл пуст. pg_dump мог завершиться с ошибкой."
    exit 1
fi

# Удаление временного файла на сервере
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "${SERVER_USER}@${SERVER_IP}" "rm -f ${REMOTE_FILE}"

# --- Шаг 3: Проверка и статистика ---
echo "[3/3] Проверка..."

FILE_SIZE=$(du -h "${LOCAL_FILE}" | cut -f1)

# Контрольная сумма
if command -v sha256sum &> /dev/null; then
    CHECKSUM=$(sha256sum "${LOCAL_FILE}" | cut -c1-16)
elif command -v shasum &> /dev/null; then
    CHECKSUM=$(shasum -a 256 "${LOCAL_FILE}" | cut -c1-16)
else
    CHECKSUM="(недоступна)"
fi

echo ""
echo "=== Бэкап завершён ==="
echo "Файл:          ${LOCAL_FILE}"
echo "Размер:         ${FILE_SIZE}"
echo "SHA256 (начало): ${CHECKSUM}..."

# --- Ротация старых бэкапов ---
if [ "$RETENTION_DAYS" -gt 0 ]; then
    OLD_COUNT=$(find "$OUTPUT_DIR" -name "slime_arena_*.sql.gz" -mtime +"$RETENTION_DAYS" 2>/dev/null | wc -l)
    if [ "$OLD_COUNT" -gt 0 ]; then
        echo ""
        echo "Удаление бэкапов старше ${RETENTION_DAYS} дней (${OLD_COUNT} файлов)..."
        find "$OUTPUT_DIR" -name "slime_arena_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
    fi
fi

echo ""
echo "Для восстановления: gunzip < ${LOCAL_FILE} | psql -U ${DB_USER} ${DB_NAME}"
