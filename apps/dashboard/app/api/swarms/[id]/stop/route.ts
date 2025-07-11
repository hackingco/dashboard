import { NextRequest, NextResponse } from 'next/server';

const MANAGER_URL = process.env.MANAGER_URL || 'http://localhost:8080';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const response = await fetch(`${MANAGER_URL}/api/swarms/${params.id}/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Manager API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error stopping swarm:', error);
    return NextResponse.json(
      { error: 'Failed to stop swarm' },
      { status: 500 }
    );
  }
}