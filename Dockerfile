# ─── Stage 1: Production Base ───
FROM node:20-bookworm-slim AS base

WORKDIR /app

# Install curl for container healthchecks & dumb-init for PID 1 process management
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package*.json ./

# Install production dependencies only (clean ci)
RUN npm ci --omit=dev && npm cache clean --force

# Copy source code and utility scripts
COPY src/ ./src/
COPY scripts/ ./scripts/

# Create runtime directories for uploads & logs with proper permissions
RUN mkdir -p /app/uploads /app/logs \
    && chown -R node:node /app

# Switch to unprivileged user for security
USER node

# Expose default API port
EXPOSE 5000

# Container healthcheck using backend readiness endpoint
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Launch with dumb-init for graceful SIGTERM/SIGINT signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/server.js"]

