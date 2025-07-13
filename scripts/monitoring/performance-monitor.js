#!/usr/bin/env node

/**
 * Performance Regression Detection Script
 * Compares current performance metrics against historical baselines
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const config = {
  thresholds: {
    // Response time thresholds (in milliseconds)
    responseTime: {
      warning: 0.15, // 15% increase is a warning
      critical: 0.30, // 30% increase is critical
    },
    // Throughput thresholds (requests per second)
    throughput: {
      warning: -0.10, // 10% decrease is a warning
      critical: -0.25, // 25% decrease is critical
    },
    // Error rate thresholds (percentage)
    errorRate: {
      warning: 0.02, // 2% error rate is a warning
      critical: 0.05, // 5% error rate is critical
    },
    // Memory usage thresholds
    memory: {
      warning: 0.20, // 20% increase is a warning
      critical: 0.40, // 40% increase is critical
    },
    // CPU usage thresholds
    cpu: {
      warning: 0.15, // 15% increase is a warning
      critical: 0.30, // 30% increase is critical
    },
  },
  
  // Historical baseline file paths
  baselinePaths: {
    performance: './performance-baseline.json',
    historical: './historical-performance.json',
  },
  
  // Current performance data paths
  currentPaths: {
    loadTest: './load-test-results.json',
    memoryProfile: './memory-profile.json',
    cpuProfile: './cpu-profile.json',
  },
  
  // Output paths
  outputPaths: {
    report: './performance-regression-report.json',
    summary: './performance-regression-summary.txt',
  },
};

// Utility functions
const logWithTimestamp = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

const calculatePercentageChange = (current, baseline) => {
  if (baseline === 0) return current === 0 ? 0 : Infinity;
  return ((current - baseline) / baseline) * 100;
};

const determineSeverity = (change, thresholds, isReverse = false) => {
  const multiplier = isReverse ? -1 : 1;
  const adjustedChange = change * multiplier;
  
  if (adjustedChange >= thresholds.critical * 100) return 'critical';
  if (adjustedChange >= thresholds.warning * 100) return 'warning';
  return 'ok';
};

// Data loading functions
async function loadPerformanceData() {
  const data = {};
  
  try {
    // Load baseline data
    if (await fileExists(config.baselinePaths.performance)) {
      const baselineContent = await fs.readFile(config.baselinePaths.performance, 'utf8');
      data.baseline = JSON.parse(baselineContent);
      logWithTimestamp('✅ Loaded performance baseline data');
    } else {
      logWithTimestamp('⚠️  No performance baseline found');
      data.baseline = null;
    }
    
    // Load historical data
    if (await fileExists(config.baselinePaths.historical)) {
      const historicalContent = await fs.readFile(config.baselinePaths.historical, 'utf8');
      data.historical = JSON.parse(historicalContent);
      logWithTimestamp('✅ Loaded historical performance data');
    } else {
      logWithTimestamp('⚠️  No historical performance data found');
      data.historical = null;
    }
    
    // Load current performance data
    const currentDataPromises = Object.entries(config.currentPaths).map(async ([key, path]) => {
      if (await fileExists(path)) {
        const content = await fs.readFile(path, 'utf8');
        return [key, JSON.parse(content)];
      }
      return [key, null];
    });
    
    const currentDataResults = await Promise.all(currentDataPromises);
    data.current = Object.fromEntries(currentDataResults);
    
    logWithTimestamp('✅ Loaded current performance data');
    
    return data;
  } catch (error) {
    throw new Error(`Failed to load performance data: ${error.message}`);
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Analysis functions
function analyzeResponseTime(current, baseline) {
  if (!current?.responseTime || !baseline?.response_time) {
    return { status: 'missing_data', message: 'Response time data missing' };
  }
  
  const metrics = {
    p50: {
      current: current.responseTime.p50 || current.responseTime.median,
      baseline: baseline.response_time.p50 || baseline.response_time.median,
    },
    p95: {
      current: current.responseTime.p95,
      baseline: baseline.response_time.p95,
    },
    p99: {
      current: current.responseTime.p99,
      baseline: baseline.response_time.p99,
    },
    average: {
      current: current.responseTime.average || current.responseTime.mean,
      baseline: baseline.response_time.average || baseline.response_time.mean,
    },
  };
  
  const analysis = {};
  
  Object.entries(metrics).forEach(([metric, values]) => {
    if (values.current !== undefined && values.baseline !== undefined) {
      const change = calculatePercentageChange(values.current, values.baseline);
      const severity = determineSeverity(change, config.thresholds.responseTime);
      
      analysis[metric] = {
        current: values.current,
        baseline: values.baseline,
        change: change.toFixed(2),
        severity,
        status: severity === 'ok' ? 'pass' : 'regression',
      };
    }
  });
  
  return analysis;
}

function analyzeThroughput(current, baseline) {
  if (!current?.throughput || !baseline?.throughput) {
    return { status: 'missing_data', message: 'Throughput data missing' };
  }
  
  const currentThroughput = current.throughput.rps || current.throughput.requestsPerSecond;
  const baselineThroughput = baseline.throughput.rps || baseline.throughput.requestsPerSecond;
  
  if (currentThroughput === undefined || baselineThroughput === undefined) {
    return { status: 'missing_data', message: 'Throughput values missing' };
  }
  
  const change = calculatePercentageChange(currentThroughput, baselineThroughput);
  const severity = determineSeverity(change, config.thresholds.throughput, true); // Reverse: decrease is bad
  
  return {
    current: currentThroughput,
    baseline: baselineThroughput,
    change: change.toFixed(2),
    severity,
    status: severity === 'ok' ? 'pass' : 'regression',
  };
}

function analyzeErrorRate(current, baseline) {
  if (!current?.errors || !baseline?.errors) {
    return { status: 'missing_data', message: 'Error rate data missing' };
  }
  
  const currentErrorRate = current.errors.rate || (current.errors.count / current.requests.total);
  const baselineErrorRate = baseline.errors.rate || (baseline.errors.count / baseline.requests.total);
  
  if (currentErrorRate === undefined || baselineErrorRate === undefined) {
    return { status: 'missing_data', message: 'Error rate values missing' };
  }
  
  const change = calculatePercentageChange(currentErrorRate, baselineErrorRate);
  const severity = determineSeverity(change, config.thresholds.errorRate);
  
  return {
    current: currentErrorRate,
    baseline: baselineErrorRate,
    change: change.toFixed(2),
    severity,
    status: severity === 'ok' ? 'pass' : 'regression',
  };
}

function analyzeMemoryUsage(current, baseline) {
  if (!current?.memory || !baseline?.memory) {
    return { status: 'missing_data', message: 'Memory usage data missing' };
  }
  
  const currentMemory = current.memory.peak || current.memory.max;
  const baselineMemory = baseline.memory.peak || baseline.memory.max;
  
  if (currentMemory === undefined || baselineMemory === undefined) {
    return { status: 'missing_data', message: 'Memory usage values missing' };
  }
  
  const change = calculatePercentageChange(currentMemory, baselineMemory);
  const severity = determineSeverity(change, config.thresholds.memory);
  
  return {
    current: currentMemory,
    baseline: baselineMemory,
    change: change.toFixed(2),
    severity,
    status: severity === 'ok' ? 'pass' : 'regression',
  };
}

function analyzeCpuUsage(current, baseline) {
  if (!current?.cpu || !baseline?.cpu) {
    return { status: 'missing_data', message: 'CPU usage data missing' };
  }
  
  const currentCpu = current.cpu.average || current.cpu.mean;
  const baselineCpu = baseline.cpu.average || baseline.cpu.mean;
  
  if (currentCpu === undefined || baselineCpu === undefined) {
    return { status: 'missing_data', message: 'CPU usage values missing' };
  }
  
  const change = calculatePercentageChange(currentCpu, baselineCpu);
  const severity = determineSeverity(change, config.thresholds.cpu);
  
  return {
    current: currentCpu,
    baseline: baselineCpu,
    change: change.toFixed(2),
    severity,
    status: severity === 'ok' ? 'pass' : 'regression',
  };
}

// Main analysis function
async function performRegressionAnalysis() {
  logWithTimestamp('🔍 Starting performance regression analysis');
  
  try {
    // Load all performance data
    const data = await loadPerformanceData();
    
    if (!data.baseline) {
      throw new Error('No baseline data available for comparison');
    }
    
    // Perform analysis on different metrics
    const analysis = {
      timestamp: new Date().toISOString(),
      commit: process.env.GITHUB_SHA || 'unknown',
      branch: process.env.GITHUB_REF_NAME || 'unknown',
      
      responseTime: analyzeResponseTime(data.current.loadTest, data.baseline),
      throughput: analyzeThroughput(data.current.loadTest, data.baseline),
      errorRate: analyzeErrorRate(data.current.loadTest, data.baseline),
      memory: analyzeMemoryUsage(data.current.memoryProfile, data.baseline),
      cpu: analyzeCpuUsage(data.current.cpuProfile, data.baseline),
    };
    
    // Determine overall regression status
    const regressions = Object.values(analysis)
      .filter(metric => typeof metric === 'object' && metric.status === 'regression');
    
    const criticalRegressions = regressions.filter(r => r.severity === 'critical');
    const warningRegressions = regressions.filter(r => r.severity === 'warning');
    
    analysis.summary = {
      regression_detected: regressions.length > 0,
      total_regressions: regressions.length,
      critical_regressions: criticalRegressions.length,
      warning_regressions: warningRegressions.length,
      severity: criticalRegressions.length > 0 ? 'critical' : 
                warningRegressions.length > 0 ? 'warning' : 'ok',
      status: regressions.length > 0 ? 'fail' : 'pass',
    };
    
    // Generate recommendations
    analysis.recommendations = generateRecommendations(analysis);
    
    // Save analysis results
    await fs.writeFile(
      config.outputPaths.report,
      JSON.stringify(analysis, null, 2),
      'utf8'
    );
    
    // Generate human-readable summary
    const summary = generateTextSummary(analysis);
    await fs.writeFile(config.outputPaths.summary, summary, 'utf8');
    
    logWithTimestamp('✅ Performance regression analysis completed');
    
    // Log results
    console.log('\n' + '='.repeat(60));
    console.log('PERFORMANCE REGRESSION ANALYSIS RESULTS');
    console.log('='.repeat(60));
    console.log(`📊 Overall Status: ${analysis.summary.status.toUpperCase()}`);
    console.log(`🚨 Regressions Found: ${analysis.summary.total_regressions}`);
    console.log(`🔴 Critical: ${analysis.summary.critical_regressions}`);
    console.log(`🟡 Warning: ${analysis.summary.warning_regressions}`);
    console.log('='.repeat(60));
    
    if (analysis.summary.regression_detected) {
      console.log('\n📋 Detected Regressions:');
      Object.entries(analysis).forEach(([metric, data]) => {
        if (typeof data === 'object' && data.status === 'regression') {
          const icon = data.severity === 'critical' ? '🔴' : '🟡';
          console.log(`  ${icon} ${metric}: ${data.change}% change (${data.current} vs ${data.baseline})`);
        }
      });
    }
    
    if (analysis.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      analysis.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }
    
    console.log('='.repeat(60));
    
    // Exit with appropriate code
    if (analysis.summary.critical_regressions > 0) {
      process.exit(1); // Critical regressions cause failure
    } else if (analysis.summary.warning_regressions > 0) {
      process.exit(0); // Warnings don't fail the build but are noted
    } else {
      process.exit(0); // All good
    }
    
  } catch (error) {
    logWithTimestamp(`❌ Regression analysis failed: ${error.message}`);
    throw error;
  }
}

function generateRecommendations(analysis) {
  const recommendations = [];
  
  // Response time recommendations
  if (analysis.responseTime.status === 'regression') {
    recommendations.push('Investigate API endpoint performance bottlenecks');
    recommendations.push('Consider implementing caching strategies');
    recommendations.push('Review database query performance');
  }
  
  // Throughput recommendations
  if (analysis.throughput.status === 'regression') {
    recommendations.push('Scale up infrastructure resources');
    recommendations.push('Optimize request processing pipeline');
    recommendations.push('Consider load balancing improvements');
  }
  
  // Error rate recommendations
  if (analysis.errorRate.status === 'regression') {
    recommendations.push('Review error logs for failure patterns');
    recommendations.push('Implement better error handling');
    recommendations.push('Consider circuit breaker patterns');
  }
  
  // Memory recommendations
  if (analysis.memory.status === 'regression') {
    recommendations.push('Investigate memory leaks');
    recommendations.push('Optimize data structures and caching');
    recommendations.push('Consider garbage collection tuning');
  }
  
  // CPU recommendations
  if (analysis.cpu.status === 'regression') {
    recommendations.push('Profile CPU-intensive operations');
    recommendations.push('Optimize algorithms and computations');
    recommendations.push('Consider horizontal scaling');
  }
  
  return recommendations;
}

function generateTextSummary(analysis) {
  const lines = [
    'PERFORMANCE REGRESSION ANALYSIS SUMMARY',
    '=' .repeat(50),
    '',
    `Analysis Date: ${analysis.timestamp}`,
    `Commit: ${analysis.commit}`,
    `Branch: ${analysis.branch}`,
    '',
    `Overall Status: ${analysis.summary.status.toUpperCase()}`,
    `Regression Detected: ${analysis.summary.regression_detected ? 'YES' : 'NO'}`,
    `Total Regressions: ${analysis.summary.total_regressions}`,
    `Critical Regressions: ${analysis.summary.critical_regressions}`,
    `Warning Regressions: ${analysis.summary.warning_regressions}`,
    '',
    'DETAILED RESULTS:',
    '-'.repeat(30),
  ];
  
  Object.entries(analysis).forEach(([metric, data]) => {
    if (typeof data === 'object' && data.current !== undefined) {
      const status = data.status === 'regression' ? `REGRESSION (${data.severity})` : 'PASS';
      lines.push(`${metric.padEnd(15)}: ${status} (${data.change}% change)`);
    }
  });
  
  if (analysis.recommendations.length > 0) {
    lines.push('');
    lines.push('RECOMMENDATIONS:');
    lines.push('-'.repeat(20));
    analysis.recommendations.forEach(rec => lines.push(`• ${rec}`));
  }
  
  return lines.join('\n');
}

// Error handling
process.on('unhandledRejection', (error) => {
  logWithTimestamp(`❌ Unhandled rejection: ${error.message}`);
  process.exit(1);
});

// Main execution
if (require.main === module) {
  performRegressionAnalysis().catch(error => {
    logWithTimestamp(`❌ Regression analysis failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  performRegressionAnalysis,
  analyzeResponseTime,
  analyzeThroughput,
  analyzeErrorRate,
  analyzeMemoryUsage,
  analyzeCpuUsage,
};