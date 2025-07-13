# CORS Fix Instructions for Swarm Manager

The admin dashboard is deployed at: https://dist-d4ex7zt2q-hackingco.vercel.app

## Quick Fix (Using Environment Variable)

Since Fly.io API is having issues, here's the manual fix:

1. **Login to Fly.io Dashboard**
   - Go to https://fly.io/apps/swarm-manager-live
   - Navigate to Secrets section

2. **Update DASHBOARD_URL Secret**
   - Set `DASHBOARD_URL` to: `https://dist-d4ex7zt2q-hackingco.vercel.app`
   - This will automatically allow the new dashboard URL

3. **Restart the App**
   - The app will restart automatically after updating secrets
   - CORS will now allow the new dashboard URL

## Alternative: Code is Already Updated

The Manager source code at `/apps/manager/src/index.ts` has been updated to include:

```javascript
const allowedOrigins = [
  // ... existing origins ...
  'https://dist-d4ex7zt2q-hackingco.vercel.app',
  'https://dist-cqq7lpfmg-hackingco.vercel.app',
  // Pattern matching for any Vercel deployment
  /^https:\/\/admin-dashboard-.*-hackingco\.vercel\.app$/,
  /^https:\/\/dist-.*-hackingco\.vercel\.app$/,
]
```

When you're able to deploy (once Fly.io API is working), the CORS will automatically work for:
- All specific URLs listed
- Any Vercel preview deployment matching the patterns

## Testing the Dashboard

Once CORS is fixed, the dashboard at https://dist-d4ex7zt2q-hackingco.vercel.app will:
- Show real-time swarm data (updates every 10s)
- Display system metrics (updates every 30s)
- Allow full swarm management capabilities

## Current Status

- ✅ Dashboard deployed to Vercel
- ✅ Manager code updated with new CORS URLs
- ⏳ Manager needs redeployment or secret update
- ❌ Fly.io API currently having issues

## Manual Deployment Command

When Fly.io API is working again:
```bash
cd apps/manager
source fly-auth-env.sh
fly deploy --app swarm-manager-live
```

Or just update the secret:
```bash
fly secrets set DASHBOARD_URL="https://dist-d4ex7zt2q-hackingco.vercel.app" --app swarm-manager-live
```