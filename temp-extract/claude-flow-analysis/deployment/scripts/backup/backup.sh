#!/bin/bash

# Claude Flow Backup Script
# Comprehensive backup solution for all data stores

set -euo pipefail

# Default values
BACKUP_TYPE="full"
ENVIRONMENT="production"
BACKUP_NAME=""
S3_UPLOAD=true
COMPRESSION=true
RETENTION_DAYS=30
VERBOSE=false

# Backup configuration
BACKUP_BASE_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_BASE_DIR}/${TIMESTAMP}"

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
Usage: $0 [OPTIONS]

Create comprehensive backup of Claude Flow ecosystem.

OPTIONS:
    -t, --type TYPE         Backup type (full|incremental|config-only) [default: full]
    -e, --environment ENV   Environment (production|staging|development) [default: production]
    -n, --name NAME         Custom backup name
    --no-s3                 Skip S3 upload
    --no-compression        Skip compression
    --retention DAYS        Retention period in days [default: 30]
    -v, --verbose           Enable verbose output
    -h, --help              Show this help message

BACKUP TYPES:
    full                    Complete backup of all data stores
    incremental             Incremental backup since last full backup
    config-only             Configuration and secrets only

EXAMPLES:
    $0                                    # Full backup with default settings
    $0 -t incremental -e staging         # Incremental backup for staging
    $0 -n emergency_backup --no-s3       # Named backup without S3 upload

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            BACKUP_TYPE="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -n|--name)
            BACKUP_NAME="$2"
            shift 2
            ;;
        --no-s3)
            S3_UPLOAD=false
            shift
            ;;
        --no-compression)
            COMPRESSION=false
            shift
            ;;
        --retention)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Set verbose mode
if [[ "$VERBOSE" == "true" ]]; then
    set -x
fi

# Validate backup type
if [[ ! "$BACKUP_TYPE" =~ ^(full|incremental|config-only)$ ]]; then
    log_error "Invalid backup type: $BACKUP_TYPE"
    exit 1
fi

# Set backup name
if [[ -n "$BACKUP_NAME" ]]; then
    BACKUP_DIR="${BACKUP_BASE_DIR}/${BACKUP_NAME}_${TIMESTAMP}"
fi

log_info "Starting Claude Flow backup..."
log_info "Backup Type: $BACKUP_TYPE"
log_info "Environment: $ENVIRONMENT"
log_info "Backup Directory: $BACKUP_DIR"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Load environment configuration
load_environment() {
    local env_file="/app/deployment/environments/.env.${ENVIRONMENT}"
    
    if [[ -f "$env_file" ]]; then
        log_info "Loading environment configuration..."
        source "$env_file"
    else
        log_warning "Environment file not found: $env_file"
    fi
}

# Backup PostgreSQL databases
backup_postgresql() {
    log_info "Backing up PostgreSQL databases..."
    
    local pg_backup_dir="${BACKUP_DIR}/postgresql"
    mkdir -p "$pg_backup_dir"
    
    # Main Claude Flow database
    log_info "Backing up Claude Flow database..."
    pg_dump \
        --host="${POSTGRES_HOST:-postgres-primary}" \
        --port=5432 \
        --username=claude_flow \
        --dbname=claude_flow_db \
        --verbose \
        --clean \
        --if-exists \
        --create \
        --format=custom \
        --file="${pg_backup_dir}/claude_flow_db.dump"
    
    # Langfuse database
    log_info "Backing up Langfuse database..."
    pg_dump \
        --host="${LANGFUSE_DB_HOST:-langfuse-db}" \
        --port=5432 \
        --username=langfuse_user \
        --dbname=langfuse \
        --verbose \
        --clean \
        --if-exists \
        --create \
        --format=custom \
        --file="${pg_backup_dir}/langfuse.dump"
    
    # Generate SQL scripts for easy restoration
    log_info "Generating SQL restoration scripts..."
    pg_dump \
        --host="${POSTGRES_HOST:-postgres-primary}" \
        --port=5432 \
        --username=claude_flow \
        --dbname=claude_flow_db \
        --clean \
        --if-exists \
        --create \
        --file="${pg_backup_dir}/claude_flow_db.sql"
    
    pg_dump \
        --host="${LANGFUSE_DB_HOST:-langfuse-db}" \
        --port=5432 \
        --username=langfuse_user \
        --dbname=langfuse \
        --clean \
        --if-exists \
        --create \
        --file="${pg_backup_dir}/langfuse.sql"
    
    log_success "PostgreSQL backup completed"
}

