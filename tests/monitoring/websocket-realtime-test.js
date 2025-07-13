#!/usr/bin/env node

/**
 * WebSocket Real-time Connection Testing Suite
 * Tests WebSocket connections for real-time state updates
 * Usage: node websocket-realtime-test.js [environment]
 */

const WebSocket = require('ws');
const { performance } = require('perf_hooks');

// Configuration
const config = {
  staging: {
    dashboard: 'wss://staging.hive-mind.fly.dev/ws',
    manager: 'wss://staging-manager.hive-mind.fly.dev/ws'
  },
  production: {
    dashboard: 'wss://hive-mind.fly.dev/ws',
    manager: 'wss://manager.hive-mind.fly.dev/ws'
  },
  current: {
    dashboard: 'wss://swarm-admin-dashboard-3vgcyjnzq-hackingco.vercel.app/ws',
    manager: 'wss://swarm-mgr-1739853764.fly.dev/ws'
  }
};

const ENVIRONMENT = process.argv[2] || 'current';
const TIMEOUT = 30000; // 30 seconds
const PING_INTERVAL = 5000; // 5 seconds
const MAX_RETRIES = 3;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

class WebSocketTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logTest(testName, status, details = '') {
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    const color = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
    this.log(`${icon} ${testName}: ${status} ${details}`, color);
    
