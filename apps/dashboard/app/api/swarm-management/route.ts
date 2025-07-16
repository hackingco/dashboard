// Swarm Management API Routes
// Created: 2025-07-14
// Purpose: RESTful API for swarm coordination operations

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import SwarmCoordinationClient from '@/lib/swarm-coordination-client';

// Initialize Supabase client
const swarmClient = new SwarmCoordinationClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/swarm-management - Get swarm entities
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entity = searchParams.get('entity') || 'networks';
    const sessionId = searchParams.get('sessionId');
    const networkId = searchParams.get('networkId');
    const agentId = searchParams.get('agentId');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    const config = {
      limit,
      offset,
      filters: {} as Record<string, any>
    };

    // Add filters based on query parameters
    if (sessionId) config.filters.session_id = sessionId;
    if (networkId) config.filters.network_id = networkId;
    if (agentId) config.filters.agent_id = agentId;

    let result;

    switch (entity) {
      case 'networks':
        result = await swarmClient.getNetworks(config);
        break;
      case 'sessions':
        result = await swarmClient.getSessions(config);
        break;
      case 'agents':
        result = await swarmClient.getAgents(config);
        break;
      case 'tasks':
        result = await swarmClient.getTasks(config);
        break;
      case 'memory':
        const pattern = searchParams.get('pattern') || '';
        const namespace = searchParams.get('namespace');
        result = await swarmClient.searchMemory(pattern, namespace);
        break;
      case 'events':
        result = await swarmClient.getCoordinationEvents(config);
        break;
      case 'metrics':
        result = await swarmClient.getMetrics(config);
        break;
      case 'health':
        result = await swarmClient.getHealthStatus(config);
        break;
      case 'dashboard':
        result = await swarmClient.getDashboardMetrics();
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid entity type' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/swarm-management:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/swarm-management - Create swarm entities
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entity, data } = body;

    if (!entity || !data) {
      return NextResponse.json(
        { success: false, error: 'Missing entity or data' },
        { status: 400 }
      );
    }

    let result;

    switch (entity) {
      case 'network':
        result = await swarmClient.createNetwork(data);
        break;
      case 'session':
        result = await swarmClient.createSession(data);
        break;
      case 'agent':
        result = await swarmClient.spawnAgent(data);
        break;
      case 'task':
        result = await swarmClient.createTask(data);
        break;
      case 'memory':
        result = await swarmClient.storeMemory(data);
        break;
      case 'event':
        result = await swarmClient.sendCoordinationEvent(data);
        break;
      case 'metric':
        result = await swarmClient.recordMetric(data);
        break;
      case 'health':
        result = await swarmClient.updateAgentHealth(data);
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid entity type' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/swarm-management:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/swarm-management - Update swarm entities
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { entity, id, data } = body;

    if (!entity || !id || !data) {
      return NextResponse.json(
        { success: false, error: 'Missing entity, id, or data' },
        { status: 400 }
      );
    }

    let result;

    switch (entity) {
      case 'network':
        result = await swarmClient.updateNetwork(id, data);
        break;
      case 'session':
        result = await swarmClient.updateSession(id, data);
        break;
      case 'agent':
        result = await swarmClient.updateAgent(id, data);
        break;
      case 'task':
        result = await swarmClient.updateTask(id, data);
        break;
      case 'agent-heartbeat':
        result = await swarmClient.updateAgentHeartbeat(id);
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid entity type' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in PUT /api/swarm-management:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/swarm-management - Delete swarm entities
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entity = searchParams.get('entity');
    const id = searchParams.get('id');

    if (!entity || !id) {
      return NextResponse.json(
        { success: false, error: 'Missing entity or id' },
        { status: 400 }
      );
    }

    let result;

    switch (entity) {
      case 'network':
        result = await swarmClient.deleteNetwork(id);
        break;
      // Add other delete operations as needed
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid entity type or delete not supported' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in DELETE /api/swarm-management:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}