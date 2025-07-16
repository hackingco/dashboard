#!/bin/bash

# Claude Flow Restore Script
# Restore from backup with various options

set -euo pipefail

# Default values
BACKUP_SOURCE=""
RESTORE_TYPE="full"
TARGET_ENVIRONMENT="production"
DRY_RUN=false
FORCE=false
VERBOSE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS] BACKUP_SOURCE

Restore Claude Flow from backup.

ARGUMENTS:
    BACKUP_SOURCE           Path to backup file or S3 URL (s3://bucket/key)

OPTIONS:
    -t, --type TYPE         Restore type (full|data-only|config-only) [default: full]
    -e, --environment ENV   Target environment [default: production]
    -d, --dry-run          Show what would be restored without executing
    -f, --force            Force restore even if target environment is active
    -v, --verbose          Enable verbose output
    -h, --help             Show this help message

RESTORE TYPES:
    full                   Complete restore of all components
    data-only              Restore only databases and data
    config-only            Restore only configuration and secrets

EXAMPLES:
    $0 /backups/backup_20231215_120000.tar.gz
    $0 s3://claude-flow-backups/production/backup_20231215_120000.tar.gz
    $0 -t data-only -e staging /path/to/backup.tar.gz

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            RESTORE_TYPE="$2"
            shift 2
            ;;
        -e|--environment)
            TARGET_ENVIRONMENT="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        -*)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
        *)
            BACKUP_SOURCE="$1"
            shift
            ;;
    esac
done

# Validate arguments
if [[ -z "$BACKUP_SOURCE" ]]; then
    log_error "Backup source is required"
    usage
    exit 1
fi

# Set verbose mode
if [[ "$VERBOSE" == "true" ]]; then
    set -x
fi

log_info "Starting Claude Flow restore..."
log_info "Backup Source: $BACKUP_SOURCE"
log_info "Restore Type: $RESTORE_TYPE"
log_info "Target Environment: $TARGET_ENVIRONMENT"
log_info "Dry Run: $DRY_RUN"

# Restore working directory
RESTORE_WORK_DIR="/tmp/claude_flow_restore_$(date +%s)"

