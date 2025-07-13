#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/dashboard/.env.local' });
require('dotenv').config({ path: 'apps/manager/.env' });

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function print(message, color = '') {
  console.log(color + message + colors.reset);
}

function printHeader(message) {
  console.log('\n' + colors.bright + colors.cyan + '═══ ' + message + ' ═══' + colors.reset + '\n');
}

async function checkEnvFile(filePath, requiredKeys) {
  try {
    await fs.access(filePath);
    print(`✅ Found ${filePath}`, colors.green);
    
    // Read and check keys
    const content = await fs.readFile(filePath, 'utf8');
    const missingKeys = [];
    const foundKeys = [];
    
    for (const key of requiredKeys) {
      const regex = new RegExp(`^${key}=.+$`, 'm');
      if (regex.test(content)) {
        foundKeys.push(key);
      } else {
        missingKeys.push(key);
      }
    }
    
    if (missingKeys.length > 0) {
      print(`❌ Missing keys in ${filePath}:`, colors.red);
      missingKeys.forEach(key => print(`   - ${key}`, colors.red));
      return false;
    }
    
    foundKeys.forEach(key => print(`   ✓ ${key}`, colors.green));
    return true;
  } catch (error) {
    print(`❌ Not found: ${filePath}`, colors.red);
    return false;
  }
}

async function testSupabaseConnection(url, key, keyType) {
  try {
    const supabase = createClient(url, key);
    
    // Test basic connection
    const { count, error } = await supabase
      .from('swarms')
      .select('*', { count: 'exact', head: true });
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw error;
    }
    
    print(`✅ ${keyType} key connection successful`, colors.green);
    return true;
  } catch (error) {
    print(`❌ ${keyType} key connection failed: ${error.message}`, colors.red);
    return false;
  }
}

async function checkDatabaseSchema(supabase) {
  const requiredTables = ['swarms', 'workers', 'tasks', 'logs', 'metrics', 'templates'];
  const foundTables = [];
  const missingTables = [];
  
  for (const table of requiredTables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        missingTables.push(table);
      } else {
        foundTables.push(table);
      }
    } catch (error) {
      missingTables.push(table);
    }
  }
  
  if (missingTables.length > 0) {
    print('❌ Missing tables:', colors.red);
    missingTables.forEach(table => print(`   - ${table}`, colors.red));
    print('\n💡 Run the migration in Supabase SQL Editor:', colors.yellow);
    print('   supabase/migrations/001_initial_schema.sql', colors.cyan);
    return false;
  }
  
  foundTables.forEach(table => print(`   ✓ ${table}`, colors.green));
  return true;
}

async function checkRealtimeEnabled(supabase) {
  print('\n🔍 Checking realtime configuration...', colors.yellow);
  
  return new Promise((resolve) => {
    let receivedEvent = false;
    const testId = `test-${Date.now()}`;
    
    // Subscribe to changes
    const channel = supabase
      .channel('verify-test')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'swarms' }, 
        (payload) => {
          if (payload.new && payload.new.name && payload.new.name.includes(testId)) {
            receivedEvent = true;
            print('✅ Realtime is working!', colors.green);
          }
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Create a test record to trigger realtime
          const { error } = await supabase
            .from('swarms')
            .insert({
              name: `Test Swarm ${testId}`,
              purpose: 'Verification test',
              status: 'initializing'
            })
            .select()
            .single();
          
          if (error) {
            print('❌ Could not create test record', colors.red);
          }
          
          // Wait for realtime event
          setTimeout(async () => {
            // Cleanup
            await supabase.from('swarms').delete().match({ name: `Test Swarm ${testId}` });
            supabase.removeChannel(channel);
            
            if (!receivedEvent) {
              print('⚠️  Realtime events not received', colors.yellow);
              print('   Enable replication in Database → Replication', colors.yellow);
              resolve(false);
            } else {
              resolve(true);
            }
          }, 3000);
        }
      });
  });
}

