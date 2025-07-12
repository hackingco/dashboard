# 🧪 Testing & Monitoring Workflows for Fly.io Deployment

## 📋 Overview

This document provides comprehensive testing and monitoring workflows for the Fly Swarm Orchestrator deployment. The testing suite includes smoke tests, API validation, WebSocket connectivity testing, and continuous health monitoring.

## 🚀 Quick Start

### 1. Setup FLY_ACCESS_TOKEN

```bash
# Run the interactive setup script
./scripts/setup-fly-token.sh

# Or set manually
export FLY_ACCESS_TOKEN=your_token_here
```

### 2. Run Smoke Tests

```bash
# Basic smoke tests
./tests/smoke/smoke-tests.sh

# Fly Machines API smoke tests
./tests/monitoring/fly-machines-api-test.sh swarm-admin e82992c773ed98
```

### 3. Test Real-time Connections

```bash
# Install Node.js dependencies if needed
npm install ws

# Test WebSocket connections
node tests/monitoring/websocket-realtime-test.js current
```

### 4. Start Continuous Monitoring

```bash
# Monitor health until all systems are passing
./tests/monitoring/continuous-health-monitor.sh 30 1800
```

## 📁 Testing Infrastructure

### 🧪 Test Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `setup-fly-token.sh` | Configure FLY_ACCESS_TOKEN | `./scripts/setup-fly-token.sh` |
| `fly-machines-api-test.sh` | Test Fly Machines API | `./tests/monitoring/fly-machines-api-test.sh [app] [machine-id]` |
| `websocket-realtime-test.js` | Test WebSocket connections | `node tests/monitoring/websocket-realtime-test.js [env]` |
| `continuous-health-monitor.sh` | Continuous health monitoring | `./tests/monitoring/continuous-health-monitor.sh [interval] [duration]` |
| `smoke-tests.sh` | Basic smoke tests | `./tests/smoke/smoke-tests.sh [env]` |

### 🎯 Test Coverage

#### ✅ Fly Machines API Tests
- **GET /apps/{app}/machines/{id}/stats** - Machine statistics
- **GET /apps/{app}/machines** - List all machines
- **GET /apps/{app}/machines/{id}** - Machine details and status
- **Authentication validation** - Token format and permissions
- **Health monitoring** - Wait for status == "passing"
- **Error handling** - API error responses and timeouts

#### ✅ WebSocket Real-time Tests
- **Connection establishment** - Basic WebSocket connectivity
- **Real-time updates** - Subscribe to live data streams
- **Message handling** - Ping/pong and data messages
- **Load balancing** - Multiple endpoint testing
- **Error recovery** - Connection drops and reconnection

#### ✅ Health Monitoring
- **HTTP service health** - Response codes and timing
- **Machine status monitoring** - Fly machine states
- **Continuous monitoring** - Until all systems healthy
- **Performance metrics** - Response times and resource usage
- **Alerting** - Failed test notifications

## 🛠️ Configuration

### 🔐 Authentication Setup

The testing suite requires a valid Fly.io access token. Use the setup script for easy configuration:

```bash
./scripts/setup-fly-token.sh
```

**Manual Setup Options:**

1. **Environment Variable:**
   ```bash
   export FLY_ACCESS_TOKEN=fo1_your_token_here
   ```

2. **Config File:**
   ```bash
   echo "fo1_your_token_here" > ~/.fly-token
   chmod 600 ~/.fly-token
   export FLY_ACCESS_TOKEN=$(cat ~/.fly-token)
   ```

3. **Project .env File:**
   ```bash
   echo "FLY_ACCESS_TOKEN=fo1_your_token_here" >> .env.local
   ```

### 🌐 Environment Configuration

#### Current Production Environment
```bash
# Dashboard (Vercel)
DASHBOARD_URL="https://swarm-admin-dashboard-3vgcyjnzq-hackingco.vercel.app"

# Manager API (Fly.io)
MANAGER_URL="https://swarm-mgr-1739853764.fly.dev"

# WebSocket endpoints
DASHBOARD_WS="wss://swarm-admin-dashboard-3vgcyjnzq-hackingco.vercel.app/ws"
MANAGER_WS="wss://swarm-mgr-1739853764.fly.dev/ws"
```

#### Staging Environment
```bash
DASHBOARD_URL="https://staging.hive-mind.fly.dev"
MANAGER_URL="https://staging-manager.hive-mind.fly.dev"
```

## 📊 Monitoring Workflows

### 🏥 Health Check Workflow

The continuous health monitor performs comprehensive system validation:

```bash
# Start monitoring with 30s intervals for max 30 minutes
./tests/monitoring/continuous-health-monitor.sh 30 1800
```

**Health Check Components:**

