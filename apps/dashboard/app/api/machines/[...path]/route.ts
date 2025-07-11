import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
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
  const path = params.path.join('/')
  const url = new URL(request.url)
  const searchParams = url.searchParams.toString()
  const apiUrl = `https://api.machines.dev/v1/${path}${searchParams ? `?${searchParams}` : ''}`

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Machines API proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch from Machines API' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
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
  const path = params.path.join('/')
  const apiUrl = `https://api.machines.dev/v1/${path}`

  try {
    let body = null
    const contentType = request.headers.get('content-type')
    
    if (contentType && contentType.includes('application/json')) {
      try {
        body = await request.json()
      } catch {
        // Empty body is ok for some POST requests
      }
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 })
    }

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Machines API proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch from Machines API' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
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
  const path = params.path.join('/')
  const body = await request.json()
  const apiUrl = `https://api.machines.dev/v1/${path}`

  try {
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Machines API proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch from Machines API' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
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
  const path = params.path.join('/')
  const apiUrl = `https://api.machines.dev/v1/${path}`

  try {
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 })
    }

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Machines API proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch from Machines API' },
      { status: 500 }
    )
  }
}