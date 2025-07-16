#!/bin/bash
# Script to push remaining repositories to GitHub
# Run this script after configuring GitHub authentication

echo "🚀 Pushing remaining repositories to GitHub..."
echo "Note: This requires GitHub authentication (personal access token or SSH key)"
echo ""

# Function to push a repository
push_repo() {
    local dir=$1
    local name=$2
    
    if [ -d "$dir" ]; then
        echo "📦 Pushing $name..."
        git -C "$dir" push -u origin main
        if [ $? -eq 0 ]; then
            echo "✅ $name pushed successfully!"
        else
            echo "❌ Failed to push $name - authentication required"
        fi
        echo ""
    else
        echo "⚠️  Directory not found: $dir"
    fi
}

# Push claude-flow
push_repo "/tmp/claude-flow-extract/claude-flow" "claude-flow"

# Push hive-mind  
push_repo "/tmp/hive-mind-extract" "hive-mind"

# Push swarm-dashboard
push_repo "/tmp/swarm-dashboard-extract" "swarm-dashboard"

# Push langfuse-wrapper
push_repo "/tmp/langfuse-wrapper-extract" "langfuse-wrapper"

echo "📊 Push Summary:"
echo "If any repositories failed to push, please:"
echo "1. Configure GitHub authentication:"
echo "   - Personal Access Token: gh auth login"
echo "   - SSH Key: Add your SSH key to GitHub"
echo "2. Run this script again"
echo ""
echo "🔐 IMPORTANT: Remember to revoke the exposed API keys listed in SECURITY_SCAN_REPORT.md"