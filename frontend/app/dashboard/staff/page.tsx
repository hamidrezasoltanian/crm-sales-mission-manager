'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import EmployeeLayout from '../../components/EmployeeLayout'
import ProtectedRoute from '../../components/ProtectedRoute'
import LoadingSpinner from '../../components/LoadingSpinner'

// Staff Dashboard redirects to my-dashboard which is the employee dashboard
// This ensures consistency and avoids code duplication
export default function StaffDashboard() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to my-dashboard (which is the staff/employee dashboard)
    router.replace('/my-dashboard')
  }, [router])

  return (
    <ProtectedRoute>
      <EmployeeLayout>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner fullScreen={false} />
        </div>
      </EmployeeLayout>
    </ProtectedRoute>
  )
}

