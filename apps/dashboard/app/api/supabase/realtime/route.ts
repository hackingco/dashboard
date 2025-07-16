import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

// WebSocket connection manager for real-time updates
class RealtimeManager {
  private static connections = new Map<string, Set<any>>();
  
  static addConnection(sessionId: string, connection: any) {
    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, new Set());
    }
    this.connections.get(sessionId)?.add(connection);
  }
  
  static removeConnection(sessionId: string, connection: any) {
    this.connections.get(sessionId)?.delete(connection);
    if (this.connections.get(sessionId)?.size === 0) {
      this.connections.delete(sessionId);
    }
  }
  
  static broadcast(sessionId: string, data: any) {
    const connections = this.connections.get(sessionId);
    if (connections) {
      connections.forEach(connection => {
        try {
          connection.send(JSON.stringify(data));
        } catch (error) {
          // Remove dead connections
          this.removeConnection(sessionId, connection);
        }
      });
    }
  }
  
  static broadcastToAll(data: any) {
    this.connections.forEach((connections, sessionId) => {
      this.broadcast(sessionId, data);
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const channel = searchParams.get('channel') || 'all';

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId parameter' },
        { status: 400 }
      );
    }

    // Check if this is a WebSocket upgrade request
    const upgradeHeader = request.headers.get('upgrade');
    
    if (upgradeHeader?.toLowerCase() === 'websocket') {
      // In a real implementation, you'd handle WebSocket upgrade here
      // For now, return connection info
      return NextResponse.json({
        message: 'WebSocket connection established',
        sessionId,
        channel,
        timestamp: new Date().toISOString(),
        connectionId: crypto.randomUUID()
      });
    }

    // Return Server-Sent Events endpoint info
    return new Response(
      `data: ${JSON.stringify({
        type: 'connection',
        sessionId,
        channel,
        timestamp: new Date().toISOString()
      })}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        }
      }
    );

  } catch (error) {
    console.error('Error setting up real-time connection:', error);
    return NextResponse.json(
      { 
        error: 'Failed to establish real-time connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const eventData = await request.json();
    
    // Validate required fields
    if (!eventData.type || !eventData.sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: type, sessionId' },
        { status: 400 }
      );
    }

    const { type, sessionId, data, broadcast = false } = eventData;

    // Prepare the event for broadcast
    const realtimeEvent = {
      id: crypto.randomUUID(),
      type,
      sessionId,
      data,
      timestamp: new Date().toISOString()
    };

    // Broadcast to specific session or all sessions
    if (broadcast) {
      RealtimeManager.broadcastToAll(realtimeEvent);
    } else {
      RealtimeManager.broadcast(sessionId, realtimeEvent);
    }

    console.log('Broadcasting real-time event:', { type, sessionId, broadcast });

    return NextResponse.json({
      success: true,
      eventId: realtimeEvent.id,
      broadcast,
      timestamp: realtimeEvent.timestamp
    });

  } catch (error) {
    console.error('Error broadcasting real-time event:', error);
    return NextResponse.json(
      { 
        error: 'Failed to broadcast event',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}