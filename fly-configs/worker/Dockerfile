# Multi-stage Dockerfile for Worker Template
# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Install dependencies
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build TypeScript (if applicable)
RUN if [ -f "tsconfig.json" ]; then npm run build; fi

# Stage 3: Production dependencies
FROM node:20-alpine AS prod-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Install only production dependencies
RUN corepack enable pnpm && pnpm install --prod --frozen-lockfile

# Stage 4: Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Add security and monitoring tools
RUN apk add --no-cache dumb-init curl

# Add non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 worker

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy production dependencies
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy application files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# For non-TypeScript workers, copy source directly
RUN if [ ! -d "dist" ]; then \
    mkdir -p src && \
    cp -r *.js src/ 2>/dev/null || true; \
    fi

# Create necessary directories
RUN mkdir -p /data /app/logs /app/tmp && \
    chown -R worker:nodejs /data /app/logs /app/tmp

# Change ownership
RUN chown -R worker:nodejs /app

USER worker

EXPOSE 3000
EXPOSE 9092

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Dynamic command based on whether TypeScript was built
CMD ["sh", "-c", "if [ -d 'dist' ]; then node dist/index.js; else node src/index.js || node index.js; fi"]