1. **HTTP Services**
   - Dashboard accessibility and response times
   - Manager API health endpoints
   - Error rate monitoring

2. **Fly Machines**
   - Machine status (started/starting/stopped)
   - Resource utilization (CPU/Memory)
   - Regional deployment status

3. **Real-time Connectivity**
   - WebSocket connection establishment
   - Real-time data stream validation
   - Connection stability testing

4. **Performance Metrics**
   - Response time tracking
   - Throughput measurement
   - Resource utilization monitoring

### 🔄 Automated Monitoring

#### Continuous Integration

Add to your CI/CD pipeline:

```yaml
# .github/workflows/health-monitoring.yml
name: Health Monitoring

on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes
  workflow_dispatch:

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup environment
        run: |
          chmod +x scripts/setup-fly-token.sh
          chmod +x tests/monitoring/*.sh
          
      - name: Configure token
        env:
          FLY_ACCESS_TOKEN: ${{ secrets.FLY_ACCESS_TOKEN }}
        run: echo "Token configured"
        
      - name: Run smoke tests
        run: ./tests/smoke/smoke-tests.sh
        
      - name: Test Fly API
        run: ./tests/monitoring/fly-machines-api-test.sh
        
      - name: Test WebSocket
        run: node tests/monitoring/websocket-realtime-test.js current
```

#### Cron Job Monitoring

Set up system-level monitoring:

```bash
# Add to crontab: crontab -e
*/15 * * * * cd /path/to/project && ./tests/monitoring/fly-machines-api-test.sh >> /var/log/swarm-health.log 2>&1
0 */6 * * * cd /path/to/project && ./tests/monitoring/continuous-health-monitor.sh 60 3600 >> /var/log/swarm-continuous.log 2>&1
```

## 🧪 Test Execution Examples

### Basic Health Check

```bash
# Quick smoke test of all services
./tests/smoke/smoke-tests.sh

# Expected output:
# 🔥 Running Smoke Tests...
# ✅ Service Health... ✓
# ✅ Swarm Status API... ✓
# ✅ Machine List API... ✓
# 🎉 All smoke tests passed!
```

### Fly Machines API Testing

```bash
# Test specific app and machine
./tests/monitoring/fly-machines-api-test.sh swarm-admin e82992c773ed98

# Expected output:
# 🔥 Fly Machines API Smoke Test Suite
# 🧪 Testing: API Connectivity... ✅ PASS
# 🧪 Testing: App Existence... ✅ PASS
# 🧪 Testing: Machine Stats... ✅ PASS
# 🏥 Health monitoring complete - System is healthy!
```

### WebSocket Real-time Testing

```bash
# Test WebSocket connections for current environment
node tests/monitoring/websocket-realtime-test.js current

# Expected output:
# 🧪 WebSocket Real-time Testing Suite
# 🔍 Testing DASHBOARD Service
# ✅ dashboard Connection: PASS (Connection established and stable)
# ✅ dashboard Real-time Updates: PASS (Received 3 real-time updates)
# 🎉 All WebSocket tests passed!
```

### Continuous Health Monitoring

```bash
# Monitor with 30s intervals for max 30 minutes
./tests/monitoring/continuous-health-monitor.sh 30 1800

# Expected output:
# 🏥 Continuous Health Monitoring
# 🔍 Health Check #1 at 2025-07-12 05:45:00
# 📡 HTTP Services:
#   🌐 swarm-admin: ✅ HEALTHY (200, 0.234s)
#   🌐 swarm-manager: ✅ HEALTHY (200, 0.456s)
# 🤖 Fly Machines:
#   🤖 swarm-admin machine: ✅ RUNNING (e82992c773ed98 in ord)
# 🎯 Overall Status: ✅ ALL SYSTEMS HEALTHY
# 🎉 HEALTH MONITORING COMPLETE!
```

## 🔧 Troubleshooting

### Common Issues

#### 1. FLY_ACCESS_TOKEN Issues

**Problem:** Authentication failures

**Solutions:**
```bash
# Get new token
flyctl auth login
flyctl auth token

# Verify token format (should start with fo1_ or fo0_)
echo $FLY_ACCESS_TOKEN | head -c 20

# Test token manually
curl -H "Authorization: Bearer $FLY_ACCESS_TOKEN" https://api.machines.dev/v1/apps
```

#### 2. Machine Not Found

**Problem:** Cannot find machine ID

**Solutions:**
```bash
# List all machines for app
flyctl machines list -a swarm-admin

# Check app exists and you have access
flyctl apps list

# Use auto-detection
./tests/monitoring/fly-machines-api-test.sh swarm-admin auto-detect
```

#### 3. WebSocket Connection Failures

**Problem:** WebSocket tests fail

