/**
 * API Route: /api/agents
 * Handles CRUD operations for swarm agents with real-time status updates
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin, SwarmDatabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const swarmId = searchParams.get('swarm_id')
    const status = searchParams.get('status')
    const include_inactive = searchParams.get('include_inactive') === 'true'

    // Build query
    let query = supabaseAdmin
      .from('swarm_agents')
      .select('*')
      .order('last_activity', { ascending: false })

    if (swarmId) {
      query = query.eq('swarm_id', swarmId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (!include_inactive) {
      query = query.neq('status', 'offline')
    }

    const { data: agents, error } = await query

    if (error) {
      console.error('Error fetching agents:', error)
      return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
    }

    // Transform data for frontend compatibility
    const transformedAgents = agents?.map(agent => ({
      id: agent.id,
      name: agent.name,
      type: agent.type,
      status: agent.status,
      currentTask: agent.current_task,
      tasksCompleted: agent.tasks_completed,
      averageResponseTime: agent.average_response_time,
      memoryUsage: agent.memory_usage,
      cpuUsage: agent.cpu_usage,
      lastActivity: new Date(agent.last_activity),
      swarmId: agent.swarm_id,
      metadata: agent.metadata || {},
      // Add computed fields
      uptime: Date.now() - new Date(agent.created_at).getTime(),
      efficiency: agent.tasks_completed > 0 ? 
        Math.min(100, (agent.tasks_completed / ((Date.now() - new Date(agent.created_at).getTime()) / 3600000)) * 10) : 0,
      loadFactor: Math.min(1, (agent.cpu_usage + agent.memory_usage) / 200),
    })) || []

    // Calculate swarm-level metrics
    const activeAgents = transformedAgents.filter(a => a.status === 'active')
    const totalTasks = transformedAgents.reduce((sum, a) => sum + a.tasksCompleted, 0)
    const avgResponseTime = transformedAgents.length > 0 ?
      transformedAgents.reduce((sum, a) => sum + a.averageResponseTime, 0) / transformedAgents.length : 0

    return NextResponse.json({
      agents: transformedAgents,
      metrics: {
        totalAgents: transformedAgents.length,
        activeAgents: activeAgents.length,
        idleAgents: transformedAgents.filter(a => a.status === 'idle').length,
        errorAgents: transformedAgents.filter(a => a.status === 'error').length,
        totalTasks,
        averageResponseTime: Math.round(avgResponseTime),
        totalMemoryUsage: transformedAgents.reduce((sum, a) => sum + a.memoryUsage, 0),
        totalCpuUsage: transformedAgents.reduce((sum, a) => sum + a.cpuUsage, 0),
        averageEfficiency: transformedAgents.length > 0 ?
          transformedAgents.reduce((sum, a) => sum + a.efficiency, 0) / transformedAgents.length : 0,
      },
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Unexpected error in agents API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      type,
      swarm_id,
      status = 'idle',
      current_task = null,
      metadata = {}
    } = body

    if (!name || !type || !swarm_id) {
      return NextResponse.json({
        error: 'Missing required fields: name, type, swarm_id'
      }, { status: 400 })
    }

    const newAgent = await SwarmDatabase.insertAgent({
      id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,
      status,
      current_task,
      tasks_completed: 0,
      average_response_time: 0,
      memory_usage: 0,
      cpu_usage: 0,
      last_activity: new Date().toISOString(),
      swarm_id,
      metadata
    })

    return NextResponse.json({
      agent: newAgent,
      message: 'Agent created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating agent:', error)
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({
        error: 'Missing agent ID'
      }, { status: 400 })
    }

    // Always update last_activity when updating agent
    const updatedAgent = await SwarmDatabase.updateAgent(id, {
      ...updates,
      last_activity: new Date().toISOString()
    })

    return NextResponse.json({
      agent: updatedAgent,
      message: 'Agent updated successfully'
    })

  } catch (error) {
    console.error('Error updating agent:', error)
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        error: 'Missing agent ID'
      }, { status: 400 })
    }

    // Soft delete - mark as offline instead of actual deletion
    const { error } = await supabaseAdmin
      .from('swarm_agents')
      .update({ 
        status: 'offline',
        current_task: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      message: 'Agent marked as offline'
    })

  } catch (error) {
    console.error('Error deactivating agent:', error)
    return NextResponse.json({ error: 'Failed to deactivate agent' }, { status: 500 })
  }
}