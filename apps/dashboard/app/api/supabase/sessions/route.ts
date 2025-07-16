import { NextRequest, NextResponse } from 'next/server';
import { SwarmDatabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');

    console.log('Fetching sessions:', { limit, status });

    let sessions = await SwarmDatabase.getSessions(limit);

    // Filter by status if provided
    if (status && status !== 'all') {
      sessions = sessions.filter(session => session.status === status);
    }

    return NextResponse.json({
      sessions,
      count: sessions.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch sessions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionData = await request.json();
    
    // Validate required fields
    if (!sessionData.session_name) {
      return NextResponse.json(
        { error: 'Missing required field: session_name' },
        { status: 400 }
      );
    }

    // Create the session with default values
    const session = {
      id: sessionData.id || crypto.randomUUID(),
      session_name: sessionData.session_name,
      description: sessionData.description || null,
      total_traces: sessionData.total_traces || 0,
      active_traces: sessionData.active_traces || 0,
      total_agents: sessionData.total_agents || 0,
      active_agents: sessionData.active_agents || 0,
      start_time: sessionData.start_time || new Date().toISOString(),
      end_time: sessionData.end_time || null,
      status: sessionData.status || 'active',
      metadata: sessionData.metadata || {}
    };

    const createdSession = await SwarmDatabase.createSession(session);

    console.log('Created session:', createdSession.id);

    return NextResponse.json(createdSession, { status: 201 });

  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session ID' },
        { status: 400 }
      );
    }

    const updates = await request.json();
    const updatedSession = await SwarmDatabase.updateSession(sessionId, updates);

    console.log('Updated session:', sessionId);

    return NextResponse.json(updatedSession);

  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}