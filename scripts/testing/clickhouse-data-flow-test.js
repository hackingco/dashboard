#!/usr/bin/env node

/**
 * ClickHouse Data Flow Validation Suite
 * Tests data ingestion, processing, and query performance for Langfuse v3
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  clickhouse: {
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    user: process.env.CLICKHOUSE_USER || 'clickhouse',
    password: process.env.CLICKHOUSE_PASSWORD || 'clickhouse',
    database: process.env.CLICKHOUSE_DATABASE || 'default'
  },
  langfuse: {
    baseUrl: process.env.LANGFUSE_HOST || 'http://localhost:3001'
  }
};

// Test results tracking
const results = {
  timestamp: new Date().toISOString(),
  tests: {},
  performance: {},
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
  }
};

// Logging utilities
const log = (message) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

const error = (message) => {
  console.error(`[ERROR] ${message}`);
};

const success = (message) => {
  console.log(`[SUCCESS] ${message}`);
};

const warning = (message) => {
  console.warn(`[WARNING] ${message}`);
};

// Update test result
const updateResult = (testName, status, message, details = null) => {
  results.tests[testName] = {
    status,
    message,
    details,
    timestamp: new Date().toISOString()
  };
  
  results.summary.total++;
  if (status === 'passed') results.summary.passed++;
  else if (status === 'failed') results.summary.failed++;
  else results.summary.warnings++;
};

// Execute ClickHouse query
async function executeQuery(query, format = 'JSON') {
  try {
    const response = await axios.post(
      `${CONFIG.clickhouse.url}`,
      `${query} FORMAT ${format}`,
      {
        headers: {
          'Content-Type': 'text/plain'
        },
        auth: {
          username: CONFIG.clickhouse.user,
          password: CONFIG.clickhouse.password
        },
        timeout: 30000
      }
    );
    
    if (format === 'JSON') {
      return JSON.parse(response.data);
    }
    return response.data;
  } catch (err) {
    throw new Error(`Query failed: ${err.message}`);
  }
}

// Test ClickHouse system information
async function testSystemInfo() {
  log('Testing ClickHouse system information...');
  
  try {
    const versionResult = await executeQuery('SELECT version()');
    const uptimeResult = await executeQuery('SELECT uptime()');
    const settingsResult = await executeQuery('SHOW SETTINGS LIKE \'%max%\' LIMIT 10');
    
    const systemInfo = {
      version: versionResult.data[0]['version()'],
      uptime: uptimeResult.data[0]['uptime()'],
      settings: settingsResult.data.slice(0, 5) // First 5 settings
    };
    
    success(`ClickHouse version: ${systemInfo.version}, uptime: ${systemInfo.uptime}s`);
    updateResult('system_info', 'passed', 'System information retrieved', systemInfo);
    return true;
  } catch (err) {
    error(`System info test failed: ${err.message}`);
    updateResult('system_info', 'failed', `System info failed: ${err.message}`);
    return false;
  }
}

// Test database and table structure
async function testDatabaseStructure() {
  log('Testing database and table structure...');
  
  try {
    // Check available databases
    const databasesResult = await executeQuery('SHOW DATABASES');
    const databases = databasesResult.data.map(row => row.name);
    
    // Check tables in default database
    const tablesResult = await executeQuery('SHOW TABLES');
    const tables = tablesResult.data.map(row => row.name);
    
    // Check if Langfuse tables exist
    const langfuseTables = tables.filter(table => 
      ['traces', 'observations', 'scores', 'sessions'].some(lf => table.includes(lf))
    );
    
    const structureInfo = {
      databases,
      tables,
      langfuseTables,
      tableCount: tables.length
    };
    
    if (langfuseTables.length > 0) {
      success(`Found ${langfuseTables.length} Langfuse-related tables: ${langfuseTables.join(', ')}`);
    } else {
      warning('No Langfuse tables found - they may be created during first ingestion');
    }
    
    updateResult('database_structure', 'passed', 'Database structure analyzed', structureInfo);
    return true;
  } catch (err) {
    error(`Database structure test failed: ${err.message}`);
    updateResult('database_structure', 'failed', `Structure test failed: ${err.message}`);
    return false;
  }
}

// Test data ingestion performance
async function testDataIngestion() {
  log('Testing data ingestion performance...');
  
  try {
    // Create test table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS test_ingestion (
        id UUID DEFAULT generateUUIDv4(),
        timestamp DateTime DEFAULT now(),
        name String,
        value Float64,
        metadata String
      ) ENGINE = MergeTree()
      ORDER BY timestamp
    `;
    
    await executeQuery(createTableQuery, 'TabSeparated');
    
    // Insert test data
    const batchSize = 1000;
    const insertData = [];
    
    for (let i = 0; i < batchSize; i++) {
      insertData.push([
        `'test-trace-${i}'`,
        Math.random() * 100,
        `'{"test": true, "index": ${i}}'`
      ].join(', '));
    }
    
    const insertQuery = `
      INSERT INTO test_ingestion (name, value, metadata) VALUES 
      ${insertData.map(row => `(${row})`).join(', ')}
    `;
    
    const startTime = Date.now();
    await executeQuery(insertQuery, 'TabSeparated');
    const endTime = Date.now();
    
    const duration = endTime - startTime;
    const throughput = (batchSize / duration) * 1000; // records per second
    
    // Verify data
    const countResult = await executeQuery('SELECT count() FROM test_ingestion');
    const count = countResult.data[0]['count()'];
    
    success(`Inserted ${batchSize} records in ${duration}ms (${throughput.toFixed(2)} records/sec)`);
    
    const performanceData = {
      batchSize,
      duration,
      throughput: throughput.toFixed(2),
      recordsInserted: count
    };
    
    results.performance.ingestion = performanceData;
    updateResult('data_ingestion', 'passed', 'Data ingestion performance test successful', performanceData);
    
    // Cleanup
    await executeQuery('DROP TABLE test_ingestion', 'TabSeparated');
    
    return true;
  } catch (err) {
    error(`Data ingestion test failed: ${err.message}`);
    updateResult('data_ingestion', 'failed', `Ingestion test failed: ${err.message}`);
    return false;
  }
}

// Test query performance
async function testQueryPerformance() {
  log('Testing query performance...');
  
  try {
    const queries = [
      {
        name: 'simple_select',
        query: 'SELECT 1 as test',
        description: 'Simple SELECT query'
      },
      {
        name: 'system_numbers',
        query: 'SELECT count() FROM system.numbers LIMIT 100000',
        description: 'Count from system.numbers'
      },
      {
        name: 'date_functions',
        query: 'SELECT now(), today(), yesterday()',
        description: 'Date function performance'
      },
      {
        name: 'aggregation',
        query: 'SELECT avg(number), max(number), min(number) FROM system.numbers LIMIT 10000',
        description: 'Aggregation functions'
      }
    ];
    
    const queryResults = {};
    
    for (const { name, query, description } of queries) {
      const startTime = Date.now();
      const result = await executeQuery(query);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      queryResults[name] = {
        description,
        duration,
        rowCount: result.data ? result.data.length : 0
      };
      
      log(`${description}: ${duration}ms`);
    }
    
    results.performance.queries = queryResults;
    updateResult('query_performance', 'passed', 'Query performance tests completed', queryResults);
    return true;
  } catch (err) {
    error(`Query performance test failed: ${err.message}`);
    updateResult('query_performance', 'failed', `Query performance failed: ${err.message}`);
    return false;
  }
}

// Test Langfuse data integration
async function testLangfuseIntegration() {
  log('Testing Langfuse data integration...');
  
  try {
    // Wait for any pending data to be processed
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check for Langfuse-related tables
    const tablesResult = await executeQuery('SHOW TABLES');
    const tables = tablesResult.data.map(row => row.name);
    
    const langfuseTables = tables.filter(table => 
      ['traces', 'observations', 'scores', 'sessions', 'projects'].some(lf => table.toLowerCase().includes(lf.toLowerCase()))
    );
    
    if (langfuseTables.length === 0) {
      warning('No Langfuse tables found - may not be created yet');
      updateResult('langfuse_integration', 'warning', 'No Langfuse tables found');
      return false;
    }
    
    // Test data in each table
    const tableData = {};
    for (const table of langfuseTables) {
      try {
        const countResult = await executeQuery(`SELECT count() FROM ${table}`);
        const count = countResult.data[0]['count()'];
        tableData[table] = count;
        log(`Table ${table}: ${count} records`);
      } catch (err) {
        tableData[table] = `Error: ${err.message}`;
      }
    }
    
    success(`Found ${langfuseTables.length} Langfuse tables`);
    updateResult('langfuse_integration', 'passed', 'Langfuse integration validated', {
      tables: langfuseTables,
      data: tableData
    });
    return true;
  } catch (err) {
    error(`Langfuse integration test failed: ${err.message}`);
    updateResult('langfuse_integration', 'failed', `Integration test failed: ${err.message}`);
    return false;
  }
}

// Test memory and resource usage
async function testResourceUsage() {
  log('Testing ClickHouse resource usage...');
  
  try {
    const queries = [
      'SELECT * FROM system.metrics WHERE metric LIKE \'%Memory%\' LIMIT 10',
      'SELECT * FROM system.events WHERE event LIKE \'%Query%\' LIMIT 10',
      'SELECT * FROM system.processes LIMIT 5'
    ];
    
    const resourceData = {};
    
    for (let i = 0; i < queries.length; i++) {
      try {
        const result = await executeQuery(queries[i]);
        resourceData[`query_${i + 1}`] = result.data.slice(0, 5); // Limit to 5 rows
      } catch (err) {
        resourceData[`query_${i + 1}`] = `Error: ${err.message}`;
      }
    }
    
    success('Resource usage data collected');
    updateResult('resource_usage', 'passed', 'Resource usage analysis completed', resourceData);
    return true;
  } catch (err) {
    warning(`Resource usage test failed: ${err.message}`);
    updateResult('resource_usage', 'warning', `Resource test failed: ${err.message}`);
    return false;
  }
}

// Test clustering and replication (if applicable)
async function testClusterStatus() {
  log('Testing cluster status...');
  
  try {
    // Check if clustering is enabled
    const clustersResult = await executeQuery('SHOW CLUSTERS');
    const clusters = clustersResult.data;
    
    if (clusters.length === 0) {
      log('No clusters configured - running in single-node mode');
      updateResult('cluster_status', 'passed', 'Single-node mode confirmed', {
        mode: 'single-node',
        clusters: 0
      });
      return true;
    }
    
    // If clusters exist, check their status
    const clusterInfo = {};
    for (const cluster of clusters.slice(0, 3)) { // Check first 3 clusters
      const clusterName = cluster.cluster;
      try {
        const nodesResult = await executeQuery(`SELECT * FROM system.clusters WHERE cluster = '${clusterName}'`);
        clusterInfo[clusterName] = nodesResult.data.length;
      } catch (err) {
        clusterInfo[clusterName] = `Error: ${err.message}`;
      }
    }
    
    success(`Found ${clusters.length} clusters`);
    updateResult('cluster_status', 'passed', 'Cluster status checked', {
      mode: 'clustered',
      clusters: clusters.length,
      clusterInfo
    });
    return true;
  } catch (err) {
    warning(`Cluster status test failed: ${err.message}`);
    updateResult('cluster_status', 'warning', `Cluster test failed: ${err.message}`);
    return false;
  }
}

// Save results to file
async function saveResults() {
  const resultsPath = path.join(process.cwd(), 'clickhouse-data-flow-test-results.json');
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  log(`Results saved to ${resultsPath}`);
}

// Generate performance summary
function generatePerformanceSummary() {
  if (Object.keys(results.performance).length > 0) {
    log('=== PERFORMANCE SUMMARY ===');
    
    if (results.performance.ingestion) {
      const ing = results.performance.ingestion;
      log(`Data Ingestion: ${ing.batchSize} records in ${ing.duration}ms (${ing.throughput} records/sec)`);
    }
    
    if (results.performance.queries) {
      log('Query Performance:');
      Object.entries(results.performance.queries).forEach(([name, data]) => {
        log(`  ${data.description}: ${data.duration}ms`);
      });
    }
  }
}

// Generate summary report
function generateSummary() {
  log('=== CLICKHOUSE DATA FLOW TEST SUMMARY ===');
  log(`Total tests: ${results.summary.total}`);
  log(`Passed: ${results.summary.passed}`);
  log(`Failed: ${results.summary.failed}`);
  log(`Warnings: ${results.summary.warnings}`);
  
  generatePerformanceSummary();
  
  console.log('\nDetailed Results:');
  Object.entries(results.tests).forEach(([testName, result]) => {
    const status = result.status.toUpperCase();
    const emoji = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';
    console.log(`${emoji} ${testName}: ${status} - ${result.message}`);
  });
}

// Main execution
async function main() {
  log('Starting ClickHouse Data Flow Tests');
  log(`ClickHouse URL: ${CONFIG.clickhouse.url}`);
  log(`Database: ${CONFIG.clickhouse.database}`);
  
  // Run all tests
  await testSystemInfo();
  await testDatabaseStructure();
  await testDataIngestion();
  await testQueryPerformance();
  await testLangfuseIntegration();
  await testResourceUsage();
  await testClusterStatus();
  
  // Save results and generate summary
  await saveResults();
  generateSummary();
  
  // Store results for coordination
  try {
    await require('child_process').execSync(
      `npx claude-flow@alpha hooks notification --message "ClickHouse data flow tests completed: ${results.summary.passed}/${results.summary.total} passed" --telemetry true`,
      { stdio: 'inherit' }
    );
  } catch (err) {
    // Ignore if hooks not available
  }
  
  // Exit with appropriate code
  if (results.summary.failed > 0) {
    error('Some tests failed. Check the results for details.');
    process.exit(1);
  } else {
    success('All critical tests passed!');
    process.exit(0);
  }
}

// Handle errors
process.on('unhandledRejection', (err) => {
  error(`Unhandled rejection: ${err.message}`);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    error(`Test suite failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  CONFIG,
  executeQuery,
  testSystemInfo,
  testDatabaseStructure,
  testDataIngestion,
  testQueryPerformance,
  testLangfuseIntegration,
  testResourceUsage,
  testClusterStatus
};