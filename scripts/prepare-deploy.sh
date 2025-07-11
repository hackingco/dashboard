#!/bin/bash

# Prepare apps for deployment by creating standalone versions

set -e

echo "🔧 Preparing apps for deployment..."

# Build all packages
echo "📦 Building packages..."
pnpm run build

# Prepare manager
echo "🚀 Preparing manager..."
cd apps/manager
mkdir -p deploy
cp -r dist deploy/
cp package.standalone.json deploy/package.json
mkdir -p deploy/node_modules/@swarm
cp -r ../../shared/types/dist deploy/node_modules/@swarm/types
cp ../../shared/types/package.json deploy/node_modules/@swarm/types/
cp -r ../../shared/utils/dist deploy/node_modules/@swarm/utils  
cp ../../shared/utils/package.json deploy/node_modules/@swarm/utils/

# Create simple Dockerfile
cat > deploy/Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY . .
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs
EXPOSE 8080
CMD ["node", "dist/index.js"]
EOF

cd ../..

# Prepare dashboard
echo "🎨 Preparing dashboard..."
cd apps/dashboard
# Dashboard uses the existing Next.js standalone build

cd ../..

# Prepare worker
echo "⚙️ Preparing worker..."
cd apps/worker
mkdir -p deploy
cp -r dist deploy/
cp package.json deploy/
# Remove workspace references
sed -i.bak 's/"@swarm\/[^"]*": "workspace:\*"/"@swarm\/types": "*"/g' deploy/package.json
rm deploy/package.json.bak

# Create simple Dockerfile
cat > deploy/Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY . .
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs
EXPOSE 8000
CMD ["node", "dist/index.js"]
EOF

cd ../..

echo "✅ Apps prepared for deployment!"
echo "Deploy with:"
echo "  cd apps/manager/deploy && fly deploy --app swarm-manager"
echo "  cd apps/dashboard && fly deploy --app swarm-admin"
echo "  cd apps/worker/deploy && fly deploy --app swarm-worker"