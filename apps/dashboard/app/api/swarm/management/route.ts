import { NextRequest, NextResponse } from 'next/server'
import { SwarmDatabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const swarmId = searchParams.get('swarmId')
    const sessionId = searchParams.get('sessionId')

    // Get swarm agents
    const agents = swarmId ? await SwarmDatabase.getAgents(swarmId) : []
    
    // Get traces if sessionId provided
    const traces = sessionId ? await SwarmDatabase.getTraces(sessionId, 50) : []
    
    // Get sessions
    const sessions = await SwarmDatabase.getSessions(20)
    
    // Get metrics if sessionId provided
    const metrics = sessionId ? await SwarmDatabase.getMetrics(sessionId, undefined, 100) : []

    return NextResponse.json({
      success: true,
      data: {
        agents,
        traces,
        sessions,
        metrics,
        swarmId,
        sessionId
      }
    })
  } catch (error) {
    console.error('Error fetching swarm management data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch swarm data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'create_agent':
        const newAgent = await SwarmDatabase.insertAgent(data)
        return NextResponse.json({ success: true, data: newAgent })

      case 'update_agent':
        const { id, updates } = data
        const updatedAgent = await SwarmDatabase.updateAgent(id, updates)
        return NextResponse.json({ success: true, data: updatedAgent })

      case 'create_trace':
        const newTrace = await SwarmDatabase.insertTrace(data)
        return NextResponse.json({ success: true, data: newTrace })

      case 'update_trace':
        const { traceId, traceUpdates } = data
        const updatedTrace = await SwarmDatabase.updateTrace(traceId, traceUpdates)
        return NextResponse.json({ success: true, data: updatedTrace })

      case 'record_metric':
        const newMetric = await SwarmDatabase.insertMetrics(data)
        return NextResponse.json({ success: true, data: newMetric })

      case 'create_session':
        const newSession = await SwarmDatabase.createSession(data)
        return NextResponse.json({ success: true, data: newSession })

      case 'update_session':
        const { sessionId, sessionUpdates } = data
        const updatedSession = await SwarmDatabase.updateSession(sessionId, sessionUpdates)
        return NextResponse.json({ success: true, data: updatedSession })

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error processing swarm management request:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    )
  }
}