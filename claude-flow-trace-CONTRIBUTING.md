# Contributing to Claude Flow Trace

🎉 First off, thank you for considering contributing to Claude Flow Trace! 🎉

Claude Flow Trace is an open-source project that thrives on community contributions. Whether you're fixing bugs, adding features, improving documentation, or sharing ideas, your input is valued and appreciated.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Community](#community)

## 📜 Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). We are committed to providing a welcoming and inclusive environment for all contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git
- Basic understanding of:
  - JavaScript/TypeScript
  - Claude Flow ecosystem
  - Observability concepts
  - REST APIs and WebSockets

### Finding Issues

Looking for ways to contribute? Check out:

- 🐛 [Bug Reports](https://github.com/ruvnet/claude-flow-trace/labels/bug)
- ✨ [Feature Requests](https://github.com/ruvnet/claude-flow-trace/labels/enhancement)
- 📚 [Documentation](https://github.com/ruvnet/claude-flow-trace/labels/documentation)
- 🎯 [Good First Issues](https://github.com/ruvnet/claude-flow-trace/labels/good%20first%20issue)

## 🤝 How to Contribute

### Reporting Bugs

Found a bug? Help us fix it by creating a detailed bug report:

1. **Check existing issues** to avoid duplicates
2. **Create a new issue** using the bug report template
3. **Include**:
   - Clear description of the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - System information
   - Error messages/logs
   - Screenshots if applicable

### Suggesting Features

Have an idea for improvement? We'd love to hear it:

1. **Check existing feature requests**
2. **Create a new issue** using the feature request template
3. **Include**:
   - Clear description of the feature
   - Use cases and benefits
   - Potential implementation approach
   - Alternative solutions considered

### Improving Documentation

Documentation improvements are always welcome:

- Fix typos or clarify existing docs
- Add examples and use cases
- Create tutorials or guides
- Improve API documentation
- Translate documentation

## 💻 Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/claude-flow-trace.git
cd claude-flow-trace
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment

```bash
# Copy example environment file
cp .env.example .env

# Configure your settings
nano .env
```

### 4. Run Development Mode

```bash
# Start the trace collector in dev mode
npm run dev

# In another terminal, run the test client
npm run client
```

### 5. Create a Branch

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Or a bugfix branch
git checkout -b fix/issue-description
```

## 🧪 Testing Guidelines

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test suite
npm test -- collector.test.js

# Run with coverage
npm run test:coverage
```

### Writing Tests

All new features and bug fixes should include tests:

```javascript
// Example test structure
describe('TraceCollector', () => {
  describe('addTrace', () => {
    it('should deduplicate traces within time window', () => {
      // Test implementation
    });
  });
});
```

### Test Requirements

- Unit tests for new functions/methods
- Integration tests for API endpoints
- E2E tests for critical workflows
- Minimum 80% code coverage
- All tests must pass before PR merge

## 🔄 Pull Request Process

### 1. Before Submitting

- [ ] Code follows style guidelines
- [ ] All tests pass locally
- [ ] Documentation is updated
- [ ] Commit messages follow conventions
- [ ] Branch is up-to-date with main

### 2. PR Guidelines

#### Title Format
```
type(scope): Brief description

Examples:
feat(collector): Add Redis storage backend
fix(api): Handle null traces in search endpoint
docs(readme): Update installation instructions
```

#### Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guide
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes
```

### 3. Review Process

1. Automated checks run (tests, linting)
2. Code review by maintainers
3. Address feedback
4. Approval and merge

## 🎨 Style Guidelines

### JavaScript/TypeScript

We use ESLint and Prettier for consistent code style:

```bash
# Format code
npm run format

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Code Conventions

```javascript
// Use meaningful variable names
const traceData = await collector.getTrace(id);  // ✅
const td = await c.gt(i);                        // ❌

// Add JSDoc comments for functions
/**
 * Adds a new trace to the collector
 * @param {Object} trace - The trace object to add
 * @returns {string} The trace ID
 */
function addTrace(trace) {
  // Implementation
}

// Use async/await over callbacks
async function processTrace(id) {  // ✅
  const trace = await getTrace(id);
  return processData(trace);
}
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format
type(scope): subject

# Types
feat:     New feature
fix:      Bug fix
docs:     Documentation changes
style:    Code style changes (formatting, etc)
refactor: Code refactoring
perf:     Performance improvements
test:     Test additions/changes
chore:    Build process or auxiliary tool changes

# Examples
feat(api): Add batch trace submission endpoint
fix(collector): Prevent duplicate trace IDs
docs(readme): Add WebSocket usage examples
```

## 🌐 Community

### Getting Help

- 💬 [GitHub Discussions](https://github.com/ruvnet/claude-flow-trace/discussions)
- 🔧 [Stack Overflow](https://stackoverflow.com/questions/tagged/claude-flow-trace)
- 📧 Email: claude-flow-trace@example.com

### Stay Updated

- ⭐ Star the repository
- 👁️ Watch for updates
- 📢 Follow [@claudeflow](https://twitter.com/claudeflow)

## 🏆 Recognition

Contributors are recognized in:

- [CONTRIBUTORS.md](CONTRIBUTORS.md)
- Release notes
- Project documentation

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

<div align="center">
  Thank you for helping make Claude Flow Trace better! 🚀
</div>