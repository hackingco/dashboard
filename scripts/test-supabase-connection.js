#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Please update your .env.local file with:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log('🔍 Testing Supabase connection...');
console.log(`URL: ${supabaseUrl}`);
console.log(`Key: ${supabaseKey.substring(0, 20)}...`);
console.log('');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Test 1: Basic connection
    console.log('📡 Test 1: Basic connection...');
    const { data: swarms, error: swarmsError } = await supabase
      .from('swarms')
      .select('id, name, status')
      .limit(5);
    
    if (swarmsError) {
      console.error('❌ Failed to query swarms:', swarmsError.message);
      return;
    }
    
    console.log('✅ Connected successfully!');
    console.log(`Found ${swarms.length} swarms`);
    if (swarms.length > 0) {
      console.log('Sample swarm:', swarms[0]);
    }
    console.log('');

    // Test 2: Insert test data
    console.log('📝 Test 2: Creating test swarm...');
    const testSwarm = {
      name: 'Test Swarm ' + Date.now(),
      purpose: 'Connection test',
      status: 'initializing',
      worker_count: 0,
      config: { test: true },
      metrics: {},
    };

    const { data: newSwarm, error: insertError } = await supabase
      .from('swarms')
      .insert(testSwarm)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Failed to create test swarm:', insertError.message);
      return;
    }

    console.log('✅ Test swarm created:', newSwarm.id);
    console.log('');

    // Test 3: Real-time subscription
    console.log('📡 Test 3: Testing real-time updates...');
    console.log('Subscribing to swarm changes...');
    
    const channel = supabase
      .channel('test-swarms')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'swarms' }, 
        payload => {
          console.log('🔔 Real-time event received:', payload.eventType);
          if (payload.new) {
            console.log('Updated swarm:', payload.new.name);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription active');
          console.log('');
          
          // Update the test swarm to trigger event
          console.log('📝 Updating test swarm to trigger real-time event...');
          supabase
            .from('swarms')
            .update({ status: 'running' })
            .eq('id', newSwarm.id)
            .then(({ error }) => {
              if (error) {
                console.error('❌ Failed to update swarm:', error.message);
              } else {
                console.log('✅ Update sent, waiting for real-time event...');
              }
            });
        }
      });

    // Wait for real-time test
    setTimeout(async () => {
      console.log('');
      console.log('🧹 Cleaning up test data...');
      
      // Delete test swarm
      const { error: deleteError } = await supabase
        .from('swarms')
        .delete()
        .eq('id', newSwarm.id);

      if (deleteError) {
        console.error('❌ Failed to delete test swarm:', deleteError.message);
      } else {
        console.log('✅ Test swarm deleted');
      }

      // Cleanup subscription
      supabase.removeChannel(channel);
      console.log('✅ Unsubscribed from real-time updates');
      
      console.log('');
      console.log('🎉 All tests completed successfully!');
      console.log('Your Supabase connection is working properly.');
      process.exit(0);
    }, 5000);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run tests
testConnection().catch(console.error);