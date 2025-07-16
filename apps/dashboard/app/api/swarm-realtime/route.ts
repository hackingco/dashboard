// Swarm Real-time API Routes
// Created: 2025-07-14
// Purpose: Real-time data streaming for swarm coordination

import { NextRequest, NextResponse } from 'next/server';
import SwarmCoordinationClient from '@/lib/swarm-coordination-client';

const swarmClient = new SwarmCoordinationClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/swarm-realtime - Get real-time performance charts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const operation = searchParams.get('operation');
    const metricType = searchParams.get('metricType') || 'response_time';
    const timeRange = searchParams.get('timeRange') || '24h';

    switch (operation) {
      case 'performance-chart':
        const chartResult = await swarmClient.getPerformanceChart(metricType, timeRange);
        
        if (!chartResult.success) {
          return NextResponse.json(
            { success: false, error: chartResult.error },
            { status: 500 }
          );
        }

        return NextResponse.json(chartResult);

      case 'dashboard-metrics':
        const metricsResult = await swarmClient.getDashboardMetrics();
        
        if (!metricsResult.success) {
          return NextResponse.json(
            { success: false, error: metricsResult.error },
            { status: 500 }
          );
        }

        return NextResponse.json(metricsResult);

      case 'memory-cleanup':
        const cleanupResult = await swarmClient.cleanupExpiredMemory();
        
        if (!cleanupResult.success) {
          return NextResponse.json(
            { success: false, error: cleanupResult.error },
            { status: 500 }
          );
        }

        return NextResponse.json(cleanupResult);

      case 'archive-sessions':
        const daysOld = parseInt(searchParams.get('daysOld') || '30');
        const archiveResult = await swarmClient.archiveOldSessions(daysOld);
        
        if (!archiveResult.success) {
          return NextResponse.json(
            { success: false, error: archiveResult.error },
            { status: 500 }
          );
        }

        return NextResponse.json(archiveResult);

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid operation' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in GET /api/swarm-realtime:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/swarm-realtime - Setup real-time subscriptions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operation, data } = body;

    switch (operation) {
      case 'memory-retrieve':
        const { key, namespace, sessionId } = data;
        const memoryResult = await swarmClient.retrieveMemory(key, namespace, sessionId);
        
        if (!memoryResult.success) {
          return NextResponse.json(
            { success: false, error: memoryResult.error },
            { status: 500 }
          );
        }

        return NextResponse.json(memoryResult);

      case 'record-metric':
        const metricResult = await swarmClient.recordMetric(data);
        
        if (!metricResult.success) {
          return NextResponse.json(
            { success: false, error: metricResult.error },
            { status: 500 }
          );
        }

        return NextResponse.json(metricResult);

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid operation' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in POST /api/swarm-realtime:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}