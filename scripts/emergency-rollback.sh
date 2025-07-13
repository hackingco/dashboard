#!/bin/bash

# Emergency Rollback Script
# This script provides one-command emergency rollback capabilities
# Usage: ./scripts/emergency-rollback.sh --service <service> --reason "<reason>"

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SERVICE=""
REASON=""
ROLLBACK_TO=""
CONFIRM="false"
DRY_RUN="false"

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo -e "${BLUE}"
    echo "=================================================================="
    echo "🚨 EMERGENCY ROLLBACK SCRIPT"
    echo "=================================================================="
    echo -e "${NC}"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Emergency rollback script for Fly Swarm Orchestrator services.

OPTIONS:
    --service <service>     Service to rollback (manager, dashboard, worker, all)
    --reason "<reason>"     Reason for rollback (required)
    --rollback-to <version> Specific version to rollback to (optional)
    --confirm              Skip confirmation prompt
    --dry-run              Show what would be done without executing
    --help                 Show this help message

EXAMPLES:
    # Rollback manager API with confirmation
    $0 --service manager --reason "Critical bug in API response handling"
    
    # Rollback all services to specific version
    $0 --service all --reason "Database migration issue" --rollback-to v1.2.3
    
    # Dry run to see what would happen
    $0 --service dashboard --reason "Frontend crash" --dry-run
    
    # Emergency rollback with no confirmation
    $0 --service all --reason "Production outage" --confirm

SERVICES:
    manager     Fly Swarm Manager API (swarm-manager-live)
    dashboard   Admin Dashboard (Vercel deployment)
    worker      Worker Service (swarm-worker)
    all         All services

PREREQUISITES:
    - flyctl CLI installed and authenticated
    - vercel CLI installed and authenticated (for dashboard)
    - FLY_API_TOKEN environment variable set
    - VERCEL_TOKEN environment variable set (for dashboard)

EOF
}

# Function to parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --service)
                SERVICE="$2"
                shift 2
                ;;
            --reason)
                REASON="$2"
                shift 2
                ;;
            --rollback-to)
                ROLLBACK_TO="$2"
                shift 2
                ;;
            --confirm)
                CONFIRM="true"
                shift
                ;;
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Function to validate inputs
validate_inputs() {
    if [[ -z "$SERVICE" ]]; then
        print_error "Service is required. Use --service <service>"
        exit 1
    fi
    
    if [[ "$SERVICE" != "manager" && "$SERVICE" != "dashboard" && "$SERVICE" != "worker" && "$SERVICE" != "all" ]]; then
        print_error "Invalid service. Must be one of: manager, dashboard, worker, all"
        exit 1
    fi
    
    if [[ -z "$REASON" ]]; then
        print_error "Reason is required. Use --reason \"<reason>\""
        exit 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check flyctl
    if ! command -v flyctl &> /dev/null; then
        print_error "flyctl CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check FLY_API_TOKEN
    if [[ -z "${FLY_API_TOKEN:-}" ]]; then
        print_error "FLY_API_TOKEN environment variable is not set"
        exit 1
    fi
    
    # Check vercel CLI if dashboard rollback is needed
    if [[ "$SERVICE" == "dashboard" || "$SERVICE" == "all" ]]; then
        if ! command -v vercel &> /dev/null; then
            print_warning "vercel CLI is not installed. Dashboard rollback will be manual."
        fi
        
        if [[ -z "${VERCEL_TOKEN:-}" ]]; then
            print_warning "VERCEL_TOKEN environment variable is not set. Dashboard rollback will be manual."
        fi
    fi
    
    print_success "Prerequisites check completed"
}