async function checkApiEndpoints() {
  const endpoints = [
    { url: 'http://localhost:8080/health', name: 'Manager Health' },
    { url: 'http://localhost:3000', name: 'Dashboard' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(endpoint.url, { 
        signal: controller.signal,
        method: 'GET'
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        print(`✅ ${endpoint.name} is accessible`, colors.green);
      } else {
        print(`⚠️  ${endpoint.name} returned status ${response.status}`, colors.yellow);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        print(`⚠️  ${endpoint.name} is not running (timeout)`, colors.yellow);
      } else {
        print(`⚠️  ${endpoint.name} is not accessible`, colors.yellow);
      }
    }
  }
}

async function runVerification() {
  print('\n🔍 SUPABASE VERIFICATION TOOL', colors.bright + colors.blue);
  print('Checking your Supabase setup...\n');
  
  let allPassed = true;
  
  // Step 1: Check environment files
  printHeader('Environment Files');
  
  const dashboardEnvOk = await checkEnvFile('apps/dashboard/.env.local', [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'MANAGER_URL'
  ]);
  
  const managerEnvOk = await checkEnvFile('apps/manager/.env', [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'PORT'
  ]);
  
  allPassed = allPassed && dashboardEnvOk && managerEnvOk;
  
  if (!dashboardEnvOk || !managerEnvOk) {
    print('\n💡 Run the setup wizard to configure:', colors.yellow);
    print('   node scripts/supabase-wizard.js', colors.cyan);
    return;
  }
  
  // Step 2: Test connections
  printHeader('Supabase Connection');
  
  const dashboardUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const dashboardKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const managerUrl = process.env.SUPABASE_URL;
  const managerKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!dashboardUrl || !dashboardKey) {
    print('❌ Missing Supabase credentials in dashboard .env', colors.red);
    allPassed = false;
  } else {
    const dashboardOk = await testSupabaseConnection(dashboardUrl, dashboardKey, 'Anon');
    allPassed = allPassed && dashboardOk;
  }
  
  if (!managerUrl || !managerKey) {
    print('❌ Missing Supabase credentials in manager .env', colors.red);
    allPassed = false;
  } else {
    const managerOk = await testSupabaseConnection(managerUrl, managerKey, 'Service');
    allPassed = allPassed && managerOk;
  }
  
  if (!allPassed) return;
  
  // Step 3: Check database schema
  printHeader('Database Schema');
  
  const supabase = createClient(dashboardUrl, dashboardKey);
  const schemaOk = await checkDatabaseSchema(supabase);
  allPassed = allPassed && schemaOk;
  
  if (!schemaOk) return;
  
  // Step 4: Check realtime
  printHeader('Realtime Configuration');
  
  const realtimeOk = await checkRealtimeEnabled(supabase);
  allPassed = allPassed && realtimeOk;
  
  // Step 5: Check services (optional)
  printHeader('Service Status');
  print('Checking if services are running...\n');
  await checkApiEndpoints();
  
  // Step 6: Summary
  printHeader('Verification Summary');
  
  if (allPassed) {
    print('✅ All checks passed!', colors.bright + colors.green);
    print('\nYour Supabase setup is complete and working correctly.', colors.green);
    print('\nNext steps:', colors.bright);
    print('1. Start the services:', colors.cyan);
    print('   pnpm dev', colors.white);
    print('2. Open the dashboard:', colors.cyan);
    print('   http://localhost:3000', colors.white);
    print('3. Launch your first swarm! 🚀', colors.cyan);
  } else {
    print('⚠️  Some checks failed', colors.yellow);
    print('\nPlease fix the issues above and run verification again.', colors.yellow);
    print('\nNeed help? Check:', colors.bright);
    print('- docs/SUPABASE_VISUAL_GUIDE.md', colors.cyan);
    print('- docs/swarm-memory/operations/SUPABASE_SETUP.md', colors.cyan);
  }
  
  // Additional diagnostics
  if (process.argv.includes('--verbose')) {
    printHeader('Diagnostic Information');
    print('Dashboard URL: ' + (dashboardUrl || 'NOT SET'), dashboardUrl ? colors.green : colors.red);
    print('Manager URL: ' + (managerUrl || 'NOT SET'), managerUrl ? colors.green : colors.red);
    print('Node version: ' + process.version, colors.cyan);
    print('Platform: ' + process.platform, colors.cyan);
  }
}

// Run verification
runVerification().catch(error => {
  print(`\n❌ Verification failed: ${error.message}`, colors.red);
  process.exit(1);
});