import { NextRequest } from 'next/server';
import { supabase, supabaseAdmin } from './supabase';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  lastLogin?: string;
}

export class AuthUtils {
  
  /**
   * Verify JWT token and return user information
   */
  static async verifyToken(token: string): Promise<AuthUser | null> {
    try {
      const { data, error } = await supabase.auth.getUser(token);
      
      if (error || !data.user) {
        return null;
      }

      const user: AuthUser = {
        id: data.user.id,
        email: data.user.email || '',
        role: data.user.user_metadata?.app_role || 'user',
        permissions: this.getRolePermissions(data.user.user_metadata?.app_role)
      };

      return user;

    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Extract and verify authorization from request headers
   */
  static async authenticateRequest(request: NextRequest): Promise<AuthUser | null> {
    // Check for Bearer token
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return this.verifyToken(token);
    }

    // Check for API key
    const apiKey = request.headers.get('x-api-key');
    if (apiKey) {
      return this.verifyApiKey(apiKey);
    }

    // Check for session cookie (handled by middleware)
    return null;
  }

  /**
   * Verify API key for machine-to-machine authentication
   */
  static async verifyApiKey(apiKey: string): Promise<AuthUser | null> {
    const validApiKey = process.env.SWARM_API_KEY;
    
    if (!validApiKey || apiKey !== validApiKey) {
      return null;
    }

    // Return system user for API key authentication
    return {
      id: 'system',
      email: 'system@swarm.local',
      role: 'system',
      permissions: ['all']
    };
  }

  /**
   * Get permissions for a given role
   */
  static getRolePermissions(role: string): string[] {
    const rolePermissions: Record<string, string[]> = {
      'super_admin': ['all'],
      'admin': [
        'read:all',
        'write:swarms',
        'write:agents',
        'write:traces',
        'write:metrics',
        'delete:swarms',
        'manage:users'
      ],
      'operator': [
        'read:all',
        'write:swarms',
        'write:agents',
        'write:traces',
        'write:metrics'
      ],
      'viewer': [
        'read:swarms',
        'read:agents',
        'read:traces',
        'read:metrics'
      ],
      'user': [
        'read:own',
        'write:own'
      ],
      'system': ['all']
    };

    return rolePermissions[role] || rolePermissions['user'];
  }

  /**
   * Check if user has required permission
   */
  static hasPermission(user: AuthUser, permission: string): boolean {
    if (user.permissions.includes('all')) {
      return true;
    }

    return user.permissions.includes(permission);
  }

  /**
   * Check if user can access resource
   */
  static canAccessResource(user: AuthUser, resource: string, action: string): boolean {
    const permission = `${action}:${resource}`;
    
    if (this.hasPermission(user, permission)) {
      return true;
    }

    // Check for wildcard permissions
    if (this.hasPermission(user, `${action}:all`)) {
      return true;
    }

    return false;
  }

  /**
   * Create audit log entry
   */
  static async createAuditLog(
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    metadata?: any
  ): Promise<void> {
    try {
      await supabaseAdmin
        .from('audit_logs')
        .insert({
          user_id: userId,
          action,
          resource,
          resource_id: resourceId,
          metadata,
          timestamp: new Date().toISOString(),
          ip_address: metadata?.ip_address,
          user_agent: metadata?.user_agent
        });
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // Don't throw - audit logging shouldn't break functionality
    }
  }

  /**
   * Rate limiting check
   */
  static async checkRateLimit(
    userId: string,
    action: string,
    window: number = 3600, // 1 hour
    limit: number = 100
  ): Promise<boolean> {
    try {
      const windowStart = new Date(Date.now() - window * 1000);
      
      const { count } = await supabaseAdmin
        .from('rate_limits')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('action', action)
        .gte('timestamp', windowStart.toISOString());

      if (count && count >= limit) {
        return false; // Rate limit exceeded
      }

      // Record this request
      await supabaseAdmin
        .from('rate_limits')
        .insert({
          user_id: userId,
          action,
          timestamp: new Date().toISOString()
        });

      return true;

    } catch (error) {
      console.error('Rate limit check failed:', error);
      return true; // Allow on error
    }
  }

  /**
   * Generate secure API key
   */
  static generateApiKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'sk_';
    
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * Hash sensitive data
   */
  static async hashData(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}