# Download and extract backup
prepare_backup() {
    log_info "Preparing backup for restore..."
    
    mkdir -p "$RESTORE_WORK_DIR"
    
    if [[ "$BACKUP_SOURCE" =~ ^s3:// ]]; then
        # Download from S3
        log_info "Downloading backup from S3..."
        local backup_file="${RESTORE_WORK_DIR}/backup.tar.gz"
        
        aws s3 cp "$BACKUP_SOURCE" "$backup_file" --region "${AWS_REGION:-us-west-2}"
        
        BACKUP_SOURCE="$backup_file"
    fi
    
    # Verify backup file exists
    if [[ ! -f "$BACKUP_SOURCE" ]]; then
        log_error "Backup file not found: $BACKUP_SOURCE"
        exit 1
    fi
    
    # Extract backup
    log_info "Extracting backup..."
    tar -xzf "$BACKUP_SOURCE" -C "$RESTORE_WORK_DIR"
    
    # Find extracted directory
    local extracted_dir=$(find "$RESTORE_WORK_DIR" -maxdepth 1 -type d -name "*[0-9]*" | head -1)
    
    if [[ -z "$extracted_dir" ]]; then
        log_error "Could not find extracted backup directory"
        exit 1
    fi
    
    export BACKUP_DIR="$extracted_dir"
    log_success "Backup prepared: $BACKUP_DIR"
}

# Validate backup
validate_backup() {
    log_info "Validating backup..."
    
    # Check metadata
    local metadata_file="${BACKUP_DIR}/backup_metadata.json"
    
    if [[ ! -f "$metadata_file" ]]; then
        log_error "Backup metadata not found"
        exit 1
    fi
    
    local backup_type=$(jq -r '.type' "$metadata_file")
    local backup_env=$(jq -r '.environment' "$metadata_file")
    local backup_timestamp=$(jq -r '.timestamp' "$metadata_file")
    
    log_info "Backup Information:"
    log_info "  Type: $backup_type"
    log_info "  Environment: $backup_env"
    log_info "  Timestamp: $backup_timestamp"
    
    # Verify checksums if available
    if jq -e '.checksum' "$metadata_file" >/dev/null 2>&1; then
        local expected_checksum=$(jq -r '.checksum' "$metadata_file")
        local actual_checksum=$(sha256sum "$BACKUP_SOURCE" | cut -d' ' -f1)
        
        if [[ "$expected_checksum" != "$actual_checksum" ]]; then
            log_error "Backup checksum mismatch!"
            log_error "Expected: $expected_checksum"
            log_error "Actual: $actual_checksum"
            exit 1
        fi
        
        log_success "Backup checksum verified"
    fi
    
    log_success "Backup validation completed"
}

# Check environment status
check_environment_status() {
    log_info "Checking target environment status..."
    
    if [[ "$FORCE" == "true" ]]; then
        log_warning "Force flag set, skipping environment checks"
        return
    fi
    
    # Check if services are running
    local running_services=()
    
    # Check Docker services
    if command -v docker &> /dev/null; then
        local docker_services=$(docker ps --format "table {{.Names}}" | grep -E "(claude-flow|langfuse|postgres|redis|clickhouse)" || true)
        
        if [[ -n "$docker_services" ]]; then
            running_services+=("Docker services")
        fi
    fi
    
    # Check Kubernetes services
    if command -v kubectl &> /dev/null && kubectl cluster-info &> /dev/null; then
        local k8s_services=$(kubectl get pods -n claude-flow --no-headers 2>/dev/null | grep Running || true)
        
        if [[ -n "$k8s_services" ]]; then
            running_services+=("Kubernetes services")
        fi
    fi
    
    if [[ ${#running_services[@]} -gt 0 ]]; then
        log_warning "Active services detected in target environment:"
        for service in "${running_services[@]}"; do
            log_warning "  - $service"
        done
        
        if [[ "$DRY_RUN" == "false" ]]; then
            read -p "Continue with restore? This will stop active services. (yes/no): " -r
            
            if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
                log_info "Restore cancelled"
                exit 0
            fi
        fi
    fi
    
    log_success "Environment status check completed"
}

# Stop services
stop_services() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would stop services"
        return
    fi
    
    log_info "Stopping services for restore..."
    
    # Stop Docker services
    if command -v docker-compose &> /dev/null; then
        local compose_file="/app/deployment/infrastructure/docker-compose.${TARGET_ENVIRONMENT}.yml"
        
        if [[ -f "$compose_file" ]]; then
            docker-compose -f "$compose_file" down || true
        fi
    fi
    
    # Stop Kubernetes services
    if command -v kubectl &> /dev/null && kubectl cluster-info &> /dev/null; then
        kubectl scale deployment --all --replicas=0 -n claude-flow || true
    fi
    
    log_success "Services stopped"
}

# Restore PostgreSQL databases
restore_postgresql() {
    log_info "Restoring PostgreSQL databases..."
    
    local pg_backup_dir="${BACKUP_DIR}/postgresql"
    
    if [[ ! -d "$pg_backup_dir" ]]; then
        log_warning "PostgreSQL backup not found, skipping"
        return
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would restore PostgreSQL databases:"
        ls -la "$pg_backup_dir"
        return
    fi
    
    # Restore Claude Flow database
    if [[ -f "${pg_backup_dir}/claude_flow_db.dump" ]]; then
        log_info "Restoring Claude Flow database..."
        
        pg_restore \
            --host="${POSTGRES_HOST:-postgres-primary}" \
            --port=5432 \
            --username=claude_flow \
            --dbname=claude_flow_db \
            --verbose \
            --clean \
            --if-exists \
            --create \
            "${pg_backup_dir}/claude_flow_db.dump"
    fi
    
    # Restore Langfuse database
    if [[ -f "${pg_backup_dir}/langfuse.dump" ]]; then
        log_info "Restoring Langfuse database..."
        
        pg_restore \
            --host="${LANGFUSE_DB_HOST:-langfuse-db}" \
            --port=5432 \
            --username=langfuse_user \
            --dbname=langfuse \
            --verbose \
            --clean \
            --if-exists \
            --create \
            "${pg_backup_dir}/langfuse.dump"
    fi
    
    log_success "PostgreSQL restore completed"
}

# Restore Redis data
restore_redis() {
    log_info "Restoring Redis data..."
    
    local redis_backup_dir="${BACKUP_DIR}/redis"
    
    if [[ ! -d "$redis_backup_dir" ]]; then
        log_warning "Redis backup not found, skipping"
        return
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would restore Redis data:"
        ls -la "$redis_backup_dir"
        return
    fi
    
    # Stop Redis to restore data file
    redis-cli -h "${REDIS_HOST:-redis-primary}" -p 6379 SHUTDOWN NOSAVE || true
    
    # Copy dump file
    if [[ -f "${redis_backup_dir}/dump.rdb" ]]; then
        docker cp "${redis_backup_dir}/dump.rdb" "${REDIS_CONTAINER:-redis-primary}:/data/dump.rdb"
    fi
    
    # Restart Redis
    docker start "${REDIS_CONTAINER:-redis-primary}" || true
    
    # Wait for Redis to be ready
    local retries=0
    while [[ $retries -lt 30 ]]; do
        if redis-cli -h "${REDIS_HOST:-redis-primary}" -p 6379 ping >/dev/null 2>&1; then
            break
        fi
        retries=$((retries + 1))
        sleep 1
    done
    
    log_success "Redis restore completed"
}

# Restore ClickHouse data
restore_clickhouse() {
    log_info "Restoring ClickHouse data..."
    
    local ch_backup_dir="${BACKUP_DIR}/clickhouse"
    
    if [[ ! -d "$ch_backup_dir" ]]; then
        log_warning "ClickHouse backup not found, skipping"
        return
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would restore ClickHouse data:"
        ls -la "$ch_backup_dir"
        return
    fi
    
    # Restore database schemas and data
    for schema_file in "${ch_backup_dir}"/*_schema.sql; do
        if [[ -f "$schema_file" ]]; then
            log_info "Restoring schema: $(basename "$schema_file")"
            clickhouse-client \
                --host="${CLICKHOUSE_HOST:-clickhouse-cluster}" \
                --port=9000 \
                --queries-file="$schema_file"
        fi
    done
    
    # Restore table data
    for data_file in "${ch_backup_dir}"/*_data.csv; do
        if [[ -f "$data_file" ]]; then
            local table_info=$(basename "$data_file" .csv | sed 's/_data$//')
            local db=$(echo "$table_info" | cut -d_ -f1)
            local table=$(echo "$table_info" | cut -d_ -f2-)
            
            log_info "Restoring data: $db.$table"
            clickhouse-client \
                --host="${CLICKHOUSE_HOST:-clickhouse-cluster}" \
                --port=9000 \
                --query="INSERT INTO $db.$table FORMAT CSVWithNames" < "$data_file"
        fi
    done
    
    log_success "ClickHouse restore completed"
}

# Restore configuration
restore_configuration() {
    log_info "Restoring configuration..."
    
    local config_backup_dir="${BACKUP_DIR}/configuration"
    
    if [[ ! -d "$config_backup_dir" ]]; then
        log_warning "Configuration backup not found, skipping"
        return
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would restore configuration:"
        find "$config_backup_dir" -type f
        return
    fi
    
    # Restore deployment configurations
    if [[ -d "${config_backup_dir}/deployment" ]]; then
        cp -r "${config_backup_dir}/deployment" /app/
    fi
    
    # Restore application configurations
    if [[ -d "${config_backup_dir}/.claude" ]]; then
        cp -r "${config_backup_dir}/.claude" /app/
    fi
    
    # Restore Docker configurations
    if [[ -f "${config_backup_dir}/docker-compose.yml" ]]; then
        cp "${config_backup_dir}/docker-compose.yml" /app/
    fi
    
    log_success "Configuration restore completed"
}

# Restore secrets
restore_secrets() {
    log_info "Restoring secrets..."
    
    local secrets_backup_dir="${BACKUP_DIR}/secrets"
    
    if [[ ! -d "$secrets_backup_dir" ]]; then
        log_warning "Secrets backup not found, skipping"
        return
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would restore secrets:"
        ls -la "$secrets_backup_dir"
        return
    fi
    
    log_warning "Secret restoration requires manual decryption and application"
    log_warning "Please decrypt and apply secrets from: $secrets_backup_dir"
    
    log_success "Secrets restore completed (manual steps required)"
}

# Start services
start_services() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would start services"
        return
    fi
    
    log_info "Starting services after restore..."
    
    # Start Docker services
    if command -v docker-compose &> /dev/null; then
        local compose_file="/app/deployment/infrastructure/docker-compose.${TARGET_ENVIRONMENT}.yml"
        
        if [[ -f "$compose_file" ]]; then
            docker-compose -f "$compose_file" up -d
        fi
    fi
    
    # Start Kubernetes services
    if command -v kubectl &> /dev/null && kubectl cluster-info &> /dev/null; then
        kubectl scale deployment --all --replicas=1 -n claude-flow
    fi
    
    log_success "Services started"
}

# Verify restore
verify_restore() {
    log_info "Verifying restore..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - skipping verification"
        return
    fi
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 60
    
    # Health checks
    local health_checks=(
        "http://localhost:8080/health:Claude Flow"
        "http://localhost:3000/api/public/health:Langfuse"
    )
    
    for check in "${health_checks[@]}"; do
        local url=$(echo "$check" | cut -d: -f1-2)
        local service=$(echo "$check" | cut -d: -f3)
        
        log_info "Checking $service health..."
        
        local retries=0
        local max_retries=30
        
        while [[ $retries -lt $max_retries ]]; do
            if curl -f -s "$url" > /dev/null; then
                log_success "$service is healthy"
                break
            fi
            
            retries=$((retries + 1))
            log_info "Waiting for $service (attempt $retries/$max_retries)..."
            sleep 10
        done
        
        if [[ $retries -eq $max_retries ]]; then
            log_error "$service health check failed"
            return 1
        fi
    done
    
    log_success "Restore verification completed"
}

# Cleanup
cleanup() {
    log_info "Cleaning up restore workspace..."
    
    if [[ -d "$RESTORE_WORK_DIR" ]]; then
        rm -rf "$RESTORE_WORK_DIR"
    fi
    
    log_success "Cleanup completed"
}

# Main execution
main() {
    local start_time=$(date +%s)
    
    trap cleanup EXIT
    
    prepare_backup
    validate_backup
    check_environment_status
    
    case "$RESTORE_TYPE" in
        full)
            stop_services
            restore_postgresql
            restore_redis
            restore_clickhouse
            restore_configuration
            restore_secrets
            start_services
            verify_restore
            ;;
        data-only)
            stop_services
            restore_postgresql
            restore_redis
            restore_clickhouse
            start_services
            verify_restore
            ;;
        config-only)
            restore_configuration
            restore_secrets
            ;;
        *)
            log_error "Unknown restore type: $RESTORE_TYPE"
            exit 1
            ;;
    esac
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "Restore completed successfully in ${duration} seconds"
    
    if [[ "$RESTORE_TYPE" == "full" ]] && [[ "$DRY_RUN" == "false" ]]; then
        log_info "Post-restore checklist:"
        log_info "  1. Verify all services are running correctly"
        log_info "  2. Check application logs for any errors"
        log_info "  3. Test critical functionality"
        log_info "  4. Update DNS/load balancer if needed"
        log_info "  5. Notify stakeholders of completion"
    fi
}

# Run main function
main "$@"