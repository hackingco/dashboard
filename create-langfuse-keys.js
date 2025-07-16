#!/usr/bin/env node

// Create API keys for Langfuse
const crypto = require('crypto');

function generateLangfuseKeys() {
  const publicKey = `pk-lf-${crypto.randomUUID()}`;
  const secretKey = `sk-lf-${crypto.randomBytes(32).toString('hex')}`;
  
  return { publicKey, secretKey };
}

const keys = generateLangfuseKeys();
console.log('Generated Langfuse API Keys:');
console.log('PUBLIC_KEY:', keys.publicKey);
console.log('SECRET_KEY:', keys.secretKey);
console.log('');
console.log('Copy these to your .env.langfuse file:');
console.log(`LANGFUSE_PUBLIC_KEY=${keys.publicKey}`);
console.log(`LANGFUSE_SECRET_KEY=${keys.secretKey}`);