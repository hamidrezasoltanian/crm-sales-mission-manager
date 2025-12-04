'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: ('super_admin' | 'admin' | 'manager' | 'staff' | 'hr' | 'expert')[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    } else if (!loading && user && allowedRoles) {
      // Super Admin bypasses all role checks
      if (user.role === 'super_admin' || user.role === 'admin') return;

      if (!allowedRoles.includes(user.role)) {
        // Redirect to appropriate dashboard based on role
        if (['staff', 'expert'].includes(user.role)) {
          router.push('/my-dashboard')
        } else {
          router.push('/')
        }
      }
    }
  }, [user, loading, router, allowedRoles])

  if (loading) {
    return <LoadingSpinner fullScreen={true} />
  }

  if (!user) {
    return null
  }

  // Super Admin bypass
  if (allowedRoles && !allowedRoles.includes(user.role) && user.role !== 'super_admin') {
    return null
  }

  return <>{children}</>
}
