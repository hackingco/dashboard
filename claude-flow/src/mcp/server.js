/**
 * MCP (Model Context Protocol) Server for Claude-Flow
 * Provides stdio and HTTP interfaces for Claude Code integration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

export class MCPServer {
  constructor(orchestrator, memory) {
    this.orchestrator = orchestrator;
    this.memory = memory;
    this.server = new Server({
      name: 'claude-flow',
      version: '2.0.0'
    }, {
      capabilities: {
        tools: {},
        resources: {}
      }
    });

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler('tools/list', async () => ({
      tools: this.getToolDefinitions()
    }));

    // Handle tool calls
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        const result = await this.handleToolCall(name, args);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error) {
        logger.error(`Tool call failed: ${name}`, error);
        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}`
          }],
          isError: true
        };
      }
    });

    // List resources
    this.server.setRequestHandler('resources/list', async () => ({
      resources: []
    }));
  }

  getToolDefinitions() {
    return [
      // Swarm Management
      {
        name: 'swarm_init',
        description: 'Initialize a new swarm with specified topology',
        inputSchema: {
          type: 'object',
          properties: {
            topology: {
              type: 'string',
              enum: ['mesh', 'hierarchical', 'ring', 'star'],
              description: 'Swarm topology type'
            },
            maxAgents: {
              type: 'number',
              description: 'Maximum number of agents',
              default: 5,
              minimum: 1,
              maximum: 100
            },
            strategy: {
              type: 'string',
              enum: ['balanced', 'specialized', 'adaptive'],
              description: 'Distribution strategy',
              default: 'balanced'
            }
          },
          required: ['topology']
        }
      },
      {
        name: 'swarm_status',
        description: 'Get current swarm status and agent information',
        inputSchema: {
          type: 'object',
          properties: {
            verbose: {
              type: 'boolean',
              description: 'Include detailed agent information',
              default: false
            }
          }
        }
      },
      {
        name: 'swarm_monitor',
        description: 'Monitor swarm activity in real-time',
        inputSchema: {
          type: 'object',
          properties: {
            duration: {
              type: 'number',
              description: 'Monitoring duration in seconds',
              default: 10
            },
            interval: {
              type: 'number',
              description: 'Update interval in seconds',
              default: 1
            }
          }
        }
      },

      // Agent Management
      {
        name: 'agent_spawn',
        description: 'Spawn a new agent in the swarm',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['researcher', 'coder', 'analyst', 'optimizer', 'coordinator'],
              description: 'Agent type'
            },
            name: {
              type: 'string',
              description: 'Custom agent name'
            },
            capabilities: {
              type: 'array',
              items: { type: 'string' },
              description: 'Agent capabilities'
            }
          },
          required: ['type']
        }
      },
      {
        name: 'agent_list',
        description: 'List all active agents in the swarm',
        inputSchema: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              enum: ['all', 'active', 'idle', 'busy'],
              description: 'Filter agents by status',
              default: 'all'
            }
          }
        }
      },
      {
        name: 'agent_metrics',
        description: 'Get performance metrics for agents',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: {
              type: 'string',
              description: 'Specific agent ID (optional)'
            },
            metric: {
              type: 'string',
              enum: ['all', 'cpu', 'memory', 'tasks', 'performance'],
              default: 'all'
            }
          }
        }
      },

      // Task Management
      {
        name: 'task_orchestrate',
        description: 'Orchestrate a task across the swarm',
        inputSchema: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'Task description or instructions'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              description: 'Task priority',
              default: 'medium'
            },
            strategy: {
              type: 'string',
              enum: ['parallel', 'sequential', 'adaptive'],
              description: 'Execution strategy',
              default: 'adaptive'
            },
            maxAgents: {
              type: 'number',
              description: 'Maximum agents to use',
              minimum: 1,
              maximum: 10
            }
          },
          required: ['task']
        }
      },
      {
        name: 'task_status',
        description: 'Check progress of running tasks',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Specific task ID (optional)'
            },
            detailed: {
              type: 'boolean',
              description: 'Include detailed progress',
              default: false
            }
          }
        }
      },
      {
        name: 'task_results',
        description: 'Retrieve results from completed tasks',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task ID to retrieve results for'
            },
            format: {
              type: 'string',
              enum: ['summary', 'detailed', 'raw'],
              description: 'Result format',
              default: 'summary'
            }
          },
          required: ['taskId']
        }
      },

      // System Tools
      {
        name: 'benchmark_run',
        description: 'Execute performance benchmarks',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['all', 'wasm', 'swarm', 'agent', 'task'],
              description: 'Benchmark type',
              default: 'all'
            },
            iterations: {
              type: 'number',
              description: 'Number of iterations',
              default: 10,
              minimum: 1,
              maximum: 100
            }
          }
        }
      },
      {
        name: 'features_detect',
        description: 'Detect runtime features and capabilities',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['all', 'wasm', 'simd', 'memory', 'platform'],
              description: 'Feature category',
              default: 'all'
            }
          }
        }
      },
      {
        name: 'memory_usage',
        description: 'Get current memory usage statistics',
        inputSchema: {
          type: 'object',
          properties: {
            detail: {
              type: 'string',
              enum: ['summary', 'detailed', 'by-agent'],
              description: 'Detail level',
              default: 'summary'
            }
          }
        }
      },

      // Neural Tools
      {
        name: 'neural_status',
        description: 'Get neural agent status and performance metrics',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: {
              type: 'string',
              description: 'Specific agent ID (optional)'
            }
          }
        }
      },
      {
        name: 'neural_train',
        description: 'Train neural agents with sample tasks',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: {
              type: 'string',
              description: 'Specific agent ID to train (optional)'
            },
            iterations: {
              type: 'number',
              description: 'Number of training iterations',
              default: 10,
              minimum: 1,
              maximum: 100
            }
          }
        }
      },
      {
        name: 'neural_patterns',
        description: 'Get cognitive pattern information',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              enum: ['all', 'convergent', 'divergent', 'lateral', 'systems', 'critical', 'abstract'],
              description: 'Cognitive pattern type',
              default: 'all'
            }
          }
        }
      }
    ];
  }

  async handleToolCall(name, args) {
    switch (name) {
      // Swarm Management
      case 'swarm_init':
        return await this.orchestrator.initSwarm(args);
      
      case 'swarm_status':
        return await this.orchestrator.getSwarmStatus(args.verbose);
      
      case 'swarm_monitor':
        return await this.orchestrator.monitorSwarm(args.duration, args.interval);

      // Agent Management
      case 'agent_spawn':
        return await this.orchestrator.spawnAgent(args);
      
      case 'agent_list':
        return await this.orchestrator.listAgents(args.filter);
      
      case 'agent_metrics':
        return await this.orchestrator.getAgentMetrics(args.agentId, args.metric);

      // Task Management
      case 'task_orchestrate':
        return await this.orchestrator.orchestrateTask(args);
      
      case 'task_status':
        return await this.orchestrator.getTaskStatus(args.taskId, args.detailed);
      
      case 'task_results':
        return await this.orchestrator.getTaskResults(args.taskId, args.format);

      // System Tools
      case 'benchmark_run':
        return await this.orchestrator.runBenchmark(args.type, args.iterations);
      
      case 'features_detect':
        return await this.orchestrator.detectFeatures(args.category);
      
      case 'memory_usage':
        return await this.orchestrator.getMemoryUsage(args.detail);

      // Neural Tools
      case 'neural_status':
        return await this.orchestrator.getNeuralStatus(args.agentId);
      
      case 'neural_train':
        return await this.orchestrator.trainNeural(args.agentId, args.iterations);
      
      case 'neural_patterns':
        return await this.orchestrator.getNeuralPatterns(args.pattern);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async startStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MCP server started in stdio mode');
  }

  async startHttp(port = 3000) {
    const app = express();

    // Security middleware
    app.use(helmet());
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });
    app.use('/api', limiter);

    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', version: '2.0.0' });
    });

    // MCP endpoints
    app.post('/api/tools/list', async (req, res) => {
      try {
        const tools = this.getToolDefinitions();
        res.json({ tools });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/tools/call', async (req, res) => {
      try {
        const { name, arguments: args } = req.body;
        const result = await this.handleToolCall(name, args);
        res.json({ result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Start server
    app.listen(port, () => {
      logger.info(`MCP HTTP server listening on port ${port}`);
    });
  }
}