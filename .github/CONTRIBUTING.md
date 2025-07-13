# Contributing to Hive Mind Swarm Platform

Thank you for your interest in contributing to the Hive Mind enterprise swarm orchestration platform! This guide will help you get started.

## 🚀 Quick Start

1. **Fork and Clone**
   ```bash
   gh repo fork hackingco/dashboard
   git clone https://github.com/YOUR_USERNAME/dashboard.git
   cd dashboard
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Set Up Environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Run Development Server**
   ```bash
   pnpm dev
   ```

## 📋 Development Guidelines

### Branch Naming Convention
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `perf/description` - Performance improvements

### Commit Message Format
We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

**Examples:**
- `feat(dashboard): add swarm orchestration interface`
- `fix(manager): resolve agent coordination race condition`
- `docs(api): update endpoint documentation`

### Pull Request Process

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes and Test**
   ```bash
   pnpm test
   pnpm lint
   pnpm typecheck
   ```

3. **Create Pull Request**
   - Use descriptive title following conventional commit format
   - Fill out the PR template completely
   - Link relevant issues
   - Request review from appropriate code owners

### Code Quality Standards

#### TypeScript
- All new code must be TypeScript
- Maintain strict type checking
- Use proper interfaces and types
- No `any` types without justification

#### Testing
- Write unit tests for new functionality
- Maintain >70% code coverage
- Include integration tests for API endpoints
- Add E2E tests for critical user flows

#### Code Style
- Use Prettier for formatting
- Follow ESLint rules
- Use meaningful variable names
- Add JSDoc comments for complex functions

## 🏗️ Architecture Guidelines

### Monorepo Structure
```
apps/
├── dashboard/    # Next.js frontend
├── manager/      # Hive Mind coordination service
└── worker/       # Worker node implementation

shared/
├── types/        # Shared TypeScript types
├── utils/        # Common utilities
└── config/       # Shared configuration

packages/
└── claude-flow/  # Core orchestration package
```

### API Design
- Use RESTful conventions
- Include proper error handling
- Implement rate limiting
- Document with OpenAPI/Swagger

### Database
- Use Prisma for schema management
- Write reversible migrations
- Follow naming conventions
- Index performance-critical queries

## 🧪 Testing Strategy

### Test Types
1. **Unit Tests** - Individual function/component testing
2. **Integration Tests** - API endpoint and service integration
3. **E2E Tests** - Full user workflow testing
4. **Performance Tests** - Load and stress testing

### Running Tests
```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit
pnpm test:integration
pnpm test:e2e

# Run with coverage
pnpm test:coverage

# Run performance tests
pnpm test:performance
```

## 🔧 Local Development

### Prerequisites
- Node.js 18+
- pnpm 8+
- PostgreSQL 15+
- Docker (for services)

### Environment Setup
```bash
# Database setup
docker-compose up -d postgres

# Run migrations
pnpm db:migrate

# Seed test data
pnpm db:seed
```

### Available Scripts
```bash
pnpm dev          # Start development servers
pnpm build        # Build all applications
pnpm lint         # Run linting
pnpm lint:fix     # Fix linting issues
pnpm typecheck    # TypeScript checking
pnpm format       # Format code with Prettier
```

## 📝 Documentation

### Adding Documentation
- Update README files for significant changes
- Document new APIs in OpenAPI format
- Add JSDoc comments for complex functions
- Update architecture diagrams when needed

### Documentation Structure
- `/docs/` - High-level documentation
- `/apps/*/README.md` - Application-specific docs
- Inline code comments for complex logic

## 🔒 Security Guidelines

### Security Practices
- Never commit secrets or API keys
- Use environment variables for configuration
- Implement proper authentication/authorization
- Validate all inputs
- Use HTTPS in production

### Reporting Security Issues
Please report security vulnerabilities privately to: security@example.com

## 🐛 Bug Reports

### Before Submitting
1. Check existing issues
2. Reproduce the bug
3. Gather relevant information:
   - OS and browser versions
   - Steps to reproduce
   - Expected vs actual behavior
   - Error messages/logs

### Bug Report Template
```markdown
**Describe the bug**
A clear description of the issue.

**To Reproduce**
Steps to reproduce the behavior.

**Expected behavior**
What should have happened.

**Environment**
- OS: [e.g., macOS 13.1]
- Browser: [e.g., Chrome 108]
- Node.js: [e.g., 18.12.0]
```

## 🚀 Feature Requests

### Proposing Features
1. Check existing feature requests
2. Create detailed proposal with:
   - Use case description
   - Proposed solution
   - Alternative approaches
   - Implementation considerations

## 🏆 Recognition

Contributors will be recognized in:
- Changelog for releases
- GitHub contributors page
- Annual contributor highlights

## 📞 Getting Help

- **GitHub Discussions** - General questions and ideas
- **GitHub Issues** - Bug reports and feature requests
- **Discord** - Real-time community chat
- **Email** - Direct contact for sensitive topics

## 📄 License

By contributing, you agree that your contributions will be licensed under the project's license terms.

---

Thank you for contributing to the Hive Mind platform! 🐝✨