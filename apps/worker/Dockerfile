FROM node:18-alpine

WORKDIR /app

# Copy deployment package without workspace dependencies
COPY package.deploy.json ./package.json

# Install production dependencies
RUN npm install --production --legacy-peer-deps

# Copy built JavaScript files
COPY dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 8000

CMD ["node", "dist/index.js"]