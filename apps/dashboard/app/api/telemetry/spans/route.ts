import { NextRequest, NextResponse } from 'next/server';

interface SpanData {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'success' | 'error' | 'pending';
  parentId?: string;
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const swarmId = searchParams.get('swarmId');
    const timeRange = searchParams.get('timeRange') || '1h';
    const spanName = searchParams.get('name');
    const status = searchParams.get('status');

    // In production, this would fetch from the telemetry service
    const managerApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    try {
      // Try to fetch from manager service if available
      const response = await fetch(`${managerApiUrl}/api/telemetry/spans?${searchParams.toString()}`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch (error) {
      console.warn('Manager service not available, using mock data');
    }

    // Generate mock span data
    const timeRangeMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    }[timeRange] || 60 * 60 * 1000;

    const now = new Date();
    const spanNames = [
      'SwarmCreation',
      'TaskExecution', 
      'WorkerAssignment',
      'ApiRequest',
      'DatabaseQuery',
      'FileUpload',
      'DataProcessing',
      'ValidationCheck',
      'DeploymentProcess',
      'HealthCheck',
      'MetricsCollection',
      'LogAggregation'
    ];

    const spans: SpanData[] = Array.from({ length: 50 }, (_, i) => {
      const spanStartTime = new Date(now.getTime() - Math.random() * timeRangeMs);
      const duration = Math.floor(Math.random() * 3000) + 50;
      const spanEndTime = new Date(spanStartTime.getTime() + duration);
      const spanStatus = ['success', 'success', 'success', 'success', 'error', 'pending'][Math.floor(Math.random() * 6)] as any;
      const name = spanNames[Math.floor(Math.random() * spanNames.length)];

      return {
        id: `span-${i + 1}-${Date.now()}`,
        name,
        startTime: spanStartTime,
        endTime: spanStatus === 'pending' ? undefined : spanEndTime,
        duration: spanStatus === 'pending' ? undefined : duration,
        status: spanStatus,
        parentId: i > 10 ? `span-${Math.floor(Math.random() * 10) + 1}-${Date.now()}` : undefined,
        input: {
          swarmId: swarmId || `swarm-${Math.floor(Math.random() * 3) + 1}`,
          taskType: ['automated', 'manual', 'scheduled'][Math.floor(Math.random() * 3)],
          priority: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
          userId: `user-${Math.floor(Math.random() * 10) + 1}`,
          requestId: `req-${Math.random().toString(36).substr(2, 9)}`,
        },
        output: spanStatus === 'pending' ? undefined : {
          result: spanStatus,
          processedItems: Math.floor(Math.random() * 100),
          metrics: { 
            cpu: Math.random() * 100, 
            memory: Math.random() * 1024,
            networkIO: Math.random() * 1000000 // bytes
          },
          errors: spanStatus === 'error' ? [
            `Error in ${name}: ${['Timeout', 'Connection failed', 'Invalid input', 'Resource limit'][Math.floor(Math.random() * 4)]}`
          ] : undefined,
        },
        metadata: {
          version: '1.0.0',
          environment: 'production',
          region: ['us-east-1', 'us-west-2', 'eu-west-1'][Math.floor(Math.random() * 3)],
          sessionId: `session-${Math.floor(Math.random() * 5) + 1}`,
          traceId: `trace-${Math.random().toString(36).substr(2, 16)}`,
          workerId: `worker-${Math.floor(Math.random() * 8) + 1}`,
          machineId: `machine-${Math.random().toString(36).substr(2, 8)}`,
        },
      };
    });

    // Apply filters
    let filteredSpans = spans;
    
    if (spanName) {
      filteredSpans = filteredSpans.filter(span => 
        span.name.toLowerCase().includes(spanName.toLowerCase())
      );
    }
    
    if (status) {
      filteredSpans = filteredSpans.filter(span => span.status === status);
    }

    if (swarmId) {
      filteredSpans = filteredSpans.filter(span => 
        span.input?.swarmId === swarmId
      );
    }

    // Sort by start time (newest first)
    filteredSpans.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    return NextResponse.json({
      spans: filteredSpans,
      summary: {
        total: filteredSpans.length,
        success: filteredSpans.filter(s => s.status === 'success').length,
        error: filteredSpans.filter(s => s.status === 'error').length,
        pending: filteredSpans.filter(s => s.status === 'pending').length,
        avgDuration: filteredSpans.filter(s => s.duration).reduce((sum, s) => sum + (s.duration || 0), 0) / 
                    filteredSpans.filter(s => s.duration).length || 0,
        timeRange,
        swarmId,
        generated: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('Error fetching telemetry spans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch telemetry spans' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const span = await request.json();
    
    // In production, this would send to the telemetry service
    // const telemetryService = new TelemetryService();
    // telemetryService.startSpan(span.id, span.name, span.input, span.metadata, span.parentId);

    console.log('Recording telemetry span:', span);
    
    return NextResponse.json({ 
      success: true, 
      spanId: span.id,
      recorded: new Date().toISOString() 
    });

  } catch (error) {
    console.error('Error recording telemetry span:', error);
    return NextResponse.json(
      { error: 'Failed to record telemetry span' },
      { status: 500 }
    );
  }
}