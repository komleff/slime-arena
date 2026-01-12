# Load Tests for Slime Arena

k6 load tests for Soft Launch performance validation.

## Target Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| CCU | 500 | Concurrent users |
| p99 Latency | < 2000ms | 99th percentile response time |
| Error Rate | < 1% | HTTP 5xx errors |

## Prerequisites

1. Install k6: https://k6.io/docs/getting-started/installation/

```bash
# Windows (chocolatey)
choco install k6

# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

2. MetaServer running on localhost:3000
3. PostgreSQL and Redis available
4. Set environment variables:
   - `MATCH_SERVER_TOKEN` - Server-to-server auth token

## Running Tests

### Basic Run

```bash
k6 run tests/load/soft-launch.js
```

### With Custom URL

```bash
k6 run -e BASE_URL=http://your-server:3000 tests/load/soft-launch.js
```

### With Server Token

```bash
k6 run -e SERVER_TOKEN=your-token tests/load/soft-launch.js
```

### Quick Smoke Test (lower load)

```bash
k6 run --vus 10 --duration 30s tests/load/soft-launch.js
```

## Test Stages

The test follows these stages:

1. **Ramp up** (1 min): 0 → 100 users
2. **Ramp up** (2 min): 100 → 300 users
3. **Ramp up** (2 min): 300 → 500 users
4. **Steady state** (5 min): 500 users (target CCU)
5. **Ramp down** (1 min): 500 → 0 users

Total duration: ~11 minutes

## Test Scenarios

Each virtual user performs:

1. Health check
2. Authentication (dev platform)
3. Get runtime config
4. Get profile
5. Matchmaking flow (join → status → cancel)
6. Submit match results (every 5th iteration)
7. Check wallet balance

## Output

Results are saved to `tests/load/results.json` after each run.

## Interpreting Results

### Success Criteria

```
✓ http_req_duration p(99) < 2000ms
✓ errors rate < 1%
```

### Key Metrics to Watch

- `http_req_duration`: Overall latency distribution
- `auth_latency`: Authentication endpoint performance
- `match_results_latency`: Match submission performance
- `successful_auths`: Total successful authentications
- `successful_match_results`: Total match submissions

## Troubleshooting

### High Error Rate

1. Check MetaServer logs for errors
2. Verify database connection pool size
3. Check Redis connection limits
4. Review rate limiting configuration

### High Latency

1. Profile database queries
2. Check for N+1 query patterns
3. Review connection pooling
4. Consider adding caching
