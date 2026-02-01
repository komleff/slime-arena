#!/bin/sh
# =============================================================================
# Slime Arena DB - Entrypoint Script
# Initializes PostgreSQL and Redis, then starts supervisord
# =============================================================================
set -e

PGDATA="/var/lib/postgresql/data"
DB_USER="${POSTGRES_USER:-slime}"
DB_PASSWORD="${POSTGRES_PASSWORD:-slime_dev_password}"
DB_NAME="${POSTGRES_DB:-slime_arena}"

echo "=== Slime Arena DB Starting ==="

# =============================================================================
# Step 1: Initialize PostgreSQL data directory if not exists
# =============================================================================
if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "[PostgreSQL] Initializing data directory..."

    # Ensure directories exist with correct permissions
    mkdir -p "$PGDATA" /run/postgresql
    chown -R postgres:postgres "$PGDATA" /run/postgresql
    chmod 700 "$PGDATA"

    # Initialize database cluster
    su-exec postgres initdb -D "$PGDATA" --encoding=UTF8 --locale=C

    # Configure PostgreSQL for network connections
    echo "host all all 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"
    echo "host all all ::0/0 md5" >> "$PGDATA/pg_hba.conf"

    # Listen on all interfaces
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PGDATA/postgresql.conf"

    echo "[PostgreSQL] Data directory initialized"
else
    echo "[PostgreSQL] Data directory exists, skipping initialization"
    # Ensure correct permissions on existing data
    chown -R postgres:postgres "$PGDATA" /run/postgresql
fi

# =============================================================================
# Step 2: Start PostgreSQL temporarily for setup
# =============================================================================
echo "[PostgreSQL] Starting temporarily for setup..."
su-exec postgres pg_ctl -D "$PGDATA" -w start -o "-c listen_addresses=localhost"

# =============================================================================
# Step 3: Create user and database if not exists
# =============================================================================
echo "[PostgreSQL] Checking user and database..."

# Create user if not exists
if ! su-exec postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
    echo "[PostgreSQL] Creating user '$DB_USER'..."
    su-exec postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD'"
else
    echo "[PostgreSQL] User '$DB_USER' already exists"
fi

# Create database if not exists
if ! su-exec postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
    echo "[PostgreSQL] Creating database '$DB_NAME'..."
    su-exec postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER"

    # Load seed data if available (only on fresh database)
    if [ -f /docker-entrypoint-initdb.d/seed-data.sql ]; then
        echo "[Seed] Loading seed data..."
        su-exec postgres psql -d "$DB_NAME" -f /docker-entrypoint-initdb.d/seed-data.sql
        echo "[Seed] Done."
    fi
else
    echo "[PostgreSQL] Database '$DB_NAME' already exists"
fi

# =============================================================================
# Step 4: Stop PostgreSQL (supervisord will restart it)
# =============================================================================
echo "[PostgreSQL] Stopping temporary instance..."
su-exec postgres pg_ctl -D "$PGDATA" -w stop

# =============================================================================
# Step 5: Ensure Redis data directory
# =============================================================================
echo "[Redis] Setting up data directory..."
mkdir -p /var/lib/redis
chown redis:redis /var/lib/redis

# =============================================================================
# Step 6: Start supervisord (manages all services)
# =============================================================================
echo "=== Starting PostgreSQL and Redis via supervisord ==="
exec /usr/bin/supervisord -c /etc/supervisord.conf
