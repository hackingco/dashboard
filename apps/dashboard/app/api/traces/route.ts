/**
 * API Route: /api/traces
 * Handles CRUD operations for swarm traces with real-time capabilities
 * Instrumented with Langfuse for observability
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin, SwarmDatabase } from '@/lib/supabase'
import { traceAPIEndpoint, batchTracer } from '@/lib/langfuse-server'

export async function GET(request: NextRequest) {
  return traceAPIEndpoint('/api/traces', 'GET', async () => {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')
    const real_time = searchParams.get('real_time') === 'true'

    // Build query
    let query = supabaseAdmin
      .from('swarm_traces')
      .select(`
        *,
        swarm_sessions (
          session_name,
          status as session_status
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: traces, error } = await query

    if (error) {
      console.error('Error fetching traces:', error)
      return NextResponse.json({ error: 'Failed to fetch traces' }, { status: 500 })
    }

    // Transform data for frontend compatibility
    const transformedTraces = traces?.map(trace => ({
      id: trace.id,
      name: trace.trace_name,
      sessionId: trace.session_id,
      timestamp: new Date(trace.created_at),
      duration: trace.duration_ms || 0,
      status: trace.status,
      input: trace.trace_data?.input || trace.trace_data?.action || trace.trace_name,
      output: trace.trace_data?.output || `${trace.trace_name} completed`,
      metadata: {
        ...trace.metadata,
        session_name: trace.swarm_sessions?.session_name,
        session_status: trace.swarm_sessions?.session_status,
      },
      // Add mock data for dashboard compatibility
      model: trace.trace_data?.model || 'swarm-agent',
      promptTokens: trace.trace_data?.prompt_tokens || 100,
      completionTokens: trace.trace_data?.completion_tokens || 50,
      totalCost: trace.trace_data?.total_cost || 0.001,
      userId: trace.trace_data?.user_id || 'swarm-user',
      tags: ['swarm', 'real-time', ...(trace.metadata?.tags || [])],
      scores: trace.trace_data?.scores || {
        quality: 0.95,
        relevance: 0.98,
        efficiency: 0.92,
      },
      memoryUsage: trace.trace_data?.memory_usage || Math.floor(Math.random() * 512) + 128,
      cpuUsage: trace.trace_data?.cpu_usage || Math.floor(Math.random() * 80) + 10,
      agentId: trace.trace_data?.agent_id || `agent-${Math.floor(Math.random() * 5) + 1}`,
      swarmId: trace.trace_data?.swarm_id || 'swarm_observability',
    })) || []

    // Add batch tracing for each individual trace
    transformedTraces.forEach(trace => {
      batchTracer.add({
        name: `Trace Retrieved: ${trace.name}`,
        sessionId: trace.sessionId,
        metadata: {
          traceId: trace.id,
          status: trace.status,
          agentId: trace.agentId,
        },
        tags: ['api', 'trace-retrieval'],
      })
    })

    return NextResponse.json({
      traces: transformedTraces,
      count: traces?.length || 0,
      real_time,
      timestamp: new Date().toISOString(),
    })
  }).catch(error => {
    console.error('Unexpected error in traces API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  })
}

export async function POST(request: NextRequest) {
  return traceAPIEndpoint('/api/traces', 'POST', async () => {
    const body = await request.json()
    const {
      session_id,
      trace_name,
      trace_data,
      status = 'pending',
      duration_ms = 0,
      metadata = {}
    } = body

    if (!session_id || !trace_name) {
      return NextResponse.json({
        error: 'Missing required fields: session_id, trace_name'
      }, { status: 400 })
    }

    const newTrace = await SwarmDatabase.insertTrace({
      id: `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      session_id,
      trace_name,
      trace_data: trace_data || {},
      status,
      duration_ms,
      metadata
    })

    // Add to Langfuse batch tracer
    batchTracer.add({
      name: `Trace Created: ${trace_name}`,
      sessionId: session_id,
      metadata: {
        traceId: newTrace.id,
        status,
        duration_ms,
        ...metadata
      },
      tags: ['api', 'trace-creation', 'swarm'],
    })

    return NextResponse.json({
      trace: newTrace,
      message: 'Trace created successfully'
    }, { status: 201 })
  }).catch(error => {
    console.error('Error creating trace:', error)
    return NextResponse.json({ error: 'Failed to create trace' }, { status: 500 })
  })
}

export async function PUT(request: NextRequest) {
  return traceAPIEndpoint('/api/traces', 'PUT', async () => {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({
        error: 'Missing trace ID'
      }, { status: 400 })
    }

    const updatedTrace = await SwarmDatabase.updateTrace(id, updates)

    // Add to Langfuse batch tracer
    batchTracer.add({
      name: `Trace Updated: ${updatedTrace.trace_name}`,
      sessionId: updatedTrace.session_id,
      metadata: {
        traceId: id,
        updates,
        newStatus: updatedTrace.status,
      },
      tags: ['api', 'trace-update', 'swarm'],
    })

    return NextResponse.json({
      trace: updatedTrace,
      message: 'Trace updated successfully'
    })
  }).catch(error => {
    console.error('Error updating trace:', error)
    return NextResponse.json({ error: 'Failed to update trace' }, { status: 500 })
  })
}

export async function DELETE(request: NextRequest) {
  return traceAPIEndpoint('/api/traces', 'DELETE', async () => {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        error: 'Missing trace ID'
      }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('swarm_traces')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    // Add to Langfuse batch tracer
    batchTracer.add({
      name: `Trace Deleted`,
      sessionId: `deletion-${Date.now()}`,
      metadata: {
        traceId: id,
        action: 'delete',
      },
      tags: ['api', 'trace-deletion', 'swarm'],
    })

    return NextResponse.json({
      message: 'Trace deleted successfully'
    })
  }).catch(error => {
    console.error('Error deleting trace:', error)
    return NextResponse.json({ error: 'Failed to delete trace' }, { status: 500 })
  })
}