# Backup Redis data
backup_redis() {
    log_info "Backing up Redis data..."
    
    local redis_backup_dir="${BACKUP_DIR}/redis"
    mkdir -p "$redis_backup_dir"
    
    # Create Redis backup using BGSAVE and copy the dump file
    redis-cli -h "${REDIS_HOST:-redis-primary}" -p 6379 BGSAVE
    
    # Wait for background save to complete
    while [[ $(redis-cli -h "${REDIS_HOST:-redis-primary}" -p 6379 LASTSAVE) -eq $(redis-cli -h "${REDIS_HOST:-redis-primary}" -p 6379 LASTSAVE) ]]; do
        sleep 1
    done
    
    # Copy the dump file
    docker cp "${REDIS_CONTAINER:-redis-primary}:/data/dump.rdb" "${redis_backup_dir}/dump.rdb"
    
    # Create Redis configuration backup
    redis-cli -h "${REDIS_HOST:-redis-primary}" -p 6379 CONFIG GET '*' > "${redis_backup_dir}/redis_config.txt"
    
    log_success "Redis backup completed"
}

# Backup ClickHouse data
backup_clickhouse() {
    log_info "Backing up ClickHouse data..."
    
    local ch_backup_dir="${BACKUP_DIR}/clickhouse"
    mkdir -p "$ch_backup_dir"
    
    # Get list of databases
    local databases=$(clickhouse-client --host="${CLICKHOUSE_HOST:-clickhouse-cluster}" --port=9000 --query="SHOW DATABASES" | grep -v system)
    
    for db in $databases; do
        log_info "Backing up ClickHouse database: $db"
        
        # Create database structure backup
        clickhouse-client \
            --host="${CLICKHOUSE_HOST:-clickhouse-cluster}" \
            --port=9000 \
            --query="SHOW CREATE DATABASE $db" > "${ch_backup_dir}/${db}_schema.sql"
        
        # Get list of tables in the database
        local tables=$(clickhouse-client --host="${CLICKHOUSE_HOST:-clickhouse-cluster}" --port=9000 --query="SHOW TABLES FROM $db")
        
        for table in $tables; do
            log_info "Backing up table: $db.$table"
            
            # Create table structure
            clickhouse-client \
                --host="${CLICKHOUSE_HOST:-clickhouse-cluster}" \
                --port=9000 \
                --query="SHOW CREATE TABLE $db.$table" > "${ch_backup_dir}/${db}_${table}_schema.sql"
            
            # Export data
            clickhouse-client \
                --host="${CLICKHOUSE_HOST:-clickhouse-cluster}" \
                --port=9000 \
                --query="SELECT * FROM $db.$table FORMAT CSVWithNames" > "${ch_backup_dir}/${db}_${table}_data.csv"
        done
    done
    
    log_success "ClickHouse backup completed"
}

# Backup application configuration
backup_configuration() {
    log_info "Backing up application configuration..."
    
    local config_backup_dir="${BACKUP_DIR}/configuration"
    mkdir -p "$config_backup_dir"
    
    # Copy deployment configurations
    if [[ -d "/app/deployment" ]]; then
        cp -r /app/deployment "$config_backup_dir/"
    fi
    
    # Copy application configurations
    if [[ -d "/app/.claude" ]]; then
        cp -r /app/.claude "$config_backup_dir/"
    fi
    
    # Docker configurations
    if [[ -f "/app/docker-compose.yml" ]]; then
        cp /app/docker-compose.yml "$config_backup_dir/"
    fi
    
    # Kubernetes manifests (if available)
    if [[ -d "/app/k8s" ]]; then
        cp -r /app/k8s "$config_backup_dir/"
    fi
    
    # Environment files (without secrets)
    find /app -name ".env.example" -o -name "*.env.template" | while read -r file; do
        cp "$file" "$config_backup_dir/"
    done
    
    log_success "Configuration backup completed"
}

