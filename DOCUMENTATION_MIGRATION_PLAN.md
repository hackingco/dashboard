# Documentation Migration Plan

## Overview
This document outlines the comprehensive migration plan for organizing documentation across 9 identified projects in the swarm03 repository.

## Current State Analysis

### Documentation Distribution
- **Root level**: 93+ markdown files (scattered, unorganized)
- **Project-specific**: Documentation embedded within individual projects
- **Shared docs**: Mixed organizational patterns
- **Status**: Requires systematic reorganization

## Target Organization Structure

### 1. claude-flow (MCP Server)
```
claude-flow/
├── README.md                    # Main project readme
├── docs/
│   ├── getting-started.md      # Quick start guide
│   ├── api-reference.md        # API documentation
│   ├── architecture.md         # System architecture
│   ├── configuration.md        # Config options
│   ├── deployment.md          # Deployment guide
│   ├── troubleshooting.md     # Common issues
│   └── examples/
│       ├── basic-usage.md
│       ├── advanced-config.md
│       └── integration-examples.md
└── CHANGELOG.md               # Version history
```

### 2. swarm-platform (Core Orchestration)
```
swarm-platform/
├── README.md                    # Platform overview
├── docs/
│   ├── architecture/
│   │   ├── overview.md
│   │   ├── components.md
│   │   └── data-flow.md
│   ├── guides/
│   │   ├── quick-start.md
│   │   ├── installation.md
│   │   ├── configuration.md
│   │   └── deployment.md
│   ├── api/
│   │   ├── rest-api.md
│   │   ├── websockets.md
│   │   └── webhooks.md
│   ├── integrations/
│   │   ├── langfuse.md
│   │   ├── supabase.md
│   │   └── docker.md
│   └── development/
│       ├── contributing.md
│       ├── testing.md
│       └── debugging.md
└── SECURITY.md                 # Security policies
```

### 3. swarm-dashboard (Next.js Dashboard)
```
swarm-dashboard/
├── README.md                    # Dashboard overview
├── docs/
│   ├── user-guide/
│   │   ├── overview.md
│   │   ├── navigation.md
│   │   ├── monitoring.md
│   │   └── management.md
│   ├── development/
│   │   ├── setup.md
│   │   ├── components.md
│   │   ├── api-integration.md
│   │   └── testing.md
│   └── deployment/
│       ├── build-process.md
│       ├── environment-config.md
│       └── hosting.md
└── CONTRIBUTING.md             # Contribution guidelines
```

### 4. swarm-admin-ui (Vite Admin Dashboard)
```
swarm-admin-ui/
├── README.md                    # Admin UI overview
├── docs/
│   ├── setup.md               # Development setup
│   ├── features.md            # Feature documentation
│   ├── configuration.md       # Config options
│   └── deployment.md          # Deployment guide
└── CHANGELOG.md               # Version history
```

### 5. hive-mind (Coordination Service)
```
hive-mind/
├── README.md                    # Service overview
├── docs/
│   ├── architecture.md        # Service architecture
│   ├── api-reference.md       # API documentation
│   ├── configuration.md       # Config options
│   ├── deployment.md          # Deployment guide
│   └── troubleshooting.md     # Common issues
└── CHANGELOG.md               # Version history
```

### 6. langfuse-wrapper (Shared Library)
```
langfuse-wrapper/
├── README.md                    # Library overview
├── docs/
│   ├── installation.md        # Installation guide
│   ├── api-reference.md       # API documentation
│   ├── examples/
│   │   ├── basic-usage.md
│   │   ├── advanced-config.md
│   │   └── integration.md
│   └── troubleshooting.md     # Common issues
└── CHANGELOG.md               # Version history
```

### 7. langfuse-api-tools (API Key Management)
```
langfuse-api-tools/
├── README.md                    # Tools overview
├── docs/
│   ├── cli-reference.md       # CLI documentation
│   ├── api-reference.md       # API documentation
│   ├── dashboard-guide.md     # Dashboard usage
│   ├── security.md           # Security practices
│   └── examples/
│       ├── rotation.md
│       └── monitoring.md
└── CHANGELOG.md               # Version history
```

### 8. claude-flow-trace (Tracing Library)
```
claude-flow-trace/
├── README.md                    # Library overview
├── docs/
│   ├── installation.md        # Installation guide
│   ├── api-reference.md       # API documentation
│   ├── configuration.md       # Config options
│   ├── examples/
│   │   ├── basic-tracing.md
│   │   ├── advanced-features.md
│   │   └── integration.md
│   └── performance.md         # Performance guide
└── CHANGELOG.md               # Version history
```

