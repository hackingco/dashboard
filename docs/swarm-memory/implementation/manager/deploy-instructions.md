# 🚀 Swarm Manager Deployment Instructions

## Quick Deploy Steps

### 1. **Login to Fly.io**
```bash
fly auth login
```

### 2. **Navigate to Manager Directory**
```bash
cd apps/manager
```

### 3. **Create and Deploy the App**
```bash
# Create the app
fly apps create swarm-manager-live --org personal

# Deploy
fly deploy

# Or if the app already exists, just deploy:
fly deploy --app swarm-manager-live
```

### 4. **Set Secrets (Required)**
After deployment, set the required secrets:

```bash
# Set your Supabase credentials
fly secrets set SUPABASE_URL="your-supabase-url" --app swarm-manager-live
fly secrets set SUPABASE_ANON_KEY="your-supabase-anon-key" --app swarm-manager-live
fly secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" --app swarm-manager-live

# Set your Fly.io API token for machine management
fly secrets set FLY_API_TOKEN="your-fly-api-token" --app swarm-manager-live

# Optional: Langfuse for LLM tracking
fly secrets set LANGFUSE_PUBLIC_KEY="your-langfuse-public-key" --app swarm-manager-live
fly secrets set LANGFUSE_SECRET_KEY="your-langfuse-secret-key" --app swarm-manager-live
```

### 5. **Verify Deployment**
```bash
# Check app status
fly status --app swarm-manager-live

# Check logs
fly logs --app swarm-manager-live

# Open the app
fly open --app swarm-manager-live
```

## 📋 Configuration Details

### **fly.toml Configuration**
The fly.toml is already configured with:
- App name: `swarm-manager-live`
- Primary region: `ord` (Chicago)
- Port: 8080
- Health check endpoint: `/api/health`
- CORS enabled for dashboard URLs

### **CORS Configuration**
The manager is configured to accept requests from:
- https://admin-dashboard-r2axwm3fl-hackingco.vercel.app
- http://localhost:3000, 3001, 3002
- Any other dashboard URLs you add to DASHBOARD_URL env var

### **API Endpoints**
Once deployed, the manager will be available at:
- Base URL: `https://swarm-manager-live.fly.dev`
- API URL: `https://swarm-manager-live.fly.dev/api`

## 🔧 Troubleshooting

### **If deployment fails:**
1. Check Docker is running locally
2. Ensure you're logged into Fly.io: `fly auth login`
3. Verify organization: `fly orgs list`
4. Check app name availability: `fly apps list`

### **If CORS issues persist:**
1. Add your dashboard URL to the allowed origins in `src/index.ts`
2. Redeploy the manager
3. Check browser console for specific CORS errors

### **If API returns 401/403:**
1. Ensure all secrets are set correctly
2. Check Supabase credentials are valid
3. Verify Fly.io API token has proper permissions

## 📊 Post-Deployment

After successful deployment:
1. The admin dashboard will automatically start showing real data
2. You can create and manage swarms through the dashboard
3. All metrics and telemetry will be live
4. Real-time updates will work via polling

## 🎯 Next Steps

1. **Deploy the Manager**: Follow steps above
2. **Set Secrets**: Configure all required environment variables
3. **Test Dashboard**: Visit https://admin-dashboard-r2axwm3fl-hackingco.vercel.app
4. **Create First Swarm**: Use the dashboard to create your first swarm

---

**Note**: The dashboard is already configured to connect to `https://swarm-manager-live.fly.dev/api` and will work as soon as the manager is deployed.