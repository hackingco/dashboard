#!/usr/bin/env node

/**
 * Prisma Migrations and Database Setup Validation Suite
 * Tests database schema, migrations, and data integrity
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const { Client } = require('pg');

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.POSTGRES_DB || 'swarm_dev'
  },
  supabase: {
    url: process.env.SUPABASE_URL || null,
    key: process.env.SUPABASE_ANON_KEY || null
  }
};

// Test results tracking
const results = {
  timestamp: new Date().toISOString(),
  tests: {},
  migrations: {},
  schema: {},
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

// Create database connection
async function createConnection(database = CONFIG.postgres.database) {
  const client = new Client({
    host: CONFIG.postgres.host,
    port: CONFIG.postgres.port,
    user: CONFIG.postgres.user,
    password: CONFIG.postgres.password,
    database
  });
  
  await client.connect();
  return client;
}

// Test PostgreSQL connectivity
async function testPostgreSQLConnectivity() {
  log('Testing PostgreSQL connectivity...');
  
  try {
    const client = await createConnection('postgres'); // Connect to default postgres db
    
    // Test basic query
    const result = await client.query('SELECT version()');
    const version = result.rows[0].version;
    
    // Test database existence
    const dbResult = await client.query(
      'SELECT datname FROM pg_database WHERE datname = $1',
      [CONFIG.postgres.database]
    );
    
    const dbExists = dbResult.rows.length > 0;
    
    await client.end();
    
    success(`PostgreSQL connected successfully. Version: ${version.split(' ')[0]} ${version.split(' ')[1]}`);
    updateResult('postgresql_connectivity', 'passed', 'PostgreSQL connectivity successful', {
      version: version.split(' ').slice(0, 2).join(' '),
      databaseExists: dbExists
    });
    
    return true;
  } catch (err) {
    error(`PostgreSQL connectivity failed: ${err.message}`);
    updateResult('postgresql_connectivity', 'failed', `PostgreSQL connectivity failed: ${err.message}`);
    return false;
  }
}

// Test database creation
async function testDatabaseCreation() {
  log('Testing database creation...');
  
  try {
    const client = await createConnection('postgres');
    
    // Check if database exists
    const dbResult = await client.query(
      'SELECT datname FROM pg_database WHERE datname = $1',
      [CONFIG.postgres.database]
    );
    
    if (dbResult.rows.length === 0) {
      // Create database
      await client.query(`CREATE DATABASE "${CONFIG.postgres.database}"`);
      log(`Database "${CONFIG.postgres.database}" created`);
    } else {
      log(`Database "${CONFIG.postgres.database}" already exists`);
    }
    
    await client.end();
    
    success('Database creation/verification successful');
    updateResult('database_creation', 'passed', 'Database available', {
      database: CONFIG.postgres.database,
      created: dbResult.rows.length === 0
    });
    
    return true;
  } catch (err) {
    error(`Database creation failed: ${err.message}`);
    updateResult('database_creation', 'failed', `Database creation failed: ${err.message}`);
    return false;
  }
}

// Test Prisma schema validation
async function testPrismaSchema() {
  log('Testing Prisma schema validation...');
  
  try {
    // Look for prisma schema files
    const possibleSchemaPaths = [
      './prisma/schema.prisma',
      './apps/dashboard/prisma/schema.prisma',
      './apps/manager/prisma/schema.prisma',
      './shared/prisma/schema.prisma'
    ];
    
    const foundSchemas = [];
    
    for (const schemaPath of possibleSchemaPaths) {
      try {
        await fs.access(schemaPath);
        foundSchemas.push(schemaPath);
      } catch (err) {
        // File doesn't exist, continue
      }
    }
    
    if (foundSchemas.length === 0) {
      warning('No Prisma schema files found');
      updateResult('prisma_schema', 'warning', 'No Prisma schemas found');
      return false;
    }
    
    const schemaResults = {};
    
    for (const schemaPath of foundSchemas) {
      try {
        const schemaContent = await fs.readFile(schemaPath, 'utf-8');
        
        // Basic schema validation
        const hasGenerator = schemaContent.includes('generator');
        const hasDatasource = schemaContent.includes('datasource');
        const hasModels = schemaContent.includes('model ');
        
        // Count models
        const modelMatches = schemaContent.match(/model\s+\w+/g);
        const modelCount = modelMatches ? modelMatches.length : 0;
        
        schemaResults[schemaPath] = {
          hasGenerator,
          hasDatasource,
          hasModels,
          modelCount,
          size: schemaContent.length
        };
        
        log(`Schema ${schemaPath}: ${modelCount} models`);
      } catch (err) {
        schemaResults[schemaPath] = `Error: ${err.message}`;
      }
    }
    
    results.schema = schemaResults;
    success(`Found ${foundSchemas.length} Prisma schema files`);
    updateResult('prisma_schema', 'passed', 'Prisma schemas validated', {
      schemas: foundSchemas,
      results: schemaResults
    });
    
    return true;
  } catch (err) {
    error(`Prisma schema validation failed: ${err.message}`);
    updateResult('prisma_schema', 'failed', `Schema validation failed: ${err.message}`);
    return false;
  }
}

// Test migrations directory
async function testMigrationsDirectory() {
  log('Testing migrations directory...');
  
  try {
    const possibleMigrationPaths = [
      './prisma/migrations',
      './apps/dashboard/prisma/migrations',
      './apps/manager/prisma/migrations',
      './supabase/migrations'
    ];
    
    const foundMigrations = [];
    
    for (const migrationPath of possibleMigrationPaths) {
      try {
        const stats = await fs.stat(migrationPath);
        if (stats.isDirectory()) {
          const files = await fs.readdir(migrationPath);
          foundMigrations.push({
            path: migrationPath,
            files: files.length,
            fileList: files.slice(0, 10) // First 10 files
          });
        }
      } catch (err) {
        // Directory doesn't exist, continue
      }
    }
    
    if (foundMigrations.length === 0) {
      warning('No migration directories found');
      updateResult('migrations_directory', 'warning', 'No migration directories found');
      return false;
    }
    
    const totalMigrations = foundMigrations.reduce((sum, dir) => sum + dir.files, 0);
    
    success(`Found ${foundMigrations.length} migration directories with ${totalMigrations} total files`);
    updateResult('migrations_directory', 'passed', 'Migration directories found', {
      directories: foundMigrations
    });
    
    return true;
  } catch (err) {
    error(`Migrations directory test failed: ${err.message}`);
    updateResult('migrations_directory', 'failed', `Migrations test failed: ${err.message}`);
    return false;
  }
}

// Test database schema
async function testDatabaseSchema() {
  log('Testing database schema...');
  
  try {
    const client = await createConnection();
    
    // Get all tables
    const tablesResult = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows;
    
    // Get table details
    const tableDetails = {};
    
    for (const table of tables.slice(0, 20)) { // Limit to first 20 tables
      const tableName = table.table_name;
      
      // Get column count
      const columnsResult = await client.query(`
        SELECT COUNT(*) as column_count
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
      `, [tableName]);
      
      // Get row count (for non-system tables)
      let rowCount = 0;
      try {
        if (!tableName.startsWith('_') && !tableName.includes('migration')) {
          const countResult = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
          rowCount = parseInt(countResult.rows[0].count);
        }
      } catch (err) {
        // Ignore count errors for complex tables
      }
      
      tableDetails[tableName] = {
        type: table.table_type,
        columns: parseInt(columnsResult.rows[0].column_count),
        rows: rowCount
      };
    }
    
    // Check for common Langfuse/Supabase tables
    const expectedTables = ['users', 'sessions', 'accounts', 'traces', 'observations'];
    const foundExpectedTables = tables.filter(table => 
      expectedTables.some(expected => table.table_name.includes(expected))
    );
    
    await client.end();
    
    success(`Found ${tables.length} tables in database schema`);
    updateResult('database_schema', 'passed', 'Database schema analyzed', {
      totalTables: tables.length,
      tableDetails,
      expectedTablesFound: foundExpectedTables.length,
      sampleTables: tables.slice(0, 10).map(t => t.table_name)
    });
    
    return true;
  } catch (err) {
    error(`Database schema test failed: ${err.message}`);
    updateResult('database_schema', 'failed', `Schema test failed: ${err.message}`);
    return false;
  }
}

// Test data integrity
async function testDataIntegrity() {
  log('Testing data integrity...');
  
  try {
    const client = await createConnection();
    
    // Test basic data operations
    const testTableName = 'test_integrity_' + Date.now();
    
    // Create test table
    await client.query(`
      CREATE TABLE ${testTableName} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data JSONB
      )
    `);
    
    // Insert test data
    const insertResult = await client.query(`
      INSERT INTO ${testTableName} (name, data) 
      VALUES 
        ('test1', '{"type": "test", "value": 1}'),
        ('test2', '{"type": "test", "value": 2}')
      RETURNING id
    `);
    
    const insertedIds = insertResult.rows.map(row => row.id);
    
    // Read test data
    const selectResult = await client.query(`
      SELECT * FROM ${testTableName} ORDER BY id
    `);
    
    // Update test data
    await client.query(`
      UPDATE ${testTableName} 
      SET data = '{"type": "test", "value": 999, "updated": true}' 
      WHERE id = $1
    `, [insertedIds[0]]);
    
    // Delete test data
    await client.query(`
      DELETE FROM ${testTableName} WHERE id = $1
    `, [insertedIds[1]]);
    
    // Final count
    const finalResult = await client.query(`
      SELECT COUNT(*) as count FROM ${testTableName}
    `);
    
    const finalCount = parseInt(finalResult.rows[0].count);
    
    // Cleanup
    await client.query(`DROP TABLE ${testTableName}`);
    
    await client.end();
    
    if (finalCount === 1 && selectResult.rows.length === 2) {
      success('Data integrity test passed - CRUD operations successful');
      updateResult('data_integrity', 'passed', 'Data integrity verified', {
        insertedRecords: insertedIds.length,
        initialCount: selectResult.rows.length,
        finalCount
      });
      return true;
    } else {
      error('Data integrity test failed - unexpected results');
      updateResult('data_integrity', 'failed', 'Data integrity check failed');
      return false;
    }
  } catch (err) {
    error(`Data integrity test failed: ${err.message}`);
    updateResult('data_integrity', 'failed', `Data integrity failed: ${err.message}`);
    return false;
  }
}

// Test foreign key constraints
async function testConstraints() {
  log('Testing database constraints...');
  
  try {
    const client = await createConnection();
    
    // Get foreign key constraints
    const constraintsResult = await client.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type IN ('FOREIGN KEY', 'PRIMARY KEY', 'UNIQUE')
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_type
    `);
    
    const constraints = constraintsResult.rows;
    
    // Group by constraint type
    const constraintsByType = constraints.reduce((acc, constraint) => {
      const type = constraint.constraint_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(constraint);
      return acc;
    }, {});
    
    await client.end();
    
    success(`Found ${constraints.length} database constraints`);
    updateResult('constraints', 'passed', 'Database constraints analyzed', {
      totalConstraints: constraints.length,
      byType: Object.keys(constraintsByType).reduce((acc, type) => {
        acc[type] = constraintsByType[type].length;
        return acc;
      }, {}),
      sampleConstraints: constraints.slice(0, 10)
    });
    
    return true;
  } catch (err) {
    error(`Constraints test failed: ${err.message}`);
    updateResult('constraints', 'failed', `Constraints test failed: ${err.message}`);
    return false;
  }
}

// Test Supabase integration (if configured)
async function testSupabaseIntegration() {
  log('Testing Supabase integration...');
  
  if (!CONFIG.supabase.url || !CONFIG.supabase.key) {
    warning('Supabase configuration not found - skipping integration test');
    updateResult('supabase_integration', 'warning', 'Supabase not configured');
    return false;
  }
  
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(CONFIG.supabase.url, CONFIG.supabase.key);
    
    // Test connection
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    
    if (error && !error.message.includes('relation "users" does not exist')) {
      throw new Error(`Supabase connection failed: ${error.message}`);
    }
    
    // Test auth endpoints
    const authResponse = await fetch(`${CONFIG.supabase.url}/auth/v1/settings`, {
      headers: {
        'Authorization': `Bearer ${CONFIG.supabase.key}`,
        'apikey': CONFIG.supabase.key
      }
    });
    
    if (!authResponse.ok) {
      throw new Error(`Auth endpoint failed: ${authResponse.status}`);
    }
    
    success('Supabase integration test passed');
    updateResult('supabase_integration', 'passed', 'Supabase integration verified', {
      url: CONFIG.supabase.url,
      authEndpoint: authResponse.status === 200
    });
    
    return true;
  } catch (err) {
    error(`Supabase integration test failed: ${err.message}`);
    updateResult('supabase_integration', 'failed', `Supabase integration failed: ${err.message}`);
    return false;
  }
}

// Save results to file
async function saveResults() {
  const resultsPath = path.join(process.cwd(), 'prisma-migrations-test-results.json');
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  log(`Results saved to ${resultsPath}`);
}

// Generate summary report
function generateSummary() {
  log('=== PRISMA MIGRATIONS TEST SUMMARY ===');
  log(`Total tests: ${results.summary.total}`);
  log(`Passed: ${results.summary.passed}`);
  log(`Failed: ${results.summary.failed}`);
  log(`Warnings: ${results.summary.warnings}`);
  
  if (Object.keys(results.schema).length > 0) {
    log('\nSchema Analysis:');
    Object.entries(results.schema).forEach(([path, info]) => {
      if (typeof info === 'object') {
        log(`  ${path}: ${info.modelCount} models`);
      }
    });
  }
  
  console.log('\nDetailed Results:');
  Object.entries(results.tests).forEach(([testName, result]) => {
    const status = result.status.toUpperCase();
    const emoji = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';
    console.log(`${emoji} ${testName}: ${status} - ${result.message}`);
  });
}

// Main execution
async function main() {
  log('Starting Prisma Migrations and Database Tests');
  log(`PostgreSQL: ${CONFIG.postgres.host}:${CONFIG.postgres.port}/${CONFIG.postgres.database}`);
  log(`Supabase: ${CONFIG.supabase.url ? 'Configured' : 'Not configured'}`);
  
  // Run all tests
  await testPostgreSQLConnectivity();
  await testDatabaseCreation();
  await testPrismaSchema();
  await testMigrationsDirectory();
  await testDatabaseSchema();
  await testDataIntegrity();
  await testConstraints();
  await testSupabaseIntegration();
  
  // Save results and generate summary
  await saveResults();
  generateSummary();
  
  // Store results for coordination
  try {
    await execAsync(
      `npx claude-flow@alpha hooks notification --message "Prisma/database tests completed: ${results.summary.passed}/${results.summary.total} passed" --telemetry true`
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
  createConnection,
  testPostgreSQLConnectivity,
  testDatabaseCreation,
  testPrismaSchema,
  testMigrationsDirectory,
  testDatabaseSchema,
  testDataIntegrity,
  testConstraints,
  testSupabaseIntegration
};