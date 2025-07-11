import { NextResponse } from 'next/server'

export async function GET() {
  // Check if we have a server-side API token
  const hasToken = !!process.env.FLY_API_TOKEN
  
  return NextResponse.json({
    hasServerToken: hasToken,
    requiresClientToken: !hasToken,
  })
}