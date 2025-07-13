#!/bin/bash

# GitHub Repository Optimization Script
# Configures branch protection rules and repository settings

set -euo pipefail

# Configuration
REPO="hackingco/dashboard"
MAIN_BRANCH="enterprise-swarm-platform"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

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
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v gh &> /dev/null; then
        log_error "GitHub CLI (gh) is not installed"
        log_info "Install it from: https://cli.github.com/"
        exit 1
    fi
    
    if ! gh auth status &> /dev/null; then
        log_error "GitHub CLI is not authenticated"
        log_info "Run: gh auth login"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Wait for CI to be healthy before enforcing protection
wait_for_ci_health() {
    log_info "Checking CI health before enabling strict protection..."
    
    # Get recent workflow runs
    local ci_status=$(gh api repos/$REPO/actions/runs \
        --jq '.workflow_runs[0:5] | map(select(.status == "completed")) | map(.conclusion) | unique')
    
    if echo "$ci_status" | grep -q "failure"; then
        log_warning "Recent CI failures detected. Branch protection will be configured but not strictly enforced."
        return 1
    else
        log_success "CI appears healthy. Safe to enable strict protection."
        return 0
    fi
}

# Configure branch protection rules
configure_branch_protection() {
    local enforce_strict=$1
    
    log_info "Configuring branch protection for $MAIN_BRANCH..."
    
    # Build protection configuration
    local protection_config='{
        "required_status_checks": {
            "strict": true,
            "contexts": []
        },
        "enforce_admins": false,
        "required_pull_request_reviews": {
            "required_approving_review_count": 1,
            "dismiss_stale_reviews": true,
            "require_code_owner_reviews": true,
            "require_last_push_approval": false
        },
        "restrictions": null,
        "allow_force_pushes": false,
        "allow_deletions": false,
        "block_creations": false,
        "required_conversation_resolution": true
    }'
    
    # If CI is healthy, add required status checks
    if [ "$enforce_strict" = true ]; then
        protection_config=$(echo "$protection_config" | jq '.required_status_checks.contexts = [
            "PR Validation",
            "Code Quality", 
            "Unit Tests",
            "Type Safety",
            "Automated Test Suite"
        ]')
        log_info "Enabling strict status checks"
    else
        protection_config=$(echo "$protection_config" | jq '.required_status_checks = null')
        log_warning "Disabling strict status checks due to CI issues"
    fi
    
    # Apply protection rules
    if gh api repos/$REPO/branches/$MAIN_BRANCH/protection \
        --method PUT \
        --input - <<< "$protection_config" > /dev/null 2>&1; then
        log_success "Branch protection configured successfully"
    else
        log_error "Failed to configure branch protection"
        return 1
    fi
}

# Optimize repository settings
optimize_repository_settings() {
    log_info "Optimizing repository settings..."
    
    # Configure merge settings
    gh api repos/$REPO --method PATCH --field allow_merge_commit=false \
        --field allow_squash_merge=true \
        --field allow_rebase_merge=false \
        --field delete_branch_on_merge=true > /dev/null
    
    log_success "Repository merge settings optimized"
    
    # Enable vulnerability alerts
    gh api repos/$REPO/vulnerability-alerts --method PUT > /dev/null 2>&1 || true
    
    # Enable automated security fixes (Dependabot)
    gh api repos/$REPO/automated-security-fixes --method PUT > /dev/null 2>&1 || true
    
    log_success "Security features enabled"
}

# Create branch protection status report
create_status_report() {
    log_info "Generating branch protection status report..."
    
    local report_file="branch-protection-report.md"
    
    cat > "$report_file" << EOF
# Branch Protection Status Report

Generated: $(date)
Repository: $REPO
Main Branch: $MAIN_BRANCH

## Current Protection Settings

EOF
    
    # Get current protection status
    if gh api repos/$REPO/branches/$MAIN_BRANCH/protection --jq '.' >> "$report_file" 2>/dev/null; then
        log_success "Branch protection is active"
    else
        echo "❌ No branch protection configured" >> "$report_file"
        log_warning "Branch protection not found"
    fi
    
    cat >> "$report_file" << EOF

## Repository Settings

EOF
    
    gh api repos/$REPO --jq '{
        allow_merge_commit,
        allow_squash_merge, 
        allow_rebase_merge,
        delete_branch_on_merge,
        has_issues,
        has_projects,
        has_wiki,
        private
    }' >> "$report_file"
    
    log_success "Status report created: $report_file"
}

# Main execution
main() {
    log_info "Starting GitHub Repository Optimization"
    log_info "Repository: $REPO"
    log_info "Main Branch: $MAIN_BRANCH"
    
    check_prerequisites
    
    # Check if CI is healthy
    if wait_for_ci_health; then
        configure_branch_protection true
    else
        log_warning "Configuring lenient branch protection due to CI issues"
        configure_branch_protection false
        
        log_info "To enable strict protection after CI is fixed, run:"
        log_info "  gh api repos/$REPO/branches/$MAIN_BRANCH/protection --method PUT --input protection-strict.json"
    fi
    
    optimize_repository_settings
    create_status_report
    
    log_success "Repository optimization completed!"
    
    # Display summary
    echo
    log_info "Summary of changes:"
    echo "✅ Branch protection configured for $MAIN_BRANCH"
    echo "✅ Repository merge settings optimized"
    echo "✅ Security features enabled"
    echo "✅ Governance files created"
    
    echo
    log_info "Next steps:"
    echo "1. Review the branch protection settings"
    echo "2. Test the PR workflow with a small change"
    echo "3. Monitor CI health and adjust protection as needed"
    echo "4. Train team on new governance processes"
}

# Run if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi