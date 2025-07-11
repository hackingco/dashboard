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
