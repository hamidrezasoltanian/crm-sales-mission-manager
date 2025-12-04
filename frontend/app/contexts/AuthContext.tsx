'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { login as apiLogin, getMe } from '../lib/api'
import { showToast } from '../components/Toast'
import { useRouter } from 'next/navigation'

interface Personnel {
  id: number
  name: string
  phone: string
  role: 'admin' | 'manager' | 'staff' | 'super_admin' | 'hr' | 'expert'
  telegramId?: string
  username?: string
}

interface AuthContextType {
  user: Personnel | null
  loading: boolean
  login: (credentials: { username: string; password?: string }) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  isAdmin: boolean
  isManager: boolean
  isSuperAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Personnel | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check for token and load user
    const loadUser = async () => {
      // Safety timeout - force loading to false after 5 seconds
      const safetyTimeout = setTimeout(() => {
        console.warn('[AuthContext] Loading timeout - forcing state to false')
        setLoading(false)
      }, 5000)
      
      try {
        // Only access localStorage on client side
        if (typeof window === 'undefined') {
          clearTimeout(safetyTimeout)
          setLoading(false)
          return
        }
        
        const token = localStorage.getItem('token')
        if (token) {
          try {
            const userData = await getMe()
            setUser(userData)
            
            // Check if onboarding is needed
            const onboardingCompleted = localStorage.getItem('onboarding_completed')
            if (!onboardingCompleted && userData) {
              // Don't redirect immediately, let the app decide
              // The onboarding page will check this
            }
          } catch (getMeError: any) {
            // Handle getMe errors separately
            if (getMeError?.response?.status === 403 || getMeError?.response?.status === 401) {
              if (typeof window !== 'undefined') {
                localStorage.removeItem('token')
              }
              setUser(null)
            } else {
              console.error('Error loading user:', getMeError)
            }
          }
        } else {
          setUser(null)
        }
      } catch (error: any) {
        // Only remove token if it's a 403 (invalid token) or 401 (unauthorized)
        if (error?.response?.status === 403 || error?.response?.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token')
          }
          setUser(null)
          // Don't redirect immediately - let the page handle it
          // This prevents redirect loops and allows public pages to work
        } else {
          // Only log non-auth errors
          console.error('Error loading user:', error)
        }
      } finally {
        clearTimeout(safetyTimeout)
        setLoading(false)
      }
    }

    loadUser()
  }, [router])

  const login = async (credentials: { username: string; password?: string }) => {
    try {
      const data = await apiLogin(credentials)
      
      // Check if 2FA is required
      if (data.requires2FA) {
        // Return the 2FA requirement info, don't throw error
        return data
      }
      
      if (data.token) {
        localStorage.setItem('token', data.token)
        setUser(data.user)
        showToast(`خوش آمدید ${data.user.name}`, 'success')
        
        // Check for redirect parameter (for SSO)
        const urlParams = new URLSearchParams(window.location.search)
        const redirect = urlParams.get('redirect')
        
        if (redirect) {
          // Redirect to external system with token
          window.location.href = `${redirect}?token=${data.token}`
          return
        }
        
        // Redirect based on role
        if (data.user.role === 'staff') {
           router.push('/my-dashboard')
        } else {
           router.push('/')
        }
      }
    } catch (error: any) {
      console.error('Login error:', error)
      // Check if 2FA is required from error response
      if (error.response?.data?.requires2FA) {
        return error.response.data
      }
      const msg = error.response?.data?.message || error.message || 'خطا در ورود';
      showToast(msg, 'error')
      throw error
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('currentUserId') // Clean up old legacy auth
    showToast('با موفقیت خارج شدید', 'info')
    router.push('/login')
  }

  // Role helpers
  const isSuperAdmin = user?.role === 'admin'; // Admin = Super Admin
  const isAdmin = isSuperAdmin;
  const isManager = isAdmin || user?.role === 'manager';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        isAdmin,
        isManager,
        isSuperAdmin
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
