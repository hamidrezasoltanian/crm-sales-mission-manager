/**
 * Permission System for Role-Based Access Control
 * Defines permissions for each role and API endpoint
 */

// Permission Matrix
const PERMISSIONS = {
  // Sales Analysis Dashboard
  'sales-analysis:read': ['admin', 'manager'],
  'sales-analysis:write': ['admin'],
  
  // EZ Dashboard
  'ez-dashboard:read': ['admin'],
  'ez-dashboard:write': ['admin'],
  
  // Leave App
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
}

/**
 * Check if user has permission for a specific action
 */
export function hasPermission(userRole, permission) {
  if (!userRole || !permission) {
    return false
  }
  
  // Super admin has all permissions
  if (userRole === 'super_admin') {
    return true
  }
  
  // Admin has most permissions (but not all - super_admin can restrict)
  if (userRole === 'admin') {
    // Check if there's a specific denial for admin
    // For now, admin has all permissions except super_admin only features
    return true
  }
  
  // Check specific permission
  const allowedRoles = PERMISSIONS[permission]
  if (!allowedRoles) {
    return false
  }
  
  return allowedRoles.includes(userRole)
}

/**
 * Get permission for API endpoint
 */
export function getPermissionForEndpoint(method, path) {
  // Sales Analysis
  if (path.startsWith('/sales-analysis')) {
    if (method === 'GET') return 'sales-analysis:read'
    return 'sales-analysis:write'
  }
  
  // EZ Dashboard
  if (path.startsWith('/ez-dashboard')) {
    if (method === 'GET') return 'ez-dashboard:read'
    return 'ez-dashboard:write'
  }
  
  // Leave Management
  if (path.startsWith('/leave-management')) {
    if (method === 'GET') return 'leave-management:read'
    if (method === 'POST') return 'leave-management:create'
    if (method === 'PUT' && path.includes('/approve')) return 'leave-management:approve'
    if (method === 'DELETE') return 'leave-management:delete'
    return 'leave-management:read'
  }
  
  // Medical Files
  if (path.startsWith('/medical-files')) {
    if (method === 'GET') return 'medical-files:read'
    if (method === 'POST') return 'medical-files:upload'
    if (method === 'DELETE') return 'medical-files:delete'
    return 'medical-files:read'
  }
  
  // Recruitment
  if (path.startsWith('/recruitment')) {
    if (method === 'GET') return 'recruitment:read'
    if (method === 'POST') return 'recruitment:create'
    if (method === 'PUT') return 'recruitment:update'
    if (method === 'DELETE') return 'recruitment:delete'
    return 'recruitment:read'
  }
  
  return null
}

/**
 * Middleware to check permissions
 */
export function requirePermission(permission) {
  return (req, res, next) => {
    const user = req.user
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    if (!hasPermission(user.role, permission)) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        required: permission,
        role: user.role
      })
    }
    
    next()
  }
}

