#!/bin/sh
# =============================================================================
# Slime Arena Monolith Full - Entrypoint Script
# Initializes PostgreSQL, Redis, runs migrations, and starts supervisord
# =============================================================================
set -e

PGDATA="/var/lib/postgresql/data"
DB_USER="slime"
DB_PASSWORD="slime_dev_password"
DB_NAME="slime_arena"

echo "=== Slime Arena Monolith Full Starting ==="

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

    # Configure PostgreSQL for local connections
    echo "host all all 127.0.0.1/32 md5" >> "$PGDATA/pg_hba.conf"
    echo "host all all ::1/128 md5" >> "$PGDATA/pg_hba.conf"

    # Listen only on localhost (internal container use)
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/" "$PGDATA/postgresql.conf"

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
else
    echo "[PostgreSQL] Database '$DB_NAME' already exists"
fi

# =============================================================================
# Step 4: Run database migrations
# =============================================================================
echo "[Migrations] Running database migrations..."
cd /app
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME" npm run db:migrate --workspace=server || {
    echo "[Migrations] Warning: Migration failed or already applied"
}

# =============================================================================
# Step 5: Stop PostgreSQL (supervisord will restart it)
# =============================================================================
echo "[PostgreSQL] Stopping temporary instance..."
su-exec postgres pg_ctl -D "$PGDATA" -w stop

# =============================================================================
# Step 6: Ensure Redis data directory
# =============================================================================
echo "[Redis] Setting up data directory..."
mkdir -p /var/lib/redis
chown redis:redis /var/lib/redis

# =============================================================================
# Step 7: Start supervisord (manages all services)
# =============================================================================
echo "=== Starting all services via supervisord ==="
exec /usr/bin/supervisord -c /etc/supervisord.conf
