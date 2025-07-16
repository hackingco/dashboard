FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat git
WORKDIR /app

# Copy workspace root package.json and lockfile
COPY ../../package.json ../../pnpm-lock.yaml ../../pnpm-workspace.yaml ./
# Copy all workspace package.json files
COPY package.json ./apps/dashboard/
COPY ../../shared ./shared/
COPY ../../apps/manager/package.json ./apps/manager/

RUN corepack enable pnpm && pnpm install --frozen-lockfile --ignore-scripts || pnpm install --no-frozen-lockfile --ignore-scripts

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/shared ./shared
COPY . ./apps/dashboard/

# Set working directory to dashboard
WORKDIR /app/apps/dashboard
RUN corepack enable pnpm && pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application from builder stage
COPY --from=builder /app/apps/dashboard/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/dashboard/package.json ./package.json

# Copy shared workspace dependencies
COPY --from=builder /app/shared ./shared

# Create API health check endpoint
RUN echo '{"status":"ok","service":"dashboard","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}' > ./public/api/health.json

USER nextjs

EXPOSE 3000
ENV PORT 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]
