/**
 * API Route: /api/realtime
 * Handles real-time WebSocket connections and Supabase real-time subscriptions
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

// Handle WebSocket upgrade for real-time connections
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    const swarmId = searchParams.get('swarm_id')
    const types = searchParams.get('types')?.split(',') || ['traces', 'agents', 'metrics']

    // For now, return connection info since Next.js doesn't support WebSocket upgrades directly
    // In production, you'd use a separate WebSocket server or serverless function
    return NextResponse.json({
      status: 'ready',
      connectionInfo: {
        sessionId,
        swarmId,
        subscriptionTypes: types,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        realtimeEndpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/websocket`,
        timestamp: new Date().toISOString()
      },
      instructions: {
        message: 'Use Supabase client-side real-time subscriptions for WebSocket connections',
        example: 'supabase.channel(`traces-${sessionId}`).on("postgres_changes", {...}).subscribe()'
      }
    })

  } catch (error) {
    console.error('Error setting up real-time connection:', error)
    return NextResponse.json({ error: 'Failed to setup real-time connection' }, { status: 500 })
  }
}

// Handle real-time subscription management
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, sessionId, swarmId, subscriptionType } = body

    switch (action) {
      case 'subscribe_traces':
        // Return subscription configuration for traces
        return NextResponse.json({
          subscription: {
            channel: `traces-${sessionId}`,
            event: 'postgres_changes',
            schema: 'public',
            table: 'swarm_traces',
            filter: sessionId ? `session_id=eq.${sessionId}` : undefined
          },
          message: 'Trace subscription configured'
        })

      case 'subscribe_agents':
        // Return subscription configuration for agents
        return NextResponse.json({
          subscription: {
            channel: `agents-${swarmId}`,
            event: 'postgres_changes', 
            schema: 'public',
            table: 'swarm_agents',
            filter: swarmId ? `swarm_id=eq.${swarmId}` : undefined
          },
          message: 'Agent subscription configured'
        })

      case 'subscribe_metrics':
        // Return subscription configuration for metrics
        return NextResponse.json({
          subscription: {
            channel: `metrics-${sessionId}`,
            event: 'postgres_changes',
            schema: 'public', 
            table: 'swarm_metrics',
            filter: sessionId ? `session_id=eq.${sessionId}` : undefined
          },
          message: 'Metrics subscription configured'
        })

      case 'broadcast_update':
        // Broadcast update to all subscribers
        const { channel, payload } = body
        
        // Use Supabase broadcast to send real-time updates
        const broadcastResult = await supabase
          .channel(channel)
          .send({
            type: 'broadcast',
            event: 'swarm_update',
            payload
          })

        return NextResponse.json({
          broadcast: broadcastResult,
          message: 'Update broadcasted successfully'
        })

      default:
        return NextResponse.json({
          error: 'Invalid action. Supported: subscribe_traces, subscribe_agents, subscribe_metrics, broadcast_update'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Error handling real-time subscription:', error)
    return NextResponse.json({ error: 'Failed to handle subscription' }, { status: 500 })
  }
}

// Handle real-time events and broadcasting
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, data, sessionId, swarmId } = body

    // Process different types of real-time events
    switch (event) {
      case 'trace_update':
        // Update trace and broadcast to subscribers
        const { traceId, updates } = data
        
        const { data: updatedTrace, error: traceError } = await supabaseAdmin
          .from('swarm_traces')
          .update(updates)
          .eq('id', traceId)
          .select()
          .single()

        if (traceError) throw traceError

        // Broadcast update
        await supabase
          .channel(`traces-${sessionId}`)
          .send({
            type: 'broadcast',
            event: 'trace_updated',
            payload: { trace: updatedTrace, timestamp: new Date().toISOString() }
          })

        return NextResponse.json({
          trace: updatedTrace,
          message: 'Trace updated and broadcasted'
        })

      case 'agent_status_change':
        // Update agent status and broadcast
        const { agentId, status, currentTask } = data

        const { data: updatedAgent, error: agentError } = await supabaseAdmin
          .from('swarm_agents')
          .update({
            status,
            current_task: currentTask,
            last_activity: new Date().toISOString()
          })
          .eq('id', agentId)
          .select()
          .single()

        if (agentError) throw agentError

        // Broadcast update
        await supabase
          .channel(`agents-${swarmId}`)
          .send({
            type: 'broadcast',
            event: 'agent_status_changed',
            payload: { agent: updatedAgent, timestamp: new Date().toISOString() }
          })

        return NextResponse.json({
          agent: updatedAgent,
          message: 'Agent status updated and broadcasted'
        })

      case 'metrics_batch':
        // Insert metrics batch and broadcast
        const { metrics } = data

        const { data: insertedMetrics, error: metricsError } = await supabaseAdmin
          .from('swarm_metrics')
          .insert(metrics)
          .select()

        if (metricsError) throw metricsError

        // Broadcast metrics update
        await supabase
          .channel(`metrics-${sessionId}`)
          .send({
            type: 'broadcast',
            event: 'metrics_updated',
            payload: { metrics: insertedMetrics, timestamp: new Date().toISOString() }
          })

        return NextResponse.json({
          metrics: insertedMetrics,
          count: insertedMetrics?.length || 0,
          message: 'Metrics batch inserted and broadcasted'
        })

      case 'session_status_change':
        // Update session status and broadcast
        const { sessionStatus, endTime } = data

        const { data: updatedSession, error: sessionError } = await supabaseAdmin
          .from('swarm_sessions')
          .update({
            status: sessionStatus,
            end_time: endTime,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId)
          .select()
          .single()

        if (sessionError) throw sessionError

        // Broadcast session update to all relevant channels
        const channels = [`session-${sessionId}`, `traces-${sessionId}`, `metrics-${sessionId}`]
        
        for (const channel of channels) {
          await supabase
            .channel(channel)
            .send({
              type: 'broadcast',
              event: 'session_status_changed',
              payload: { session: updatedSession, timestamp: new Date().toISOString() }
            })
        }

        return NextResponse.json({
          session: updatedSession,
          message: 'Session status updated and broadcasted'
        })

      default:
        return NextResponse.json({
          error: 'Invalid event type'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Error processing real-time event:', error)
    return NextResponse.json({ error: 'Failed to process real-time event' }, { status: 500 })
  }
}

// Health check for real-time services
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const channelName = searchParams.get('channel')

    if (!channelName) {
      return NextResponse.json({
        error: 'Channel name required for cleanup'
      }, { status: 400 })
    }

    // Cleanup/unsubscribe from channel
    // Note: Actual cleanup would happen client-side with supabase.removeChannel()
    
    return NextResponse.json({
      channel: channelName,
      message: 'Channel cleanup initiated - complete client-side unsubscription',
      instructions: 'Call supabase.removeChannel() or channel.unsubscribe() on client'
    })

  } catch (error) {
    console.error('Error cleaning up real-time connection:', error)
    return NextResponse.json({ error: 'Failed to cleanup connection' }, { status: 500 })
  }
}