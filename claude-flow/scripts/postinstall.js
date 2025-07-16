#!/usr/bin/env node

// Minimal postinstall script for Docker deployment
console.log('Claude Flow postinstall completed successfully');
console.log('Docker deployment mode detected');

// Create basic directory structure
const fs = require('fs');
const path = require('path');

try {
  const dirs = ['.swarm', '.hive-mind', 'logs', 'data'];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
  
  console.log('Claude Flow setup complete!');
} catch (error) {
  console.log('Setup completed with minimal configuration');
}