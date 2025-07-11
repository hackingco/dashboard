#!/bin/bash
set -e

echo "🔧 Building and deploying dashboard with Fly Machines API proxy..."

cd apps/dashboard

# Build the Next.js app locally first
echo "📦 Building Next.js app..."
pnpm build

# Create a simple Dockerfile for Next.js standalone build
cat > Dockerfile << 'EOF'
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

# Create user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone server
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public

USER nextjs

EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
EOF

# Deploy to Fly.io
echo "🚀 Deploying to Fly.io..."

# Reset fly.toml to use regular Dockerfile
cat > fly.toml << 'EOF'
app = "swarm-admin"
primary_region = "sjc"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

[[services]]
  protocol = "tcp"
  internal_port = 3000

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
EOF

FLY_ACCESS_TOKEN=$(fly auth token) fly deploy --app swarm-admin --remote-only

echo "✅ Dashboard deployment complete!"
echo "🌐 Your Fly Machines UI is available at: https://swarm-admin.fly.dev/machines"
echo ""
echo "⚠️  Note: You'll need to enter your Fly API token to use the Machines UI"
echo "   Get your token with: fly auth token"