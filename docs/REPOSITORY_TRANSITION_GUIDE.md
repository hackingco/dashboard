# 🔄 Repository Transition Guide

## Dashboard Platform Repository Restructure

**Repository Name:** Dashboard (formerly PromptDash)  
**Repository URL:** https://github.com/hackingco/dashboard.git  
**Default Branch:** enterprise-swarm-platform  
**Current Branch:** dashboard  
**Transition Date:** July 13, 2025

---

## 📋 Transition Summary

### What Changed

1. **Repository Rebranding**
   - **Repository Name**: PromptDash → Dashboard
   - **Platform Identity**: Complete transformation to modern AI swarm orchestration platform
   - **Documentation**: Comprehensive enterprise-grade documentation overhaul

2. **Branch Structure Changes**
   - **Default Branch**: Changed to `enterprise-swarm-platform`
   - **Development Branch**: `dashboard` (current active branch)
   - **Legacy Branches**: Preserved with backup prefixes

3. **Architecture Evolution**
   - **Platform Type**: AI Swarm Orchestration Platform
   - **Components**: Admin Dashboard, Manager API, Worker Swarms
   - **Tech Stack**: Next.js, Express.js, Fly.io, Supabase

---

## 🚀 Team Transition Instructions

### For Existing Team Members

#### 1. Update Local Repository

```bash
# Navigate to your local repository
cd /path/to/your/local/repository

# Fetch latest changes from remote
git fetch --all

# Check current remote URL (should show new Dashboard URL)
git remote -v

# If remote URL is outdated, update it
git remote set-url origin https://github.com/hackingco/dashboard.git

# Switch to new default branch
git checkout enterprise-swarm-platform
git pull origin enterprise-swarm-platform

# Optional: Update your main development branch
git checkout dashboard
git pull origin dashboard
```

#### 2. Update Local Branch Tracking

```bash
# List all remote branches
git branch -r

# Set up tracking for new default branch
git checkout enterprise-swarm-platform
git branch --set-upstream-to=origin/enterprise-swarm-platform

# Set up tracking for active development branch
git checkout dashboard
git branch --set-upstream-to=origin/dashboard
```

#### 3. Clean Up Old References

```bash
# Remove old branch references (optional)
git remote prune origin

# Update your git configuration (if needed)
git config --global init.defaultBranch enterprise-swarm-platform
```

### For New Team Members

#### 1. Clone Repository

```bash
# Clone the renamed repository
git clone https://github.com/hackingco/dashboard.git
cd dashboard

# Check available branches
git branch -a

# Switch to active development branch
git checkout dashboard
```

#### 2. Environment Setup

```bash
# Install dependencies
pnpm install

# Build all applications
pnpm build

# Start development environment
pnpm dev
```

---

## 🔧 Development Workflow Changes

### New Branch Strategy

1. **enterprise-swarm-platform** (Default/Main)
   - Production-ready code
   - Requires PR review
   - Protected branch with CI/CD validation

2. **dashboard** (Active Development)
   - Current feature development
   - Integration testing
   - Pre-production validation

3. **Feature Branches**
   - Create from: `dashboard`
   - Merge to: `dashboard`
   - Format: `feature/description` or `fix/description`

### Updated PR Workflow

```bash
# Create feature branch from dashboard
git checkout dashboard
git pull origin dashboard
git checkout -b feature/your-feature-name

# Make your changes
# ... development work ...

# Commit changes
git add .
git commit -m "feat: add new feature description"

# Push to remote
git push origin feature/your-feature-name

# Create PR targeting 'dashboard' branch (not enterprise-swarm-platform)
```

### CI/CD Integration

All workflows have been updated to work with the new branch structure:
- **Target Branch**: Pull requests should target `dashboard`
- **Deployment**: Automatic deployment from `enterprise-swarm-platform`
- **Testing**: Comprehensive testing on all feature branches

---

## 📝 Retargeting Existing Pull Requests

### For Open Pull Requests

If you have open PRs targeting the old default branch:

1. **Via GitHub Web Interface**:
   - Go to your PR page
   - Click "Edit" next to the target branch
   - Change target from old branch to `dashboard`
   - Update PR description if needed

