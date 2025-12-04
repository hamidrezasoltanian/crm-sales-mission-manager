'use client'

import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Import role-specific dashboards
import AdminDashboard from './admin/page'
import ManagerDashboard from './manager/page'
import StaffDashboard from './staff/page'

export default function UnifiedDashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  if (!user) {
    return null
  }

  // Route based on role
  switch (user.role) {
    case 'admin':
      return <AdminDashboard />
    case 'manager':
      return <ManagerDashboard />
    case 'staff':
    default:
      return <StaffDashboard />
  }
}

