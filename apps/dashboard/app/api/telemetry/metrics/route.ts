import { NextRequest, NextResponse } from 'next/server';

interface TelemetryMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const swarmId = searchParams.get('swarmId');
    const timeRange = searchParams.get('timeRange') || '1h';
    const metricName = searchParams.get('name');

    // In production, this would fetch from the telemetry service
    // const telemetryService = new TelemetryService();
    // const metrics = telemetryService.getMetrics(metricName, sinceDate);

    // For now, return mock data
    const managerApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    try {
      // Try to fetch from manager service if available
      const response = await fetch(`${managerApiUrl}/api/telemetry/metrics?${searchParams.toString()}`, {
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

    // Generate mock telemetry data
    const timeRangeMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    }[timeRange] || 60 * 60 * 1000;

    const now = new Date();
    const metricNames = metricName ? [metricName] : [
      'span.duration',
      'api.response_time',
      'swarm.creation_time',
      'task.execution_time',
      'error.rate',
      'throughput.tasks_per_minute',
      'memory.usage_mb',
      'cpu.usage_percent'
    ];

    const metrics: TelemetryMetric[] = [];
    
    metricNames.forEach(name => {
      const pointCount = timeRange === '7d' ? 168 : timeRange === '24h' ? 48 : 60; // hourly points
      for (let i = 0; i < pointCount; i++) {
        const timestamp = new Date(now.getTime() - (i * timeRangeMs / pointCount));
        let value = Math.random() * 100;
        
        // Add realistic patterns
        if (name.includes('duration') || name.includes('time')) {
          value = Math.random() * 1000 + 100; // 100-1100ms
        } else if (name.includes('rate')) {
          value = Math.random() * 10; // 0-10%
        } else if (name.includes('percent')) {
          value = Math.random() * 100; // 0-100%
        } else if (name.includes('mb')) {
          value = Math.random() * 512 + 256; // 256-768MB
        }

        metrics.push({
          name,
          value,
          unit: name.includes('time') || name.includes('duration') ? 'ms' : 
                name.includes('percent') ? '%' : 
                name.includes('mb') ? 'MB' :
                name.includes('rate') ? '/min' : 'count',
          timestamp,
          tags: {
            swarm: swarmId || `swarm-${Math.floor(Math.random() * 3) + 1}`,
            environment: 'production',
            region: 'us-east-1',
          },
        });
      }
    });

    return NextResponse.json({
      metrics: metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
      summary: {
        count: metrics.length,
        timeRange,
        swarmId,
        generated: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('Error fetching telemetry metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch telemetry metrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const metric = await request.json();
    
    // In production, this would send to the telemetry service
    // const telemetryService = new TelemetryService();
    // telemetryService.recordMetric(metric.name, metric.value, metric.unit, metric.tags);

    console.log('Recording telemetry metric:', metric);
    
    return NextResponse.json({ 
      success: true, 
      recorded: new Date().toISOString() 
    });

  } catch (error) {
    console.error('Error recording telemetry metric:', error);
    return NextResponse.json(
      { error: 'Failed to record telemetry metric' },
      { status: 500 }
    );
  }
}