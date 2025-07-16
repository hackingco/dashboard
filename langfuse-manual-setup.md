# Langfuse Manual Setup for Swarm Tracing

## 🚨 CRITICAL: Real Setup Instructions

The issue is that we need to create actual API keys in the Langfuse UI. Here's how to do it properly:

### Step 1: Access Langfuse UI
1. Open http://localhost:3000 in your browser
2. You should see the Langfuse interface

### Step 2: Create Account & Project
1. If prompted, create a new account or sign in
2. Create a new project called "Swarm Collective Intelligence"
3. Navigate to Project Settings → API Keys

### Step 3: Generate Real API Keys
1. Click "Create New API Key"
2. Copy the Public Key (starts with `pk-lf-`)
3. Copy the Secret Key (starts with `sk-lf-`)

### Step 4: Update Environment
Update `.env.langfuse` with your real keys:
```bash
LANGFUSE_PUBLIC_KEY=pk-lf-YOUR_REAL_PUBLIC_KEY
LANGFUSE_SECRET_KEY=sk-lf-YOUR_REAL_SECRET_KEY
```

### Step 5: Test with Real Traces
Run the real swarm demo:
```bash
node real-swarm-demo.js
```

## Alternative: Use Docker Exec to Access Database

If the UI setup is problematic, we can directly access the database:

```bash
# Access the database container
docker exec -it cf-langfuse-db psql -U postgres -d langfuse

# Check existing API keys
\c langfuse
SELECT * FROM api_keys;

# Create a new API key manually if needed
INSERT INTO api_keys (id, public_key, secret_key, display_name, created_at, updated_at) 
VALUES (gen_random_uuid(), 'pk-lf-manual-key', 'sk-lf-manual-secret', 'Manual Swarm Key', NOW(), NOW());
```

## Real Swarm Demo Script

The `real-swarm-demo.js` file has been created with the proper structure. Once you have real API keys:

1. Replace the placeholder keys in the script
2. Run `node real-swarm-demo.js`
3. Check http://localhost:3000 for the traces

## Expected Results

Once properly configured, you should see:
- Real swarm traces in the Langfuse UI
- Agent coordination events
- Consensus voting processes
- Memory operations
- Performance metrics

The traces will appear in the Langfuse dashboard with proper session tracking and metadata.