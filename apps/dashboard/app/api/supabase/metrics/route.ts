import { NextRequest, NextResponse } from 'next/server';
import { SwarmDatabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const metricType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required parameter: sessionId' },
        { status: 400 }
      );
    }

    console.log('Fetching metrics:', { sessionId, metricType, limit });

    const metrics = await SwarmDatabase.getMetrics(sessionId, metricType || undefined, limit);

    // Group metrics by type for easier consumption
    const groupedMetrics = metrics.reduce((acc, metric) => {
      if (!acc[metric.metric_type]) {
        acc[metric.metric_type] = [];
      }
      acc[metric.metric_type].push(metric);
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json({
      metrics: groupedMetrics,
      total: metrics.length,
      sessionId,
      metricType: metricType || 'all',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const metricData = await request.json();
    
    // Validate required fields
    if (!metricData.session_id || !metricData.metric_type || metricData.metric_value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, metric_type, metric_value' },
        { status: 400 }
      );
    }

    // Handle batch metric creation
    if (Array.isArray(metricData)) {
      const results = [];
      for (const metric of metricData) {
        if (!metric.session_id || !metric.metric_type || metric.metric_value === undefined) {
          continue; // Skip invalid metrics
        }

        const metricRecord = {
          id: metric.id || crypto.randomUUID(),
          session_id: metric.session_id,
          metric_type: metric.metric_type,
          metric_value: parseFloat(metric.metric_value),
          metric_data: metric.metric_data || {},
          timestamp: metric.timestamp || new Date().toISOString()
        };

        try {
          const createdMetric = await SwarmDatabase.insertMetrics(metricRecord);
          results.push(createdMetric);
        } catch (error) {
          console.warn('Failed to insert metric:', error);
        }
      }

      return NextResponse.json({ 
        metrics: results, 
        count: results.length 
      }, { status: 201 });
    }

    // Single metric creation
    const metric = {
      id: metricData.id || crypto.randomUUID(),
      session_id: metricData.session_id,
      metric_type: metricData.metric_type,
      metric_value: parseFloat(metricData.metric_value),
      metric_data: metricData.metric_data || {},
      timestamp: metricData.timestamp || new Date().toISOString()
    };

    const createdMetric = await SwarmDatabase.insertMetrics(metric);

    console.log('Created metric:', createdMetric.id);

    return NextResponse.json(createdMetric, { status: 201 });

  } catch (error) {
    console.error('Error creating metric:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create metric',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}