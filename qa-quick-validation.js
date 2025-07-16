#!/usr/bin/env node

/**
 * Quick QA Validation Script
 * Tests basic functionality without dependencies
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧪 QA Quick Validation Script');
console.log('=' .repeat(50));

const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function runTest(name, testFn) {
  try {
    console.log(`\nTesting: ${name}`);
    const result = testFn();
    console.log(`✅ PASS: ${name}`);
    results.passed++;
    results.tests.push({ name, status: 'PASS', result });
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
  }
}

// Test 1: Check project structure
runTest('Project Structure', () => {
  const requiredDirs = ['apps', 'shared', 'tests', 'scripts'];
  requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      throw new Error(`Missing directory: ${dir}`);
    }
  });
  return 'All required directories exist';
});

// Test 2: Check package.json
runTest('Package.json Validity', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!packageJson.name || !packageJson.version) {
    throw new Error('Invalid package.json');
  }
  return `Project: ${packageJson.name} v${packageJson.version}`;
});

// Test 3: Check Docker availability
runTest('Docker Availability', () => {
  try {
    const version = execSync('docker --version', { encoding: 'utf8' }).trim();
    return version;
  } catch {
    throw new Error('Docker not available');
  }
});

// Test 4: Check Node.js version
runTest('Node.js Version', () => {
  const version = process.version;
  const major = parseInt(version.split('.')[0].substring(1));
  if (major < 18) {
    throw new Error(`Node.js version ${version} is too old. Need v18+`);
  }
  return `Node.js ${version}`;
});

// Test 5: Check test directories
runTest('Test Infrastructure', () => {
  const testDirs = [
    'tests/smoke',
    'tests/integration',
    'tests/monitoring',
    'apps/dashboard/tests'
  ];
  const existing = testDirs.filter(dir => fs.existsSync(dir));
  if (existing.length === 0) {
    throw new Error('No test directories found');
  }
  return `Found ${existing.length}/${testDirs.length} test directories`;
});

// Test 6: Check configuration files
runTest('Configuration Files', () => {
  const configs = [
    'docker-compose.yml',
    'tsconfig.json',
    '.gitignore'
  ];
  const existing = configs.filter(file => fs.existsSync(file));
  if (existing.length !== configs.length) {
    throw new Error('Missing configuration files');
  }
  return 'All configuration files present';
});

// Test 7: Check for security issues
runTest('Basic Security Check', () => {
  // Check for exposed secrets
  const envFiles = ['.env', '.env.local', '.env.production'];
  const exposedEnvs = envFiles.filter(file => {
    if (fs.existsSync(file)) {
      const gitignore = fs.readFileSync('.gitignore', 'utf8');
      return !gitignore.includes(file);
    }
    return false;
  });
  
  if (exposedEnvs.length > 0) {
    throw new Error(`Exposed env files: ${exposedEnvs.join(', ')}`);
  }
  return 'No exposed environment files';
});

// Test 8: Check memory database
runTest('Swarm Memory Database', () => {
  const dbPath = '.swarm/memory.db';
  if (!fs.existsSync(dbPath)) {
    throw new Error('Memory database not found');
  }
  const stats = fs.statSync(dbPath);
  return `Database exists: ${(stats.size / 1024).toFixed(2)} KB`;
});

// Summary
console.log('\n' + '=' .repeat(50));
console.log('📊 QA Validation Summary');
console.log('=' .repeat(50));
console.log(`Total Tests: ${results.passed + results.failed}`);
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

// Save results
const reportPath = 'qa-validation-results.json';
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n📄 Full results saved to: ${reportPath}`);

// Exit with appropriate code
process.exit(results.failed > 0 ? 1 : 0);