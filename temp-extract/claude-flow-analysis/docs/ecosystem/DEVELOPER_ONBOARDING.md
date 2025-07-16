# Claude Flow Developer Onboarding Guide

Welcome to the Claude Flow ecosystem! This guide will get you up and running with Claude Flow development in under 30 minutes.

## 🎯 Prerequisites

### Required Software
- **Node.js 20+**: [Download here](https://nodejs.org/)
- **npm 9+**: Comes with Node.js
- **Git**: [Download here](https://git-scm.com/)
- **VS Code** (recommended): [Download here](https://code.visualstudio.com/)

### Recommended VS Code Extensions
```bash
# Install via VS Code or command line
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension esbenp.prettier-vscode
code --install-extension ms-vscode.vscode-eslint
code --install-extension bradlc.vscode-tailwindcss
code --install-extension ms-vscode.vscode-json
```

## 🚀 Quick Start (5 minutes)

### 1. Clone and Setup
```bash
# Clone the repository
git clone https://github.com/ruvnet/claude-code-flow.git
cd claude-code-flow

# Automated setup (installs dependencies, configures environment)
npm run ecosystem:setup
```

### 2. Verify Installation
```bash
# Check ecosystem health
npm run ecosystem:status

# Run basic tests
npm run test:packages
```

### 3. Start Development
```bash
# Start the development environment
npm run dev

# In another terminal, start monitoring
npm run dev:monitoring
```

## 📁 Repository Structure

```
claude-code-flow/
├── packages/                    # Ecosystem packages
│   ├── shared-config/          # @claude-flow/config
│   ├── integration/            # @claude-flow/integration
│   └── templates/              # @claude-flow/templates
├── src/                        # Core claude-flow source
│   ├── cli/                    # Command line interface
│   ├── swarm/                  # Swarm coordination
│   ├── memory/                 # Memory management
│   └── monitoring/             # Health and diagnostics
├── cli-instrumentation/        # CLI monitoring tools
├── examples/                   # Example projects
├── scripts/                    # Development scripts
├── docs/                       # Documentation
└── tests/                      # Test suites
```

## 🔧 Development Environment

### Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit with your configuration
nano .env
```

### Key Environment Variables
```bash
# Development settings
NODE_ENV=development
LOG_LEVEL=debug

# Langfuse integration (optional)
LANGFUSE_PUBLIC_KEY=your_key_here
LANGFUSE_SECRET_KEY=your_secret_here

# Swarm configuration
SWARM_MAX_AGENTS=8
SWARM_TOPOLOGY=hierarchical
```

## 🛠️ Development Workflow

### Daily Development Cycle
```bash
# 1. Start your day
git pull origin main
npm run ecosystem:status

# 2. Create feature branch
git checkout -b feature/your-feature-name

# 3. Make changes and test
npm run test:watch  # Run tests in watch mode

# 4. Before committing
npm run lint:packages
npm run format:packages
npm run test:packages

# 5. Commit and push
git add .
git commit -m "feat: describe your changes"
git push origin feature/your-feature-name
```

### Package Development
```bash
# Create new package
mkdir packages/my-new-package
cd packages/my-new-package

# Initialize with shared config
npm init -y
npm install @claude-flow/config --save-dev

# Use shared configurations
echo '{"extends": "@claude-flow/config/tsconfig/node.json"}' > tsconfig.json
echo 'module.exports = require("@claude-flow/config/eslint/base");' > .eslintrc.js
```

## 🧪 Testing Strategy

### Test Types and Commands
```bash
# Unit tests (fast, isolated)
npm run test:unit

# Integration tests (cross-package)
npm run test:integration

# End-to-end tests (full workflow)
npm run test:e2e

# Performance tests
npm run test:performance

# All tests with coverage
npm run test:coverage
```

### Writing Tests
```typescript
// Example test structure
import { createSwarmInstance } from '@claude-flow/integration';

describe('SwarmInstance', () => {
  it('should create a swarm with default configuration', async () => {
    const swarm = await createSwarmInstance();
    expect(swarm).toBeDefined();
    expect(swarm.topology).toBe('hierarchical');
  });
});
```

## 📦 Working with Packages

### Package Types
1. **Core Package** (`claude-flow`): Main orchestration engine
2. **Tool Packages** (`@claude-flow/*`): Specialized utilities
3. **Template Packages**: Project scaffolding
4. **Example Packages**: Reference implementations

### Adding Dependencies
```bash
# To specific package
cd packages/integration
npm install new-dependency

# To root (affects all packages)
npm install new-dependency

# Development dependency
npm install new-dependency --save-dev
```

### Building Packages
```bash
# Build all packages
npm run build:packages

# Build specific package
cd packages/integration
npm run build

# Watch mode
npm run build:watch
```

## 🔍 Debugging and Troubleshooting

### Common Issues and Solutions

#### "Module not found" errors
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### TypeScript compilation errors
```bash
# Check TypeScript configuration
npm run typecheck:packages

# Rebuild type definitions
npm run build:packages
```

#### Test failures
```bash
# Run tests with verbose output
npm run test:packages -- --verbose

# Run specific test
npm test -- --testNamePattern="SwarmInstance"
```

### Debug Tools
```bash
# System diagnostics
npm run diagnostics

# Health check
npm run health-check

# Performance analysis
npm run test:performance
```

## 🎨 Code Style and Standards

### Code Formatting
- **Prettier**: Automatic code formatting
- **ESLint**: Code quality and consistency
- **TypeScript**: Type safety and modern JavaScript features

### Commit Convention
```bash
# Format: type(scope): description
feat(swarm): add new coordination algorithm
fix(memory): resolve memory leak in cache
docs(readme): update installation instructions
test(integration): add cross-package validation
```

### Code Review Checklist
- [ ] All tests pass
- [ ] Code follows style guidelines
- [ ] TypeScript types are properly defined
- [ ] Documentation is updated
- [ ] Breaking changes are documented
- [ ] Performance impact is considered

## 📚 Learning Resources

### Essential Reading
1. **[Architecture Overview](./ECOSYSTEM_OVERVIEW.md)**: System design and relationships
2. **[Integration Guide](./integration-guide.md)**: Cross-package coordination
3. **[API Reference](../api/)**: Complete API documentation
4. **[Examples](../../examples/)**: Working code examples

### Video Tutorials
- Setting up development environment
- Creating your first swarm
- Package integration patterns
- Performance optimization techniques

### Interactive Examples
```bash
# Run interactive examples
cd examples/basic-usage
npm install
npm start

# Try different swarm topologies
cd examples/swarm-topologies
npm run demo:hierarchical
npm run demo:mesh
npm run demo:ring
```

## 🤝 Contributing Guidelines

### Before Contributing
1. Read the [Contributing Guide](../../CONTRIBUTING.md)
2. Check existing [GitHub Issues](https://github.com/ruvnet/claude-code-flow/issues)
3. Join our [Discord Community](https://discord.gg/claude-flow)

### Contribution Process
1. **Fork** the repository
2. **Create** a feature branch
3. **Implement** your changes
4. **Test** thoroughly
5. **Document** your changes
6. **Submit** a pull request

### Getting Help
- **GitHub Discussions**: Ask questions and share ideas
- **Stack Overflow**: Use tag `claude-flow`
- **Discord**: Real-time community support
- **Email Support**: enterprise@claude-flow.com

## 🎓 Next Steps

### Beginner Tasks
- [ ] Complete the quick start guide
- [ ] Explore example projects
- [ ] Create a simple swarm application
- [ ] Run the test suite

### Intermediate Tasks
- [ ] Implement a custom agent type
- [ ] Create a package integration
- [ ] Contribute to documentation
- [ ] Add test coverage

### Advanced Tasks
- [ ] Develop a new ecosystem package
- [ ] Implement performance optimizations
- [ ] Create architectural improvements
- [ ] Mentor new contributors

## 📊 Development Metrics

Track your progress with these metrics:
- **Code Coverage**: Target 80%+ for new code
- **Performance**: No regressions in benchmark tests
- **Documentation**: 100% of public APIs documented
- **Type Safety**: 100% TypeScript coverage

## 🚀 Productive Development Tips

### VS Code Setup
```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "jest.autoEnable": true
}
```

### Git Hooks
Pre-commit hooks are automatically installed to ensure code quality:
- Lint all changed files
- Run tests for affected packages
- Format code automatically
- Check for type errors

### Performance Monitoring
```bash
# Monitor build performance
npm run build:packages -- --profile

# Analyze bundle sizes
npm run analyze:bundles

# Profile memory usage
npm run profile:memory
```

---

Welcome to the Claude Flow ecosystem! We're excited to have you as part of our community. If you have any questions, don't hesitate to reach out through our community channels.

Happy coding! 🚀