**Solutions:**
```bash
# Install wscat for manual testing
npm install -g wscat

# Test WebSocket manually
wscat -c wss://swarm-mgr-1739853764.fly.dev/ws

# Check firewall/proxy settings
curl -I https://swarm-mgr-1739853764.fly.dev

# Test with Node.js dependencies
npm install ws
```

#### 4. Health Check Timeouts

**Problem:** Health monitoring never completes

**Solutions:**
```bash
# Reduce timeout and check individual services
./tests/monitoring/continuous-health-monitor.sh 10 300

# Check individual service health
curl -v https://swarm-mgr-1739853764.fly.dev/health

# Check Fly machine status directly
flyctl status -a swarm-admin
```

### Debug Mode

Enable verbose logging for debugging:

```bash
# Enable debug mode
export DEBUG=1

# Run tests with verbose output
./tests/monitoring/fly-machines-api-test.sh swarm-admin e82992c773ed98

# Check detailed WebSocket logs
DEBUG=1 node tests/monitoring/websocket-realtime-test.js current
```

## 📈 Performance Benchmarks

### Expected Response Times

| Service | Endpoint | Expected Time | Threshold |
|---------|----------|---------------|-----------|
| Dashboard | Home page | < 2s | 5s |
| Manager API | /health | < 500ms | 2s |
| Manager API | /api/swarms | < 1s | 3s |
| WebSocket | Connection | < 2s | 5s |
| Fly Machines API | /stats | < 1s | 3s |

### Success Rate Targets

- **Smoke Tests:** 100% pass rate
- **API Tests:** 95% pass rate  
- **WebSocket Tests:** 90% pass rate
- **Health Monitoring:** 3 consecutive passes required

## 🚀 Advanced Features

### Custom Health Checks

Add custom health checks by extending the monitoring scripts:

```bash
# Add custom check function
check_custom_service() {
    local service_url="$1"
    # Custom validation logic
    return 0  # or 1 for failure
}

# Add to monitoring loop
if check_custom_service "https://your-service.com"; then
    echo "✅ Custom service healthy"
else
    echo "❌ Custom service failed"
fi
```

### Integration with Monitoring Systems

#### Prometheus Metrics

Export metrics for Prometheus:

```bash
# Add to continuous-health-monitor.sh
export_prometheus_metrics() {
    cat > /var/lib/prometheus/swarm_health.prom << EOF
swarm_health_status{service="dashboard"} 1
swarm_health_response_time{service="dashboard"} 0.234
swarm_health_status{service="manager"} 1
swarm_health_response_time{service="manager"} 0.456
EOF
}
```

#### Grafana Dashboards

Import dashboard configuration:

```json
{
  "dashboard": {
    "title": "Swarm Health Monitoring",
    "panels": [
      {
        "title": "Service Health",
        "type": "stat",
        "targets": [{"expr": "swarm_health_status"}]
      }
    ]
  }
}
```

## 📋 Test Results & Reporting

### Automated Reports

Test results are automatically saved:

```bash
# Results files created
monitoring-results-20250712-054500.json  # Continuous monitoring
fly-api-test-results.json                # API test results
websocket-test-results.json              # WebSocket test results
```

### Report Format

```json
{
  "monitoring": {
    "start_time": "1673520000",
    "end_time": "1673521800",
    "duration": 1800,
    "health_checks": 60,
    "consecutive_passes": 3,
    "completed": true
  },
  "services": [
    {"name": "swarm-admin", "url": "https://...", "status": "healthy"},
    {"name": "swarm-manager", "url": "https://...", "status": "healthy"}
  ]
}
```

## 🎯 Best Practices

### 1. Regular Monitoring

- Run smoke tests after every deployment
- Schedule continuous monitoring during critical periods
- Set up alerts for consecutive failures

### 2. Token Management

- Rotate tokens regularly
- Use environment-specific tokens
- Store tokens securely (never in code)

### 3. Test Environment Isolation

- Use separate tokens for staging/production
- Configure different endpoints per environment
- Isolate test data and resources

### 4. Performance Optimization

- Cache API responses when appropriate
- Batch health checks where possible
- Use connection pooling for WebSocket tests

## 🔗 Related Documentation

- [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) - Comprehensive testing strategy
- [DEPLOYMENT_SUCCESS_FINAL.md](./DEPLOYMENT_SUCCESS_FINAL.md) - Deployment status
- [Fly.io Machines API](https://fly.io/docs/machines/api/) - Official API documentation
- [WebSocket MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) - WebSocket reference

---

## 🎉 Success Metrics

When all tests pass, you should see:

- ✅ **100% smoke test pass rate**
- ✅ **All Fly machines in "started" state**
- ✅ **WebSocket connections stable**
- ✅ **Response times under thresholds**
- ✅ **3+ consecutive health passes**

**🎯 Your Swarm deployment is healthy and operational!**