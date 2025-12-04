/**
 * usePermissions Hook
 * Provides permission checking utilities for components
 */

import { useAuth } from '../contexts/AuthContext'

// Permission definitions (should match backend)
export const PERMISSIONS = {
  // Sales Analysis
  'sales-analysis:read': ['admin', 'manager'],
  'sales-analysis:write': ['admin'],
  
  // EZ Dashboard
  'ez-dashboard:read': ['admin'],
  'ez-dashboard:write': ['admin'],
  
  // Leave Management
  'leave-management:read': ['admin', 'manager', 'staff'],
  'leave-management:create': ['admin', 'manager', 'staff'],
  'leave-management:approve': ['admin', 'manager'],
  'leave-management:delete': ['admin'],
  
  // Medical Files
  'medical-files:read': ['admin', 'expert', 'manager'],
  'medical-files:upload': ['admin', 'expert'],
  'medical-files:delete': ['admin'],
  
  // Recruitment
  'recruitment:read': ['admin', 'manager', 'hr'],
  'recruitment:create': ['admin', 'manager', 'hr'],
  'recruitment:update': ['admin', 'manager'],
  'recruitment:delete': ['admin'],
  
  // Admin only
  'admin:*': ['admin'],
  'system:settings': ['admin'],
  'system:users': ['admin'],
} as const

export type Permission = keyof typeof PERMISSIONS
export type Role = 'admin' | 'manager' | 'staff' | 'hr' | 'expert' | 'super_admin'

/**
 * Check if user has a specific permission
 */
export function hasPermission(userRole: Role | string | undefined, permission: Permission): boolean {
  if (!userRole || !permission) {
    return false
  }
  
  // Super admin and admin have all permissions
  if (userRole === 'admin' || userRole === 'super_admin') {
    return true
  }
  
  // Check specific permission
  const allowedRoles = PERMISSIONS[permission]
  if (!allowedRoles) {
    return false
  }
  
  return allowedRoles.includes(userRole as any)
}

/**
 * usePermissions Hook
 * Returns permission checking functions
 */
export function usePermissions() {
  const { user } = useAuth()
  const userRole = user?.role as Role | undefined

  /**
   * Check if current user has permission
   */
  const can = (permission: Permission): boolean => {
    return hasPermission(userRole, permission)
  }

  /**
   * Check if current user has any of the given permissions
   */
  const canAny = (permissions: Permission[]): boolean => {
    return permissions.some(permission => hasPermission(userRole, permission))
  }

  /**
   * Check if current user has all of the given permissions
   */
  const canAll = (permissions: Permission[]): boolean => {
    return permissions.every(permission => hasPermission(userRole, permission))
  }

  /**
   * Check if current user has a specific role
   */
  const hasRole = (role: Role | Role[]): boolean => {
    if (!userRole) return false
    if (Array.isArray(role)) {
      return role.includes(userRole)
    }
    return userRole === role
  }

  /**
   * Check if current user is admin
   */
  const isAdmin = (): boolean => {
    return userRole === 'admin' || userRole === 'super_admin'
  }

  /**
   * Check if current user is manager or admin
   */
  const isManagerOrAdmin = (): boolean => {
    return userRole === 'admin' || userRole === 'manager' || userRole === 'super_admin'
  }

  return {
    can,
    canAny,
    canAll,
    hasRole,
    isAdmin,
    isManagerOrAdmin,
    userRole,
  }
}

