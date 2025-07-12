# Hotfix: @swarm/supabase Module Not Found Error

## Issue
The Fly.io deployment was crashing with:
```
Error: Cannot find module '@swarm/supabase'
Require stack:
- /app/dist/routes/swarms.js
```

## Root Cause
The `@swarm/supabase` is a workspace dependency that exists in the monorepo structure. During deployment:
1. `package.json` references workspace dependencies like `"@swarm/supabase": "workspace:*"`
2. For production deployment, `package.deploy.json` strips out workspace dependencies
3. The compiled JavaScript still imports from `@swarm/supabase` which doesn't exist in production

## Solution Implemented
Created local copies of the required modules within the manager app:

1. **Created `/src/lib/supabase-operations.ts`**
   - Copied all supabase client and operations code from `@swarm/supabase`
   - Simplified type references to avoid database type dependencies

2. **Created `/src/lib/types.ts`**
   - Copied necessary type definitions from `@swarm/types`
   - Only included types actually used by the manager app

3. **Updated imports in all affected files:**
   - `/src/routes/swarms.ts`: Changed from `@swarm/supabase` to `../lib/supabase-operations`
   - `/src/services/supabase.service.ts`: Updated to use local imports

## Files Modified
- `/src/routes/swarms.ts` - Updated imports
- `/src/services/supabase.service.ts` - Updated imports
- `/src/lib/supabase-operations.ts` - New file (created)
- `/src/lib/types.ts` - New file (created)

## Deployment Instructions
The app should now deploy successfully without the module not found error:
```bash
npm run build
npm run deploy
```

## Future Considerations
For a more permanent solution, consider:
1. Publishing workspace packages to npm
2. Using a build tool that bundles workspace dependencies
3. Converting to a single package structure for deployment