# Function to get current status
get_current_status() {
    print_info "Getting current deployment status..."
    
    if [[ "$SERVICE" == "manager" || "$SERVICE" == "all" ]]; then
        print_info "Manager API Status:"
        if [[ "$DRY_RUN" == "false" ]]; then
            flyctl status --app swarm-manager-live || print_warning "Failed to get manager status"
            flyctl releases --app swarm-manager-live --limit 3 || print_warning "Failed to get manager releases"
        else
            echo "  [DRY RUN] Would check flyctl status --app swarm-manager-live"
        fi
        echo
    fi
    
    if [[ "$SERVICE" == "worker" || "$SERVICE" == "all" ]]; then
        print_info "Worker Service Status:"
        if [[ "$DRY_RUN" == "false" ]]; then
            flyctl status --app swarm-worker || print_warning "Failed to get worker status"
            flyctl releases --app swarm-worker --limit 3 || print_warning "Failed to get worker releases"
        else
            echo "  [DRY RUN] Would check flyctl status --app swarm-worker"
        fi
        echo
    fi
    
    if [[ "$SERVICE" == "dashboard" || "$SERVICE" == "all" ]]; then
        print_info "Dashboard Status:"
        if [[ "$DRY_RUN" == "false" ]]; then
            curl -s -I https://admin-dashboard-l0e1w6ivz-hackingco.vercel.app | head -1 || print_warning "Failed to check dashboard status"
        else
            echo "  [DRY RUN] Would check dashboard status"
        fi
        echo
    fi
}

# Function to confirm rollback
confirm_rollback() {
    if [[ "$CONFIRM" == "true" ]]; then
        return 0
    fi
    
    echo
    print_warning "⚠️  EMERGENCY ROLLBACK CONFIRMATION ⚠️"
    echo
    echo "Service(s): $SERVICE"
    echo "Reason: $REASON"
    if [[ -n "$ROLLBACK_TO" ]]; then
        echo "Target Version: $ROLLBACK_TO"
    else
        echo "Target Version: Previous release (automatic)"
    fi
    echo "Dry Run: $DRY_RUN"
    echo
    
    if [[ "$DRY_RUN" == "false" ]]; then
        print_warning "This will rollback the specified service(s) in PRODUCTION!"
        print_warning "This action cannot be easily undone."
        echo
        read -p "Are you sure you want to proceed? (type 'ROLLBACK' to confirm): " confirmation
        
        if [[ "$confirmation" != "ROLLBACK" ]]; then
            print_info "Rollback cancelled by user"
            exit 0
        fi
    else
        print_info "DRY RUN mode - no actual changes will be made"
    fi
}

# Function to rollback manager API
rollback_manager() {
    print_info "Rolling back Manager API..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "  [DRY RUN] Would execute:"
        if [[ -n "$ROLLBACK_TO" ]]; then
            echo "    flyctl releases rollback --app swarm-manager-live --to $ROLLBACK_TO"
        else
            echo "    flyctl releases rollback --app swarm-manager-live"
        fi
        return 0
    fi
    
    # Execute rollback
    if [[ -n "$ROLLBACK_TO" ]]; then
        flyctl releases rollback --app swarm-manager-live --to "$ROLLBACK_TO"
    else
        flyctl releases rollback --app swarm-manager-live
    fi
    
    # Wait for rollback
    print_info "Waiting for Manager API rollback to complete..."
    sleep 30
    
    # Health check
    print_info "Performing post-rollback health check..."
    max_attempts=20
    attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f --max-time 10 https://swarm-manager-live.fly.dev/health; then
            print_success "Manager API rollback successful!"
            return 0
        else
            print_warning "Health check failed (attempt $attempt/$max_attempts)"
            if [[ $attempt -eq $max_attempts ]]; then
                print_error "Manager API rollback health check failed"
                return 1
            fi
            sleep 10
            ((attempt++))
        fi
    done
}

# Function to rollback dashboard
rollback_dashboard() {
    print_info "Rolling back Dashboard..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "  [DRY RUN] Dashboard rollback would require:"
        echo "    1. Manual rollback via Vercel dashboard, OR"
        echo "    2. Redeployment of previous version, OR"
        echo "    3. Vercel alias management (if configured)"
        return 0
    fi
    
    print_warning "Dashboard rollback requires manual intervention"
    print_info "Please follow these steps:"
    echo "1. Go to https://vercel.com/dashboard"
    echo "2. Find the admin-dashboard project"
    echo "3. Navigate to deployments"
    echo "4. Promote a previous deployment"
    echo
    print_info "Alternatively, redeploy from a previous Git commit"
    
    # Basic health check
    print_info "Checking current dashboard status..."
    if curl -f --max-time 10 https://admin-dashboard-l0e1w6ivz-hackingco.vercel.app; then
        print_info "Dashboard is currently responding"
    else
        print_warning "Dashboard is not responding"
    fi
}

