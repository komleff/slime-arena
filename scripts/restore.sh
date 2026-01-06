#!/bin/bash
# PostgreSQL Restore Script for Slime Arena
# Run: ./scripts/restore.sh backups/slime_arena_YYYYMMDD_HHMMSS.dump

set -e

BACKUP_FILE="$1"
FORCE="${2:-}"

echo "=== Slime Arena PostgreSQL Restore ==="
echo ""

# Validate backup file
if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./scripts/restore.sh <backup_file> [--force]"
    echo "Example: ./scripts/restore.sh backups/slime_arena_20260107_120000.dump"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Load environment variables from .env if exists
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Database connection parameters (with defaults)
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-slime}"
PGDATABASE="${PGDATABASE:-slime_arena}"

if [ -z "$PGPASSWORD" ]; then
    echo "Warning: PGPASSWORD not set. You may be prompted for password."
fi

# Get backup file info
FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo "Host:     $PGHOST:$PGPORT"
echo "Database: $PGDATABASE"
echo "User:     $PGUSER"
echo "Backup:   $BACKUP_FILE ($FILE_SIZE)"
echo ""

# Check if pg_restore is available
if ! command -v pg_restore &> /dev/null; then
    echo "Error: pg_restore not found. Install PostgreSQL client tools."
    exit 1
fi

PG_VERSION=$(pg_restore --version)
echo "Using: $PG_VERSION"

# Warning and confirmation
echo ""
echo "WARNING: This will DROP and RECREATE all objects in the database!"
echo "         All existing data will be replaced with backup data."
echo ""

if [ "$FORCE" != "--force" ]; then
    read -p "Type 'RESTORE' to confirm: " CONFIRMATION
    if [ "$CONFIRMATION" != "RESTORE" ]; then
        echo "Restore cancelled."
        exit 0
    fi
fi

echo ""
echo "Starting restore..."

START_TIME=$(date +%s)

# Restore with --clean to drop existing objects, --if-exists to avoid errors
# Note: pg_restore may return non-zero for warnings (DROP IF EXISTS on non-existent objects)
set +e
pg_restore \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    --clean \
    --if-exists \
    --verbose \
    "$BACKUP_FILE" 2>&1 | sed 's/^/  /'

EXIT_CODE=$?
set -e

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "Warning: pg_restore completed with warnings (exit code $EXIT_CODE)"
    echo "This is often normal due to DROP IF EXISTS on non-existent objects."
fi

echo ""
echo "=== Restore Complete ==="
echo "Duration: ${DURATION} seconds"
echo ""
echo "Recommended: Run Stage D tests to verify data integrity"
echo "  npx tsx server/tests/meta-stage-d.test.ts"