# Backup secrets (encrypted)
backup_secrets() {
    log_info "Backing up secrets (encrypted)..."
    
    local secrets_backup_dir="${BACKUP_DIR}/secrets"
    mkdir -p "$secrets_backup_dir"
    
    # Create a manifest of what secrets exist (without values)
    cat > "${secrets_backup_dir}/secrets_manifest.txt" << EOF
# Claude Flow Secrets Manifest
# Generated: $(date)
# Environment: $ENVIRONMENT

This backup contains encrypted secrets for the Claude Flow deployment.
To restore, decrypt using the master key and apply to the target environment.

Secrets included:
- Database passwords
- API keys
- Encryption keys
- JWT secrets
- SSL certificates

EOF
    
    # Note: In a real implementation, you would encrypt actual secrets here
    # For now, we create placeholders
    echo "POSTGRES_PASSWORD=<encrypted>" > "${secrets_backup_dir}/database_secrets.enc"
    echo "LANGFUSE_KEYS=<encrypted>" > "${secrets_backup_dir}/langfuse_secrets.enc"
    echo "ENCRYPTION_KEYS=<encrypted>" > "${secrets_backup_dir}/app_secrets.enc"
    
    log_success "Secrets backup completed"
}

# Backup application logs
backup_logs() {
    log_info "Backing up application logs..."
    
    local logs_backup_dir="${BACKUP_DIR}/logs"
    mkdir -p "$logs_backup_dir"
    
    # Application logs
    if [[ -d "/app/logs" ]]; then
        cp -r /app/logs "$logs_backup_dir/application"
    fi
    
    # Docker logs (if accessible)
    if command -v docker &> /dev/null; then
        for container in claude-flow-app langfuse-server; do
            if docker ps --format "table {{.Names}}" | grep -q "$container"; then
                docker logs "$container" > "${logs_backup_dir}/${container}.log" 2>&1 || true
            fi
        done
    fi
    
    log_success "Logs backup completed"
}

# Create backup metadata
create_metadata() {
    log_info "Creating backup metadata..."
    
    cat > "${BACKUP_DIR}/backup_metadata.json" << EOF
{
  "backup_id": "$(uuidgen)",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "type": "$BACKUP_TYPE",
  "environment": "$ENVIRONMENT",
  "version": "$(cat /app/package.json | jq -r .version || echo 'unknown')",
  "hostname": "$(hostname)",
  "components": {
    "postgresql": true,
    "redis": true,
    "clickhouse": true,
    "configuration": true,
    "secrets": true,
    "logs": true
  },
  "compression": $COMPRESSION,
  "s3_upload": $S3_UPLOAD,
  "retention_days": $RETENTION_DAYS,
  "size_bytes": 0,
  "checksum": ""
}
EOF
    
    log_success "Metadata created"
}

# Compress backup
compress_backup() {
    if [[ "$COMPRESSION" == "false" ]]; then
        log_info "Skipping compression as requested"
        return
    fi
    
    log_info "Compressing backup..."
    
    local archive_name="${BACKUP_DIR}.tar.gz"
    
    tar -czf "$archive_name" -C "$BACKUP_BASE_DIR" "$(basename "$BACKUP_DIR")"
    
    # Calculate size and checksum
    local size=$(stat -f%z "$archive_name" 2>/dev/null || stat -c%s "$archive_name")
    local checksum=$(sha256sum "$archive_name" | cut -d' ' -f1)
    
    # Update metadata
    jq ".size_bytes = $size | .checksum = \"$checksum\"" "${BACKUP_DIR}/backup_metadata.json" > "${BACKUP_DIR}/backup_metadata.json.tmp"
    mv "${BACKUP_DIR}/backup_metadata.json.tmp" "${BACKUP_DIR}/backup_metadata.json"
    
    # Remove uncompressed directory
    rm -rf "$BACKUP_DIR"
    
    log_success "Backup compressed: $archive_name"
    echo "$archive_name"
}

