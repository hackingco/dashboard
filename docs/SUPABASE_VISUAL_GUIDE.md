# 🎨 Supabase Setup Visual Guide

## 📚 Table of Contents
1. [Create Project](#1-create-project)
2. [Get API Keys](#2-get-api-keys)
3. [Run Migration](#3-run-migration)
4. [Enable Realtime](#4-enable-realtime)
5. [Test Connection](#5-test-connection)

---

## 1. Create Project

### Step 1.1: Go to Supabase
```
https://app.supabase.com
```

### Step 1.2: Click "New project"
```
┌─────────────────────────────────────┐
│  Supabase                           │
│  ┌─────────────────────┐           │
│  │  + New project      │           │
│  └─────────────────────┘           │
└─────────────────────────────────────┘
```

### Step 1.3: Fill in details
```
┌─────────────────────────────────────┐
│  Create a new project               │
│                                     │
│  Name: [swarm-orchestrator]         │
│  Database Password: [••••••••]      │
│  Region: [US East (Virginia)]       │
│                                     │
│  [Create new project]               │
└─────────────────────────────────────┘
```

---

## 2. Get API Keys

### Step 2.1: Navigate to Settings → API
```
┌─────────────────────────────────────┐
│  Dashboard  Settings  SQL Editor    │
│  ┌─────────┬──────────────────┐    │
│  │Settings │ Project Settings   │    │
│  │  > API  │                   │    │
│  │    Auth │ Configuration     │    │
│  │    ...  │ API Settings      │    │
│  └─────────┴──────────────────┘    │
└─────────────────────────────────────┘
```

### Step 2.2: Copy your keys
```
┌─────────────────────────────────────┐
│  API Settings                       │
│                                     │
│  Project URL                        │
│  ┌─────────────────────────────┐   │
│  │https://xxxxx.supabase.co    │📋 │
│  └─────────────────────────────┘   │
│                                     │
│  anon public                        │
│  ┌─────────────────────────────┐   │
│  │eyJhbGc...                   │📋 │
│  └─────────────────────────────┘   │
│                                     │
│  service_role secret                │
│  ┌─────────────────────────────┐   │
│  │eyJhbGc...                   │📋 │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## 3. Run Migration

### Step 3.1: Open SQL Editor
```
┌─────────────────────────────────────┐
│  Dashboard  Settings  SQL Editor    │
│                       ^^^^^^^^^^^^  │
└─────────────────────────────────────┘
```

### Step 3.2: Create new query
```
┌─────────────────────────────────────┐
│  SQL Editor                         │
│  ┌──────────────┐                   │
│  │ + New query  │                   │
│  └──────────────┘                   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ -- Paste migration SQL here │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  [RUN]                              │
└─────────────────────────────────────┘
```

### Step 3.3: Verify tables created
```
┌─────────────────────────────────────┐
│  Table Editor                       │
│  ┌─────────────┐                    │
│  │ Tables      │                    │
│  │ ✓ swarms    │                    │
│  │ ✓ workers   │                    │
│  │ ✓ tasks     │                    │
│  │ ✓ logs      │                    │
│  │ ✓ metrics   │                    │
│  │ ✓ templates │                    │
│  └─────────────┘                    │
└─────────────────────────────────────┘
```

---

## 4. Enable Realtime

### Step 4.1: Go to Database → Replication
```
┌─────────────────────────────────────┐
│  Database                           │
│  ┌─────────────┐                    │
│  │ Tables      │                    │
│  │ Replication │ ← Click here       │
│  │ Backups     │                    │
│  └─────────────┘                    │
└─────────────────────────────────────┘
```

### Step 4.2: Enable for tables
```
┌─────────────────────────────────────┐
│  Replication                        │
│                                     │
│  Source: 0 tables                   │
│  ┌─────────────────────────────┐   │
│  │ Select tables:              │   │
│  │ ☑ swarms                    │   │
│  │ ☑ workers                   │   │
│  │ ☑ tasks                     │   │
│  │ ☑ logs                      │   │
│  │ ☑ metrics                   │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Enable replication]               │
└─────────────────────────────────────┘
```

---

## 5. Test Connection

### Step 5.1: Update .env files

**apps/dashboard/.env.local**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
MANAGER_URL=http://localhost:8080
```

**apps/manager/.env**
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
FLY_API_TOKEN=your-fly-token
PORT=8080
```

### Step 5.2: Run test script
```bash
# Test the connection
node scripts/test-supabase-connection.js
```

### Step 5.3: Expected output
```
🔍 Testing Supabase connection...
URL: https://xxxxx.supabase.co
Key: eyJhbGciOiJIUzI1NiI...

📡 Test 1: Basic connection...
✅ Connected successfully!
Found 0 swarms

📝 Test 2: Creating test swarm...
✅ Test swarm created: 123e4567-e89b-12d3-a456-426614174000

📡 Test 3: Testing real-time updates...
✅ Real-time subscription active
✅ Update sent, waiting for real-time event...
🔔 Real-time event received: UPDATE

🧹 Cleaning up test data...
✅ Test swarm deleted
✅ Unsubscribed from real-time updates

🎉 All tests completed successfully!
```

---

## 🎯 Quick Commands

```bash
# Run interactive wizard
node scripts/supabase-wizard.js

# Quick setup
./scripts/supabase-quick-setup.sh

# Test connection
node scripts/test-supabase-connection.js

# Start development
pnpm install
pnpm --filter @swarm/supabase build
pnpm dev
```

---

## 🆘 Troubleshooting

### "Missing Supabase credentials"
- Check `.env` files exist
- Verify keys are copied correctly
- No extra spaces in keys

### "relation 'swarms' does not exist"
- Run migration in SQL Editor
- Check for SQL errors
- Verify all tables created

### "Realtime not working"
- Enable replication for tables
- Check WebSocket connection
- Use anon key in client

### "Permission denied"
- Check RLS policies
- Use service_role key in server
- Verify table permissions

---

## 🎉 Success Checklist

- [ ] Supabase project created
- [ ] API keys copied to .env files
- [ ] Database migration executed
- [ ] Tables visible in Table Editor
- [ ] Realtime enabled for 5 tables
- [ ] Connection test passes
- [ ] Services start without errors
- [ ] Can create swarm from dashboard

---

Need help? Join our Discord or check the [docs](https://supabase.com/docs)!