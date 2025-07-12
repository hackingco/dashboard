# 🚀 Supabase Quick Start Guide

## 1. Run Setup Script

```bash
./scripts/setup-supabase.sh
```

This creates your `.env` files from examples.

## 2. Create Supabase Project

1. Visit [app.supabase.com](https://app.supabase.com)
2. Create new project named `swarm-orchestrator`
3. Save your database password!

## 3. Get API Keys

In Supabase Dashboard → Settings → API:
- Copy **Project URL**
- Copy **anon public** key  
- Copy **service_role** key (secret!)

## 4. Update Environment Files

### apps/dashboard/.env.local
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

### apps/manager/.env
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-key
FLY_API_TOKEN=your-fly-token
```

## 5. Run Database Migration

1. Open Supabase Dashboard → SQL Editor
2. Click "New query"
3. Copy contents of `supabase/migrations/001_initial_schema.sql`
4. Click "RUN" button

## 6. Enable Realtime

Dashboard → Database → Replication → Enable for:
- ✅ swarms
- ✅ workers  
- ✅ tasks
- ✅ logs
- ✅ metrics

## 7. Install & Build

```bash
# Install dependencies
pnpm install

# Build Supabase SDK
pnpm --filter @swarm/supabase build
```

## 8. Test Connection

```bash
# Run test script
node scripts/test-supabase-connection.js
```

You should see:
- ✅ Connected successfully!
- ✅ Test swarm created
- ✅ Real-time subscription active

## 9. Start Services

```bash
# Terminal 1
cd apps/manager && pnpm dev

# Terminal 2  
cd apps/dashboard && pnpm dev
```

## 10. Launch a Swarm! 🐝

1. Open http://localhost:3000
2. Click "Launch Swarm"
3. Fill in the form
4. Check Supabase Dashboard → Table Editor → swarms

## Troubleshooting

### "Missing Supabase credentials"
→ Check `.env` files have correct values

### "relation 'swarms' does not exist"
→ Run the migration in SQL Editor

### "Realtime not working"
→ Enable replication in Database settings

### "Permission denied"
→ Using anon key in client, service key in server?

## Next Steps

✅ Supabase connected  
✅ Real-time enabled  
✅ Dashboard ready  

Now you can:
- Launch swarms through the UI
- Monitor real-time updates
- Check logs in Supabase dashboard
- Build worker implementation

---

Questions? Check the full guide: `SUPABASE_SETUP.md`