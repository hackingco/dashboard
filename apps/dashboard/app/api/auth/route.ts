import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { action, email, password, token } = await request.json();

    switch (action) {
      case 'signup':
        return await handleSignup(email, password);
      
      case 'signin':
        return await handleSignin(email, password);
      
      case 'signout':
        return await handleSignout();
      
      case 'verify':
        return await verifyToken(token);
      
      case 'refresh':
        return await refreshToken(token);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      { 
        error: 'Authentication failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function handleSignup(email: string, password: string) {
  try {
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          app_role: 'user',
          created_via: 'swarm_dashboard'
        }
      }
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.log('User signed up:', data.user?.email);

    return NextResponse.json({
      user: data.user,
      session: data.session,
      message: 'Signup successful. Please check your email for verification.'
    });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Signup failed' },
      { status: 500 }
    );
  }
}

async function handleSignin(email: string, password: string) {
  try {
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    console.log('User signed in:', data.user?.email);

    // Update last login timestamp
    if (data.user) {
      await supabaseAdmin
        .from('user_profiles')
        .upsert({
          id: data.user.id,
          email: data.user.email,
          last_login: new Date().toISOString(),
          login_count: 1 // Would increment in real implementation
        });
    }

    return NextResponse.json({
      user: data.user,
      session: data.session,
      message: 'Signin successful'
    });

  } catch (error) {
    console.error('Signin error:', error);
    return NextResponse.json(
      { error: 'Signin failed' },
      { status: 500 }
    );
  }
}

async function handleSignout() {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Signout successful'
    });

  } catch (error) {
    console.error('Signout error:', error);
    return NextResponse.json(
      { error: 'Signout failed' },
      { status: 500 }
    );
  }
}

async function verifyToken(token: string) {
  try {
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: data.user,
      valid: true
    });

  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json(
      { error: 'Token verification failed' },
      { status: 500 }
    );
  }
}

async function refreshToken(refreshToken: string) {
  try {
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error) {
      return NextResponse.json(
        { error: 'Token refresh failed' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      session: data.session,
      user: data.user
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { error: 'Token refresh failed' },
      { status: 500 }
    );
  }
}