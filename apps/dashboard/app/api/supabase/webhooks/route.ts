import { NextRequest, NextResponse } from 'next/server';
import { SwarmDatabase } from '@/lib/supabase';

// Webhook handler for Supabase database changes
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-supabase-signature');
    const webhookData = await request.json();

    // In production, verify the webhook signature
    // const isValid = verifyWebhookSignature(signature, webhookData);
    // if (!isValid) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }

    const { type, table, record, old_record } = webhookData;

    console.log('Received Supabase webhook:', { type, table, recordId: record?.id });

    // Handle different table events
    switch (table) {
      case 'swarm_traces':
        await handleTraceWebhook(type, record, old_record);
        break;
      
      case 'swarm_agents':
        await handleAgentWebhook(type, record, old_record);
        break;
      
      case 'swarm_sessions':
        await handleSessionWebhook(type, record, old_record);
        break;
      
      case 'swarm_metrics':
        await handleMetricsWebhook(type, record, old_record);
        break;
      
      default:
        console.log('Unhandled table webhook:', table);
    }

    return NextResponse.json({ 
      success: true, 
      processed: new Date().toISOString() 
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function handleTraceWebhook(type: string, record: any, oldRecord?: any) {
  try {
    // Broadcast real-time updates for trace changes
    const event = {
      type: `trace_${type}`,
      sessionId: record.session_id,
      data: {
        trace: record,
        old_trace: oldRecord,
        change_type: type
      }
    };

    // Send to real-time subscribers
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/supabase/realtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });

    // Update session statistics if needed
    if (type === 'INSERT') {
      await updateSessionStats(record.session_id, 'trace_added');
    } else if (type === 'UPDATE' && record.status !== oldRecord?.status) {
      await updateSessionStats(record.session_id, 'trace_status_changed');
    }

  } catch (error) {
    console.error('Error handling trace webhook:', error);
  }
}

async function handleAgentWebhook(type: string, record: any, oldRecord?: any) {
  try {
    // Broadcast agent status changes
    const event = {
      type: `agent_${type}`,
      sessionId: record.swarm_id, // Using swarm_id as session identifier
      data: {
        agent: record,
        old_agent: oldRecord,
        change_type: type
      }
    };

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/supabase/realtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });

    // Track agent performance metrics
    if (type === 'UPDATE') {
      await trackAgentMetrics(record);
    }

  } catch (error) {
    console.error('Error handling agent webhook:', error);
  }
}

async function handleSessionWebhook(type: string, record: any, oldRecord?: any) {
  try {
    // Broadcast session changes to all subscribers
    const event = {
      type: `session_${type}`,
      sessionId: record.id,
      data: {
        session: record,
        old_session: oldRecord,
        change_type: type
      },
      broadcast: true // Broadcast to all sessions
    };

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/supabase/realtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });

  } catch (error) {
    console.error('Error handling session webhook:', error);
  }
}

async function handleMetricsWebhook(type: string, record: any, oldRecord?: any) {
  try {
    // Broadcast new metrics for live charts
    if (type === 'INSERT') {
      const event = {
        type: 'metric_update',
        sessionId: record.session_id,
        data: {
          metric: record,
          metric_type: record.metric_type,
          metric_value: record.metric_value,
          timestamp: record.timestamp
        }
      };

      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/supabase/realtime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
    }

  } catch (error) {
    console.error('Error handling metrics webhook:', error);
  }
}

async function updateSessionStats(sessionId: string, eventType: string) {
  try {
    // Get current session data
    const sessions = await SwarmDatabase.getSessions(1);
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session) return;

    let updates: any = {};

    switch (eventType) {
      case 'trace_added':
        updates.total_traces = (session.total_traces || 0) + 1;
        updates.active_traces = (session.active_traces || 0) + 1;
        break;
      
      case 'trace_status_changed':
        // Could implement more specific logic here
        break;
    }

    if (Object.keys(updates).length > 0) {
      await SwarmDatabase.updateSession(sessionId, updates);
    }

  } catch (error) {
    console.error('Error updating session stats:', error);
  }
}

async function trackAgentMetrics(agent: any) {
  try {
    // Create performance metrics from agent data
    const metrics = [
      {
        session_id: agent.swarm_id,
        metric_type: 'agent_cpu_usage',
        metric_value: agent.cpu_usage || 0,
        metric_data: { agent_id: agent.id, agent_name: agent.name },
        timestamp: new Date().toISOString()
      },
      {
        session_id: agent.swarm_id,
        metric_type: 'agent_memory_usage',
        metric_value: agent.memory_usage || 0,
        metric_data: { agent_id: agent.id, agent_name: agent.name },
        timestamp: new Date().toISOString()
      },
      {
        session_id: agent.swarm_id,
        metric_type: 'agent_response_time',
        metric_value: agent.average_response_time || 0,
        metric_data: { agent_id: agent.id, agent_name: agent.name },
        timestamp: new Date().toISOString()
      }
    ];

    // Insert metrics in batch
    for (const metric of metrics) {
      await SwarmDatabase.insertMetrics(metric);
    }

  } catch (error) {
    console.error('Error tracking agent metrics:', error);
  }
}