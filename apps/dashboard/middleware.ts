import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const pathname = request.nextUrl.pathname;

  // Skip middleware for public paths and static assets
  const publicPaths = [
    '/auth',
    '/api/auth',
    '/api/public',
    '/_next',
    '/favicon.ico',
    '/images',
    '/css',
    '/js'
  ];

  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  
  if (isPublicPath) {
    return res;
  }

  try {
    // Create a Supabase client configured to use cookies
    const supabase = createMiddlewareClient({ req: request, res });

    // Check if we have a session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // If accessing protected API routes, verify authentication
    if (pathname.startsWith('/api/')) {
      // Allow access to Supabase webhooks with proper headers
      if (pathname.startsWith('/api/supabase/webhooks')) {
        const signature = request.headers.get('x-supabase-signature');
        if (signature) {
          return res;
        }
      }

      // Check for API key authentication for machine-to-machine communication
      const apiKey = request.headers.get('x-api-key');
      const validApiKey = process.env.SWARM_API_KEY;
      
      if (apiKey && validApiKey && apiKey === validApiKey) {
        return res;
      }

      // Check for session-based authentication
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized - No valid session' },
          { status: 401 }
        );
      }

      // Verify user role for admin endpoints
      if (pathname.startsWith('/api/admin/')) {
        const userRole = session.user?.user_metadata?.app_role;
        if (userRole !== 'admin' && userRole !== 'super_admin') {
          return NextResponse.json(
            { error: 'Forbidden - Admin access required' },
            { status: 403 }
          );
        }
      }

      return res;
    }

    // For dashboard pages, redirect to auth if no session
    if (!session && pathname !== '/auth') {
      const redirectUrl = new URL('/auth', request.url);
      redirectUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // If user is authenticated and trying to access auth page, redirect to dashboard
    if (session && pathname === '/auth') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return res;

  } catch (error) {
    console.error('Middleware error:', error);
    
    // On error, redirect API calls to error response, pages to auth
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
    
    return NextResponse.redirect(new URL('/auth', request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}