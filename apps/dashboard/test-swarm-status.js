const https = require('https');

// Test the swarm status API endpoint
const testSwarmStatus = async () => {
  console.log('Testing swarm status API at https://swarm-admin.fly.dev/api/swarm-status');
  
  const options = {
    hostname: 'swarm-admin.fly.dev',
    path: '/api/swarm-status',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json'
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log(`Status Code: ${res.statusCode}`);
      console.log('Headers:', JSON.stringify(res.headers, null, 2));
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('\nResponse length:', data.length);
        if (res.headers['content-type']?.includes('application/json')) {
          try {
            const parsed = JSON.parse(data);
            console.log('JSON Response:', JSON.stringify(parsed, null, 2));
          } catch (e) {
            console.log('Failed to parse JSON:', e.message);
            console.log('First 500 chars:', data.substring(0, 500));
          }
        } else {
          console.log('Content-Type:', res.headers['content-type']);
          console.log('First 500 chars:', data.substring(0, 500));
        }
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });
    
    req.end();
  });
};

testSwarmStatus().catch(console.error);