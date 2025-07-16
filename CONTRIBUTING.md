# Contributing to Claude Flow Trace

First off, thank you for considering contributing to Claude Flow Trace! It's people like you that make Claude Flow Trace such a great tool for the AI orchestration community.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title** for the issue to identify the problem
* **Describe the exact steps which reproduce the problem** in as many details as possible
* **Provide specific examples to demonstrate the steps**
* **Describe the behavior you observed after following the steps**
* **Explain which behavior you expected to see instead and why**
* **Include screenshots and animated GIFs** if possible
* **Include your environment details** (OS, Node.js version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title** for the issue
* **Provide a step-by-step description of the suggested enhancement**
* **Provide specific examples to demonstrate the steps**
* **Describe the current behavior** and **explain which behavior you expected to see instead**
* **Explain why this enhancement would be useful** to most users

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Development Process

### Setting Up Your Environment

```bash
# Clone your fork
git clone https://github.com/your-username/claude-flow-trace.git
cd claude-flow-trace

# Install dependencies
pnpm install

# Create a branch
git checkout -b feature/your-feature-name
```

### Development Workflow

1. **Make your changes** in a feature branch
2. **Write or update tests** for your changes
3. **Run tests** to ensure everything works:
   ```bash
   pnpm test
   pnpm test:unit
   pnpm test:integration
   pnpm test:e2e
   ```
4. **Check linting**:
   ```bash
   pnpm lint
   pnpm format:check
   ```
5. **Build the project**:
   ```bash
   pnpm build
   ```

### Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

* `feat:` - New features
* `fix:` - Bug fixes
* `docs:` - Documentation changes
* `style:` - Code style changes (formatting, etc.)
* `refactor:` - Code refactoring
* `test:` - Test additions or modifications
* `chore:` - Maintenance tasks
* `perf:` - Performance improvements

Examples:
```
feat: add real-time swarm monitoring dashboard
fix: resolve WebSocket connection timeout issue
docs: update API documentation for v2 endpoints
```

### Testing

* **Unit Tests**: Test individual components and functions
* **Integration Tests**: Test API endpoints and service interactions
* **E2E Tests**: Test complete user workflows
* **Performance Tests**: Ensure performance benchmarks are met

All tests must pass before a PR can be merged.

### Code Style

* We use TypeScript with strict mode enabled
* Follow the existing code style (enforced by ESLint and Prettier)
* Use meaningful variable and function names
* Add comments for complex logic
* Keep functions focused and small
* Follow SOLID principles

### Documentation

* Update README.md if you change functionality
* Add JSDoc comments to new functions and classes
* Update API documentation for endpoint changes
* Include examples in your documentation

## Project Structure

```
claude-flow-trace/
├── apps/
│   ├── dashboard/      # Next.js frontend application
│   ├── manager/        # Express.js API server
│   └── worker/         # Worker agent implementation
├── shared/
│   ├── config/         # Shared configuration
│   └── types/          # Shared TypeScript types
├── tests/              # Test suites
├── docs/               # Documentation
└── scripts/            # Build and deployment scripts
```

## Review Process

1. A maintainer will review your PR
2. They may request changes or ask questions
3. Once approved, your PR will be merged
4. Your contribution will be included in the next release!

## Community

* Join our [Discord](https://discord.gg/claude-flow) for discussions
* Follow us on [Twitter](https://twitter.com/claudeflow) for updates
* Check out our [blog](https://blog.claude-flow.com) for tutorials

## Recognition

Contributors will be recognized in:
* The project README
* Release notes
* Our website's contributors page

Thank you for contributing to Claude Flow Trace! 🎉