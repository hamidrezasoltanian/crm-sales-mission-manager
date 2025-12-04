'use client'

import { ReactNode } from 'react'
import { usePermissions, Permission } from '../hooks/usePermissions'

interface PermissionGuardProps {
  children: ReactNode
  permission?: Permission | Permission[]
  requireAll?: boolean
  fallback?: ReactNode
  showError?: boolean
}

/**
 * PermissionGuard Component
 * Conditionally renders children based on user permissions
 */
export default function PermissionGuard({
  children,
  permission,
  requireAll = false,
  fallback = null,
  showError = false,
}: PermissionGuardProps) {
  const { can, canAny, canAll } = usePermissions()

  // If no permission specified, show children
  if (!permission) {
    return <>{children}</>
  }

  // Check permissions
  const hasAccess = Array.isArray(permission)
    ? requireAll
      ? canAll(permission)
      : canAny(permission)
    : can(permission)

  if (hasAccess) {
    return <>{children}</>
  }

  // Show error message if requested
  if (showError) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-800 dark:text-red-200 text-sm">
          شما دسترسی لازم برای مشاهده این بخش را ندارید.
        </p>
      </div>
    )
  }

  // Return fallback or nothing
  return <>{fallback}</>
}

