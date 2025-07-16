#!/usr/bin/env node
/**
 * Ecosystem Status Monitor
 * 
 * Provides comprehensive status overview of Claude Flow ecosystem packages,
 * their health, dependencies, and integration status.
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');
const { execSync } = require('child_process');

class EcosystemStatusMonitor {
  constructor() {
    this.rootDir = process.cwd();
    this.packages = this.discoverPackages();
  }

  /**
   * Discover all packages in the ecosystem
   */
  discoverPackages() {
    const packages = [];
    
    // Root package
    if (fs.existsSync(path.join(this.rootDir, 'package.json'))) {
      packages.push({
        name: 'claude-flow',
        path: this.rootDir,
        type: 'core',
        packageJson: require(path.join(this.rootDir, 'package.json')),
      });
    }

    // Packages directory
    const packagesDir = path.join(this.rootDir, 'packages');
    if (fs.existsSync(packagesDir)) {
      const packageDirs = fs.readdirSync(packagesDir);
      packageDirs.forEach(dir => {
        const packagePath = path.join(packagesDir, dir);
        const packageJsonPath = path.join(packagePath, 'package.json');
        
        if (fs.existsSync(packageJsonPath)) {
          packages.push({
            name: dir,
            path: packagePath,
            type: 'package',
            packageJson: require(packageJsonPath),
          });
        }
      });
    }

    // CLI instrumentation
    const cliDir = path.join(this.rootDir, 'cli-instrumentation');
    if (fs.existsSync(path.join(cliDir, 'package.json'))) {
      packages.push({
        name: 'cli-instrumentation',
        path: cliDir,
        type: 'tool',
        packageJson: require(path.join(cliDir, 'package.json')),
      });
    }

    // Migration package
    const migrationDir = path.join(this.rootDir, 'src/migration');
    if (fs.existsSync(path.join(migrationDir, 'package.json'))) {
      packages.push({
        name: 'migration',
        path: migrationDir,
        type: 'tool',
        packageJson: require(path.join(migrationDir, 'package.json')),
      });
    }

    // Examples
    const examplesDir = path.join(this.rootDir, 'examples');
    if (fs.existsSync(examplesDir)) {
      const exampleDirs = fs.readdirSync(examplesDir);
      exampleDirs.forEach(dir => {
        const examplePath = path.join(examplesDir, dir);
        const packageJsonPath = path.join(examplePath, 'package.json');
        
        if (fs.existsSync(packageJsonPath)) {
          packages.push({
            name: `example-${dir}`,
            path: examplePath,
            type: 'example',
            packageJson: require(packageJsonPath),
          });
        }
      });
    }

    return packages;
  }

  /**
   * Check package health
   */
  checkPackageHealth(pkg) {
    const health = {
      status: 'healthy',
      issues: [],
      warnings: [],
      metrics: {
        dependencies: 0,
        devDependencies: 0,
        scripts: 0,
        size: 0,
      },
    };

    try {
      // Check node_modules exists
      if (!fs.existsSync(path.join(pkg.path, 'node_modules'))) {
        health.issues.push('Dependencies not installed');
        health.status = 'unhealthy';
      }

      // Check for common dependency issues
      if (pkg.packageJson.dependencies) {
        health.metrics.dependencies = Object.keys(pkg.packageJson.dependencies).length;
        
        // Check for outdated Claude Flow references
        Object.keys(pkg.packageJson.dependencies).forEach(dep => {
          if (dep.startsWith('file:') || dep.startsWith('../')) {
            health.warnings.push(`Local dependency reference: ${dep}`);
          }
        });
      }

      if (pkg.packageJson.devDependencies) {
        health.metrics.devDependencies = Object.keys(pkg.packageJson.devDependencies).length;
      }

      if (pkg.packageJson.scripts) {
        health.metrics.scripts = Object.keys(pkg.packageJson.scripts).length;
      }

      // Check package size
      try {
        const stats = fs.statSync(pkg.path);
        health.metrics.size = this.getDirectorySize(pkg.path);
      } catch (error) {
        health.warnings.push('Could not determine package size');
      }

      // Check for TypeScript configuration
      if (!fs.existsSync(path.join(pkg.path, 'tsconfig.json'))) {
        health.warnings.push('No TypeScript configuration found');
      }

      // Check for test files
      const hasTests = fs.existsSync(path.join(pkg.path, 'tests')) ||
                      fs.existsSync(path.join(pkg.path, '__tests__')) ||
                      pkg.packageJson.scripts?.test;
      
      if (!hasTests) {
        health.warnings.push('No tests found');
      }

      // Determine overall status
      if (health.issues.length > 0) {
        health.status = 'unhealthy';
      } else if (health.warnings.length > 2) {
        health.status = 'degraded';
      }

    } catch (error) {
      health.status = 'error';
      health.issues.push(`Health check failed: ${error.message}`);
    }

    return health;
  }

  /**
   * Get directory size in MB
   */
  getDirectorySize(dirPath) {
    try {
      const result = execSync(`du -sm "${dirPath}"`, { encoding: 'utf8' });
      return parseInt(result.split('\t')[0]);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check ecosystem dependencies
   */
  checkEcosystemDependencies() {
    const dependencies = new Map();
    const issues = [];

    this.packages.forEach(pkg => {
      if (pkg.packageJson.dependencies) {
        Object.entries(pkg.packageJson.dependencies).forEach(([name, version]) => {
          if (!dependencies.has(name)) {
            dependencies.set(name, new Set());
          }
          dependencies.get(name).add(version);
        });
      }
    });

    // Check for version conflicts
    dependencies.forEach((versions, name) => {
      if (versions.size > 1) {
        issues.push({
          type: 'version-conflict',
          dependency: name,
          versions: Array.from(versions),
          severity: 'warning',
        });
      }
    });

    return {
      totalDependencies: dependencies.size,
      conflicts: issues.filter(i => i.type === 'version-conflict').length,
      issues,
    };
  }

  /**
   * Generate status report
   */
  generateStatusReport() {
    console.log(chalk.bold.blue('📊 Claude Flow Ecosystem Status Report'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log();

    // Package overview
    const packageTable = new Table({
      head: ['Package', 'Version', 'Type', 'Status', 'Dependencies', 'Issues'],
      colWidths: [25, 12, 10, 12, 12, 20],
    });

    this.packages.forEach(pkg => {
      const health = this.checkPackageHealth(pkg);
      const statusColor = {
        healthy: chalk.green,
        degraded: chalk.yellow,
        unhealthy: chalk.red,
        error: chalk.red,
      }[health.status];

      packageTable.push([
        pkg.packageJson.name || pkg.name,
        pkg.packageJson.version || 'N/A',
        pkg.type,
        statusColor(health.status),
        health.metrics.dependencies.toString(),
        health.issues.length + health.warnings.length,
      ]);
    });

    console.log(chalk.bold('📦 Package Status:'));
    console.log(packageTable.toString());
    console.log();

    // Dependency analysis
    const depAnalysis = this.checkEcosystemDependencies();
    console.log(chalk.bold('🔗 Dependency Analysis:'));
    console.log(`  Total unique dependencies: ${chalk.cyan(depAnalysis.totalDependencies)}`);
    console.log(`  Version conflicts: ${chalk.yellow(depAnalysis.conflicts)}`);
    
    if (depAnalysis.conflicts > 0) {
      console.log(chalk.yellow('  ⚠️  Version conflicts detected:'));
      depAnalysis.issues
        .filter(i => i.type === 'version-conflict')
        .forEach(issue => {
          console.log(`    ${issue.dependency}: ${issue.versions.join(', ')}`);
        });
    }
    console.log();

    // Health summary
    const healthCounts = this.packages.reduce((acc, pkg) => {
      const health = this.checkPackageHealth(pkg);
      acc[health.status] = (acc[health.status] || 0) + 1;
      return acc;
    }, {});

    console.log(chalk.bold('💚 Health Summary:'));
    console.log(`  ${chalk.green('●')} Healthy: ${healthCounts.healthy || 0}`);
    console.log(`  ${chalk.yellow('●')} Degraded: ${healthCounts.degraded || 0}`);
    console.log(`  ${chalk.red('●')} Unhealthy: ${healthCounts.unhealthy || 0}`);
    console.log(`  ${chalk.red('●')} Error: ${healthCounts.error || 0}`);
    console.log();

    // Recommendations
    this.generateRecommendations();
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    console.log(chalk.bold('🚀 Optimization Recommendations:'));
    
    const recommendations = [];

    // Check for missing shared configs
    const hasSharedConfig = this.packages.some(pkg => 
      pkg.packageJson.name === '@claude-flow/config'
    );
    
    if (!hasSharedConfig) {
      recommendations.push('Create @claude-flow/config package for shared configurations');
    }

    // Check for integration package
    const hasIntegration = this.packages.some(pkg => 
      pkg.packageJson.name === '@claude-flow/integration'
    );
    
    if (!hasIntegration) {
      recommendations.push('Create @claude-flow/integration package for ecosystem coordination');
    }

    // Check for dependency conflicts
    const depAnalysis = this.checkEcosystemDependencies();
    if (depAnalysis.conflicts > 0) {
      recommendations.push('Resolve dependency version conflicts for consistency');
    }

    // Check for packages without tests
    const packagesWithoutTests = this.packages.filter(pkg => {
      const hasTests = fs.existsSync(path.join(pkg.path, 'tests')) ||
                      fs.existsSync(path.join(pkg.path, '__tests__')) ||
                      pkg.packageJson.scripts?.test;
      return !hasTests && pkg.type !== 'example';
    });

    if (packagesWithoutTests.length > 0) {
      recommendations.push(`Add tests to ${packagesWithoutTests.length} packages`);
    }

    // Check for outdated dependencies
    recommendations.push('Run dependency audit and update outdated packages');
    recommendations.push('Implement consistent coding standards across packages');
    recommendations.push('Set up automated CI/CD for all packages');

    if (recommendations.length === 0) {
      console.log('  ✅ Ecosystem is well optimized!');
    } else {
      recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }
    console.log();

    // Next steps
    console.log(chalk.bold('📋 Next Steps:'));
    console.log('  1. Run `npm run ecosystem:setup` to configure shared packages');
    console.log('  2. Run `npm run ecosystem:validate` to check configuration');
    console.log('  3. Run `npm run lint:packages` to check code quality');
    console.log('  4. Run `npm run test:packages` to validate functionality');
    console.log();
  }
}

// CLI execution
if (require.main === module) {
  try {
    const monitor = new EcosystemStatusMonitor();
    monitor.generateStatusReport();
  } catch (error) {
    console.error(chalk.red('❌ Error generating status report:'), error.message);
    process.exit(1);
  }
}

module.exports = EcosystemStatusMonitor;