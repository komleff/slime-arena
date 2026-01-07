# =============================================================================
# Slime Arena Monolith Container
# Multi-stage production build for MetaServer + MatchServer + Client
# Version: 0.3.3
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder
# Install dependencies and build all packages
# -----------------------------------------------------------------------------
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files first for layer caching
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/

# Install ALL dependencies (dev deps needed for build)
RUN npm ci

# Copy source code
COPY shared/ shared/
COPY server/ server/
COPY client/ client/
COPY config/ config/

# Build all packages in correct order
# 1. shared (dependency for both server and client)
# 2. server (TypeScript compilation)
# 3. client (Vite production build)
RUN npm run build --workspace=shared && \
    npm run build --workspace=server && \
    npm run build --workspace=client

# -----------------------------------------------------------------------------
# Stage 2: Runtime
# Minimal production image
# -----------------------------------------------------------------------------
FROM node:18-alpine AS runtime

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install production dependencies only
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/
RUN npm ci --omit=dev

# Copy built artifacts from builder stage
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Copy configuration files to root (for meta server)
COPY --from=builder /app/config ./config

# Copy config to server/dist/config (loadBalanceConfig.ts expects it relative to dist)
# Path: server/dist/server/src/config/../../../config = server/dist/config
COPY --from=builder /app/config ./server/dist/config

# Copy shared package.json for workspace resolution
COPY --from=builder /app/shared/package.json ./shared/

# Install serve for static file hosting (client)
RUN npm install -g serve concurrently

# Expose ports:
# 3000 - MetaServer (HTTP API)
# 2567 - MatchServer (WebSocket/Colyseus)
# 5174 - Client (static files)
EXPOSE 3000 2567 5174

# Health check for MetaServer
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:3000/health || exit 1

# Run all services concurrently
# META: MetaServer (HTTP API for auth, profiles, matchmaking)
# MATCH: MatchServer (Colyseus game server)
# CLIENT: Static file server for web client
CMD ["concurrently", \
    "--kill-others-on-fail", \
    "--names", "META,MATCH,CLIENT", \
    "--prefix-colors", "blue.bold,magenta.bold,green.bold", \
    "node server/dist/server/src/meta/server.js", \
    "node server/dist/server/src/index.js", \
    "serve -s client/dist -l 5174 --no-clipboard"]
