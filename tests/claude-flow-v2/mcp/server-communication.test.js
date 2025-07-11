/**
 * MCP Server Communication Tests for Claude-Flow v2.0.0
 * Tests the MCP server stdio communication protocol
 */

const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const { spawn } = require('child_process');
const path = require('path');

class MCPTestClient {
  constructor() {
    this.server = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let initBuffer = '';
      
      this.server.stdout.on('data', (data) => {
        const text = data.toString();
        initBuffer += text;
        
        // Look for initialization complete
        if (initBuffer.includes('Content-Length:')) {
          // Parse the first message
          this.setupMessageHandling();
          resolve();
        }
      });

      this.server.stderr.on('data', (data) => {
        console.error('MCP Server Error:', data.toString());
      });

      this.server.on('error', reject);
      
      // Timeout if server doesn't start
      setTimeout(() => reject(new Error('MCP server startup timeout')), 5000);
    });
  }

  setupMessageHandling() {
    let buffer = '';
    
    this.server.stdout.on('data', (data) => {
      buffer += data.toString();
      
      // Process complete messages
      while (buffer.includes('\r\n\r\n')) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        const headers = buffer.substring(0, headerEnd);
        
        const contentLengthMatch = headers.match(/Content-Length: (\d+)/);
        if (!contentLengthMatch) {
          buffer = buffer.substring(headerEnd + 4);
          continue;
        }
        
        const contentLength = parseInt(contentLengthMatch[1]);
        const messageStart = headerEnd + 4;
        
        if (buffer.length >= messageStart + contentLength) {
          const messageBody = buffer.substring(messageStart, messageStart + contentLength);
          buffer = buffer.substring(messageStart + contentLength);
          
          try {
            const message = JSON.parse(messageBody);
            this.handleMessage(message);
          } catch (err) {
            console.error('Failed to parse MCP message:', err);
          }
        } else {
          break; // Wait for more data
        }
      }
    });
  }

  handleMessage(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);
      resolve(message);
    }
  }

  async sendRequest(method, params = {}) {
    const id = ++this.messageId;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      const message = JSON.stringify(request);
      const headers = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;
      
      this.server.stdin.write(headers + message);
      
      // Timeout for response
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Timeout waiting for response to ${method}`));
        }
      }, 5000);
    });
  }

  async stop() {
    if (this.server) {
      this.server.kill();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

describe('MCP Server Communication Tests', () => {
  let mcpClient;

  beforeAll(async () => {
    mcpClient = new MCPTestClient();
    await mcpClient.start();
  }, 10000);

  afterAll(async () => {
    await mcpClient.stop();
  });

  describe('Server Initialization', () => {
    it('should respond to initialize request', async () => {
      const response = await mcpClient.sendRequest('initialize', {
        protocolVersion: '0.1.0',
        capabilities: {}
      });
      
      expect(response.result).toBeDefined();
      expect(response.result.protocolVersion).toBe('0.1.0');
      expect(response.result.capabilities).toBeDefined();
    });

    it('should list available tools', async () => {
      const response = await mcpClient.sendRequest('tools/list');
      
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeInstanceOf(Array);
      
      // Check for core tools
      const toolNames = response.result.tools.map(t => t.name);
      expect(toolNames).toContain('swarm_init');
      expect(toolNames).toContain('agent_spawn');
      expect(toolNames).toContain('task_orchestrate');
      expect(toolNames).toContain('memory_usage');
    });
  });

  describe('Swarm Tools', () => {
    it('should execute swarm_init tool', async () => {
      const response = await mcpClient.sendRequest('tools/call', {
        name: 'swarm_init',
        arguments: {
          topology: 'mesh',
          maxAgents: 4,
          strategy: 'balanced'
        }
      });
      
      expect(response.result).toBeDefined();
      expect(response.result.content).toBeInstanceOf(Array);
      
      const textContent = response.result.content.find(c => c.type === 'text');
      expect(textContent.text).toContain('initialized');
    });

    it('should execute swarm_status tool', async () => {
      const response = await mcpClient.sendRequest('tools/call', {
        name: 'swarm_status',
        arguments: {}
      });
      
      expect(response.result).toBeDefined();
      const textContent = response.result.content.find(c => c.type === 'text');
      expect(textContent.text).toMatch(/swarm|status/i);
    });

    it('should handle invalid topology', async () => {
      const response = await mcpClient.sendRequest('tools/call', {
        name: 'swarm_init',
        arguments: {
          topology: 'invalid'
        }
      });
      
      expect(response.error || response.result.isError).toBeDefined();
    });
  });

  describe('Agent Tools', () => {
    it('should spawn agents', async () => {
      const response = await mcpClient.sendRequest('tools/call', {
        name: 'agent_spawn',
        arguments: {
          type: 'researcher',
          name: 'MCPTestAgent',
          capabilities: ['search', 'analyze']
        }
      });
      
      expect(response.result).toBeDefined();
      const textContent = response.result.content.find(c => c.type === 'text');
      expect(textContent.text).toContain('spawned');
    });

    it('should list agents', async () => {
      const response = await mcpClient.sendRequest('tools/call', {
        name: 'agent_list',
        arguments: {
          filter: 'all'
        }
      });
      
      expect(response.result).toBeDefined();
      const textContent = response.result.content.find(c => c.type === 'text');
      expect(textContent.text).toMatch(/agent/i);
    });
  });

  describe('Memory Tools', () => {
    it('should store memory', async () => {
      const response = await mcpClient.sendRequest('tools/call', {
        name: 'memory_usage',
        arguments: {
          action: 'store',
          key: 'mcp-test-key',
          value: JSON.stringify({ test: true }),
          namespace: 'mcp-testing'
        }
      });
      
      expect(response.result).toBeDefined();
      const textContent = response.result.content.find(c => c.type === 'text');
      expect(textContent.text).toContain('stored');
    });

    it('should retrieve memory', async () => {
      const response = await mcpClient.sendRequest('tools/call', {
        name: 'memory_usage',
        arguments: {
          action: 'retrieve',
          key: 'mcp-test-key',
          namespace: 'mcp-testing'
        }
      });
      
      expect(response.result).toBeDefined();
      const textContent = response.result.content.find(c => c.type === 'text');
      expect(textContent.text).toContain('test');
    });

    it('should search memory', async () => {
      const response = await mcpClient.sendRequest('tools/call', {
        name: 'memory_search',
        arguments: {
          pattern: 'mcp-test',
          namespace: 'mcp-testing'
        }
      });
      
      expect(response.result).toBeDefined();
    });
  });

  describe('Task Orchestration Tools', () => {
    it('should orchestrate tasks', async () => {
      const response = await mcpClient.sendRequest('tools/call', {
        name: 'task_orchestrate',
        arguments: {
          task: 'MCP test task execution',
          strategy: 'parallel',
          priority: 'medium'
        }
      });
      
      expect(response.result).toBeDefined();
      const textContent = response.result.content.find(c => c.type === 'text');
      expect(textContent.text).toMatch(/orchestrat|task/i);
    });

    it('should get task status', async () => {
      const response = await mcpClient.sendRequest('tools/call', {
        name: 'task_status',
        arguments: {}
      });
      
      expect(response.result).toBeDefined();
    });
  });

  describe('Neural Pattern Tools', () => {
    it('should get neural status', async () => {
      const response = await mcpClient.sendRequest('tools/call', {
        name: 'neural_status',
        arguments: {}
      });
      
      expect(response.result).toBeDefined();
      const textContent = response.result.content.find(c => c.type === 'text');
      expect(textContent.text).toMatch(/neural|pattern/i);
    });

    it('should train neural patterns', async () => {
      const response = await mcpClient.sendRequest('tools/call', {
        name: 'neural_train',
        arguments: {
          iterations: 5
        }
      });
      
      expect(response.result).toBeDefined();
      const textContent = response.result.content.find(c => c.type === 'text');
      expect(textContent.text).toMatch(/train|iteration/i);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool', async () => {
      const response = await mcpClient.sendRequest('tools/call', {
        name: 'unknown_tool',
        arguments: {}
      });
      
      expect(response.error).toBeDefined();
      expect(response.error.message).toContain('unknown');
    });

    it('should handle invalid arguments', async () => {
      const response = await mcpClient.sendRequest('tools/call', {
        name: 'swarm_init',
        arguments: {
          maxAgents: 'invalid' // Should be number
        }
      });
      
      expect(response.error || response.result.isError).toBeDefined();
    });

    it('should handle missing required arguments', async () => {
      const response = await mcpClient.sendRequest('tools/call', {
        name: 'memory_usage',
        arguments: {
          action: 'store'
          // Missing required 'key' and 'value'
        }
      });
      
      expect(response.error || response.result.isError).toBeDefined();
    });
  });

  describe('Protocol Compliance', () => {
    it('should handle batch requests', async () => {
      // Note: This is a simplified test. Full batch request handling
      // would require modifying the client to support batch mode
      const response1 = await mcpClient.sendRequest('tools/list');
      const response2 = await mcpClient.sendRequest('swarm_status');
      
      expect(response1.result).toBeDefined();
      expect(response2.result).toBeDefined();
    });

    it('should include proper JSON-RPC fields', async () => {
      const response = await mcpClient.sendRequest('tools/list');
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBeDefined();
      expect(response.result || response.error).toBeDefined();
    });
  });
});