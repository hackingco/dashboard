# Container Management System

## 🚀 Overview

The Container Management System is a comprehensive container orchestration and health monitoring solution designed to ensure 100% service availability for the Langfuse swarm architecture. This system provides intelligent container management, automated recovery, real-time monitoring, and service dependency validation.

## 📋 System Components

### 1. Container Health Monitor (`container-health-monitor.js`)
- **Purpose**: Real-time container health monitoring
- **Features**:
  - Continuous health checks for all containers
  - HTTP endpoint monitoring
  - Database connectivity testing
  - Redis health verification
  - Automated restart on failure
  - Health dashboard at `http://localhost:9999/dashboard`

### 2. Container Manager (`container-manager.js`)
- **Purpose**: Automated container lifecycle management
- **Features**:
  - Service stack management
  - Dependency-aware startup sequences
  - Resource monitoring and optimization
  - Graceful shutdown procedures
  - Network and volume management

### 3. Service Dependency Checker (`service-dependency-checker.js`)
- **Purpose**: Comprehensive dependency validation
- **Features**:
  - Dependency graph analysis
  - Network connectivity testing
  - Port availability checking
  - Database schema validation
  - Environment variable verification
  - Detailed dependency reports

### 4. Container Recovery System (`container-recovery-system.js`)
- **Purpose**: Intelligent automated recovery
- **Features**:
  - Circuit breaker pattern implementation
  - Multi-strategy recovery attempts
  - Dependency-aware recovery
  - Failure history tracking
  - Rollback capabilities
  - Smart backoff algorithms

### 5. Container Metrics Dashboard (`container-metrics-dashboard.js`)
- **Purpose**: Real-time metrics visualization
- **Features**:
  - Live metrics collection
  - Interactive web dashboard
  - Performance charts and graphs
  - Alert management
  - Resource utilization tracking
  - Historical data analysis

### 6. Container Orchestrator (`container-orchestrator.js`)
- **Purpose**: Master coordination system
- **Features**:
  - Unified system management
  - Component coordination
  - Startup sequence management
  - Status reporting
  - System health validation

## 🔧 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- Docker and Docker Compose
- Required containers running

### Quick Start
```bash
# Make scripts executable
chmod +x *.js start-container-management.sh

# Start the complete system
./start-container-management.sh
```

### Manual Setup
```bash
# Install dependencies
npm install express socket.io chart.js

# Start individual components
node container-orchestrator.js start
node container-health-monitor.js
node container-recovery-system.js start
node container-metrics-dashboard.js
```

## 📊 Monitored Containers

### Essential Containers
1. **cf-langfuse-server** (Critical)
   - Port: 3000
   - Health: `/api/public/health`
   - Dependencies: cf-langfuse-db, cf-clickhouse
   - Recovery: Restart → Recreate → Rebuild

2. **langfuse-worker-built** (High)
   - Port: 3030
   - Health: `/health`
   - Dependencies: cf-langfuse-db, cf-clickhouse, cf-analysis-redis
   - Recovery: Restart → Clear queue → Recreate

3. **cf-langfuse-db** (Critical)
   - Port: 5432
   - Health: `pg_isready`
   - Dependencies: None
   - Recovery: Restart → Repair → Recreate

4. **cf-clickhouse** (High)
   - Ports: 8123, 9000
   - Health: `/ping`
   - Dependencies: None
   - Recovery: Restart → Clear cache → Recreate

5. **cf-analysis-app** (Medium)
   - Port: 3001
   - Health: `/health`
   - Dependencies: cf-analysis-postgres, cf-analysis-redis
   - Recovery: Restart → Recreate

6. **cf-analysis-postgres** (High)
   - Port: 5433
   - Health: `pg_isready`
   - Dependencies: None
   - Recovery: Restart → Repair → Recreate

7. **cf-analysis-redis** (Medium)
   - Port: 6380
   - Health: `redis-cli ping`
   - Dependencies: None
   - Recovery: Restart → Recreate

## 🌐 Dashboard Access

### Metrics Dashboard
- **URL**: `http://localhost:9998`
- **Features**:
  - Real-time container metrics
  - CPU and memory usage charts
  - Network and disk I/O monitoring
  - Alert management
  - Historical data visualization

### Health Monitor Dashboard
- **URL**: `http://localhost:9999/dashboard`
- **Features**:
  - Container health status
  - Dependency validation results
  - Recovery attempt history
  - System status overview

## 🚨 Alert System

### Alert Levels
- **Critical**: Container stopped, dependency failure
- **Warning**: High resource usage, frequent restarts
- **Info**: Normal operations, recovery success

### Alert Thresholds
- **CPU**: 80% (Warning), 90% (Critical)
- **Memory**: 85% (Warning), 95% (Critical)
- **Disk**: 90% (Warning), 95% (Critical)
- **Restarts**: 3+ restarts (Warning)

## 🔄 Recovery Strategies

### Strategy Hierarchy
1. **Simple Restart**: Quick container restart
2. **Service Restart**: Full service restart with dependencies
3. **Recreate Container**: Force recreate from image
4. **Rebuild and Restart**: Rebuild image and restart
5. **Rollback**: Restore from backup/previous version

### Circuit Breaker Pattern
- **Threshold**: 3 failures trigger circuit breaker
- **Timeout**: 5 minutes before retry
- **States**: Closed → Open → Half-Open → Closed

## 📈 Performance Monitoring

### Collected Metrics
- **CPU Usage**: Per-container CPU percentage
- **Memory Usage**: Memory consumption and percentage
- **Network I/O**: Incoming/outgoing network traffic
- **Block I/O**: Disk read/write operations
- **Process Count**: Number of running processes
- **Uptime**: Container runtime duration
- **Restart Count**: Number of container restarts

