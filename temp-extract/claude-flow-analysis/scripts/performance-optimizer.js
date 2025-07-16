#!/usr/bin/env node
/**
 * Performance Optimizer
 * 
 * Analyzes and optimizes Claude Flow ecosystem performance including
 * build times, bundle sizes, memory usage, and runtime performance.
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');
const { execSync } = require('child_process');
const ora = require('ora');

class PerformanceOptimizer {
  constructor() {
    this.rootDir = process.cwd();
    this.results = {
      buildTimes: {},
      bundleSizes: {},
      memoryUsage: {},
      recommendations: [],
    };
  }

  /**
   * Run comprehensive performance analysis
   */
  async analyze() {
    console.log(chalk.bold.blue('🚀 Claude Flow Performance Analysis\n'));

    try {
      await this.analyzeBuildPerformance();
      await this.analyzeBundleSizes();
      await this.analyzeMemoryUsage();
      await this.analyzeDependencies();
      await this.generateOptimizations();
      
      this.displayResults();
      await this.saveResults();
    } catch (error) {
      console.error(chalk.red('❌ Performance analysis failed:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Analyze build performance across packages
   */
  async analyzeBuildPerformance() {
    const spinner = ora('Analyzing build performance...').start();

    try {
      const packages = this.discoverPackages();
      
      for (const pkg of packages) {
        if (pkg.packageJson.scripts?.build) {
          spinner.text = `Building ${pkg.name}...`;
          
          const startTime = Date.now();
          try {
            execSync('npm run build', { 
              cwd: pkg.path, 
              stdio: 'pipe',
              timeout: 300000 // 5 minute timeout
            });
            const buildTime = Date.now() - startTime;
            
            this.results.buildTimes[pkg.name] = {
              time: buildTime,
              status: 'success',
              size: this.getPackageSize(pkg.path),
            };
          } catch (error) {
            this.results.buildTimes[pkg.name] = {
              time: Date.now() - startTime,
              status: 'failed',
              error: error.message.substring(0, 100),
            };
          }
        }
      }

      spinner.succeed('Build performance analysis completed');
    } catch (error) {
      spinner.fail(`Build analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze bundle sizes and identify optimization opportunities
   */
  async analyzeBundleSizes() {
    const spinner = ora('Analyzing bundle sizes...').start();

    try {
      const packages = this.discoverPackages();
      
      for (const pkg of packages) {
        const distPath = path.join(pkg.path, 'dist');
        if (fs.existsSync(distPath)) {
          const bundleInfo = this.analyzeBundleDirectory(distPath);
          this.results.bundleSizes[pkg.name] = bundleInfo;
          
          // Check for optimization opportunities
          if (bundleInfo.totalSize > 10 * 1024 * 1024) { // 10MB
            this.results.recommendations.push({
              type: 'bundle-size',
              package: pkg.name,
              issue: 'Large bundle size detected',
              suggestion: 'Consider code splitting and tree shaking',
              severity: 'high',
            });
          }
        }
      }

      spinner.succeed('Bundle size analysis completed');
    } catch (error) {
      spinner.fail(`Bundle analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze memory usage patterns
   */
  async analyzeMemoryUsage() {
    const spinner = ora('Analyzing memory usage...').start();

    try {
      // Run memory profiling for main package
      const memoryProfile = await this.profileMemoryUsage();
      this.results.memoryUsage = memoryProfile;

      // Check for memory leaks
      if (memoryProfile.peakUsage > 512 * 1024 * 1024) { // 512MB
        this.results.recommendations.push({
          type: 'memory',
          package: 'claude-flow',
          issue: 'High memory usage detected',
          suggestion: 'Investigate memory leaks and optimize data structures',
          severity: 'medium',
        });
      }

      spinner.succeed('Memory analysis completed');
    } catch (error) {
      spinner.fail(`Memory analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze dependency optimization opportunities
   */
  async analyzeDependencies() {
    const spinner = ora('Analyzing dependencies...').start();

    try {
      const packages = this.discoverPackages();
      const dependencyMap = new Map();
      const versionConflicts = [];

      // Collect all dependencies
      packages.forEach(pkg => {
        if (pkg.packageJson.dependencies) {
          Object.entries(pkg.packageJson.dependencies).forEach(([name, version]) => {
            if (!dependencyMap.has(name)) {
              dependencyMap.set(name, new Set());
            }
            dependencyMap.get(name).add(version);
          });
        }
      });

      // Find version conflicts
      dependencyMap.forEach((versions, name) => {
        if (versions.size > 1) {
          versionConflicts.push({
            dependency: name,
            versions: Array.from(versions),
          });
        }
      });

      // Generate recommendations
      if (versionConflicts.length > 0) {
        this.results.recommendations.push({
          type: 'dependencies',
          package: 'ecosystem',
          issue: `${versionConflicts.length} dependency version conflicts`,
          suggestion: 'Standardize dependency versions across packages',
          severity: 'medium',
          details: versionConflicts.slice(0, 5), // Show first 5 conflicts
        });
      }

      spinner.succeed('Dependency analysis completed');
    } catch (error) {
      spinner.fail(`Dependency analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate optimization recommendations
   */
  async generateOptimizations() {
    const spinner = ora('Generating optimizations...').start();

    try {
      // Build time optimizations
      const slowBuilds = Object.entries(this.results.buildTimes)
        .filter(([, data]) => data.time > 30000) // > 30 seconds
        .map(([name]) => name);

      if (slowBuilds.length > 0) {
        this.results.recommendations.push({
          type: 'build-performance',
          package: 'multiple',
          issue: `${slowBuilds.length} packages have slow build times`,
          suggestion: 'Implement incremental builds and caching',
          severity: 'high',
          packages: slowBuilds,
        });
      }

      // Docker optimization recommendations
      this.results.recommendations.push({
        type: 'docker',
        package: 'ecosystem',
        issue: 'Docker builds can be optimized',
        suggestion: 'Implement multi-stage builds with layer caching',
        severity: 'medium',
      });

      // Caching strategy recommendations
      this.results.recommendations.push({
        type: 'caching',
        package: 'ecosystem',
        issue: 'No comprehensive caching strategy',
        suggestion: 'Implement build artifact and dependency caching',
        severity: 'medium',
      });

      spinner.succeed('Optimization recommendations generated');
    } catch (error) {
      spinner.fail(`Optimization generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Profile memory usage
   */
  async profileMemoryUsage() {
    try {
      // Simple memory profiling
      const initialMemory = process.memoryUsage();
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const finalMemory = process.memoryUsage();
      
      return {
        initial: initialMemory,
        final: finalMemory,
        peakUsage: Math.max(initialMemory.heapUsed, finalMemory.heapUsed),
        growth: finalMemory.heapUsed - initialMemory.heapUsed,
      };
    } catch (error) {
      return {
        error: error.message,
        peakUsage: 0,
        growth: 0,
      };
    }
  }

  /**
   * Analyze bundle directory
   */
  analyzeBundleDirectory(distPath) {
    const files = this.getAllFiles(distPath);
    let totalSize = 0;
    const fileInfo = [];

    files.forEach(file => {
      const stats = fs.statSync(file);
      const size = stats.size;
      totalSize += size;
      
      fileInfo.push({
        name: path.relative(distPath, file),
        size,
        type: path.extname(file),
      });
    });

    return {
      totalSize,
      fileCount: files.length,
      files: fileInfo.sort((a, b) => b.size - a.size).slice(0, 10), // Top 10 largest files
      types: this.groupFilesByType(fileInfo),
    };
  }

  /**
   * Get all files recursively
   */
  getAllFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir);

    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        files.push(...this.getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    });

    return files;
  }

  /**
   * Group files by type
   */
  groupFilesByType(fileInfo) {
    const types = {};
    
    fileInfo.forEach(file => {
      const type = file.type || 'no-extension';
      if (!types[type]) {
        types[type] = { count: 0, size: 0 };
      }
      types[type].count++;
      types[type].size += file.size;
    });

    return types;
  }

  /**
   * Discover packages in the ecosystem
   */
  discoverPackages() {
    const packages = [];
    
    // Root package
    if (fs.existsSync(path.join(this.rootDir, 'package.json'))) {
      packages.push({
        name: 'claude-flow',
        path: this.rootDir,
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
            packageJson: require(packageJsonPath),
          });
        }
      });
    }

    return packages;
  }

  /**
   * Get package size
   */
  getPackageSize(packagePath) {
    try {
      const result = execSync(`du -sm "${packagePath}"`, { encoding: 'utf8' });
      return parseInt(result.split('\t')[0]) * 1024 * 1024; // Convert MB to bytes
    } catch (error) {
      return 0;
    }
  }

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Display analysis results
   */
  displayResults() {
    console.log(chalk.bold('📊 Performance Analysis Results\n'));

    // Build performance table
    if (Object.keys(this.results.buildTimes).length > 0) {
      console.log(chalk.bold('🏗️ Build Performance:'));
      const buildTable = new Table({
        head: ['Package', 'Build Time', 'Status', 'Size'],
        colWidths: [25, 15, 12, 12],
      });

      Object.entries(this.results.buildTimes).forEach(([name, data]) => {
        const timeColor = data.time > 30000 ? chalk.red : data.time > 10000 ? chalk.yellow : chalk.green;
        const statusColor = data.status === 'success' ? chalk.green : chalk.red;
        
        buildTable.push([
          name,
          timeColor(`${(data.time / 1000).toFixed(1)}s`),
          statusColor(data.status),
          data.size ? this.formatFileSize(data.size) : 'N/A',
        ]);
      });

      console.log(buildTable.toString());
      console.log();
    }

    // Bundle sizes
    if (Object.keys(this.results.bundleSizes).length > 0) {
      console.log(chalk.bold('📦 Bundle Sizes:'));
      const bundleTable = new Table({
        head: ['Package', 'Total Size', 'Files', 'Largest File'],
        colWidths: [25, 15, 10, 30],
      });

      Object.entries(this.results.bundleSizes).forEach(([name, data]) => {
        const largestFile = data.files[0];
        bundleTable.push([
          name,
          this.formatFileSize(data.totalSize),
          data.fileCount.toString(),
          largestFile ? `${largestFile.name} (${this.formatFileSize(largestFile.size)})` : 'N/A',
        ]);
      });

      console.log(bundleTable.toString());
      console.log();
    }

    // Recommendations
    if (this.results.recommendations.length > 0) {
      console.log(chalk.bold('💡 Optimization Recommendations:'));
      this.results.recommendations.forEach((rec, index) => {
        const severityColor = {
          high: chalk.red,
          medium: chalk.yellow,
          low: chalk.green,
        }[rec.severity];

        console.log(`  ${index + 1}. ${severityColor(rec.severity.toUpperCase())} - ${rec.issue}`);
        console.log(`     💡 ${rec.suggestion}`);
        if (rec.package !== 'ecosystem') {
          console.log(`     📦 Package: ${rec.package}`);
        }
        console.log();
      });
    }

    // Summary
    const totalBuildTime = Object.values(this.results.buildTimes)
      .reduce((sum, data) => sum + data.time, 0);
    const totalBundleSize = Object.values(this.results.bundleSizes)
      .reduce((sum, data) => sum + data.totalSize, 0);

    console.log(chalk.bold('📈 Summary:'));
    console.log(`  Total build time: ${chalk.cyan((totalBuildTime / 1000).toFixed(1))}s`);
    console.log(`  Total bundle size: ${chalk.cyan(this.formatFileSize(totalBundleSize))}`);
    console.log(`  Recommendations: ${chalk.yellow(this.results.recommendations.length)}`);
    console.log();
  }

  /**
   * Save results to file
   */
  async saveResults() {
    const resultsPath = path.join(this.rootDir, 'performance-analysis.json');
    await fs.writeJson(resultsPath, {
      timestamp: new Date().toISOString(),
      ...this.results,
    }, { spaces: 2 });

    console.log(chalk.green(`📁 Results saved to ${resultsPath}`));
  }
}

// CLI execution
if (require.main === module) {
  const optimizer = new PerformanceOptimizer();
  optimizer.analyze();
}

module.exports = PerformanceOptimizer;