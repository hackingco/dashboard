import { NextRequest, NextResponse } from 'next/server';

const MANAGER_URL = process.env.MANAGER_URL || 'http://localhost:8080';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${MANAGER_URL}/api/swarms/${params.id}/start`, {
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
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error starting swarm:', error);
    return NextResponse.json(
      { error: 'Failed to start swarm' },
      { status: 500 }
    );
  }
}