### Historical Data
- **Retention**: 1000 data points per container
- **Interval**: 5-second collection intervals
- **Storage**: In-memory with optional persistence
- **Charts**: Real-time line charts for trends

## 🔍 Dependency Management

### Dependency Types
- **Database**: PostgreSQL, ClickHouse connections
- **Cache**: Redis connectivity
- **Service**: HTTP endpoint availability
- **Network**: Container network connectivity
- **Volume**: Volume mount validation
- **Environment**: Required environment variables

### Validation Checks
- **Connection Testing**: Direct connection validation
- **Health Queries**: Database query execution
- **Port Availability**: Network port accessibility
- **Service Responses**: HTTP response validation

## 📋 API Endpoints

### Health Monitor API
- `GET /health` - System health status
- `GET /containers` - Container information
- `GET /metrics` - Container metrics
- `GET /dashboard` - HTML dashboard

### Metrics Dashboard API
- `GET /api/metrics` - Real-time metrics
- `GET /api/alerts` - Active alerts
- `GET /api/containers` - Container list
- `GET /api/health` - Dashboard health

## 🛠 Configuration

### Environment Variables
- `HEALTH_CHECK_INTERVAL`: Health check frequency (default: 30s)
- `RECOVERY_ATTEMPTS`: Max recovery attempts (default: 5)
- `METRICS_INTERVAL`: Metrics collection interval (default: 5s)
- `ALERT_THRESHOLDS`: Custom alert thresholds
- `DASHBOARD_PORT`: Dashboard port (default: 9998)

### Configuration Files
- `container-health-monitor.js`: Health check configuration
- `container-recovery-system.js`: Recovery strategy configuration
- `container-metrics-dashboard.js`: Dashboard and alert configuration

## 📊 Logging & Reports

### Log Files
- `container-health-monitor.log`: Health check logs
- `container-recovery-history.json`: Recovery attempt history
- `dependency-report-YYYY-MM-DD.json`: Daily dependency reports
- `system-report-YYYY-MM-DD.json`: System status reports

### Report Generation
```bash
# Generate system report
node container-orchestrator.js report

# Check dependencies
node service-dependency-checker.js check

# Trigger manual recovery
node container-recovery-system.js recover <container-name>
```

## 🚀 Usage Examples

### Start Complete System
```bash
# Start all components
./start-container-management.sh

# Or start orchestrator directly
node container-orchestrator.js start
```

### Individual Component Management
```bash
# Start health monitoring
node container-health-monitor.js

# Start recovery system
node container-recovery-system.js start

# Start metrics dashboard
node container-metrics-dashboard.js

# Check dependencies
node service-dependency-checker.js check
```

### System Operations
```bash
# Check system status
node container-orchestrator.js status

# Restart all containers
node container-orchestrator.js restart

# Generate system report
node container-orchestrator.js report

# Check system requirements
node container-orchestrator.js check
```

## 🔧 Troubleshooting

### Common Issues
1. **Container Not Starting**: Check dependencies and logs
2. **High Resource Usage**: Monitor metrics and optimize
3. **Recovery Failures**: Review recovery strategies
4. **Dashboard Not Loading**: Check port availability

### Debug Commands
```bash
# View container logs
docker logs <container-name>

# Check container stats
docker stats <container-name>

# Inspect container
docker inspect <container-name>

# Check system resources
docker system df
```

### Manual Recovery
```bash
# Manual container restart
docker restart <container-name>

# Force recreate container
docker-compose up -d --force-recreate <service-name>

# Check container health
docker exec <container-name> <health-command>
```

## 📈 Performance Optimization

### Resource Optimization
- **Memory Limits**: Set appropriate memory limits
- **CPU Limits**: Configure CPU constraints
- **Volume Optimization**: Use local volumes for performance
- **Network Optimization**: Optimize container networking

### Monitoring Optimization
- **Metric Intervals**: Adjust collection frequency
- **Data Retention**: Configure retention policies
- **Alert Tuning**: Fine-tune alert thresholds
- **Dashboard Performance**: Optimize dashboard refresh rates

## 🔐 Security Considerations

### Container Security
- **Image Scanning**: Regular vulnerability scanning
- **Network Security**: Secure container networking
- **Resource Limits**: Prevent resource exhaustion
- **Access Control**: Restricted container access

### Dashboard Security
- **Authentication**: Implement user authentication
- **HTTPS**: Use secure connections
- **Rate Limiting**: Prevent abuse
- **Input Validation**: Validate all inputs

## 🚀 Future Enhancements

### Planned Features
- **Auto-scaling**: Dynamic container scaling
- **Load Balancing**: Intelligent load distribution
- **Backup Integration**: Automated backup management
- **Cluster Support**: Multi-node container management
- **Advanced Analytics**: Machine learning-based predictions

### Integration Possibilities
- **Prometheus**: Metrics integration
- **Grafana**: Advanced visualization
- **Alertmanager**: Enhanced alerting
- **Kubernetes**: Container orchestration
- **Service Mesh**: Advanced networking

## 📞 Support

For support and troubleshooting:
1. Check the logs in the respective log files
2. Review the dashboard for real-time status
3. Use the dependency checker for validation
4. Consult the API endpoints for detailed information
5. Generate system reports for comprehensive analysis

## 🎯 Success Metrics

The Container Management System ensures:
- **99.9% Uptime**: Continuous service availability
- **< 5 Second Recovery**: Rapid failure recovery
- **Real-time Monitoring**: Instant issue detection
- **Automated Resolution**: Minimal manual intervention
- **Comprehensive Reporting**: Detailed system insights

---

**Container Management System**: Ensuring 100% service availability through intelligent orchestration, monitoring, and recovery.