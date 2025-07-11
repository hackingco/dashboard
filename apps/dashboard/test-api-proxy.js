const https = require('https');

// Test the API proxy endpoint
const testApiProxy = async () => {
  console.log('Testing API proxy at https://swarm-admin.fly.dev/api/machines/apps');
  
  const options = {
    hostname: 'swarm-admin.fly.dev',
    path: '/api/machines/apps',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json'
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log(`Status Code: ${res.statusCode}`);
      console.log('Headers:', res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('Response:', JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log('Raw Response:', data);
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

testApiProxy().catch(console.error);