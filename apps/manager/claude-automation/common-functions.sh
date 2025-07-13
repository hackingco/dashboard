#!/bin/bash
# Common Functions for Claude Automation Scripts

set -euo pipefail

# Colors for output
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[0;33m'
export BLUE='\033[0;34m'
export PURPLE='\033[0;35m'
export CYAN='\033[0;36m'
export NC='\033[0m' # No Color

# Configuration
export PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.."; pwd)"
export LOG_DIR="${PROJECT_ROOT}/logs"
export REPORT_DIR="${PROJECT_ROOT}/reports"
export BACKUP_DIR="${PROJECT_ROOT}/backups"
export CONFIG_DIR="${PROJECT_ROOT}/claude-automation/config"

# Ensure directories exist
mkdir -p "${LOG_DIR}" "${REPORT_DIR}" "${BACKUP_DIR}" "${CONFIG_DIR}"

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

# Step indicator
step() {
    echo -e "${CYAN}➤ $1${NC}"
    log "STEP" "$1"
}

# Confirmation prompt
confirm() {
    local prompt="$1"
    local default="${2:-n}"
    
    if [ "${NO_CONFIRM:-false}" = "true" ]; then
        return 0
    fi
    
    while true; do
        if [ "$default" = "y" ]; then
            read -p "$(echo -e "${YELLOW}$prompt [Y/n]: ${NC}")" yn
            yn=${yn:-y}
        else
            read -p "$(echo -e "${YELLOW}$prompt [y/N]: ${NC}")" yn
            yn=${yn:-n}
        fi
        
        case $yn in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

# Check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Get current git branch
get_git_branch() {
    git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"
}

# Get current git commit
get_git_commit() {
    git rev-parse --short HEAD 2>/dev/null || echo "unknown"
}

# Check if git repo is clean
is_git_clean() {
    [ -z "$(git status --porcelain 2>/dev/null)" ]
}

# Create timestamp
timestamp() {
    date +%Y%m%d-%H%M%S
}

# Create ISO timestamp
iso_timestamp() {
    date -u +%Y-%m-%dT%H:%M:%SZ
}

# Check if running in CI
is_ci() {
    [ -n "${CI:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ] || [ -n "${GITLAB_CI:-}" ]
}

# Get environment name
get_environment() {
    echo "${ENVIRONMENT:-development}"
}

# Check if Fly.io CLI is available
has_fly_cli() {
    command_exists "fly"
}

# Check if Docker is available
has_docker() {
    command_exists "docker" && docker info >/dev/null 2>&1
}

# Pretty print JSON
pretty_json() {
    if command_exists "jq"; then
        jq .
    else
        cat
    fi
}

# Calculate duration
calculate_duration() {
    local start=$1
    local end=$2
    local duration=$((end - start))
    
    if [ $duration -lt 60 ]; then
        echo "${duration}s"
    elif [ $duration -lt 3600 ]; then
        echo "$((duration / 60))m $((duration % 60))s"
    else
        echo "$((duration / 3600))h $((duration % 3600 / 60))m"
    fi
}

# Create a spinner
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# Execute with spinner
execute_with_spinner() {
    local message="$1"
    shift
    
    echo -n "$message"
    "$@" &
    spinner $!
    wait $!
    local result=$?
    
    if [ $result -eq 0 ]; then
        echo -e " ${GREEN}✓${NC}"
    else
        echo -e " ${RED}✗${NC}"
    fi
    
    return $result
}

# Send notification (if available)
send_notification() {
    local title="$1"
    local message="$2"
    local type="${3:-info}"
    
    # Log the notification
    log "NOTIFICATION" "[$type] $title: $message"
    
    # Try to send OS notification
    if command_exists "osascript" && [ "$(uname)" = "Darwin" ]; then
        osascript -e "display notification \"$message\" with title \"$title\""
    elif command_exists "notify-send"; then
        notify-send "$title" "$message"
    fi
}

# Export all functions
export -f log success error warning info progress step confirm
export -f command_exists get_git_branch get_git_commit is_git_clean
export -f timestamp iso_timestamp is_ci get_environment
export -f has_fly_cli has_docker pretty_json calculate_duration
export -f spinner execute_with_spinner send_notification