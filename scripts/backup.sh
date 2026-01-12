#!/bin/bash
# PostgreSQL Backup Script for Slime Arena
# Run: ./scripts/backup.sh

set -e

OUTPUT_DIR="${1:-backups}"

echo "=== Slime Arena PostgreSQL Backup ==="
echo ""

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

# Create output directory if not exists
mkdir -p "$OUTPUT_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$OUTPUT_DIR/slime_arena_$TIMESTAMP.dump"

echo "Host:     $PGHOST:$PGPORT"
echo "Database: $PGDATABASE"
echo "User:     $PGUSER"
echo "Output:   $BACKUP_FILE"
echo ""

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo "Error: pg_dump not found. Install PostgreSQL client tools."
    echo "  macOS: brew install postgresql"
    echo "  Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

PG_VERSION=$(pg_dump --version)
echo "Using: $PG_VERSION"
echo ""
echo "Starting backup..."

# Run pg_dump with custom format (compressed, supports parallel restore)
START_TIME=$(date +%s)

pg_dump \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    --format=custom \
    --verbose \
    --file="$BACKUP_FILE" 2>&1 | sed 's/^/  /'

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Get file info
FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
FILE_SIZE_BYTES=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE")

# Calculate checksum
if command -v sha256sum &> /dev/null; then
    CHECKSUM=$(sha256sum "$BACKUP_FILE" | cut -c1-16)
elif command -v shasum &> /dev/null; then
    CHECKSUM=$(shasum -a 256 "$BACKUP_FILE" | cut -c1-16)
else
    CHECKSUM="(unavailable)"
fi

echo ""
echo "=== Backup Complete ==="
echo "File:     $BACKUP_FILE"
echo "Size:     $FILE_SIZE ($FILE_SIZE_BYTES bytes)"
echo "Duration: ${DURATION} seconds"
echo "Checksum: ${CHECKSUM}... (SHA256)"
echo ""
echo "To restore: ./scripts/restore.sh \"$BACKUP_FILE\""
