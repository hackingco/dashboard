# Supabase Integration Setup Guide

## 1. Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New project"
3. Fill in:
   - Project name: `swarm-orchestrator`
   - Database password: (save this securely)
   - Region: Choose closest to your Fly.io deployment
4. Click "Create new project"

## 2. Run Database Migrations

Once your project is created:

1. Go to the SQL Editor in Supabase dashboard
2. Click "New query"
3. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
4. Click "Run" to execute the migration

## 3. Get Your API Keys

1. Go to Settings → API in your Supabase dashboard
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon/Public key**: For client-side access
   - **Service role key**: For server-side access (keep secret!)

## 4. Configure Environment Variables

### For Dashboard (apps/dashboard/.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
MANAGER_URL=http://localhost:8080
```

### For Manager (apps/manager/.env)
```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
FLY_API_TOKEN=your_fly_api_token

# Optional observability
LANGFUSE_SECRET_KEY=your_langfuse_key
TRUSTGRAPH_API_KEY=your_trustgraph_key
```

### For Worker (apps/worker/.env)
```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
REDIS_URL=redis://localhost:6379
```

## 5. Enable Realtime

1. Go to Database → Replication in Supabase dashboard
2. Enable replication for these tables:
   - swarms
   - workers
   - tasks
   - logs
   - metrics

## 6. Configure Row Level Security (Optional)

For production, update the RLS policies:

```sql
-- Example: Users can only see their organization's swarms
CREATE POLICY "Users can view own org swarms" ON swarms
    FOR SELECT USING (
        organization_id = auth.jwt() ->> 'organization_id'
    );
```

## 7. Test the Connection

Run this test script to verify setup:

```bash
# Create test file: test-supabase.js
cat > test-supabase.js << 'EOF'
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Test read
    const { data, error } = await supabase
      .from('swarms')
      .select('*')
      .limit(1);
    
    if (error) throw error;
    console.log('✅ Connection successful!');
    console.log('Swarms count:', data.length);
    
    // Test realtime
    const channel = supabase
      .channel('test-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'swarms' }, 
        payload => {
          console.log('📡 Realtime event:', payload);
        }
      )
      .subscribe();
    
    console.log('✅ Realtime subscription active');
    
    // Cleanup
    setTimeout(() => {
      supabase.removeChannel(channel);
      process.exit(0);
    }, 5000);
    
  } catch (error) {
    console.error('❌ Connection failed:', error);
    process.exit(1);
  }
}

testConnection();
EOF

# Run test
node test-supabase.js
```

## 8. Install Dependencies

```bash
# Install new dependencies
pnpm install

# Build shared packages
pnpm --filter @swarm/supabase build
pnpm --filter @swarm/types build
```

## 9. Start Services

```bash
# Terminal 1: Start manager
cd apps/manager
pnpm dev

# Terminal 2: Start dashboard
cd apps/dashboard
pnpm dev

# Terminal 3: Start worker (when implemented)
cd apps/worker
pnpm dev
```

## 10. Verify Everything Works

1. Open dashboard at http://localhost:3000
2. Click "Launch Swarm"
3. Fill in the form and submit
4. Check Supabase dashboard → Table Editor → swarms
5. You should see your new swarm record!

## Troubleshooting

### Connection Refused
- Check if Supabase URL is correct
- Verify API keys are properly set
- Ensure no typos in environment variables

### Realtime Not Working
- Enable replication for tables in Supabase dashboard
- Check if using anon key (not service key) in client
- Verify WebSocket connections aren't blocked

### Permission Denied
- Check RLS policies
- Use service role key for server-side operations
- Verify auth token if using authentication

## Next Steps

After setup is complete:
1. Test swarm creation through the dashboard
2. Monitor logs in Supabase dashboard
3. Set up authentication (optional)
4. Configure backup policies
5. Enable point-in-time recovery

---

Need help? Check Supabase docs: https://supabase.com/docs