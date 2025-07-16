import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const swarmId = searchParams.get('swarmId')
    const type = searchParams.get('type') // 'traces', 'agents', 'metrics', 'sessions'

    if (!sessionId && !swarmId) {
      return NextResponse.json(
        { success: false, error: 'sessionId or swarmId required' },
        { status: 400 }
      )
    }

    let data: any[] = []

    switch (type) {
      case 'traces':
        if (sessionId) {
          const { data: traces, error } = await supabase
            .from('swarm_traces')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .limit(20)
          
          if (error) throw error
          data = traces || []
        }
        break

      case 'agents':
        if (swarmId) {
          const { data: agents, error } = await supabase
            .from('swarm_agents')
            .select('*')
            .eq('swarm_id', swarmId)
            .order('last_activity', { ascending: false })
          
          if (error) throw error
          data = agents || []
        }
        break

      case 'metrics':
        if (sessionId) {
          const { data: metrics, error } = await supabase
            .from('swarm_metrics')
            .select('*')
            .eq('session_id', sessionId)
            .order('timestamp', { ascending: false })
            .limit(50)
          
          if (error) throw error
          data = metrics || []
        }
        break

      case 'sessions':
        const { data: sessions, error } = await supabase
          .from('swarm_sessions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10)
        
        if (error) throw error
        data = sessions || []
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid type parameter' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data,
      type,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching real-time data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch real-time data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body

    let result: any = null

    switch (type) {
      case 'trace':
        const { data: newTrace, error: traceError } = await supabase
          .from('swarm_traces')
          .insert(data)
          .select()
          .single()
        
        if (traceError) throw traceError
        result = newTrace
        break

      case 'metric':
        const { data: newMetric, error: metricError } = await supabase
          .from('swarm_metrics')
          .insert(data)
          .select()
          .single()
        
        if (metricError) throw metricError
        result = newMetric
        break

      case 'agent_update':
        const { id, updates } = data
        const { data: updatedAgent, error: agentError } = await supabase
          .from('swarm_agents')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()
        
        if (agentError) throw agentError
        result = updatedAgent
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid type parameter' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error creating real-time data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create real-time data' },
      { status: 500 }
    )
  }
}