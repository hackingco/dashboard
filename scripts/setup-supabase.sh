#!/bin/bash

echo "🚀 Supabase Setup Script"
echo "========================"
echo ""

# Check if .env files exist
if [ ! -f "apps/dashboard/.env.local" ]; then
    echo "Creating apps/dashboard/.env.local from example..."
    cp apps/dashboard/.env.example apps/dashboard/.env.local
fi

if [ ! -f "apps/manager/.env" ]; then
    echo "Creating apps/manager/.env from example..."
    cp apps/manager/.env.example apps/manager/.env
fi

echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Create a Supabase project at https://app.supabase.com"
echo ""
echo "2. Get your API keys from Supabase dashboard:"
echo "   - Go to Settings → API"
echo "   - Copy Project URL, anon key, and service role key"
echo ""
echo "3. Update the .env files with your Supabase credentials:"
echo "   - apps/dashboard/.env.local"
echo "   - apps/manager/.env"
echo ""
echo "4. Run the database migration:"
echo "   - Copy supabase/migrations/001_initial_schema.sql"
echo "   - Paste into Supabase SQL Editor and run"
echo ""
echo "5. Enable realtime for tables in Supabase dashboard:"
echo "   - Go to Database → Replication"
echo "   - Enable: swarms, workers, tasks, logs, metrics"
echo ""
echo "6. Install dependencies and build:"
echo "   pnpm install"
echo "   pnpm --filter @swarm/supabase build"
echo ""
echo "7. Start the services:"
echo "   pnpm dev"
echo ""
echo "✅ Setup script complete!"