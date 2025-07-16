import { NextRequest, NextResponse } from 'next/server';
import { SwarmDatabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');

    console.log('Fetching traces:', { sessionId, limit, status });

    let traces = await SwarmDatabase.getTraces(sessionId || undefined, limit);

    // Filter by status if provided
    if (status && status !== 'all') {
      traces = traces.filter(trace => trace.status === status);
    }

    return NextResponse.json({
      traces,
      count: traces.length,
      sessionId: sessionId || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching traces:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch traces',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const traceData = await request.json();
    
    // Validate required fields
    if (!traceData.session_id || !traceData.trace_name) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, trace_name' },
        { status: 400 }
      );
    }

    // Create the trace with default values
    const trace = {
      id: traceData.id || crypto.randomUUID(),
      session_id: traceData.session_id,
      trace_name: traceData.trace_name,
      trace_data: traceData.trace_data || {},
      status: traceData.status || 'pending',
      duration_ms: traceData.duration_ms || 0,
      metadata: traceData.metadata || {}
    };

    const createdTrace = await SwarmDatabase.insertTrace(trace);

    console.log('Created trace:', createdTrace.id);

    return NextResponse.json(createdTrace, { status: 201 });

  } catch (error) {
    console.error('Error creating trace:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create trace',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const traceId = searchParams.get('id');
    
    if (!traceId) {
      return NextResponse.json(
        { error: 'Missing trace ID' },
        { status: 400 }
      );
    }

    const updates = await request.json();
    const updatedTrace = await SwarmDatabase.updateTrace(traceId, updates);

    console.log('Updated trace:', traceId);

    return NextResponse.json(updatedTrace);

  } catch (error) {
    console.error('Error updating trace:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update trace',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}