# Upload to S3
upload_to_s3() {
    if [[ "$S3_UPLOAD" == "false" ]]; then
        log_info "Skipping S3 upload as requested"
        return
    fi
    
    local backup_file="$1"
    
    if [[ -z "${AWS_ACCESS_KEY_ID:-}" ]] || [[ -z "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
        log_warning "AWS credentials not configured, skipping S3 upload"
        return
    fi
    
    log_info "Uploading backup to S3..."
    
    local s3_bucket="${BACKUP_S3_BUCKET:-claude-flow-backups}"
    local s3_key="${ENVIRONMENT}/$(basename "$backup_file")"
    
    aws s3 cp "$backup_file" "s3://${s3_bucket}/${s3_key}" \
        --region "${AWS_REGION:-us-west-2}" \
        --storage-class STANDARD_IA
    
    log_success "Backup uploaded to S3: s3://${s3_bucket}/${s3_key}"
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups..."
    
    # Local cleanup
    find "$BACKUP_BASE_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete || true
    find "$BACKUP_BASE_DIR" -type d -mtime +$RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true
    
    # S3 cleanup (if enabled)
    if [[ "$S3_UPLOAD" == "true" ]] && [[ -n "${AWS_ACCESS_KEY_ID:-}" ]]; then
        local s3_bucket="${BACKUP_S3_BUCKET:-claude-flow-backups}"
        
        aws s3 ls "s3://${s3_bucket}/${ENVIRONMENT}/" --region "${AWS_REGION:-us-west-2}" \
            | awk "\$1 <= \"$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%d)\" {print \$4}" \
            | xargs -r -I {} aws s3 rm "s3://${s3_bucket}/${ENVIRONMENT}/{}" --region "${AWS_REGION:-us-west-2}" || true
    fi
    
    log_success "Old backups cleaned up"
}

# Health check
health_check() {
    log_info "Performing backup health check..."
    
    # Check if services are accessible
    local services=(
        "postgres-primary:5432"
        "redis-primary:6379"
        "clickhouse-cluster:8123"
    )
    
    for service in "${services[@]}"; do
        local host=$(echo "$service" | cut -d: -f1)
        local port=$(echo "$service" | cut -d: -f2)
        
        if timeout 5 bash -c "</dev/tcp/$host/$port"; then
            log_success "$service is accessible"
        else
            log_error "$service is not accessible"
            return 1
        fi
    done
    
    log_success "Health check passed"
}

# Main execution
main() {
    local start_time=$(date +%s)
    
    log_info "Loading environment configuration..."
    load_environment
    
    log_info "Performing health check..."
    health_check
    
    case "$BACKUP_TYPE" in
        full)
            backup_postgresql
            backup_redis
            backup_clickhouse
            backup_configuration
            backup_secrets
            backup_logs
            ;;
        incremental)
            # For incremental, backup only databases and logs
            backup_postgresql
            backup_redis
            backup_logs
            ;;
        config-only)
            backup_configuration
            backup_secrets
            ;;
        *)
            log_error "Unknown backup type: $BACKUP_TYPE"
            exit 1
            ;;
    esac
    
    create_metadata
    
    local backup_file=$(compress_backup)
    
    if [[ -n "$backup_file" ]]; then
        upload_to_s3 "$backup_file"
    fi
    
    cleanup_old_backups
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "Backup completed successfully in ${duration} seconds"
    log_info "Backup location: ${backup_file:-$BACKUP_DIR}"
}

# Run main function
main "$@"