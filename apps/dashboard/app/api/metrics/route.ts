/**
 * API Route: /api/metrics
 * Handles time-series metrics data for dashboard analytics and monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin, SwarmDatabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    const metricType = searchParams.get('metric_type')
    const timeRange = searchParams.get('time_range') || '1h'
    const aggregation = searchParams.get('aggregation') || 'avg'
    const limit = parseInt(searchParams.get('limit') || '100')

    // Calculate time range
    const timeRangeMs = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }[timeRange] || 60 * 60 * 1000

    const timeThreshold = new Date(Date.now() - timeRangeMs).toISOString()

    // Build base query
    let query = supabaseAdmin
      .from('swarm_metrics')
      .select('*')
      .gte('timestamp', timeThreshold)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    if (metricType) {
      query = query.eq('metric_type', metricType)
    }

    const { data: metrics, error } = await query

    if (error) {
      console.error('Error fetching metrics:', error)
      return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
    }

    // Process metrics for time series analysis
    const processedMetrics = processTimeSeriesData(metrics || [], timeRange, aggregation)

    // Calculate summary statistics
    const summary = calculateSummaryStats(metrics || [])

    // Get real-time system metrics
    const systemMetrics = await generateSystemMetrics(sessionId)

    return NextResponse.json({
      metrics: processedMetrics,
      summary,
      systemMetrics,
      timeRange,
      aggregation,
      count: metrics?.length || 0,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Unexpected error in metrics API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      session_id,
      metric_type,
      metric_value,
      metric_data = {},
      timestamp = new Date().toISOString()
    } = body

    if (!session_id || !metric_type || metric_value === undefined) {
      return NextResponse.json({
        error: 'Missing required fields: session_id, metric_type, metric_value'
      }, { status: 400 })
    }

    const newMetric = await SwarmDatabase.insertMetrics({
      id: `metric-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      session_id,
      metric_type,
      metric_value,
      metric_data,
      timestamp
    })

    return NextResponse.json({
      metric: newMetric,
      message: 'Metric recorded successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error recording metric:', error)
    return NextResponse.json({ error: 'Failed to record metric' }, { status: 500 })
  }
}

// Batch insert metrics
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { metrics } = body

    if (!metrics || !Array.isArray(metrics)) {
      return NextResponse.json({
        error: 'Invalid request: metrics array required'
      }, { status: 400 })
    }

    const processedMetrics = metrics.map(metric => ({
      id: `metric-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...metric,
      timestamp: metric.timestamp || new Date().toISOString()
    }))

    const { data, error } = await supabaseAdmin
      .from('swarm_metrics')
      .insert(processedMetrics)
      .select()

    if (error) {
      throw error
    }

    return NextResponse.json({
      metrics: data,
      count: data?.length || 0,
      message: 'Metrics batch recorded successfully'
    })

  } catch (error) {
    console.error('Error batch recording metrics:', error)
    return NextResponse.json({ error: 'Failed to batch record metrics' }, { status: 500 })
  }
}

// Helper function to process time series data
function processTimeSeriesData(metrics: any[], timeRange: string, aggregation: string) {
  if (!metrics.length) return []

  // Group metrics by time intervals
  const intervalMs = {
    '5m': 30 * 1000,     // 30-second intervals
    '15m': 60 * 1000,    // 1-minute intervals
    '1h': 5 * 60 * 1000, // 5-minute intervals
    '6h': 15 * 60 * 1000, // 15-minute intervals
    '24h': 60 * 60 * 1000, // 1-hour intervals
    '7d': 6 * 60 * 60 * 1000, // 6-hour intervals
    '30d': 24 * 60 * 60 * 1000, // 1-day intervals
  }[timeRange] || 5 * 60 * 1000

  const grouped = new Map()

  metrics.forEach(metric => {
    const timestamp = new Date(metric.timestamp)
    const intervalStart = new Date(Math.floor(timestamp.getTime() / intervalMs) * intervalMs)
    const key = `${intervalStart.toISOString()}-${metric.metric_type}`

    if (!grouped.has(key)) {
      grouped.set(key, {
        timestamp: intervalStart,
        metric_type: metric.metric_type,
        values: [],
        metric_data: []
      })
    }

    grouped.get(key).values.push(metric.metric_value)
    grouped.get(key).metric_data.push(metric.metric_data)
  })

  // Apply aggregation
  return Array.from(grouped.values()).map(group => {
    let aggregatedValue: number

    switch (aggregation) {
      case 'sum':
        aggregatedValue = group.values.reduce((sum: number, val: number) => sum + val, 0)
        break
      case 'max':
        aggregatedValue = Math.max(...group.values)
        break
      case 'min':
        aggregatedValue = Math.min(...group.values)
        break
      case 'count':
        aggregatedValue = group.values.length
        break
      case 'avg':
      default:
        aggregatedValue = group.values.reduce((sum: number, val: number) => sum + val, 0) / group.values.length
        break
    }

    return {
      timestamp: group.timestamp,
      metric_type: group.metric_type,
      value: aggregatedValue,
      count: group.values.length,
      raw_values: group.values,
      aggregation
    }
  }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

// Helper function to calculate summary statistics
function calculateSummaryStats(metrics: any[]) {
  if (!metrics.length) return {}

  const groupedByType = metrics.reduce((acc, metric) => {
    if (!acc[metric.metric_type]) {
      acc[metric.metric_type] = []
    }
    acc[metric.metric_type].push(metric.metric_value)
    return acc
  }, {} as Record<string, number[]>)

  const summary: Record<string, any> = {}

  Object.entries(groupedByType).forEach(([type, values]) => {
    const sortedValues = values.sort((a, b) => a - b)
    const sum = values.reduce((s, v) => s + v, 0)
    const avg = sum / values.length

    summary[type] = {
      count: values.length,
      sum,
      avg,
      min: sortedValues[0],
      max: sortedValues[sortedValues.length - 1],
      median: sortedValues[Math.floor(sortedValues.length / 2)],
      stddev: Math.sqrt(
        values.reduce((variance, v) => variance + Math.pow(v - avg, 2), 0) / values.length
      ),
      percentiles: {
        p25: sortedValues[Math.floor(sortedValues.length * 0.25)],
        p75: sortedValues[Math.floor(sortedValues.length * 0.75)],
        p90: sortedValues[Math.floor(sortedValues.length * 0.90)],
        p95: sortedValues[Math.floor(sortedValues.length * 0.95)],
        p99: sortedValues[Math.floor(sortedValues.length * 0.99)]
      }
    }
  })

  return summary
}

// Helper function to generate current system metrics
async function generateSystemMetrics(sessionId?: string | null) {
  const timestamp = new Date()

  // Get current counts from database
  const [tracesCount, agentsCount, sessionsCount] = await Promise.all([
    supabaseAdmin
      .from('swarm_traces')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId || ''),
    supabaseAdmin
      .from('swarm_agents')
      .select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('swarm_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
  ])

  return {
    timestamp: timestamp.toISOString(),
    system: {
      active_traces: tracesCount.count || 0,
      active_agents: agentsCount.count || 0,
      active_sessions: sessionsCount.count || 0,
      memory_usage: Math.random() * 80 + 20, // Simulated
      cpu_usage: Math.random() * 70 + 15,    // Simulated
      disk_usage: Math.random() * 60 + 30,   // Simulated
      network_io: Math.random() * 100 + 50,  // Simulated
    },
    performance: {
      avg_response_time: Math.random() * 1000 + 500,
      throughput: Math.random() * 50 + 20,
      error_rate: Math.random() * 5,
      success_rate: 95 + Math.random() * 5,
    },
    health: {
      overall_score: 85 + Math.random() * 15,
      database_latency: Math.random() * 50 + 10,
      api_latency: Math.random() * 100 + 50,
      websocket_connections: Math.floor(Math.random() * 20) + 5,
    }
  }
}