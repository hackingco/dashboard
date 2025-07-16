/**
 * Langfuse instrumentation middleware for Next.js API routes
 * Automatically instruments all API calls with performance tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { getLangfuseServer, withPerformanceMonitoring } from '@/lib/langfuse-server'

export async function instrumentedAPIHandler(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const url = new URL(request.url)
  const method = request.method
  const pathname = url.pathname
  const startTime = Date.now()

  // Create a unique session ID for this request
  const sessionId = `api-${method}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  try {
    // Initialize Langfuse if not already done
    const langfuse = getLangfuseServer()

    // Create a trace for this API request
    const trace = langfuse.trace({
      name: `API: ${method} ${pathname}`,
      sessionId,
      metadata: {
        method,
        pathname,
        query: Object.fromEntries(url.searchParams),
        headers: Object.fromEntries(request.headers.entries()),
        timestamp: new Date().toISOString(),
      },
      tags: ['api', method.toLowerCase(), pathname.split('/').filter(Boolean).join('-')],
    })

    // Execute the handler with performance monitoring
    const response = await withPerformanceMonitoring(
      `${method} ${pathname}`,
      () => handler(request),
      1000 // Warn if request takes more than 1 second
    )

    // Update trace with response information
    const duration = Date.now() - startTime
    trace.update({
      output: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      },
      metadata: {
        method,
        pathname,
        duration,
        status: response.status,
        success: response.status < 400,
      },
      level: response.status >= 400 ? 'ERROR' : 'DEFAULT',
    })

    // Create a generation span for the API processing
    const generation = trace.generation({
      name: 'API Processing',
      model: 'api-handler',
      input: {
        method,
        pathname,
        query: Object.fromEntries(url.searchParams),
      },
      output: {
        status: response.status,
        duration,
      },
      usage: {
        promptTokens: 0,
        completionTokens: 0,
      },
    })

    generation.end()
    await langfuse.flushAsync()

    return response
  } catch (error) {
    // Log error to Langfuse
    const langfuse = getLangfuseServer()
    const duration = Date.now() - startTime

    const trace = langfuse.trace({
      name: `API Error: ${method} ${pathname}`,
      sessionId,
      metadata: {
        method,
        pathname,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      tags: ['api', 'error', method.toLowerCase()],
      level: 'ERROR',
    })

    await langfuse.flushAsync()

    // Return error response
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// Middleware for specific route patterns
export function createInstrumentedHandler(
  routeName: string,
  tags: string[] = []
) {
  return function instrumentedHandler(
    handler: (req: NextRequest) => Promise<NextResponse>
  ) {
    return async (request: NextRequest): Promise<NextResponse> => {
      const langfuse = getLangfuseServer()
      const sessionId = `${routeName}-${Date.now()}`

      const trace = langfuse.trace({
        name: routeName,
        sessionId,
        tags: ['instrumented', ...tags],
        metadata: {
          route: routeName,
          method: request.method,
          timestamp: new Date().toISOString(),
        },
      })

      try {
        const result = await handler(request)
        
        trace.update({
          output: { success: true, status: result.status },
          metadata: {
            route: routeName,
            method: request.method,
            status: result.status,
          },
        })

        await langfuse.flushAsync()
        return result
      } catch (error) {
        trace.update({
          output: { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
          metadata: {
            route: routeName,
            method: request.method,
            error: error instanceof Error ? error.stack : String(error),
          },
          level: 'ERROR',
        })

        await langfuse.flushAsync()
        throw error
      }
    }
  }
}

// Export convenience wrappers for common patterns
export const instrumentedGET = createInstrumentedHandler('GET Handler', ['get'])
export const instrumentedPOST = createInstrumentedHandler('POST Handler', ['post'])
export const instrumentedPUT = createInstrumentedHandler('PUT Handler', ['put'])
export const instrumentedDELETE = createInstrumentedHandler('DELETE Handler', ['delete'])