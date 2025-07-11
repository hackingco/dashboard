#!/bin/bash
set -e

echo "🔧 Fixing dashboard deployment..."

cd apps/dashboard

# Build locally first
echo "📦 Building dashboard locally..."
pnpm build

# Create a deployment directory with everything needed
echo "📁 Creating deployment package..."
rm -rf .deploy
mkdir -p .deploy

# Copy the standalone build (follow symlinks)
cp -rL .next/standalone/* .deploy/ || true
mkdir -p .deploy/.next
cp -r .next/static .deploy/.next/static
cp -r public .deploy/public

# Install production dependencies in the deploy directory
cd .deploy
npm init -y
npm install next@14.0.0 react@18.2.0 react-dom@18.2.0 --save
cd ..

# Create a simple Dockerfile that just runs the pre-built app
cat > .deploy/Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy pre-built application
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Fix permissions
RUN chown -R nodejs:nodejs .

USER nodejs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
EOF

# Deploy from the .deploy directory
echo "🚀 Deploying to Fly.io..."
cd .deploy
FLY_ACCESS_TOKEN=$(fly auth token) fly deploy --app swarm-admin --remote-only

echo "✅ Dashboard deployment complete!"