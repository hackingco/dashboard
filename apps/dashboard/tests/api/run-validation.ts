#!/usr/bin/env node
/**
 * Langfuse API Validation Runner
 * Standalone script to run comprehensive API validation
 */

import { runLangfuseApiValidation, type ApiValidationReport } from './langfuse-test-runner';
import fs from 'fs/promises';
import path from 'path';

interface ValidationConfig {
  outputDir: string;
  generateReport: boolean;
  verbose: boolean;
  exitOnFailure: boolean;
  includePerformanceTests: boolean;
  maxRetries: number;
}

const DEFAULT_CONFIG: ValidationConfig = {
  outputDir: './tests/api/results',
  generateReport: true,
  verbose: true,
  exitOnFailure: false,
  includePerformanceTests: true,
  maxRetries: 3,
};

async function ensureOutputDirectory(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error(`Failed to create output directory ${dir}:`, error);
    throw error;
  }
}

async function saveReportToFile(report: ApiValidationReport, outputDir: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(outputDir, `langfuse-api-validation-${timestamp}.json`);
  
  try {
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`📄 Validation report saved to: ${reportPath}`);
  } catch (error) {
    console.error('Failed to save validation report:', error);
    throw error;
  }
}

async function generateHtmlReport(report: ApiValidationReport, outputDir: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const htmlPath = path.join(outputDir, `langfuse-api-validation-${timestamp}.html`);
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Langfuse API Validation Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f8fafc;
            color: #334155;
            line-height: 1.6;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5rem;
            font-weight: 700;
        }
        .header p {
            margin: 10px 0 0;
            opacity: 0.9;
            font-size: 1.1rem;
        }
        .content {
            padding: 30px;
        }
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .status-card {
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            background: #f8fafc;
        }
        .status-card h3 {
            margin: 0 0 10px;
            color: #1e293b;
            font-size: 1.1rem;
        }
        .status-value {
            font-size: 2rem;
            font-weight: 700;
            margin: 5px 0;
        }
        .status-success { color: #10b981; }
        .status-warning { color: #f59e0b; }
        .status-error { color: #ef4444; }
        .status-info { color: #3b82f6; }
        .test-suites {
            margin-top: 30px;
        }
        .test-suite {
            margin-bottom: 25px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            overflow: hidden;
        }
        .test-suite-header {
            background: #f1f5f9;
            padding: 15px 20px;
            border-bottom: 1px solid #e2e8f0;
        }
        .test-suite-title {
            margin: 0;
            font-size: 1.2rem;
            color: #1e293b;
        }
        .test-suite-summary {
            font-size: 0.9rem;
            color: #64748b;
            margin-top: 5px;
        }
        .test-results {
            padding: 20px;
        }
        .test-result {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #f1f5f9;
        }
        .test-result:last-child {
            border-bottom: none;
        }
        .test-name {
            font-weight: 500;
        }
        .test-status {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.9rem;
        }
        .test-duration {
            color: #64748b;
        }
        .recommendations {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 20px;
            margin-top: 30px;
        }
        .recommendations h3 {
            margin: 0 0 15px;
            color: #92400e;
        }
        .recommendations ul {
            margin: 0;
            padding-left: 20px;
        }
        .recommendations li {
            margin-bottom: 8px;
            color: #92400e;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        .badge-success {
            background: #dcfce7;
            color: #166534;
        }
        .badge-error {
            background: #fecaca;
            color: #991b1b;
        }
        .badge-warning {
            background: #fef3c7;
            color: #92400e;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #64748b;
            font-size: 0.9rem;
            border-top: 1px solid #e2e8f0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Langfuse API Validation Report</h1>
            <p>Generated on ${report.timestamp.toLocaleString()}</p>
        </div>
        
        <div class="content">
            <div class="status-grid">
                <div class="status-card">
                    <h3>🌐 Langfuse API</h3>
                    <div class="status-value ${report.langfuseAvailable ? 'status-success' : 'status-error'}">
                        ${report.langfuseAvailable ? '✅ Available' : '❌ Unavailable'}
                    </div>
                </div>
                
                <div class="status-card">
                    <h3>🔄 WebSocket</h3>
                    <div class="status-value ${report.webSocketSupported ? 'status-success' : 'status-warning'}">
                        ${report.webSocketSupported ? '✅ Supported' : '⚠️ Limited'}
                    </div>
                </div>
                
                <div class="status-card">
                    <h3>📊 API Coverage</h3>
                    <div class="status-value status-info">
                        ${report.summary.apiCoverage.toFixed(1)}%
                    </div>
                </div>
                
                <div class="status-card">
                    <h3>🎯 Reliability Score</h3>
                    <div class="status-value ${report.summary.reliabilityScore >= 90 ? 'status-success' : report.summary.reliabilityScore >= 70 ? 'status-warning' : 'status-error'}">
                        ${report.summary.reliabilityScore.toFixed(1)}%
                    </div>
                </div>
            </div>
            
            <div class="status-grid">
                <div class="status-card">
                    <h3>📋 Total Tests</h3>
                    <div class="status-value status-info">${report.summary.totalTests}</div>
                </div>
                
                <div class="status-card">
                    <h3>✅ Passed</h3>
                    <div class="status-value status-success">${report.summary.totalPassed}</div>
                </div>
                
                <div class="status-card">
                    <h3>❌ Failed</h3>
                    <div class="status-value status-error">${report.summary.totalFailed}</div>
                </div>
                
                <div class="status-card">
                    <h3>⏱️ Duration</h3>
                    <div class="status-value status-info">${report.summary.totalDuration}ms</div>
                </div>
            </div>
            
            <div class="test-suites">
                <h2>🔍 Test Suite Results</h2>
                ${report.testSuites.map(suite => `
                    <div class="test-suite">
                        <div class="test-suite-header">
                            <h3 class="test-suite-title">${suite.suiteName}</h3>
                            <div class="test-suite-summary">
                                ${suite.passed}/${suite.results.length} tests passed • ${suite.totalDuration}ms duration
                            </div>
                        </div>
                        <div class="test-results">
                            ${suite.results.map(result => `
                                <div class="test-result">
                                    <div class="test-name">${result.testName}</div>
                                    <div class="test-status">
                                        <span class="badge badge-${result.status === 'passed' ? 'success' : result.status === 'failed' ? 'error' : 'warning'}">
                                            ${result.status}
                                        </span>
                                        <span class="test-duration">${result.duration}ms</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            ${report.recommendations.length > 0 ? `
            <div class="recommendations">
                <h3>💡 Recommendations</h3>
                <ul>
                    ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
        </div>
        
        <div class="footer">
            Report generated by Langfuse API Validator
        </div>
    </div>
</body>
</html>
`;
  
  try {
    await fs.writeFile(htmlPath, html, 'utf-8');
    console.log(`📄 HTML report saved to: ${htmlPath}`);
  } catch (error) {
    console.error('Failed to save HTML report:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  const config: ValidationConfig = { ...DEFAULT_CONFIG };
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--output-dir':
        config.outputDir = args[++i];
        break;
      case '--no-report':
        config.generateReport = false;
        break;
      case '--quiet':
        config.verbose = false;
        break;
      case '--exit-on-failure':
        config.exitOnFailure = true;
        break;
      case '--no-performance':
        config.includePerformanceTests = false;
        break;
      case '--max-retries':
        config.maxRetries = parseInt(args[++i]) || 3;
        break;
      case '--help':
        console.log(`
Langfuse API Validation Runner

Usage: node run-validation.js [options]

Options:
  --output-dir <dir>     Output directory for reports (default: ./tests/api/results)
  --no-report           Skip generating report files
  --quiet               Reduce console output
  --exit-on-failure     Exit with error code on test failures
  --no-performance      Skip performance tests
  --max-retries <n>     Maximum retry attempts (default: 3)
  --help                Show this help message

Examples:
  node run-validation.js
  node run-validation.js --output-dir ./reports --exit-on-failure
  node run-validation.js --quiet --no-performance
        `);
        process.exit(0);
    }
  }
  
  console.log('🚀 Starting Langfuse API Validation...');
  console.log(`📁 Output directory: ${config.outputDir}`);
  console.log(`🔄 Max retries: ${config.maxRetries}`);
  console.log('');
  
  try {
    // Ensure output directory exists
    if (config.generateReport) {
      await ensureOutputDirectory(config.outputDir);
    }
    
    let report: ApiValidationReport | null = null;
    let attempt = 0;
    
    // Retry logic for API validation
    while (attempt < config.maxRetries && !report) {
      attempt++;
      
      try {
        if (attempt > 1) {
          console.log(`🔄 Retry attempt ${attempt}/${config.maxRetries}...`);
        }
        
        report = await runLangfuseApiValidation();
        break;
        
      } catch (error) {
        console.error(`❌ Validation attempt ${attempt} failed:`, error);
        
        if (attempt < config.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff
          console.log(`⏱️ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    if (!report) {
      throw new Error(`Failed to complete validation after ${config.maxRetries} attempts`);
    }
    
    // Generate reports
    if (config.generateReport) {
      await saveReportToFile(report, config.outputDir);
      await generateHtmlReport(report, config.outputDir);
    }
    
    // Print summary
    console.log('\n🎯 VALIDATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${report.summary.totalPassed}/${report.summary.totalTests}`);
    console.log(`❌ Failed: ${report.summary.totalFailed}/${report.summary.totalTests}`);
    console.log(`📊 API Coverage: ${report.summary.apiCoverage.toFixed(1)}%`);
    console.log(`🎯 Reliability: ${report.summary.reliabilityScore.toFixed(1)}%`);
    console.log(`⏱️ Duration: ${report.summary.totalDuration}ms`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Key Recommendations:');
      report.recommendations.slice(0, 3).forEach(rec => {
        console.log(`   ${rec}`);
      });
    }
    
    // Exit with appropriate code
    if (config.exitOnFailure && report.summary.totalFailed > 0) {
      console.log('\n❌ Exiting with error due to test failures');
      process.exit(1);
    }
    
    console.log('\n✅ Validation completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('💥 Fatal error during validation:', error);
    
    if (config.exitOnFailure) {
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export { main as runValidation };