/**
 * Enhanced Supabase Admin Operations
 * Provides administrative functions for user management, organizations, and security
 */

import { supabaseAdmin } from './supabase';
import { AuthUtils } from './auth-utils';

export interface AdminUser {
  id: string;
  email: string;
  displayName?: string;
  appRole: string;
  organizationId?: string;
  isActive: boolean;
  lastLogin?: string;
  loginCount: number;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  settings: any;
  plan: string;
  isActive: boolean;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  userId: string;
  permissions: string[];
  rateLimit: number;
  isActive: boolean;
  lastUsed?: string;
  expiresAt?: string;
  createdAt: string;
}

export class SupabaseAdmin {
  
  // User Management
  static async createUser(userData: {
    email: string;
    password: string;
    displayName?: string;
    appRole?: string;
    organizationId?: string;
  }): Promise<AdminUser> {
    try {
      // Create user in auth.users
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          display_name: userData.displayName || userData.email,
          app_role: userData.appRole || 'user'
        }
      });

      if (authError) throw authError;

      // Create user profile
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          email: userData.email,
          display_name: userData.displayName || userData.email,
          app_role: userData.appRole || 'user',
          organization_id: userData.organizationId || '00000000-0000-0000-0000-000000000000'
        })
        .select()
        .single();

      if (profileError) throw profileError;

      return {
        id: profileData.id,
        email: profileData.email,
        displayName: profileData.display_name,
        appRole: profileData.app_role,
        organizationId: profileData.organization_id,
        isActive: profileData.is_active,
        lastLogin: profileData.last_login,
        loginCount: profileData.login_count,
        createdAt: profileData.created_at
      };

    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  static async getUserById(userId: string): Promise<AdminUser | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      return {
        id: data.id,
        email: data.email,
        displayName: data.display_name,
        appRole: data.app_role,
        organizationId: data.organization_id,
        isActive: data.is_active,
        lastLogin: data.last_login,
        loginCount: data.login_count,
        createdAt: data.created_at
      };

    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  static async listUsers(organizationId?: string, limit: number = 50): Promise<AdminUser[]> {
    try {
      let query = supabaseAdmin
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.map(user => ({
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        appRole: user.app_role,
        organizationId: user.organization_id,
        isActive: user.is_active,
        lastLogin: user.last_login,
        loginCount: user.login_count,
        createdAt: user.created_at
      }));

    } catch (error) {
      console.error('Error listing users:', error);
      return [];
    }
  }

  static async updateUserRole(userId: string, role: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({ 
          app_role: role,
          permissions: AuthUtils.getRolePermissions(role)
        })
        .eq('id', userId);

      if (error) throw error;

      // Also update auth metadata
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { app_role: role }
      });

    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }

  static async deactivateUser(userId: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', userId);

      if (error) throw error;

    } catch (error) {
      console.error('Error deactivating user:', error);
      throw error;
    }
  }

  // Organization Management
  static async createOrganization(orgData: {
    name: string;
    slug: string;
    description?: string;
    plan?: string;
  }): Promise<Organization> {
    try {
      const { data, error } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: orgData.name,
          slug: orgData.slug,
          description: orgData.description,
          plan: orgData.plan || 'free'
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        description: data.description,
        settings: data.settings,
        plan: data.plan,
        isActive: data.is_active,
        createdAt: data.created_at
      };

    } catch (error) {
      console.error('Error creating organization:', error);
      throw error;
    }
  }

  static async listOrganizations(): Promise<Organization[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(org => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        settings: org.settings,
        plan: org.plan,
        isActive: org.is_active,
        createdAt: org.created_at
      }));

    } catch (error) {
      console.error('Error listing organizations:', error);
      return [];
    }
  }

  // API Key Management
  static async createApiKey(keyData: {
    name: string;
    userId: string;
    permissions?: string[];
    rateLimit?: number;
    expiresAt?: string;
  }): Promise<{ apiKey: ApiKey; fullKey: string }> {
    try {
      const fullKey = AuthUtils.generateApiKey();
      const keyHash = await AuthUtils.hashData(fullKey);
      const keyPrefix = fullKey.substring(0, 7) + '...';

      const { data, error } = await supabaseAdmin
        .from('api_keys')
        .insert({
          name: keyData.name,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          user_id: keyData.userId,
          permissions: keyData.permissions || ['read:own'],
          rate_limit: keyData.rateLimit || 1000,
          expires_at: keyData.expiresAt
        })
        .select()
        .single();

      if (error) throw error;

      const apiKey: ApiKey = {
        id: data.id,
        name: data.name,
        keyPrefix: data.key_prefix,
        userId: data.user_id,
        permissions: data.permissions,
        rateLimit: data.rate_limit,
        isActive: data.is_active,
        lastUsed: data.last_used,
        expiresAt: data.expires_at,
        createdAt: data.created_at
      };

      return { apiKey, fullKey };

    } catch (error) {
      console.error('Error creating API key:', error);
      throw error;
    }
  }

  static async listApiKeys(userId?: string): Promise<ApiKey[]> {
    try {
      let query = supabaseAdmin
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.map(key => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.key_prefix,
        userId: key.user_id,
        permissions: key.permissions,
        rateLimit: key.rate_limit,
        isActive: key.is_active,
        lastUsed: key.last_used,
        expiresAt: key.expires_at,
        createdAt: key.created_at
      }));

    } catch (error) {
      console.error('Error listing API keys:', error);
      return [];
    }
  }

  static async revokeApiKey(keyId: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('api_keys')
        .update({ is_active: false })
        .eq('id', keyId);

      if (error) throw error;

    } catch (error) {
      console.error('Error revoking API key:', error);
      throw error;
    }
  }

  // Audit Logs
  static async getAuditLogs(
    userId?: string,
    action?: string,
    resource?: string,
    limit: number = 100
  ): Promise<any[]> {
    try {
      let query = supabaseAdmin
        .from('audit_logs')
        .select(`
          *,
          user_profiles(email, display_name)
        `)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (action) {
        query = query.eq('action', action);
      }

      if (resource) {
        query = query.eq('resource', resource);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data;

    } catch (error) {
      console.error('Error getting audit logs:', error);
      return [];
    }
  }

  // System Maintenance
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const { data } = await supabaseAdmin.rpc('cleanup_expired_sessions');
      return data || 0;
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
      return 0;
    }
  }

  static async cleanupRateLimits(): Promise<number> {
    try {
      const { data } = await supabaseAdmin.rpc('cleanup_rate_limits');
      return data || 0;
    } catch (error) {
      console.error('Error cleaning up rate limits:', error);
      return 0;
    }
  }

  // Analytics
  static async getUserStats(): Promise<any> {
    try {
      const { data: totalUsers } = await supabaseAdmin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });

      const { data: activeUsers } = await supabaseAdmin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { data: recentLogins } = await supabaseAdmin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_login', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      return {
        totalUsers: totalUsers?.length || 0,
        activeUsers: activeUsers?.length || 0,
        recentLogins: recentLogins?.length || 0
      };

    } catch (error) {
      console.error('Error getting user stats:', error);
      return { totalUsers: 0, activeUsers: 0, recentLogins: 0 };
    }
  }
}