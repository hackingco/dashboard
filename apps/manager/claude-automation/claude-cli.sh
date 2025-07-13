#!/bin/bash
# Claude-Friendly CLI for Testing and Deployment
# Provides simple commands with clear feedback

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.."; pwd)"
LOG_DIR="${PROJECT_ROOT}/logs"
REPORT_DIR="${PROJECT_ROOT}/reports"
BACKUP_DIR="${PROJECT_ROOT}/backups"

# Ensure directories exist
mkdir -p "${LOG_DIR}" "${REPORT_DIR}" "${BACKUP_DIR}"

# Logging function
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_DIR}/claude-automation.log"
}

# Success indicator
success() {
    echo -e "${GREEN}✅ $1${NC}"
    log "SUCCESS" "$1"
}

# Error indicator
error() {
    echo -e "${RED}❌ $1${NC}"
    log "ERROR" "$1"
}

# Warning indicator
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    log "WARNING" "$1"
}

# Info indicator
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
    log "INFO" "$1"
}

# Progress indicator
progress() {
    echo -e "${BLUE}🔄 $1${NC}"
    log "PROGRESS" "$1"
}

# Help function
show_help() {
    cat << EOF
${BLUE}Claude Automation CLI${NC}

Usage: $0 <command> [options]

Commands:
    ${GREEN}test${NC}          Run all tests with detailed feedback
    ${GREEN}test-unit${NC}     Run unit tests only
    ${GREEN}test-integration${NC} Run integration tests only
    ${GREEN}test-e2e${NC}      Run end-to-end tests
    ${GREEN}lint${NC}          Run code quality checks
    ${GREEN}typecheck${NC}     Run TypeScript type checking
    ${GREEN}build${NC}         Build the application
    ${GREEN}deploy${NC}        Deploy with safety checks
    ${GREEN}deploy-preview${NC} Deploy to preview environment
    ${GREEN}deploy-production${NC} Deploy to production (with confirmations)
    ${GREEN}rollback${NC}      Rollback to previous version
    ${GREEN}status${NC}        Check deployment status
    ${GREEN}logs${NC}          View recent logs
    ${GREEN}report${NC}        Generate comprehensive report
    ${GREEN}backup${NC}        Create deployment backup
    ${GREEN}restore${NC}       Restore from backup
    ${GREEN}validate${NC}      Validate deployment readiness
    ${GREEN}monitor${NC}       Start real-time monitoring
    ${GREEN}help${NC}          Show this help message

Options:
    --verbose      Show detailed output
    --dry-run      Simulate actions without executing
    --no-confirm   Skip confirmation prompts (use with caution)
    --report       Generate report after command

Examples:
    $0 test                    # Run all tests
    $0 deploy --dry-run        # Simulate deployment
    $0 deploy-production       # Deploy to production with confirmations
    $0 rollback               # Rollback to previous version
    $0 status                 # Check current deployment status
    $0 report                 # Generate comprehensive report

EOF
}

# Parse arguments
VERBOSE=false
DRY_RUN=false
NO_CONFIRM=false
GENERATE_REPORT=false

while [[ $# -gt 1 ]]; do
    case $1 in
        --verbose)
            VERBOSE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-confirm)
            NO_CONFIRM=false
            shift
            ;;
        --report)
            GENERATE_REPORT=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Command handling
COMMAND=${1:-help}

case $COMMAND in
    test)
        ./test-all.sh
        ;;
    test-unit)
        ./test-unit.sh
        ;;
    test-integration)
        ./test-integration.sh
        ;;
    test-e2e)
        ./test-e2e.sh
        ;;
    lint)
        ./quality-checks.sh lint
        ;;
    typecheck)
        ./quality-checks.sh typecheck
        ;;
    build)
        ./build.sh
        ;;
    deploy)
        ./deploy-safe.sh
        ;;
    deploy-preview)
        ./deploy-preview.sh
        ;;
    deploy-production)
        ./deploy-production.sh
        ;;
    rollback)
        ./rollback.sh
        ;;
    status)
        ./deployment-status.sh
        ;;
    logs)
        ./view-logs.sh
        ;;
    report)
        ./generate-report.sh
        ;;
    backup)
        ./backup-deployment.sh
        ;;
    restore)
        ./restore-backup.sh
        ;;
    validate)
        ./validate-deployment.sh
        ;;
    monitor)
        ./monitor-realtime.sh
        ;;
    help)
        show_help
        ;;
    *)
        error "Unknown command: $COMMAND"
        show_help
        exit 1
        ;;
esac

# Generate report if requested
if [ "$GENERATE_REPORT" = true ]; then
    ./generate-report.sh
fi