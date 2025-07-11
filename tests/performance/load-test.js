import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests should be below 1s
    http_req_failed: ['rate<0.1'],     // Error rate should be less than 10%
    errors: ['rate<0.1'],              // Custom error rate
  },
};

const API_BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const API_TOKEN = __ENV.FLY_API_TOKEN || 'test-token';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_TOKEN}`,
  };

  // Test 1: Get swarm status
  let response = http.get(`${API_BASE_URL}/api/swarm-status`, { headers });
  
  check(response, {
    'swarm status is 200': (r) => r.status === 200,
    'swarm status has correct content': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.hasOwnProperty('totalMachines') && data.hasOwnProperty('activeMachines');
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);

  sleep(1);

  // Test 2: List machines
  response = http.get(`${API_BASE_URL}/api/machines`, { headers });
  
  check(response, {
    'machines list is 200': (r) => r.status === 200,
    'machines list is array': (r) => {
      try {
        const data = JSON.parse(r.body);
        return Array.isArray(data);
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);

  sleep(1);

  // Test 3: Create machine (POST)
  const machineConfig = {
    name: `load-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    config: {
      image: 'nginx:alpine',
      guest: {
        cpu_kind: 'shared',
        cpus: 1,
        memory_mb: 256,
      },
    },
    region: 'iad',
  };

  response = http.post(`${API_BASE_URL}/api/machines`, JSON.stringify(machineConfig), { headers });
  
  check(response, {
    'machine creation is 201': (r) => r.status === 201,
    'machine creation returns id': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.hasOwnProperty('id');
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);

  let machineId = null;
  try {
    const data = JSON.parse(response.body);
    machineId = data.id;
  } catch {
    console.log('Failed to parse machine creation response');
  }

  sleep(2);

  if (machineId) {
    // Test 4: Start machine
    response = http.post(`${API_BASE_URL}/api/swarms/${machineId}/start`, null, { headers });
    
    check(response, {
      'machine start is 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(2);

    // Test 5: Stop machine
    response = http.post(`${API_BASE_URL}/api/swarms/${machineId}/stop`, null, { headers });
    
    check(response, {
      'machine stop is 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(1);

    // Test 6: Delete machine
    response = http.del(`${API_BASE_URL}/api/machines/${machineId}`, null, { headers });
    
    check(response, {
      'machine deletion is 204': (r) => r.status === 204,
    }) || errorRate.add(1);
  }

  sleep(1);
}

// Setup function - runs once before the test
export function setup() {
  console.log('Starting load test...');
  console.log(`API Base URL: ${API_BASE_URL}`);
  
  // Verify API is accessible
  const response = http.get(`${API_BASE_URL}/api/swarm-status`);
  if (response.status !== 200) {
    throw new Error(`API is not accessible: ${response.status}`);
  }
  
  return { apiBaseUrl: API_BASE_URL };
}

// Teardown function - runs once after the test
export function teardown(data) {
  console.log('Load test completed');
  
  // Clean up any remaining test machines
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_TOKEN}`,
  };
  
  const response = http.get(`${API_BASE_URL}/api/machines`, { headers });
  if (response.status === 200) {
    try {
      const machines = JSON.parse(response.body);
      const testMachines = machines.filter(m => m.name && m.name.includes('load-test'));
      
      console.log(`Cleaning up ${testMachines.length} test machines...`);
      
      testMachines.forEach(machine => {
        http.del(`${API_BASE_URL}/api/machines/${machine.id}`, null, { headers });
      });
    } catch (error) {
      console.log('Error during cleanup:', error);
    }
  }
}