### 9. swarm-trace-viewer (Trace Visualization)
```
swarm-trace-viewer/
├── README.md                    # Viewer overview
├── docs/
│   ├── user-guide.md         # User documentation
│   ├── setup.md              # Development setup
│   ├── features.md           # Feature documentation
│   └── deployment.md         # Deployment guide
└── CHANGELOG.md               # Version history
```

## Migration Strategy

### Phase 1: Preparation
1. **Audit existing documentation** - Catalog all markdown files
2. **Identify ownership** - Map files to target projects
3. **Create migration matrix** - Document source → destination mappings
4. **Backup current state** - Ensure safe migration process

### Phase 2: Structure Creation
1. **Create target directories** - Set up new documentation structures
2. **Generate template files** - Create consistent README templates
3. **Establish conventions** - Define naming and organization standards

### Phase 3: Content Migration
1. **Migrate project-specific docs** - Move files to appropriate projects
2. **Update cross-references** - Fix internal links and references
3. **Consolidate duplicates** - Merge redundant documentation
4. **Update README files** - Ensure proper documentation discovery

### Phase 4: Validation
1. **Link verification** - Check all internal and external links
2. **Content review** - Ensure documentation is current and accurate
3. **Navigation testing** - Verify easy access to all documentation
4. **Cleanup** - Remove obsolete or duplicate files

## File Migration Matrix

### Core Platform Documentation (to swarm-platform)
- `README.md` → `swarm-platform/README.md` (enhanced)
- `ARCHITECTURE-V2.md` → `swarm-platform/docs/architecture/overview.md`
- `DEPLOYMENT_*.md` → `swarm-platform/docs/guides/deployment.md` (consolidated)
- `DOCKER_*.md` → `swarm-platform/docs/integrations/docker.md` (consolidated)
- `SECURITY_*.md` → `swarm-platform/SECURITY.md` (consolidated)

### Dashboard Documentation (to swarm-dashboard)
- `apps/dashboard/README.md` → `swarm-dashboard/README.md`
- `DASHBOARD_*.md` → `swarm-dashboard/docs/` (organized by category)
- `REAL_TIME_DASHBOARD_*.md` → `swarm-dashboard/docs/features/real-time.md`

### Claude Flow Documentation (to claude-flow)
- `claude-flow/README.md` → `claude-flow/README.md` (enhanced)
- `CLAUDE_FLOW_*.md` → `claude-flow/docs/` (organized)
- `claude-flow/docs/` → `claude-flow/docs/` (restructured)

### Langfuse Documentation (distributed)
- `LANGFUSE_*.md` → Split between `langfuse-wrapper/docs/` and `langfuse-api-tools/docs/`
- `api-key-management/README.md` → `langfuse-api-tools/README.md`

### Tracing Documentation (to claude-flow-trace and swarm-trace-viewer)
- `claude-flow-trace/README.md` → `claude-flow-trace/README.md`
- `swarm-tracing-dashboard/` → `swarm-trace-viewer/docs/`

### Testing and Validation Documentation
- `*_TEST_*.md` → Distributed to appropriate project test documentation
- `QA_*.md` → `swarm-platform/docs/development/testing.md`

### Legacy/Archive Documentation
- Obsolete status reports → `docs/archive/` in relevant projects
- Duplicate files → Consolidated or removed
- Outdated guides → Updated or removed

## Implementation Plan

### Immediate Actions (Coder 1)
1. Create target directory structures for all 9 projects
2. Generate template README files for each project
3. Begin migration of claude-flow documentation (self-contained)
4. Migrate admin-dashboard documentation (standalone)

### Parallel Actions (Coder 2)
1. Audit and categorize all root-level markdown files
2. Create migration mapping spreadsheet
3. Begin migration of langfuse-related documentation
4. Update cross-references in migrated files

### Coordination Requirements
- Use shared memory for tracking migration progress
- Regular status updates via hooks
- Validate no documentation is lost during migration
- Ensure git history preservation where possible

## Success Criteria
1. **Organization**: Clear, logical documentation structure for each project
2. **Accessibility**: Easy discovery and navigation of documentation
3. **Completeness**: No documentation lost during migration
4. **Consistency**: Uniform formatting and organization across projects
5. **Maintainability**: Clear ownership and update processes for each project

## Risk Mitigation
- **Backup strategy**: Git history preservation
- **Validation process**: Comprehensive link and content checking
- **Rollback plan**: Ability to revert changes if issues discovered
- **Communication**: Clear coordination between agents working on migration