# Function to rollback worker service
rollback_worker() {
    print_info "Rolling back Worker Service..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "  [DRY RUN] Would execute:"
        if [[ -n "$ROLLBACK_TO" ]]; then
            echo "    flyctl releases rollback --app swarm-worker --to $ROLLBACK_TO"
        else
            echo "    flyctl releases rollback --app swarm-worker"
        fi
        return 0
    fi
    
    # Execute rollback
    if [[ -n "$ROLLBACK_TO" ]]; then
        flyctl releases rollback --app swarm-worker --to "$ROLLBACK_TO"
    else
        flyctl releases rollback --app swarm-worker
    fi
    
    # Wait for rollback
    print_info "Waiting for Worker Service rollback to complete..."
    sleep 30
    
    # Health check
    print_info "Checking worker service status..."
    if flyctl status --app swarm-worker | grep -q "started\|running"; then
        print_success "Worker Service rollback successful!"
        return 0
    else
        print_error "Worker Service rollback verification failed"
        return 1
    fi
}

# Function to log rollback
log_rollback() {
    local timestamp=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
    local log_file="rollback-$(date +%Y%m%d-%H%M%S).log"
    
    cat > "$log_file" << EOF
EMERGENCY ROLLBACK LOG
=====================

Timestamp: $timestamp
Service(s): $SERVICE
Reason: $REASON
Target Version: ${ROLLBACK_TO:-"Previous release (automatic)"}
Executed by: ${USER:-"unknown"}
Dry Run: $DRY_RUN

Status:
- Manager API: ${MANAGER_ROLLBACK_STATUS:-"not attempted"}
- Dashboard: ${DASHBOARD_ROLLBACK_STATUS:-"not attempted"}  
- Worker Service: ${WORKER_ROLLBACK_STATUS:-"not attempted"}

Notes:
- All rollback actions were logged
- Post-rollback health checks performed
- Manual verification recommended

EOF
    
    print_info "Rollback logged to: $log_file"
}

# Main execution function
main() {
    print_header
    
    parse_args "$@"
    validate_inputs
    check_prerequisites
    get_current_status
    confirm_rollback
    
    local overall_success=true
    
    # Execute rollbacks based on service selection
    if [[ "$SERVICE" == "manager" || "$SERVICE" == "all" ]]; then
        if rollback_manager; then
            MANAGER_ROLLBACK_STATUS="success"
            print_success "Manager API rollback completed"
        else
            MANAGER_ROLLBACK_STATUS="failed"
            print_error "Manager API rollback failed"
            overall_success=false
        fi
    fi
    
    if [[ "$SERVICE" == "dashboard" || "$SERVICE" == "all" ]]; then
        if rollback_dashboard; then
            DASHBOARD_ROLLBACK_STATUS="manual"
            print_warning "Dashboard rollback requires manual completion"
        else
            DASHBOARD_ROLLBACK_STATUS="failed"
            print_error "Dashboard rollback failed"
            overall_success=false
        fi
    fi
    
    if [[ "$SERVICE" == "worker" || "$SERVICE" == "all" ]]; then
        if rollback_worker; then
            WORKER_ROLLBACK_STATUS="success"
            print_success "Worker Service rollback completed"
        else
            WORKER_ROLLBACK_STATUS="failed"
            print_error "Worker Service rollback failed"
            overall_success=false
        fi
    fi
    
    # Log the rollback
    log_rollback
    
    echo
    if [[ "$overall_success" == "true" ]]; then
        print_success "🎯 Emergency rollback completed successfully!"
        if [[ "$DRY_RUN" == "false" ]]; then
            print_info "Please verify all services are functioning correctly"
            print_info "Monitor logs and metrics for any issues"
        fi
    else
        print_error "🚨 Emergency rollback completed with errors!"
        print_warning "Manual intervention may be required"
        print_info "Check the rollback log for details"
    fi
    
    echo
    print_info "Next steps:"
    echo "1. Verify all services are responding correctly"
    echo "2. Check monitoring dashboards and alerts"
    echo "3. Review and fix the issues that caused the rollback"
    echo "4. Plan and test fixes before next deployment"
    echo
}

# Execute main function with all arguments
main "$@"