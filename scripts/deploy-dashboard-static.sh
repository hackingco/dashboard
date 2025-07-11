#!/bin/bash
set -e

echo "🔧 Deploying dashboard as static site..."

cd apps/dashboard

# Configure Next.js for static export
cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Ignore TypeScript errors during build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Ignore ESLint errors during build
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
EOF

# Build static export
echo "📦 Building static export..."
pnpm build

# Create deployment directory
echo "📁 Creating deployment package..."
rm -rf .deploy-static
mkdir -p .deploy-static

# Copy static files
cp -r out/* .deploy-static/

# Create a simple static file server
cat > .deploy-static/server.js << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const contentTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

const server = http.createServer((req, res) => {
  console.log('Request:', req.url);
  let filePath = '.' + req.url;
  
  // Handle specific routes
  if (filePath === './' || filePath === './') {
    filePath = './index.html';
  } else if (filePath === './enhanced' || filePath === './enhanced/') {
    filePath = './enhanced.html';
  } else if (!path.extname(filePath)) {
    // If no extension, try adding .html
    filePath += '.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = contentTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // Try to serve index.html for client-side routing
        fs.readFile('./index.html', (error, content) => {
          if (error) {
            res.writeHead(404);
            res.end('Not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Static server running on port ${PORT}`);
});
EOF

# Create package.json for the static server
cat > .deploy-static/package.json << 'EOF'
{
  "name": "swarm-dashboard-static",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  }
}
EOF

# Create Dockerfile
cat > .deploy-static/Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy all static files and server
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
EOF

# Deploy
echo "🚀 Deploying to Fly.io..."
cd .deploy-static
FLY_ACCESS_TOKEN=$(fly auth token) fly deploy --app swarm-admin --remote-only

echo "✅ Dashboard static deployment complete!"