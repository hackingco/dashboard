#!/usr/bin/env node

/**
 * Stop Background Monitors
 * Prevents the health check errors from appearing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🛑 Stopping background monitors...\n');

// Create a config file to disable background monitoring
const config = {
  enableHealthMonitoring: false,
  keyRotationInterval: 0,
  skipUIExtraction: true,
  offlineMode: true
};

fs.writeFileSync(
  path.join(__dirname, '.langfuse-config.json'),
  JSON.stringify(config, null, 2)
);

console.log('✅ Created offline config file');
console.log('   Background health checks disabled');
console.log('   UI extraction disabled');
console.log('   System will use stored keys only\n');

// Also update the env file
const envContent = `LANGFUSE_HOST=http://localhost:3000
LANGFUSE_PUBLIC_KEY=pk-lf-REDACTED
LANGFUSE_SECRET_KEY=sk-lf-5f3b4323-450a-49bb-9dfc-f55da800d343
LANGFUSE_OFFLINE_MODE=true`;

fs.writeFileSync(path.join(__dirname, '.env'), envContent);
console.log('✅ Updated .env with offline mode\n');