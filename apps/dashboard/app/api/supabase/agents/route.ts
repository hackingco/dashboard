import { NextRequest, NextResponse } from 'next/server';
import { SwarmDatabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const swarmId = searchParams.get('swarmId');
    const status = searchParams.get('status');

    console.log('Fetching agents:', { swarmId, status });

    let agents = await SwarmDatabase.getAgents(swarmId || undefined);

    // Filter by status if provided
    if (status && status !== 'all') {
      agents = agents.filter(agent => agent.status === status);
    }

    return NextResponse.json({
      agents,
      count: agents.length,
      swarmId: swarmId || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch agents',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const agentData = await request.json();
    
    // Validate required fields
    if (!agentData.name || !agentData.type || !agentData.swarm_id) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, swarm_id' },
        { status: 400 }
      );
    }

    // Create the agent with default values
    const agent = {
      id: agentData.id || crypto.randomUUID(),
      name: agentData.name,
      type: agentData.type,
      status: agentData.status || 'idle',
      current_task: agentData.current_task || null,
      tasks_completed: agentData.tasks_completed || 0,
      average_response_time: agentData.average_response_time || 0,
      memory_usage: agentData.memory_usage || 0,
      cpu_usage: agentData.cpu_usage || 0,
      last_activity: new Date().toISOString(),
      swarm_id: agentData.swarm_id,
      metadata: agentData.metadata || {}
    };

    const createdAgent = await SwarmDatabase.insertAgent(agent);

    console.log('Created agent:', createdAgent.id);

    return NextResponse.json(createdAgent, { status: 201 });

  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create agent',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('id');
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing agent ID' },
        { status: 400 }
      );
    }

    const updates = await request.json();
    
    // Update last_activity if status is being changed
    if (updates.status) {
      updates.last_activity = new Date().toISOString();
    }

    const updatedAgent = await SwarmDatabase.updateAgent(agentId, updates);

    console.log('Updated agent:', agentId);

    return NextResponse.json(updatedAgent);

  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update agent',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}