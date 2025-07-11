import { NextRequest, NextResponse } from 'next/server';

const MANAGER_URL = process.env.MANAGER_URL || 'http://localhost:8080';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${MANAGER_URL}/api/swarms`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Manager API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching swarms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch swarms' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${MANAGER_URL}/api/swarms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Manager API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating swarm:', error);
    return NextResponse.json(
      { error: 'Failed to create swarm' },
      { status: 500 }
    );
  }
}