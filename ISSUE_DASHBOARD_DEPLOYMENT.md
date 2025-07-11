# Issue: Dashboard Deployment Fails on Fly.io

## Problem Description
The Next.js dashboard application fails to deploy on Fly.io with "Error: Cannot find module 'next'" when running the standalone build.

## Root Cause
The Next.js standalone build creates symlinks to pnpm's node_modules store, which don't resolve correctly in the Docker container.

## Error Log
```
Error: Cannot find module 'next'
Require stack:
- /app/server.js
    at Module._resolveFilename (node:internal/modules/cjs/loader:1140:15)
    at Module._load (node:internal/modules/cjs/loader:981:27)
```

## Solution
Create a self-contained Docker build that doesn't rely on workspace dependencies or symlinks.