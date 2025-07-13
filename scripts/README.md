# Scripts Organization & Testing Suite

This directory contains the organized and consolidated testing, monitoring, and validation scripts for the Swarm Orchestrator project.

## 📁 Directory Structure

```
scripts/
├── testing/                     # Consolidated test runners
│   ├── unit-tests.sh           # Unit test runner for all workspaces
│   ├── integration-tests.sh    # Integration testing with services
│   └── comprehensive-tests.sh  # Complete test suite orchestrator
├── monitoring/                  # Preserved monitoring scripts
│   ├── langfuse-monitor.js     # Real-time Langfuse trace monitoring
│   ├── deployment-monitor.js   # Post-deployment health monitoring
│   └── performance-monitor.js  # Performance regression analysis
├── validation/                  # Health checks and smoke tests
│   ├── health-checks.sh        # System health validation
│   └── smoke-tests.sh         # Basic functionality validation
└── README.md                   # This documentation
```

## 🧪 Testing Scripts

### Unit Tests (`testing/unit-tests.sh`)

Consolidated unit test runner for all project workspaces.

**Features:**
- Runs tests for Manager API, Admin Dashboard, and Shared Types
- Optional coverage reporting
- Parallel execution where possible
- Detailed logging and JSON reporting

**Usage:**
```bash
# Run all unit tests
./scripts/testing/unit-tests.sh

# Run with coverage
./scripts/testing/unit-tests.sh -c

# Verbose output with custom results directory
./scripts/testing/unit-tests.sh -v -o custom-results
```

**Options:**
- `-c, --coverage`: Generate test coverage reports
- `-v, --verbose`: Verbose output
- `-o, --output DIR`: Output directory for reports
- `-h, --help`: Show help message

### Integration Tests (`testing/integration-tests.sh`)

Comprehensive integration testing across services and APIs.

**Features:**
- Tests API health endpoints and WebSocket connections
- Database connectivity validation
- Swarm operations testing
- End-to-end workflow validation
- Environment-specific testing (local, staging, production)

**Usage:**
```bash
# Run integration tests locally
./scripts/testing/integration-tests.sh

# Run against staging environment
./scripts/testing/integration-tests.sh -e staging

# Custom timeout and verbose output
./scripts/testing/integration-tests.sh -t 60 -v
```

**Options:**
- `-e, --environment ENV`: Test environment (test|staging|local)
- `-v, --verbose`: Verbose output
- `-t, --timeout SECONDS`: Service startup timeout
- `-o, --output DIR`: Output directory for reports

### Comprehensive Tests (`testing/comprehensive-tests.sh`)

Master test suite that orchestrates all testing types.

**Features:**
- Combines unit, integration, lint, security, and performance tests
- Parallel execution for independent tests
- Configurable test types and environments
- Beautiful HTML and JSON reporting
- Timeout handling and retry logic

**Usage:**
```bash
# Run all tests
./scripts/testing/comprehensive-tests.sh

# Run only unit tests with coverage
./scripts/testing/comprehensive-tests.sh -t unit -c

# Run integration tests against staging
./scripts/testing/comprehensive-tests.sh -t integration -e staging

# Skip security scans and run in parallel
./scripts/testing/comprehensive-tests.sh --skip-security -p
```

**Options:**
- `-t, --type TYPE`: Test type (unit|integration|lint|security|performance|all)
- `-e, --environment ENV`: Test environment
- `-c, --coverage`: Generate coverage reports
- `-v, --verbose`: Verbose output
- `-p, --parallel`: Parallel execution
- `--skip-lint`: Skip linting checks
- `--skip-security`: Skip security scans
- `--timeout SECONDS`: Overall timeout

## 📊 Monitoring Scripts

### Langfuse Monitor (`monitoring/langfuse-monitor.js`)

Real-time monitoring of Langfuse traces with interactive dashboard.

**Features:**
- Live trace monitoring with blessed-based TUI
- Real-time metrics and alerts
- Performance tracking and analysis
- Export capabilities for reports

**Usage:**
```bash
# Start monitoring with environment variables
LANGFUSE_PUBLIC_KEY=your_key LANGFUSE_SECRET_KEY=your_secret node scripts/monitoring/langfuse-monitor.js

# Configure monitoring interval and alert thresholds
MONITOR_INTERVAL=2000 ALERT_THRESHOLD=3000 node scripts/monitoring/langfuse-monitor.js
```

**Environment Variables:**
- `LANGFUSE_HOST`: Langfuse instance URL
- `LANGFUSE_PUBLIC_KEY`: Public API key
- `LANGFUSE_SECRET_KEY`: Secret API key
- `MONITOR_INTERVAL`: Monitoring interval in ms
- `ALERT_THRESHOLD`: Alert threshold for latency

### Deployment Monitor (`monitoring/deployment-monitor.js`)

Comprehensive post-deployment monitoring with health checks.

**Features:**
- Continuous monitoring for configurable duration
- Health check automation for all services
- WebSocket connection monitoring
- Performance metrics collection
- Alert system with Slack integration
- Supabase integration for persistence

**Usage:**
```bash
# Monitor with default settings (1 hour)
node scripts/monitoring/deployment-monitor.js

# Custom monitoring with environment variables
MANAGER_URL=https://your-api.com SLACK_WEBHOOK=https://hooks.slack.com/... node scripts/monitoring/deployment-monitor.js
```

**Environment Variables:**
- `MANAGER_URL`: Manager API URL
- `DASHBOARD_URL`: Dashboard URL
- `SLACK_WEBHOOK`: Slack webhook for alerts
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service key

### Performance Monitor (`monitoring/performance-monitor.js`)

Advanced performance regression detection and analysis.

