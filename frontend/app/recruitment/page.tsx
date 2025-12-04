'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import ProtectedRoute from '../components/ProtectedRoute'

export default function RecruitmentPage() {
  const { user, loading: authLoading } = useAuth()
  const [proxyUrl, setProxyUrl] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && user && typeof window !== 'undefined') {
      // Get token from localStorage
      const token = localStorage.getItem('token')
      
      if (!token) {
        console.error('[Recruitment] No token found')
        setLoading(false)
        return
      }

      // Build proxy URL with token
      const protocol = window.location.protocol
      const hostname = window.location.hostname
      const port = window.location.port ? `:${window.location.port}` : ''
      const baseUrl = `${protocol}//${hostname}${port}`
      
      // Use proxy endpoint - this will show the full dashboard
      const url = `${baseUrl}/api/proxy/frontend/recruitment/?token=${token}`
      setProxyUrl(url)
      setLoading(false)
    }
  }, [user, authLoading])

  if (authLoading || loading) {
    return (
      <ProtectedRoute allowedRoles={['admin', 'manager', 'hr']}>
        <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">در حال بارگذاری داشبورد استخدام...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!user) {
    return (
      <ProtectedRoute allowedRoles={['admin', 'manager', 'hr']}>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-red-500">برای دسترسی به این صفحه، لطفاً وارد شوید.</p>
        </div>
      </ProtectedRoute>
    )
  }

  // Fullscreen iframe - covers entire viewport, no borders, no padding
  return (
    <ProtectedRoute allowedRoles={['admin', 'manager', 'hr']}>
      <div 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          width: '100vw', 
          height: '100vh', 
          margin: 0, 
          padding: 0, 
          border: 'none', 
          overflow: 'hidden',
          zIndex: 1
        }}
      >
        {proxyUrl ? (
          <iframe
            src={proxyUrl}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 'none',
              margin: 0,
              padding: 0,
              display: 'block'
            }}
            title="Recruitment Dashboard"
            allow="fullscreen"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation"
            onLoad={() => {
              console.log('[Recruitment] Dashboard loaded successfully');
            }}
            onError={(e) => {
              console.error('[Recruitment] Iframe error:', e);
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">در حال آماده‌سازی...</p>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
