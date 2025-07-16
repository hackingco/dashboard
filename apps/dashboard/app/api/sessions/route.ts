/**
 * API Route: /api/sessions
 * Handles CRUD operations for swarm sessions and session management
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin, SwarmDatabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const include_stats = searchParams.get('include_stats') === 'true'

    // Build query
    let query = supabaseAdmin
      .from('swarm_sessions')
      .select(`
        *,
        ${include_stats ? `
        swarm_traces (count),
        swarm_metrics (count)
        ` : ''}
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: sessions, error } = await query

    if (error) {
      console.error('Error fetching sessions:', error)
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
    }

    // Enhanced session data with computed metrics
    const enhancedSessions = await Promise.all(
      (sessions || []).map(async (session) => {
        let additionalStats = {}

        if (include_stats) {
          // Get detailed trace and agent counts
          const [tracesResult, agentsResult, metricsResult] = await Promise.all([
            supabaseAdmin
              .from('swarm_traces')
              .select('status', { count: 'exact' })
              .eq('session_id', session.id),
            supabaseAdmin
              .from('swarm_agents')
              .select('status', { count: 'exact' })
              .ilike('metadata->session_id', `%${session.id}%`),
            supabaseAdmin
              .from('swarm_metrics')
              .select('metric_type, metric_value')
              .eq('session_id', session.id)
              .order('timestamp', { ascending: false })
              .limit(10)
          ])

          const traces = tracesResult.data || []
          const agents = agentsResult.data || []
          const metrics = metricsResult.data || []

          additionalStats = {
            traceStats: {
              total: traces.length,
              success: traces.filter(t => t.status === 'success').length,
              error: traces.filter(t => t.status === 'error').length,
              running: traces.filter(t => t.status === 'running').length,
              pending: traces.filter(t => t.status === 'pending').length,
            },
            agentStats: {
              total: agents.length,
              active: agents.filter(a => a.status === 'active').length,
              idle: agents.filter(a => a.status === 'idle').length,
              error: agents.filter(a => a.status === 'error').length,
              offline: agents.filter(a => a.status === 'offline').length,
            },
            recentMetrics: metrics.map(m => ({
              type: m.metric_type,
              value: m.metric_value,
              timestamp: new Date().toISOString()
            })),
            performance: {
              avgResponseTime: metrics.find(m => m.metric_type === 'response_time')?.metric_value || 0,
              throughput: metrics.find(m => m.metric_type === 'task_throughput')?.metric_value || 0,
              errorRate: traces.length > 0 ? 
                (traces.filter(t => t.status === 'error').length / traces.length) * 100 : 0,
              uptime: session.start_time ? 
                Date.now() - new Date(session.start_time).getTime() : 0,
            }
          }
        }

        return {
          id: session.id,
          sessionName: session.session_name,
          description: session.description,
          status: session.status,
          startTime: new Date(session.start_time),
          endTime: session.end_time ? new Date(session.end_time) : null,
          totalTraces: session.total_traces,
          activeTraces: session.active_traces,
          totalAgents: session.total_agents,
          activeAgents: session.active_agents,
          metadata: session.metadata || {},
          createdAt: new Date(session.created_at),
          updatedAt: new Date(session.updated_at),
          duration: session.end_time ? 
            new Date(session.end_time).getTime() - new Date(session.start_time).getTime() :
            Date.now() - new Date(session.start_time).getTime(),
          ...additionalStats
        }
      })
    )

    return NextResponse.json({
      sessions: enhancedSessions,
      count: enhancedSessions.length,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Unexpected error in sessions API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      session_name,
      description = '',
      metadata = {}
    } = body

    if (!session_name) {
      return NextResponse.json({
        error: 'Missing required field: session_name'
      }, { status: 400 })
    }

    const newSession = await SwarmDatabase.createSession({
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      session_name,
      description,
      total_traces: 0,
      active_traces: 0,
      total_agents: 0,
      active_agents: 0,
      start_time: new Date().toISOString(),
      status: 'active',
      metadata
    })

    return NextResponse.json({
      session: newSession,
      message: 'Session created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({
        error: 'Missing session ID'
      }, { status: 400 })
    }

    // If ending session, set end_time
    if (updates.status === 'completed' && !updates.end_time) {
      updates.end_time = new Date().toISOString()
    }

    const updatedSession = await SwarmDatabase.updateSession(id, updates)

    return NextResponse.json({
      session: updatedSession,
      message: 'Session updated successfully'
    })

  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        error: 'Missing session ID'
      }, { status: 400 })
    }

    // Mark session as completed instead of deleting
    const { error } = await supabaseAdmin
      .from('swarm_sessions')
      .update({ 
        status: 'completed',
        end_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      message: 'Session marked as completed'
    })

  } catch (error) {
    console.error('Error completing session:', error)
    return NextResponse.json({ error: 'Failed to complete session' }, { status: 500 })
  }
}