**Features:**
- Baseline comparison for response times, throughput, and resource usage
- Configurable thresholds for warnings and critical alerts
- Historical performance tracking
- Detailed regression analysis with recommendations
- Multiple metric support (CPU, memory, error rates)

**Usage:**
```bash
# Run performance regression check
node scripts/monitoring/performance-monitor.js

# Custom baseline and threshold configuration
node scripts/monitoring/performance-monitor.js --baseline ./custom-baseline.json
```

## ✅ Validation Scripts

### Health Checks (`validation/health-checks.sh`)

Comprehensive system health validation.

**Features:**
- Service endpoint health checking
- Database connectivity validation
- WebSocket connection testing
- System resource monitoring
- External dependency checking
- Retry logic with configurable timeouts

**Usage:**
```bash
# Check local services
./scripts/validation/health-checks.sh

# Check staging environment with custom timeout
./scripts/validation/health-checks.sh -e staging -t 60

# Custom retry configuration
./scripts/validation/health-checks.sh -r 5 -d 10
```

**Options:**
- `-e, --environment ENV`: Environment to check
- `-t, --timeout SECONDS`: Request timeout
- `-r, --retry COUNT`: Retry attempts
- `-d, --delay SECONDS`: Retry delay

### Smoke Tests (`validation/smoke-tests.sh`)

Quick validation of core functionality.

**Features:**
- Basic API connectivity testing
- Core feature validation (swarm init, agent spawn, memory ops)
- WebSocket functionality testing
- Database operations validation
- Fast execution for CI/CD pipelines

**Usage:**
```bash
# Run smoke tests on local environment
./scripts/validation/smoke-tests.sh

# Test against production environment
./scripts/validation/smoke-tests.sh -e production

# Custom timeout
./scripts/validation/smoke-tests.sh -t 45
```

## 🚀 Quick Start

### For Development
```bash
# Run comprehensive tests for development
./scripts/testing/comprehensive-tests.sh -t all -c

# Quick smoke test
./scripts/validation/smoke-tests.sh

# Health check
./scripts/validation/health-checks.sh
```

### For CI/CD
```bash
# Full test suite with coverage
./scripts/testing/comprehensive-tests.sh -t all -c --timeout 600

# Post-deployment validation
./scripts/validation/health-checks.sh -e staging
./scripts/validation/smoke-tests.sh -e staging
```

### For Production Monitoring
```bash
# Start post-deployment monitoring
node scripts/monitoring/deployment-monitor.js

# Performance regression check
node scripts/monitoring/performance-monitor.js

# Continuous Langfuse monitoring
node scripts/monitoring/langfuse-monitor.js
```

## 📈 Reporting

All scripts generate detailed reports in multiple formats:

- **JSON Reports**: Machine-readable for CI/CD integration
- **HTML Reports**: Human-readable with charts and visualizations
- **Log Files**: Detailed execution logs for debugging
- **Coverage Reports**: Code coverage analysis (when enabled)

Reports are typically saved in:
- `test-results/` - Testing outputs
- `validation-results/` - Health check and smoke test results
- Individual script output directories

## 🔧 Configuration

### Environment Variables

Common environment variables across scripts:
- `NODE_ENV`: Node.js environment (test|staging|production)
- `CI`: CI environment flag
- `OUTPUT_DIR`: Custom output directory
- `VERBOSE`: Enable verbose logging
- `TIMEOUT`: Default timeout in seconds

### Service URLs

Configure service endpoints:
- `TEST_API_URL`: Manager API URL for testing
- `TEST_DASHBOARD_URL`: Dashboard URL for testing
- `MANAGER_URL`: Manager API URL for monitoring
- `DASHBOARD_URL`: Dashboard URL for monitoring

## 🛡️ Error Handling

All scripts include:
- Comprehensive error handling and validation
- Timeout protection
- Retry logic where appropriate
- Graceful failure with meaningful error messages
- Exit codes for CI/CD integration

## 📋 Migration Notes

### ✅ Recent Cleanup ($(date +%Y-%m-%d))
Comprehensive cleanup of obsolete and redundant scripts completed:
- **47+** scattered deployment scripts archived safely
- **15+** redundant testing files consolidated  
- **Security issue resolved:** Exposed API token removed from tracking
- **Backward compatibility maintained:** Wrapper scripts created for common entry points

See `scripts/legacy-cleanup-$(date +%Y%m%d)/CLEANUP_SUMMARY.md` for detailed cleanup report.

### Preserved Scripts
The following high-quality scripts were preserved and moved:
- `langfuse-monitor.js` → `monitoring/langfuse-monitor.js`
- `post-deployment-monitor.js` → `monitoring/deployment-monitor.js`
- `performance-regression-check.js` → `monitoring/performance-monitor.js`

### Consolidated Scripts
Multiple scattered test runners were consolidated into:
- `testing/unit-tests.sh` - Unified unit testing
- `testing/integration-tests.sh` - Comprehensive integration testing
- `testing/comprehensive-tests.sh` - Master test orchestrator

### Deprecated Scripts
The following scripts were replaced by the new consolidated approach:
- Various individual test runners in `apps/manager/claude-automation/`
- Scattered health check scripts  
- Multiple deployment validation scripts
- **All deployment scripts** → Use `unified-deploy.sh` or wrapper scripts in project root

## 🔄 Continuous Improvement

This testing and monitoring suite is designed to evolve. Key areas for enhancement:
- Additional performance metrics
- Enhanced monitoring dashboards
- More comprehensive integration tests
- Advanced reporting features
- Better CI/CD integration

## 📞 Support

For issues or questions about the testing and monitoring suite:
1. Check script help messages (`-h` or `--help`)
2. Review log files in output directories
3. Consult this documentation
4. Check project documentation for environment setup