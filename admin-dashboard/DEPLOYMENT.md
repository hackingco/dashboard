# Admin Dashboard Deployment Guide

## Overview

The admin dashboard is a React application built with Vite and Tailwind CSS, designed to manage the swarm infrastructure. It's configured for deployment on Fly.io as a static site served by nginx.

## Architecture

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom dark theme
- **Router**: React Router v7
- **Deployment**: Static files served by nginx on Fly.io
- **Domain**: admin.hacking.co (via CNAME to Fly.io)

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment to Fly.io

### Prerequisites

1. Install Fly CLI: https://fly.io/docs/hands-on/install-flyctl/
2. Authenticate: `fly auth login`

### First-time Setup

```bash
# Create the Fly app (only needed once)
fly apps create swarm-admin-dashboard --region sjc

# Deploy
./deploy.sh
```

### Subsequent Deployments

```bash
# Simply run the deploy script
./deploy.sh
```

## Domain Configuration

To map admin.hacking.co to your Fly.io deployment:

1. Get your app's IP address:
   ```bash
   fly ips list -a swarm-admin-dashboard
   ```

2. Add DNS records at your domain provider:
   - **A Record**: `admin.hacking.co` → `[Your Fly IP]`
   - OR
   - **CNAME Record**: `admin.hacking.co` → `swarm-admin-dashboard.fly.dev`

3. Configure certificate on Fly.io:
   ```bash
   fly certs create admin.hacking.co -a swarm-admin-dashboard
   ```

## Features

### Pages
- **Dashboard**: Overview of swarm status and metrics
- **Swarms**: Manage and monitor active swarms
- **Workers**: View and control worker nodes
- **Logs**: Real-time log streaming and analysis
- **Metrics**: Performance metrics and analytics
- **Settings**: System configuration

### UI Components
- Glass morphism design with dark theme
- Responsive layout with mobile support
- Real-time data updates
- Interactive charts and visualizations

## Build Configuration

The build is optimized for production with:
- Code splitting for better performance
- Vendor chunks for caching
- Minification with Terser
- Asset optimization

## Security

The nginx configuration includes:
- Security headers (X-Frame-Options, CSP, etc.)
- HTTPS enforcement
- Health check endpoint
- Proper MIME types

## Monitoring

- Health checks configured at `/health`
- Fly.io metrics available in dashboard
- Custom metrics can be added to the app

## Troubleshooting

### Build Failures
- Check Node version (requires Node 18+)
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check for TypeScript errors: `npm run lint`

### Deployment Issues
- Verify Fly CLI is authenticated: `fly auth whoami`
- Check app status: `fly status -a swarm-admin-dashboard`
- View logs: `fly logs -a swarm-admin-dashboard`

### Domain Issues
- Verify DNS propagation: `dig admin.hacking.co`
- Check certificate status: `fly certs list -a swarm-admin-dashboard`
- Ensure HTTPS redirect is working

## Environment Variables

Currently, no environment variables are required. If needed in the future, add them to:
- `.env.local` for local development
- `fly.toml` `[env]` section for production