2. **Via Git Command Line**:
   ```bash
   # If your PR branch needs updating
   git checkout your-pr-branch
   git rebase dashboard
   git push --force-with-lease origin your-pr-branch
   ```

### For Draft PRs

1. Update target branch to `dashboard`
2. Ensure all CI checks pass
3. Request review when ready

---

## 🔒 Repository Settings Updates

### Branch Protection Rules

**enterprise-swarm-platform** (Protected):
- Require PR reviews (2 reviewers)
- Require status checks to pass
- Require branches to be up to date
- Restrict pushes (admin override only)

**dashboard** (Semi-Protected):
- Require PR reviews (1 reviewer)
- Require status checks to pass
- Allow direct pushes from maintainers

### Access Control

- **Maintainers**: Full access to all branches
- **Contributors**: Can create PRs to `dashboard`
- **Readers**: Can clone and view repository

---

## 🚨 Important Notes

### What You Need to Know

1. **Repository URL Changed**: Update bookmarks and local remotes
2. **Default Branch Changed**: New clones will start on `enterprise-swarm-platform`
3. **Active Development**: Use `dashboard` branch for feature development
4. **Documentation Updated**: Comprehensive new documentation available
5. **Platform Rebranded**: Now "Dashboard" - modern AI swarm orchestration platform

### Common Issues & Solutions

#### Issue: Git remote URL outdated
```bash
# Solution: Update remote URL
git remote set-url origin https://github.com/hackingco/dashboard.git
```

#### Issue: Default branch confusion
```bash
# Solution: Set correct upstream tracking
git checkout dashboard
git branch --set-upstream-to=origin/dashboard
```

#### Issue: Old branch references
```bash
# Solution: Clean up remote references
git fetch --prune origin
git remote prune origin
```

---

## 📞 Support & Help

### Getting Help

1. **Documentation**: Check `/docs` directory for detailed guides
2. **Issues**: Create GitHub issue for bugs or questions
3. **Discussions**: Use GitHub Discussions for general questions
4. **Team Chat**: Reach out in team communication channels

### Quick Commands Reference

```bash
# Essential commands for transition
git remote -v                                    # Check remote URL
git fetch --all                                  # Fetch all branches
git checkout enterprise-swarm-platform           # Switch to main branch
git checkout dashboard                            # Switch to dev branch
git status                                        # Check current status
git branch -vv                                    # Check tracking branches
```

---

## ✅ Transition Checklist

Use this checklist to ensure your transition is complete:

### For Existing Team Members
- [ ] Updated remote URL to new Dashboard repository
- [ ] Fetched all latest branches from remote
- [ ] Switched to `enterprise-swarm-platform` branch
- [ ] Set up tracking for `dashboard` development branch
- [ ] Updated local git configuration if needed
- [ ] Tested build and development setup
- [ ] Updated any local scripts or aliases
- [ ] Reviewed new documentation and workflows

### For New Team Members
- [ ] Cloned Dashboard repository successfully
- [ ] Checked out `dashboard` development branch
- [ ] Installed dependencies with `pnpm install`
- [ ] Successfully built project with `pnpm build`
- [ ] Started development environment with `pnpm dev`
- [ ] Reviewed repository documentation
- [ ] Set up development environment configuration
- [ ] Verified access to required services (Fly.io, Supabase, etc.)

### For Project Maintainers
- [ ] Verified all team members have updated their local repositories
- [ ] Updated CI/CD configurations for new branch structure
- [ ] Updated documentation and deployment scripts
- [ ] Verified branch protection rules are correctly configured
- [ ] Updated any external integrations or webhooks
- [ ] Notified stakeholders about repository changes
- [ ] Updated project management tools and trackers
- [ ] Validated all existing functionality works correctly

---

## 🎯 Next Steps

After completing your transition:

1. **Start Development**: Begin using the new `dashboard` branch for feature development
2. **Review Documentation**: Familiarize yourself with updated platform documentation
3. **Test Integration**: Verify your development environment works correctly
4. **Provide Feedback**: Report any issues or suggestions for improvement

---

**🚀 Welcome to the Dashboard Platform - Modern AI Swarm Orchestration**

*This transition marks our evolution to a comprehensive enterprise-grade platform for distributed AI computing.*