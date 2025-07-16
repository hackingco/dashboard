# GitHub Migration Plan for Hive Mind Projects

## Overview
This plan outlines the migration of the hive mind monorepo into separate GitHub repositories under github.com/hackingco.

## Security Status
- ✅ Removed tracked sensitive files from git
- ✅ Updated .gitignore to prevent future exposure
- ⚠️ **ACTION REQUIRED**: Revoke exposed API keys immediately

## Identified Projects for Migration

### 1. **claude-flow** (Main MCP Tool)
- **Path**: `/claude-flow`
- **Type**: Standalone project
- **Repo**: `github.com/hackingco/claude-flow`
- **Description**: Docker-based Claude agent orchestration with MCP

### 2. **hive-mind** (Collective Intelligence)
- **Path**: `/apps/hive-mind`
- **Type**: Monorepo component
- **Repo**: `github.com/hackingco/hive-mind`
- **Description**: Coordination service for collective intelligence

### 3. **swarm-dashboard** (Web Dashboard)
- **Path**: `/apps/dashboard`
- **Type**: Monorepo component
- **Repo**: `github.com/hackingco/swarm-dashboard`
- **Description**: Next.js web dashboard for swarm monitoring

### 4. **admin-dashboard** (Admin Interface)
- **Path**: `/admin-dashboard`
- **Type**: Standalone project
- **Repo**: `github.com/hackingco/admin-dashboard`
- **Description**: Vite React admin interface

### 5. **langfuse-wrapper** (Shared Library)
- **Path**: `/shared/langfuse-wrapper`
- **Type**: Monorepo component
- **Repo**: `github.com/hackingco/langfuse-wrapper`
- **Description**: NPM package for Langfuse integration

### 6. **api-key-management** (API Key Tools)
- **Path**: `/api-key-management`
- **Type**: Standalone project
- **Repo**: `github.com/hackingco/api-key-management`
- **Description**: Comprehensive Langfuse API key management

### 7. **claude-flow-trace** (Tracing Library)
- **Path**: `/claude-flow-trace`
- **Type**: Standalone project
- **Repo**: `github.com/hackingco/claude-flow-trace`
- **Description**: Advanced tracing and observability

### 8. **swarm-tracing-dashboard** (Trace Visualization)
- **Path**: `/swarm-tracing-dashboard`
- **Type**: Standalone project
- **Repo**: `github.com/hackingco/swarm-tracing-dashboard`
- **Description**: React-based trace visualization

### 9. **swarm-orchestration** (Root Platform)
- **Path**: `/` (root)
- **Type**: Monorepo refactor
- **Repo**: `github.com/hackingco/swarm-orchestration`
- **Description**: Core orchestration platform and infrastructure

## Migration Order

### Phase 1: Standalone Projects (Easy)
1. claude-flow
2. admin-dashboard
3. api-key-management
4. claude-flow-trace
5. swarm-tracing-dashboard

### Phase 2: Shared Libraries
6. langfuse-wrapper (publish to npm)

### Phase 3: Monorepo Components
7. hive-mind
8. swarm-dashboard

### Phase 4: Root Platform
9. swarm-orchestration (refactored root)

## Pre-Migration Checklist
- [x] Remove tracked sensitive files
- [x] Update .gitignore
- [ ] Revoke exposed API keys
- [ ] Create clean .env.example files
- [ ] Verify no secrets in git history
- [ ] Create GitHub repositories
- [ ] Set up CI/CD for each repo

## Post-Migration Tasks
- [ ] Update dependency references
- [ ] Set up npm publishing for shared libs
- [ ] Configure GitHub Actions
- [ ] Update documentation
- [ ] Set up proper secret management