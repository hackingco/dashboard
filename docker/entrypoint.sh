#!/bin/bash

# Entrypoint script for Swarm containers
# Built by Builder-2 Agent for Enterprise Swarm Platform

set -euo pipefail

# Color output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}"
}

# Function to wait for a service
wait_for_service() {
    local host=$1
    local port=$2
    local service_name=$3
    local timeout=${4:-30}
    
    log "Waiting for $service_name at $host:$port..."
    
    for i in $(seq 1 $timeout); do
        if nc -z "$host" "$port" >/dev/null 2>&1; then
            success "$service_name is ready!"
            return 0
        fi
        log "Attempt $i/$timeout: $service_name not ready, waiting..."
        sleep 2
    done
    
    error "$service_name failed to start within $timeout attempts"
    return 1
}

# Function to initialize Langfuse integration
init_langfuse() {
    log "Initializing Langfuse integration..."
    
    # Check if Langfuse is enabled
    if [[ "${LANGFUSE_ENABLED:-true}" != "true" ]]; then
        warn "Langfuse integration is disabled"
        return 0
    fi
    
    # Validate Langfuse environment variables
    if [[ -z "${LANGFUSE_PUBLIC_KEY:-}" ]]; then
        warn "LANGFUSE_PUBLIC_KEY not set, using default configuration"
    fi
    
    if [[ -z "${LANGFUSE_SECRET_KEY:-}" ]]; then
        warn "LANGFUSE_SECRET_KEY not set, tracing may be limited"
    fi
    
    if [[ -z "${LANGFUSE_HOST:-}" ]]; then
        log "Using default Langfuse host: https://cloud.langfuse.com"
        export LANGFUSE_HOST="https://cloud.langfuse.com"
    fi
    
    # Test Langfuse connection
    if command -v curl >/dev/null 2>&1; then
        if curl -s --max-time 5 "${LANGFUSE_HOST}/api/public/health" >/dev/null; then
            success "Langfuse connection verified"
        else
            warn "Could not verify Langfuse connection, continuing anyway"
        fi
    fi
}

# Function to initialize database
init_database() {
    log "Initializing database..."
    
    local db_path="${DATABASE_PATH:-/app/data/swarm.db}"
    local db_dir=$(dirname "$db_path")
    
    # Create database directory if it doesn't exist
    mkdir -p "$db_dir"
    
    # Check if database file exists and is writable
    if [[ -f "$db_path" ]]; then
        log "Database file exists: $db_path"
        # Test database accessibility
        if sqlite3 "$db_path" "SELECT 1;" >/dev/null 2>&1; then
            success "Database is accessible"
        else
            error "Database exists but is not accessible"
            return 1
        fi
    else
        log "Creating new database: $db_path"
        # Create empty database
        sqlite3 "$db_path" "CREATE TABLE IF NOT EXISTS health_check (id INTEGER PRIMARY KEY, timestamp TEXT);"
        success "Database created successfully"
    fi
    
    # Set proper permissions
    chmod 644 "$db_path"
}

