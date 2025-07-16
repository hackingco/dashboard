FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    git

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create data directory
RUN mkdir -p data logs .swarm

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S claudeflow -u 1001

# Change ownership
RUN chown -R claudeflow:nodejs /app

USER claudeflow

# Expose ports
EXPOSE 8080 8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["node", "src/server.js"]