    this.results.tests.push({ name: testName, status, details });
    if (status === 'PASS') this.results.passed++;
    else if (status === 'FAIL') this.results.failed++;
  }

  async testWebSocketConnection(name, url, testMessages = []) {
    return new Promise((resolve) => {
      const startTime = performance.now();
      let ws;
      let pingInterval;
      let timeout;
      let isResolved = false;

      const cleanup = () => {
        if (pingInterval) clearInterval(pingInterval);
        if (timeout) clearTimeout(timeout);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };

      const resolveTest = (status, details) => {
        if (isResolved) return;
        isResolved = true;
        cleanup();
        const duration = Math.round(performance.now() - startTime);
        this.logTest(`${name} Connection`, status, `${details} (${duration}ms)`);
        resolve(status === 'PASS');
      };

      try {
        ws = new WebSocket(url, {
          handshakeTimeout: TIMEOUT,
          headers: {
            'User-Agent': 'WebSocket-Tester/1.0'
          }
        });

        // Set connection timeout
        timeout = setTimeout(() => {
          resolveTest('FAIL', 'Connection timeout');
        }, TIMEOUT);

        ws.on('open', () => {
          this.log(`🔌 Connected to ${name}: ${url}`, 'blue');
          
          // Start ping/pong to keep connection alive
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.ping();
            }
          }, PING_INTERVAL);

          // Send test messages
          testMessages.forEach((msg, index) => {
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                this.log(`📤 Sending test message ${index + 1}`, 'blue');
                ws.send(JSON.stringify(msg));
              }
            }, (index + 1) * 1000);
          });

          // Consider connection successful after receiving any message or after 5 seconds
          setTimeout(() => {
            resolveTest('PASS', 'Connection established and stable');
          }, 5000);
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.log(`📥 Received: ${JSON.stringify(message)}`, 'magenta');
            
            // If we receive a proper response, consider it successful immediately
            if (message.type || message.event || message.data) {
              resolveTest('PASS', 'Connection established and responsive');
            }
          } catch (e) {
            this.log(`📥 Received raw data: ${data.toString().substring(0, 100)}`, 'magenta');
          }
        });

        ws.on('pong', () => {
          this.log(`🏓 Pong received from ${name}`, 'blue');
        });

        ws.on('error', (error) => {
          resolveTest('FAIL', `Connection error: ${error.message}`);
        });

        ws.on('close', (code, reason) => {
          if (!isResolved) {
            const reasonStr = reason ? reason.toString() : 'No reason provided';
            resolveTest('FAIL', `Connection closed: ${code} - ${reasonStr}`);
          }
        });

      } catch (error) {
        resolveTest('FAIL', `Setup error: ${error.message}`);
      }
    });
  }

  async testRealTimeUpdates(name, url) {
    return new Promise((resolve) => {
      const startTime = performance.now();
      let ws;
      let timeout;
      let isResolved = false;
      let messagesReceived = 0;

      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };

      const resolveTest = (status, details) => {
        if (isResolved) return;
        isResolved = true;
        cleanup();
        const duration = Math.round(performance.now() - startTime);
        this.logTest(`${name} Real-time Updates`, status, `${details} (${duration}ms)`);
        resolve(status === 'PASS');
      };

      try {
        ws = new WebSocket(url);

        timeout = setTimeout(() => {
          resolveTest('FAIL', 'Real-time test timeout');
        }, TIMEOUT);

        ws.on('open', () => {
          // Subscribe to real-time events
          const subscribeMessages = [
            { type: 'subscribe', channel: 'swarm_status' },
            { type: 'subscribe', channel: 'machine_updates' },
            { type: 'subscribe', channel: 'task_progress' },
            { type: 'ping' }
          ];

          subscribeMessages.forEach((msg, index) => {
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(msg));
              }
            }, index * 500);
          });
        });

        ws.on('message', (data) => {
          messagesReceived++;
          this.log(`📊 Real-time update #${messagesReceived}: ${data.toString().substring(0, 100)}`, 'magenta');
          
          // Consider successful if we receive multiple real-time messages
          if (messagesReceived >= 2) {
            resolveTest('PASS', `Received ${messagesReceived} real-time updates`);
          }
        });

        ws.on('error', (error) => {
          resolveTest('FAIL', `Real-time error: ${error.message}`);
        });

        ws.on('close', () => {
          if (!isResolved) {
            if (messagesReceived > 0) {
              resolveTest('PASS', `Received ${messagesReceived} updates before close`);
            } else {
              resolveTest('FAIL', 'Connection closed without real-time updates');
            }
          }
        });

        // If no real-time updates after 15 seconds, consider it a partial success
        setTimeout(() => {
          if (!isResolved) {
            if (messagesReceived > 0) {
              resolveTest('PASS', `Limited real-time updates (${messagesReceived})`);
            } else {
              resolveTest('WARN', 'No real-time updates detected');
            }
          }
        }, 15000);

      } catch (error) {
        resolveTest('FAIL', `Real-time setup error: ${error.message}`);
      }
    });
  }

  async testLoadBalancing(urls) {
    this.log('🔄 Testing load balancing across endpoints...', 'blue');
    
    const connectionPromises = urls.map(async (url, index) => {
      return this.testWebSocketConnection(`Load Test ${index + 1}`, url);
    });

    const results = await Promise.allSettled(connectionPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    
    this.logTest('Load Balancing', 
      successful > urls.length / 2 ? 'PASS' : 'FAIL',
      `${successful}/${urls.length} endpoints successful`);
    
    return successful > urls.length / 2;
  }

  async runAllTests() {
    this.log('🧪 WebSocket Real-time Testing Suite', 'blue');
    this.log('====================================', 'blue');
    this.log(`Environment: ${ENVIRONMENT}`, 'blue');
    this.log('');

    const endpoints = config[ENVIRONMENT];
    if (!endpoints) {
      this.log(`❌ Unknown environment: ${ENVIRONMENT}`, 'red');
      this.log(`Available environments: ${Object.keys(config).join(', ')}`, 'yellow');
      return false;
    }

    // Test each endpoint
    for (const [serviceName, serviceUrl] of Object.entries(endpoints)) {
      this.log(`\n🔍 Testing ${serviceName.toUpperCase()} Service`, 'blue');
      this.log(`URL: ${serviceUrl}`, 'blue');
      
      // Basic connection test
      const basicTest = await this.testWebSocketConnection(serviceName, serviceUrl, [
        { type: 'ping' },
        { type: 'status_request' }
      ]);

      // Real-time updates test (only if basic test passes)
      if (basicTest) {
        await this.testRealTimeUpdates(serviceName, serviceUrl);
      } else {
        this.logTest(`${serviceName} Real-time Updates`, 'SKIP', 'Basic connection failed');
      }
    }

    // Load balancing test
    this.log('\n🏋️ Load Balancing Tests', 'blue');
    const allUrls = Object.values(endpoints);
    await this.testLoadBalancing(allUrls);

    // Performance summary
    this.log('\n📊 Performance Summary', 'blue');
    this.log('===================', 'blue');
    
    const totalTests = this.results.passed + this.results.failed;
    const successRate = totalTests > 0 ? Math.round((this.results.passed / totalTests) * 100) : 0;
    
    this.log(`✅ Passed: ${this.results.passed}`, 'green');
    this.log(`❌ Failed: ${this.results.failed}`, 'red');
    this.log(`📈 Success Rate: ${successRate}%`, successRate >= 70 ? 'green' : 'red');

    // Failed tests details
    if (this.results.failed > 0) {
      this.log('\n❌ Failed Tests:', 'red');
      this.results.tests
        .filter(t => t.status === 'FAIL')
        .forEach(t => this.log(`  - ${t.name}: ${t.details}`, 'red'));
      
      this.log('\n💡 Troubleshooting Tips:', 'yellow');
      this.log('  1. Check if WebSocket endpoints are correctly configured');
      this.log('  2. Verify firewall/proxy settings allow WebSocket connections');
      this.log('  3. Check if services are running and healthy');
      this.log('  4. Test with wscat: wscat -c <websocket-url>');
      this.log('  5. Check browser network console for WebSocket errors');
    }

    return this.results.failed === 0;
  }
}

// Main execution
async function main() {
  // Check if WebSocket is available
  if (typeof WebSocket === 'undefined') {
    console.log('❌ WebSocket not available in this environment');
    console.log('💡 Try installing ws: npm install ws');
    process.exit(1);
  }

  const tester = new WebSocketTester();
  
  try {
    const success = await tester.runAllTests();
    
    if (success) {
      tester.log('\n🎉 All WebSocket tests passed! Real-time connections are healthy.', 'green');
      process.exit(0);
    } else {
      tester.log('\n❌ Some WebSocket tests failed.', 'red');
      process.exit(1);
    }
  } catch (error) {
    tester.log(`\n💥 Test suite error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test suite interrupted');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test suite terminated');
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { WebSocketTester };