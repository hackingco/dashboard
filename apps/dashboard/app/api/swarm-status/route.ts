import { NextRequest, NextResponse } from 'next/server'

const SWARM_APPS = ['swarm-admin', 'swarm-manager', 'swarm-worker']

export async function GET(request: NextRequest) {
  // Use server-side token if available, otherwise require client token
  const serverToken = process.env.FLY_API_TOKEN
  const authHeader = request.headers.get('authorization')
  
  let token = serverToken
  if (!token) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    token = authHeader.substring(7)
  }
  const results = []

  for (const appName of SWARM_APPS) {
    try {
      // Fetch machines for each app
      const response = await fetch(
        `https://api.machines.dev/v1/apps/${appName}/machines`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.ok) {
        const machines = await response.json()
        results.push({
          app: appName,
          machines: machines,
          status: 'success',
        })
      } else {
        results.push({
          app: appName,
          machines: [],
          status: 'error',
          error: `HTTP ${response.status}`,
        })
      }
    } catch (error) {
      results.push({
        app: appName,
        machines: [],
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    apps: results,
  })
}