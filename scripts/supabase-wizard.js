#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Colors for terminal output
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

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function createEnvFile(filePath, content) {
  await fs.writeFile(filePath, content, 'utf8');
  print(`✅ Created ${filePath}`, colors.green);
}

async function updateEnvFile(filePath, updates) {
  let content = '';
  
  if (await fileExists(filePath)) {
    content = await fs.readFile(filePath, 'utf8');
  }
  
  // Update or add each key
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'gm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }
  
  await fs.writeFile(filePath, content.trim() + '\n', 'utf8');
  print(`✅ Updated ${filePath}`, colors.green);
}

async function setupWizard() {
  print('\n🧙‍♂️ SUPABASE CONFIGURATION WIZARD', colors.bright + colors.blue);
  print('This wizard will help you set up Supabase for your Swarm Orchestrator\n');

  // Step 1: Check if user has Supabase account
  printHeader('Step 1: Supabase Account');
  const hasAccount = await question('Do you have a Supabase account? (y/n): ');
  
  if (hasAccount.toLowerCase() !== 'y') {
    print('\n📝 Please create a free account at: https://app.supabase.com', colors.yellow);
    print('Press Enter when you have created your account...');
    await question('');
  }

  // Step 2: Create project
  printHeader('Step 2: Create Supabase Project');
  print('1. Go to https://app.supabase.com');
  print('2. Click "New project"');
  print('3. Use these settings:');
  print('   - Name: swarm-orchestrator', colors.cyan);
  print('   - Database Password: (choose a strong password)', colors.cyan);
  print('   - Region: (choose closest to you)', colors.cyan);
  print('\nPress Enter when your project is created...');
  await question('');

  // Step 3: Get credentials
  printHeader('Step 3: Get Your API Keys');
  print('In your Supabase dashboard:');
  print('1. Go to Settings → API');
  print('2. Copy the following values:\n');

  const projectUrl = await question('Project URL (https://xxxxx.supabase.co): ');
  const anonKey = await question('anon/public key: ');
  const serviceKey = await question('service_role key (keep secret!): ');

  // Step 4: Configure environment files
  printHeader('Step 4: Configure Environment Files');
  
  // Dashboard env
  const dashboardEnv = {
    NEXT_PUBLIC_SUPABASE_URL: projectUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    MANAGER_URL: 'http://localhost:8080'
  };
  
  await updateEnvFile('apps/dashboard/.env.local', dashboardEnv);
  
  // Manager env
  const managerEnv = {
    SUPABASE_URL: projectUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    PORT: '8080',
    DASHBOARD_URL: 'http://localhost:3000'
  };
  
  await updateEnvFile('apps/manager/.env', managerEnv);

  // Step 5: Run database migration
  printHeader('Step 5: Database Migration');
  print('Now we need to set up your database schema.\n');
  print('1. Go to your Supabase dashboard');
  print('2. Click on "SQL Editor" in the left sidebar');
  print('3. Click "New query"');
  print('4. The migration SQL has been copied to your clipboard (if supported)');
  print('5. Paste it into the SQL editor and click "RUN"\n');

  // Try to copy migration to clipboard
  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations/001_initial_schema.sql');
    const migration = await fs.readFile(migrationPath, 'utf8');
    
    if (process.platform === 'darwin') {
      await execAsync(`echo '${migration.replace(/'/g, "'\\''")}' | pbcopy`);
      print('✅ Migration SQL copied to clipboard!', colors.green);
    } else if (process.platform === 'linux') {
      await execAsync(`echo '${migration.replace(/'/g, "'\\''")}' | xclip -selection clipboard`);
      print('✅ Migration SQL copied to clipboard!', colors.green);
    } else {
      print('📋 Please manually copy the migration from: supabase/migrations/001_initial_schema.sql', colors.yellow);
    }
  } catch (err) {
    print('📋 Please manually copy the migration from: supabase/migrations/001_initial_schema.sql', colors.yellow);
  }

  print('\nPress Enter after running the migration...');
  await question('');

  // Step 6: Enable realtime
  printHeader('Step 6: Enable Realtime');
  print('Enable realtime for your tables:\n');
  print('1. Go to Database → Replication');
  print('2. Click "0 tables" under "Source"');
  print('3. Enable replication for these tables:');
  print('   ✓ swarms', colors.cyan);
  print('   ✓ workers', colors.cyan);
  print('   ✓ tasks', colors.cyan);
  print('   ✓ logs', colors.cyan);
  print('   ✓ metrics', colors.cyan);
  print('\nPress Enter after enabling realtime...');
  await question('');

  // Step 7: Test connection
  printHeader('Step 7: Test Connection');
  const testConnection = await question('Would you like to test the connection now? (y/n): ');
  
  if (testConnection.toLowerCase() === 'y') {
    print('\n🔍 Testing connection...', colors.yellow);
    
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(projectUrl, anonKey);
      
      const { data, error } = await supabase.from('swarms').select('count').single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows, which is OK
        throw error;
      }
      
      print('✅ Connection successful!', colors.green);
      
      // Test realtime
      print('📡 Testing realtime...', colors.yellow);
      const channel = supabase
        .channel('test')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'swarms' }, payload => {
          print('✅ Realtime is working!', colors.green);
        })
        .subscribe();
      
      setTimeout(() => {
        supabase.removeChannel(channel);
      }, 2000);
      
    } catch (err) {
      print(`❌ Connection failed: ${err.message}`, colors.red);
      print('Please check your credentials and try again.', colors.yellow);
    }
  }

  // Step 8: Next steps
  printHeader('Setup Complete! 🎉');
  print('Your Supabase integration is configured.\n');
  print('Next steps:', colors.bright);
  print('1. Install dependencies: ' + colors.cyan + 'pnpm install');
  print('2. Build packages: ' + colors.cyan + 'pnpm --filter @swarm/supabase build');
  print('3. Start the manager: ' + colors.cyan + 'cd apps/manager && pnpm dev');
  print('4. Start the dashboard: ' + colors.cyan + 'cd apps/dashboard && pnpm dev');
  print('\n5. Open http://localhost:3000 and launch your first swarm! 🚀\n');

  // Optional: Add Fly.io token
  const configureFly = await question('Would you like to configure Fly.io integration? (y/n): ');
  
  if (configureFly.toLowerCase() === 'y') {
    printHeader('Fly.io Configuration');
    print('Get your Fly API token:');
    print('1. Install Fly CLI: ' + colors.cyan + 'curl -L https://fly.io/install.sh | sh');
    print('2. Login: ' + colors.cyan + 'fly auth login');
    print('3. Get token: ' + colors.cyan + 'fly auth token\n');
    
    const flyToken = await question('Fly API token: ');
    
    if (flyToken) {
      await updateEnvFile('apps/manager/.env', { FLY_API_TOKEN: flyToken });
      print('✅ Fly.io configured!', colors.green);
    }
  }

  rl.close();
  print('\n✨ Wizard complete! Happy swarming! 🐝\n', colors.bright + colors.green);
}

// Run the wizard
setupWizard().catch(err => {
  print(`\n❌ Error: ${err.message}`, colors.red);
  rl.close();
  process.exit(1);
});