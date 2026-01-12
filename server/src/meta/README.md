# MetaServer - Quick Start

MetaServer provides HTTP API for Slime Arena meta-game features: authentication, profiles, configuration, economy.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)

## Quick Start with Docker

### 1. Start all services (PostgreSQL, Redis, MetaServer)

```bash
cd docker
docker-compose up -d postgres redis
```

### 2. Run database migrations

```bash
# From server directory
cd ../server
npm install
npm run db:migrate
```

### 3. Start MetaServer

```bash
npm run dev:meta
```

MetaServer will be available at `http://localhost:3000`

### 4. Run smoke tests

```bash
# PowerShell (Windows)
cd ../tests/smoke
.\run-smoke-tests.ps1

# Bash (Linux/Mac)
./run-smoke-tests.sh
```

## Environment Variables

Create `.env` file in `server/` directory:

```env
# Database
DATABASE_URL=postgresql://slime:slime_dev_password@localhost:5432/slime_arena

# Redis
REDIS_URL=redis://localhost:6379

# MetaServer
META_PORT=3000
NODE_ENV=development
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/verify` - Verify platform auth and get session token
- `POST /api/v1/auth/logout` - Revoke session

### Configuration
- `GET /api/v1/config/runtime` - Get active runtime configuration

### Profile
- `GET /api/v1/profile` - Get player profile (requires auth)
- `POST /api/v1/profile/nickname` - Update nickname (requires auth)

### Health
- `GET /health` - Service health check

## Database Schema

Initial migration creates tables:
- `users` - User accounts (platform-agnostic)
- `sessions` - Authentication sessions
- `profiles` - Player profiles (level, XP, cosmetics)
- `wallets` - Currency balances
- `unlocked_items` - Player inventory
- `transactions` - Economy operations (for idempotency)
- `player_ratings` - Glicko-2 ratings
- `match_results` - Match history
- `battlepass_progress`, `mission_progress`, `achievements` - Progression
- `configs` - RuntimeConfig versions
- `audit_log` - Administrative actions

See `server/src/db/migrations/001_initial_schema.sql` for full schema.

## Development

### Run migrations manually

```bash
cd server
npm run db:migrate
```

### Reset database (⚠️ destroys all data)

```bash
docker-compose down -v
docker-compose up -d postgres redis
npm run db:migrate
```

### View logs

```bash
# All services
docker-compose logs -f

# PostgreSQL only
docker-compose logs -f postgres

# MetaServer (if running in docker)
docker-compose logs -f server
```

## Architecture

MetaServer follows the architecture defined in `docs/soft-launch/SlimeArena-Architecture-v4.2.5-Part2.md`:

- **Routes** (`src/meta/routes/`) - HTTP endpoint handlers
- **Services** (`src/meta/services/`) - Business logic (Auth, Config, Player, etc.)
- **Middleware** (`src/meta/middleware/`) - Auth verification, error handling
- **Database** (`src/db/`) - Connection pool and migrations

## Next Steps (Stage B)

After Stage A is complete and smoke tests pass:

1. Implement MatchmakingService
2. Add platform-specific auth adapters (Telegram, Yandex)
3. Implement WalletService and transaction handling
4. Add ShopService for purchases
5. Implement AdsService for rewarded ads

See `docs/soft-launch/SlimeArena-SoftLaunch-Plan-v1.0.5.md` for full roadmap.
