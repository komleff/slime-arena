FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=development

# Copy all package files for dependency installation
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json

# Install all dependencies (root, client, server, shared)
RUN npm ci

# Copy source code
COPY client ./client
COPY server ./server
COPY shared ./shared
COPY config ./config

# Build shared library
RUN npm run build --workspace=shared

# Expose all ports: 3000 (Meta), 2567 (Match), 5174 (Client)
EXPOSE 3000 2567 5174

# Run Meta, Match, and Client concurrently
# We assume MATCH_SERVER_TOKEN and META_SERVER_URL are set via env vars 
# which default to localhost logic for the internal communication
CMD ["npx", "concurrently", "--kill-others-on-fail", "--names", "META,MATCH,CLNT", "-c", "bgBlue.bold,bgMagenta.bold,bgGreen.bold", "npm run dev:meta --workspace=server", "npm run dev --workspace=server", "npm run dev --workspace=client"]
