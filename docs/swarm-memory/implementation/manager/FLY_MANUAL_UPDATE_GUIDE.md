# Manual Fly.io Environment Variable Update Guide

## Dashboard CORS Configuration

The swarm manager backend needs to be updated with the correct dashboard URL to allow CORS requests.

### Required Environment Variable

```bash
DASHBOARD_URL=https://dist-d4ex7zt2q-hackingco.vercel.app
```

### Manual Update Steps

#### Option 1: Via Fly.io Dashboard (Recommended)

1. **Login to Fly.io Dashboard**
   ```bash
   fly auth login
   ```
   Or visit: https://fly.io/dashboard

2. **Navigate to Your App**
   - Go to: https://fly.io/apps/swarm-manager-flat-water-2021

3. **Access Secrets/Environment**
   - Click on "Secrets" or "Environment Variables" in the app dashboard
   - Add a new secret:
     - Name: `DASHBOARD_URL`
     - Value: `https://dist-d4ex7zt2q-hackingco.vercel.app`

4. **Restart the App**
   ```bash
   fly apps restart swarm-manager-flat-water-2021
   ```

#### Option 2: Via Fly CLI

1. **Set the Environment Variable**
   ```bash
   fly secrets set DASHBOARD_URL="https://dist-d4ex7zt2q-hackingco.vercel.app" -a swarm-manager-flat-water-2021
   ```

2. **Verify the Secret**
   ```bash
   fly secrets list -a swarm-manager-flat-water-2021
   ```

3. **Check App Status**
   ```bash
   fly status -a swarm-manager-flat-water-2021
   ```

### Verify CORS is Working

After updating the environment variable and restarting:

1. **Test Health Endpoint**
   ```bash
   curl -H "Origin: https://dist-d4ex7zt2q-hackingco.vercel.app" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        https://swarm-manager-flat-water-2021.fly.dev/health -v
   ```

2. **Check Response Headers**
   Look for:
   - `Access-Control-Allow-Origin: https://dist-d4ex7zt2q-hackingco.vercel.app`
   - `Access-Control-Allow-Credentials: true`

### Current CORS Configuration in Code

The backend (`src/index.ts`) is configured to accept:
- The `DASHBOARD_URL` environment variable
- All Vercel preview deployments (regex patterns)
- Specific known dashboard URLs

### Debugging CORS Issues

If CORS is still not working after the update:

1. **Check Logs**
   ```bash
   fly logs -a swarm-manager-flat-water-2021
   ```

2. **SSH into the App**
   ```bash
   fly ssh console -a swarm-manager-flat-water-2021
   ```

3. **Check Environment Inside Container**
   ```bash
   echo $DASHBOARD_URL
   ```

4. **Test from Inside**
   ```bash
   curl http://localhost:8080/health
   ```

### Alternative: Deploy with Updated Config

If manual update doesn't work, try redeploying:

```bash
# Set the environment variable locally
export DASHBOARD_URL="https://dist-d4ex7zt2q-hackingco.vercel.app"

# Deploy with the environment variable
fly deploy -a swarm-manager-flat-water-2021 --env DASHBOARD_URL="https://dist-d4ex7zt2q-hackingco.vercel.app"
```

### Notes

- The CORS configuration in the code supports dynamic origins with regex patterns
- The dashboard URL environment variable is the primary allowed origin
- All Vercel preview deployments are automatically allowed
- WebSocket connections also respect the same CORS policy