# Function to initialize Claude Flow hooks
init_claude_flow() {
    log "Initializing Claude Flow integration..."
    
    # Create .swarm directory for coordination
    mkdir -p /app/.swarm
    
    # Initialize coordination database
    if [[ ! -f "/app/.swarm/coordination.db" ]]; then
        log "Creating coordination database..."
        sqlite3 /app/.swarm/coordination.db "
        CREATE TABLE IF NOT EXISTS coordination (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id TEXT NOT NULL,
            task_id TEXT NOT NULL,
            status TEXT NOT NULL,
            payload TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS memory_store (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            ttl INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_coordination_agent_task ON coordination(agent_id, task_id);
        CREATE INDEX IF NOT EXISTS idx_memory_ttl ON memory_store(ttl);
        "
        success "Coordination database initialized"
    fi
    
    # Test Claude Flow CLI if available
    if command -v npx >/dev/null 2>&1; then
        if npx claude-flow@alpha --version >/dev/null 2>&1; then
            success "Claude Flow CLI is available"
        else
            warn "Claude Flow CLI not available, installing..."
            npm install -g claude-flow@alpha || warn "Failed to install Claude Flow CLI"
        fi
    fi
}

# Function to setup logging
setup_logging() {
    log "Setting up logging..."
    
    local log_dir="/app/logs"
    mkdir -p "$log_dir"
    
    # Create log files with proper permissions
    touch "$log_dir/app.log"
    touch "$log_dir/error.log"
    touch "$log_dir/access.log"
    
    # Setup log rotation (basic)
    cat > "$log_dir/rotate.sh" << 'EOF'
#!/bin/bash
# Simple log rotation
for log_file in /app/logs/*.log; do
    if [[ -f "$log_file" && $(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file") -gt 10485760 ]]; then
        mv "$log_file" "${log_file}.$(date +%Y%m%d_%H%M%S)"
        touch "$log_file"
    fi
done
EOF
    chmod +x "$log_dir/rotate.sh"
    
    success "Logging setup completed"
}

# Function to validate environment
validate_environment() {
    log "Validating environment..."
    
    # Check required environment variables
    local required_vars=("NODE_ENV" "PORT" "SWARM_ROLE")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables: ${missing_vars[*]}"
        return 1
    fi
    
    # Validate port
    if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [[ "$PORT" -lt 1 ]] || [[ "$PORT" -gt 65535 ]]; then
        error "Invalid PORT value: $PORT"
        return 1
    fi
    
    # Validate swarm role
    if [[ "$SWARM_ROLE" != "manager" && "$SWARM_ROLE" != "worker" ]]; then
        error "Invalid SWARM_ROLE: $SWARM_ROLE (must be 'manager' or 'worker')"
        return 1
    fi
    
    success "Environment validation passed"
}

# Function to start the application
start_application() {
    log "Starting $SWARM_ROLE application..."
    
    # Change to app directory
    cd /app
    
    # Set up NODE_PATH to include shared modules
    export NODE_PATH="/app/shared:/app/node_modules:$NODE_PATH"
    
    # Start the application based on role
    if [[ "$SWARM_ROLE" == "manager" ]]; then
        log "Starting Swarm Manager..."
        
        # Wait for dependencies if configured
        if [[ -n "${SUPABASE_URL:-}" ]]; then
            log "Waiting for Supabase connection..."
            # Add Supabase connection check here if needed
        fi
        
        # Start manager
        exec node dist/index.js
        
    elif [[ "$SWARM_ROLE" == "worker" ]]; then
        log "Starting Swarm Worker..."
        
        # Wait for manager if URL is provided
        if [[ -n "${MANAGER_URL:-}" ]]; then
            local manager_host=$(echo "$MANAGER_URL" | sed 's|.*://||' | cut -d: -f1)
            local manager_port=$(echo "$MANAGER_URL" | sed 's|.*://||' | cut -d: -f2 | cut -d/ -f1)
            
            if [[ -n "$manager_host" && -n "$manager_port" ]]; then
                wait_for_service "$manager_host" "$manager_port" "Swarm Manager" 60
            fi
        fi
        
        # Start worker
        exec node dist/index.js
    else
        error "Unknown SWARM_ROLE: $SWARM_ROLE"
        exit 1
    fi
}

# Function to handle graceful shutdown
cleanup() {
    log "Received shutdown signal, cleaning up..."
    
    # Store final coordination state if Claude Flow is available
    if command -v npx >/dev/null 2>&1 && npx claude-flow@alpha --version >/dev/null 2>&1; then
        log "Storing final coordination state..."
        npx claude-flow@alpha hooks session-end --export-metrics true --generate-summary true || warn "Failed to export final state"
    fi
    
    # Rotate logs one final time
    if [[ -f "/app/logs/rotate.sh" ]]; then
        /app/logs/rotate.sh || warn "Failed to rotate logs during cleanup"
    fi
    
    success "Cleanup completed"
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT SIGQUIT

# Main execution
main() {
    log "Starting Swarm container initialization..."
    log "Role: $SWARM_ROLE"
    log "Port: $PORT"
    log "Node Environment: $NODE_ENV"
    
    # Run initialization steps
    validate_environment
    setup_logging
    init_database
    init_langfuse
    init_claude_flow
    
    success "Initialization completed successfully"
    
    # Start the application
    start_application
}

# Execute main function
main "$@"