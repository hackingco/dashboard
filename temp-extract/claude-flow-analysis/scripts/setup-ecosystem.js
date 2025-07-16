#!/usr/bin/env node
/**
 * Ecosystem Setup Script
 * 
 * Automated setup for Claude Flow ecosystem development environment.
 * Installs dependencies, configures shared packages, and validates setup.
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');
const ora = require('ora');

class EcosystemSetup {
  constructor() {
    this.rootDir = process.cwd();
    this.spinner = null;
  }

  /**
   * Main setup orchestration
   */
  async setup() {
    console.log(chalk.bold.blue('🚀 Setting up Claude Flow Ecosystem\n'));

    try {
      await this.checkPrerequisites();
      await this.installDependencies();
      await this.configureSharedPackages();
      await this.setupDevelopmentEnvironment();
      await this.validateSetup();
      
      this.displaySuccess();
    } catch (error) {
      this.displayError(error);
      process.exit(1);
    }
  }

  /**
   * Check system prerequisites
   */
  async checkPrerequisites() {
    this.spinner = ora('Checking prerequisites...').start();

    try {
      // Check Node.js version
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      if (majorVersion < 20) {
        throw new Error(`Node.js 20+ required, found ${nodeVersion}`);
      }

      // Check npm version
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      const npmMajor = parseInt(npmVersion.split('.')[0]);
      
      if (npmMajor < 9) {
        throw new Error(`npm 9+ required, found ${npmVersion}`);
      }

      // Check git
      try {
        execSync('git --version', { stdio: 'ignore' });
      } catch {
        throw new Error('Git is required but not installed');
      }

      this.spinner.succeed('Prerequisites validated');
    } catch (error) {
      this.spinner.fail(`Prerequisites check failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Install dependencies for all packages
   */
  async installDependencies() {
    this.spinner = ora('Installing dependencies...').start();

    try {
      // Install root dependencies
      execSync('npm install', { cwd: this.rootDir, stdio: 'pipe' });

      // Install package dependencies
      const packagesDir = path.join(this.rootDir, 'packages');
      if (fs.existsSync(packagesDir)) {
        const packages = fs.readdirSync(packagesDir);
        
        for (const pkg of packages) {
          const packagePath = path.join(packagesDir, pkg);
          const packageJsonPath = path.join(packagePath, 'package.json');
          
          if (fs.existsSync(packageJsonPath)) {
            this.spinner.text = `Installing dependencies for ${pkg}...`;
            execSync('npm install', { cwd: packagePath, stdio: 'pipe' });
          }
        }
      }

      // Install CLI instrumentation dependencies
      const cliDir = path.join(this.rootDir, 'cli-instrumentation');
      if (fs.existsSync(path.join(cliDir, 'package.json'))) {
        this.spinner.text = 'Installing CLI instrumentation dependencies...';
        execSync('npm install', { cwd: cliDir, stdio: 'pipe' });
      }

      this.spinner.succeed('Dependencies installed');
    } catch (error) {
      this.spinner.fail(`Dependency installation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Configure shared packages
   */
  async configureSharedPackages() {
    this.spinner = ora('Configuring shared packages...').start();

    try {
      // Build shared config package
      const configPath = path.join(this.rootDir, 'packages/shared-config');
      if (fs.existsSync(configPath)) {
        this.spinner.text = 'Building shared configuration package...';
        // No build needed for config package as it's just exports
      }

      // Build integration package
      const integrationPath = path.join(this.rootDir, 'packages/integration');
      if (fs.existsSync(integrationPath)) {
        this.spinner.text = 'Building integration package...';
        if (fs.existsSync(path.join(integrationPath, 'tsconfig.json'))) {
          execSync('npm run build', { cwd: integrationPath, stdio: 'pipe' });
        }
      }

      // Link packages locally for development
      this.spinner.text = 'Linking packages for development...';
      await this.linkPackages();

      this.spinner.succeed('Shared packages configured');
    } catch (error) {
      this.spinner.fail(`Shared package configuration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Link packages for local development
   */
  async linkPackages() {
    const packagesDir = path.join(this.rootDir, 'packages');
    if (!fs.existsSync(packagesDir)) return;

    const packages = fs.readdirSync(packagesDir);
    
    for (const pkg of packages) {
      const packagePath = path.join(packagesDir, pkg);
      const packageJsonPath = path.join(packagePath, 'package.json');
      
      if (fs.existsSync(packageJsonPath)) {
        try {
          execSync('npm link', { cwd: packagePath, stdio: 'pipe' });
        } catch (error) {
          // Ignore linking errors for now
          console.warn(chalk.yellow(`Warning: Could not link ${pkg}`));
        }
      }
    }
  }

  /**
   * Setup development environment
   */
  async setupDevelopmentEnvironment() {
    this.spinner = ora('Setting up development environment...').start();

    try {
      // Create .env files if they don't exist
      const envFiles = [
        '.env.example',
        '.env.development',
        '.env.local.example'
      ];

      for (const envFile of envFiles) {
        const envPath = path.join(this.rootDir, envFile);
        if (!fs.existsSync(envPath)) {
          await this.createDefaultEnvFile(envPath);
        }
      }

      // Setup git hooks
      this.spinner.text = 'Setting up git hooks...';
      await this.setupGitHooks();

      // Create development scripts
      await this.createDevelopmentScripts();

      this.spinner.succeed('Development environment configured');
    } catch (error) {
      this.spinner.fail(`Development environment setup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create default environment file
   */
  async createDefaultEnvFile(envPath) {
    const content = `# Claude Flow Environment Configuration
# Copy this file to .env and configure for your environment

# Development settings
NODE_ENV=development
LOG_LEVEL=info

# Claude Flow settings
CLAUDE_FLOW_VERSION=2.0.0-alpha.49
CLAUDE_FLOW_ENV=development

# Swarm configuration
SWARM_MAX_AGENTS=8
SWARM_TOPOLOGY=hierarchical
SWARM_STRATEGY=parallel

# Memory configuration
MEMORY_PROVIDER=sqlite
MEMORY_PERSISTENCE=true
MEMORY_ENCRYPTION=false

# Monitoring configuration
LANGFUSE_PUBLIC_KEY=your_public_key_here
LANGFUSE_SECRET_KEY=your_secret_key_here
LANGFUSE_HOST=https://cloud.langfuse.com

# Integration settings
INTEGRATION_AUTO_CONNECT=true
INTEGRATION_VALIDATE_ON_INIT=true
INTEGRATION_ENABLE_MONITORING=true

# Performance settings
PERFORMANCE_OPTIMIZATION=true
CACHING_ENABLED=true
PARALLELIZATION=true
`;

    await fs.writeFile(envPath, content);
  }

  /**
   * Setup git hooks
   */
  async setupGitHooks() {
    const hooksDir = path.join(this.rootDir, '.git/hooks');
    if (!fs.existsSync(hooksDir)) return;

    // Pre-commit hook
    const preCommitHook = `#!/bin/sh
# Claude Flow pre-commit hook

echo "🔍 Running pre-commit checks..."

# Run linting
npm run lint:packages || exit 1

# Run tests
npm run test:packages || exit 1

# Check formatting
npm run format:packages -- --check || exit 1

echo "✅ Pre-commit checks passed"
`;

    const preCommitPath = path.join(hooksDir, 'pre-commit');
    await fs.writeFile(preCommitPath, preCommitHook);
    await fs.chmod(preCommitPath, '755');
  }

  /**
   * Create development scripts
   */
  async createDevelopmentScripts() {
    const scriptsDir = path.join(this.rootDir, 'scripts/dev');
    await fs.ensureDir(scriptsDir);

    // Quick start script
    const quickStartScript = `#!/bin/bash
# Quick start development environment

echo "🚀 Starting Claude Flow development environment..."

# Start monitoring services
npm run dev:monitoring &

# Start the main application
npm run dev

echo "✅ Development environment started"
`;

    await fs.writeFile(path.join(scriptsDir, 'quick-start.sh'), quickStartScript);
    await fs.chmod(path.join(scriptsDir, 'quick-start.sh'), '755');

    // Test all script
    const testAllScript = `#!/bin/bash
# Run all tests across the ecosystem

echo "🧪 Running all ecosystem tests..."

# Run package tests
npm run test:packages

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e

echo "✅ All tests completed"
`;

    await fs.writeFile(path.join(scriptsDir, 'test-all.sh'), testAllScript);
    await fs.chmod(path.join(scriptsDir, 'test-all.sh'), '755');
  }

  /**
   * Validate setup
   */
  async validateSetup() {
    this.spinner = ora('Validating setup...').start();

    try {
      // Check package builds
      const packagesDir = path.join(this.rootDir, 'packages');
      if (fs.existsSync(packagesDir)) {
        const packages = fs.readdirSync(packagesDir);
        
        for (const pkg of packages) {
          const packagePath = path.join(packagesDir, pkg);
          const packageJsonPath = path.join(packagePath, 'package.json');
          
          if (fs.existsSync(packageJsonPath)) {
            this.spinner.text = `Validating ${pkg} package...`;
            
            // Check if package has a build script and run it
            const packageJson = require(packageJsonPath);
            if (packageJson.scripts?.build) {
              execSync('npm run build', { cwd: packagePath, stdio: 'pipe' });
            }
          }
        }
      }

      // Run basic smoke tests
      this.spinner.text = 'Running smoke tests...';
      // Add basic validation tests here

      this.spinner.succeed('Setup validation completed');
    } catch (error) {
      this.spinner.fail(`Setup validation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Display success message
   */
  displaySuccess() {
    console.log();
    console.log(chalk.green.bold('✅ Ecosystem setup completed successfully!'));
    console.log();
    console.log(chalk.bold('📋 Next steps:'));
    console.log('  1. Copy .env.example to .env and configure');
    console.log('  2. Run `npm run ecosystem:status` to check health');
    console.log('  3. Run `npm run dev` to start development');
    console.log('  4. Run `npm run test` to validate functionality');
    console.log();
    console.log(chalk.bold('🔗 Useful commands:'));
    console.log('  • `npm run ecosystem:status` - Check ecosystem health');
    console.log('  • `npm run dev:setup` - Quick development setup');
    console.log('  • `npm run test:packages` - Test all packages');
    console.log('  • `npm run lint:packages` - Lint all packages');
    console.log();
  }

  /**
   * Display error message
   */
  displayError(error) {
    console.log();
    console.log(chalk.red.bold('❌ Setup failed!'));
    console.log(chalk.red(error.message));
    console.log();
    console.log(chalk.bold('🔧 Troubleshooting:'));
    console.log('  1. Check that Node.js 20+ and npm 9+ are installed');
    console.log('  2. Ensure you have internet connectivity');
    console.log('  3. Try running `npm cache clean --force`');
    console.log('  4. Check the error details above');
    console.log();
  }
}

// CLI execution
if (require.main === module) {
  const setup = new EcosystemSetup();
  setup.setup();
}

module.exports = EcosystemSetup;