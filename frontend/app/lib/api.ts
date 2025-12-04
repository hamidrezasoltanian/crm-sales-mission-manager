import axios from 'axios'

// Get API URL from environment or detect from window location
const getApiUrl = () => {
  // Use Next.js Rewrites (Proxy)
  // This means we send requests to /api on the frontend server, 
  // and Next.js forwards them to the backend.
  // This solves CORS and Network issues.
  if (typeof window !== 'undefined') {
    // Try to use Next.js rewrite first, but fallback to direct backend URL if needed
    const useDirectBackend = localStorage.getItem('useDirectBackend') === 'true'
    if (useDirectBackend) {
      const hostname = window.location.hostname
      return `http://${hostname}:2001/api`
    }
    return '/api'
  }
  
  // Server-side fallback (direct access)
  return 'http://localhost:2001/api'
}

// Create axios instance
const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 120 seconds timeout for large responses
})

// Add request interceptor to set baseURL dynamically
api.interceptors.request.use(
  (config) => {
    // Add request interceptor to set baseURL dynamically and attach Token
    try {
      const apiUrl = getApiUrl()
      if (apiUrl) {
        config.baseURL = apiUrl
        // Log for debugging (only in development)
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.log('[API] Request to:', apiUrl + (config.url || ''))
        }
      }
      
      // Attach Token if exists
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      }
    } catch (error) {
      console.error('[API] Error getting API URL:', error)
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`)
    return response
  },
  (error) => {
    // Don't log proxy API errors (401/403) as they're expected when external services are unavailable
    const isProxyRequest = error.config?.url?.includes('/proxy/')
    const isAuthError = error.response?.status === 401 || error.response?.status === 403
    
    // Only log errors that are not auth-related (403/401) for non-proxy requests
    // Auth errors are expected when user is not logged in
    if (!isProxyRequest) {
      if (!isAuthError) {
        console.error('[API Error]', error.message)
        if (error.response) {
          console.error('[API] Response Error:', error.response.status, error.response.data)
        }
      } else {
        // Silently handle auth errors - they're expected when user is not logged in
        // Only log in development mode for debugging
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.debug('[API] Auth error (expected if not logged in):', error.response.status)
        }
      }
    }
    
    if (error.response) {
      // Handle 401/403 errors (unauthorized/invalid token)
      // Only handle auth errors for non-proxy requests (proxy requests may have their own auth)
      if ((error.response.status === 401 || error.response.status === 403) && !isProxyRequest) {
        // Don't show toast for auth errors, just clear token
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token')
          // Only redirect if not already on login page
          if (!window.location.pathname.includes('/login')) {
            // Let AuthContext handle the redirect
          }
        }
      } else {
        // Show toast notification for other errors
        if (typeof window !== 'undefined') {
          const errorMessage = error.response.data?.error || error.response.data?.message || 'خطا در ارتباط با سرور'
          const event = new CustomEvent('show-toast', {
            detail: { 
              message: errorMessage, 
              type: 'error',
              duration: 5000
            }
          })
          window.dispatchEvent(event)
        }
      }
    } else if (error.request) {
      console.error('[API] Request Error: No response received', error.request)
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('show-toast', {
          detail: { 
            message: 'خطا در ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.', 
            type: 'error',
            duration: 5000
          }
        })
        window.dispatchEvent(event)
      }
    } else {
      console.error('[API] Error:', error.message)
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('show-toast', {
          detail: { 
            message: error.message || 'خطای نامشخص', 
            type: 'error',
            duration: 5000
          }
        })
        window.dispatchEvent(event)
      }
    }
    return Promise.reject(error)
  }
)

// Auth API
export const login = async (credentials: { username: string; password?: string }) => {
  try {
    const response = await api.post('/auth/login', credentials)
    return response.data
  } catch (error: any) {
    console.error('Login API Error:', error.response?.data || error.message)
    throw error
  }
}

export const getMe = async () => {
  try {
    const response = await api.get('/auth/me')
    return response.data
  } catch (error: any) {
    // Don't log 403 errors as they're expected when token is invalid
    if (error.response?.status !== 403 && error.response?.status !== 401) {
      console.error('GetMe API Error:', error.response?.data || error.message)
    }
    throw error
  }
}

export const register = async (data: { 
  name: string
  phone: string
  telegramId?: string
  username?: string
  password?: string
  role?: string
}) => {
  try {
    const response = await api.post('/auth/register', data)
    return response
  } catch (error: any) {
    console.error('Register API Error:', error.response?.data || error.message)
    throw error
  }
}

export const getProfile = async () => {
  try {
    const response = await api.get('/auth/profile')
    return response.data
  } catch (error: any) {
    console.error('GetProfile API Error:', error.response?.data || error.message)
    throw error
  }
}

export const updateProfile = async (data: { 
  first_name?: string
  last_name?: string
  name?: string
  phone?: string
  email?: string
  telegramId?: string
  username?: string
}) => {
  try {
    const response = await api.put('/auth/profile', data)
    return response.data
  } catch (error: any) {
    console.error('UpdateProfile API Error:', error.response?.data || error.message)
    throw error
  }
}

export const changePassword = async (data: { 
  currentPassword: string
  newPassword: string
}) => {
  try {
    const response = await api.put('/auth/password', data)
    return response.data
  } catch (error: any) {
    console.error('ChangePassword API Error:', error.response?.data || error.message)
    throw error
  }
}

export const telegramLogin = async (telegramData: any) => {
  try {
    const response = await api.post('/auth/telegram', telegramData)
    return response.data
  } catch (error: any) {
    console.error('Telegram Login API Error:', error.response?.data || error.message)
    throw error
  }
}

// Email OTP API
export const sendEmailOTP = async (email: string) => {
  try {
    const response = await api.post('/auth/email-otp/send', { email })
    return response.data
  } catch (error: any) {
    console.error('Send Email OTP API Error:', error.response?.data || error.message)
    throw error
  }
}

export const verifyEmailOTP = async (email: string, code: string) => {
  try {
    const response = await api.post('/auth/email-otp/verify', { email, code })
    return response.data
  } catch (error: any) {
    console.error('Verify Email OTP API Error:', error.response?.data || error.message)
    throw error
  }
}

// Magic Link API
export const sendMagicLink = async (email: string) => {
  try {
    const response = await api.post('/auth/magic-link/send', { email })
    return response.data
  } catch (error: any) {
    console.error('Send Magic Link API Error:', error.response?.data || error.message)
    throw error
  }
}

export const verifyMagicLink = async (token: string) => {
  try {
    const response = await api.post('/auth/magic-link/verify', { token })
    return response.data
  } catch (error: any) {
    console.error('Verify Magic Link API Error:', error.response?.data || error.message)
    throw error
  }
}

// 2FA API
export const check2FA = async () => {
  try {
    // userId is now extracted from the token by the backend
    const response = await api.get('/auth/2fa/check')
    return response.data
  } catch (error: any) {
    console.error('Check 2FA API Error:', error.response?.data || error.message)
    throw error
  }
}

export const enable2FA = async (method: string = 'email') => {
  try {
    const response = await api.post('/auth/2fa/enable', { method })
    return response.data
  } catch (error: any) {
    console.error('Enable 2FA API Error:', error.response?.data || error.message)
    throw error
  }
}

export const disable2FA = async () => {
  try {
    const response = await api.post('/auth/2fa/disable')
    return response.data
  } catch (error: any) {
    console.error('Disable 2FA API Error:', error.response?.data || error.message)
    throw error
  }
}

export const verify2FA = async (userId: number, code?: string, backupCode?: string) => {
  try {
    const response = await api.post('/auth/2fa/verify', { userId, code, backupCode })
    return response.data
  } catch (error: any) {
    console.error('Verify 2FA API Error:', error.response?.data || error.message)
    throw error
  }
}

export const regenerateBackupCodes = async () => {
  try {
    const response = await api.post('/auth/2fa/backup-codes/regenerate')
    return response.data
  } catch (error: any) {
    console.error('Regenerate Backup Codes API Error:', error.response?.data || error.message)
    throw error
  }
}

export const loginWith2FA = async (username: string, password: string, code?: string, backupCode?: string) => {
  try {
    const response = await api.post('/auth/login-2fa', { username, password, code, backupCode })
    return response.data
  } catch (error: any) {
    console.error('Login with 2FA API Error:', error.response?.data || error.message)
    throw error
  }
}

// Personnel API
export const getPersonnel = async () => {
  try {
    const response = await api.get('/personnel')
    return response.data
  } catch (error: any) {
    console.error('API Error:', error.response?.data || error.message)
    throw error
  }
}

export const getPersonnelById = async (id: string) => {
  const response = await api.get(`/personnel/${id}`)
  return response.data
}

export const createPersonnel = async (data: any) => {
  const response = await api.post('/personnel', data)
  return response.data
}

export const updatePersonnel = async (id: string, data: any) => {
  const response = await api.put(`/personnel/${id}`, data)
  return response.data
}

export const deletePersonnel = async (id: string) => {
  const response = await api.delete(`/personnel/${id}`)
  return response.data
}

export const activatePersonnel = async (id: string) => {
  const response = await api.post(`/personnel/${id}/activate`)
  return response.data
}

export const deactivatePersonnel = async (id: string) => {
  const response = await api.post(`/personnel/${id}/deactivate`)
  return response.data
}

// Centers API
export const getCenters = async (filters?: { 
  responsiblePersonnelId?: number
  onlyResponsible?: boolean
  search?: string
  city?: string
  province?: string
  type?: string
  page?: number
  limit?: number
}) => {
  try {
    const params = new URLSearchParams()
    if (filters?.responsiblePersonnelId) params.append('responsiblePersonnelId', filters.responsiblePersonnelId.toString())
    if (filters?.onlyResponsible) params.append('onlyResponsible', 'true')
    if (filters?.search) params.append('search', filters.search)
    if (filters?.city) params.append('city', filters.city)
    if (filters?.province) params.append('province', filters.province)
    if (filters?.type) params.append('type', filters.type)
    if (filters?.page) params.append('page', filters.page.toString())
    if (filters?.limit) params.append('limit', filters.limit.toString())
    
    const queryString = params.toString() ? `?${params.toString()}` : ''
    const response = await api.get(`/centers${queryString}`)
    return response.data
  } catch (error: any) {
    console.error('Error in getCenters:', error.response?.data || error.message)
    throw error
  }
}

export const getCenterById = async (id: string) => {
  const response = await api.get(`/centers/${id}`)
  return response.data
}

export const createCenter = async (data: any) => {
  const response = await api.post('/centers', data)
  return response.data
}

export const updateCenter = async (id: string, data: any) => {
  const response = await api.put(`/centers/${id}`, data)
  return response.data
}

export const deleteCenter = async (id: string) => {
  const response = await api.delete(`/centers/${id}`)
  return response.data
}

// Assignments API
export const getAssignments = async (filters?: any) => {
  const params = new URLSearchParams()
  if (filters?.personnelId) params.append('personnelId', filters.personnelId)
  if (filters?.centerId) params.append('centerId', filters.centerId)
  if (filters?.status) params.append('status', filters.status)
  if (filters?.managerId) params.append('managerId', filters.managerId)
  
  const response = await api.get(`/assignments?${params.toString()}`)
  return response.data
}

export const getAssignmentById = async (id: string) => {
  const response = await api.get(`/assignments/${id}`)
  return response.data
}

export const createAssignment = async (data: any) => {
  const response = await api.post('/assignments', data)
  return response.data
}

export const rejectAssignment = async (id: string, managerId: number, managerComment?: string) => {
  try {
    console.log('[API] ===== rejectAssignment =====')
    console.log('[API] rejectAssignment called with:', { id, managerId, managerComment })
    
    // Use Next.js API route to avoid CORS issues
    const apiUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/api/assignments/${id}/reject`
      : `/api/assignments/${id}/reject`
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    
    console.log('[API] Using Next.js API route:', apiUrl)
    console.log('[API] Token exists:', !!token)
    console.log('[API] Request payload:', { managerId, managerComment })
    
    // Use fetch directly to avoid axios interceptor rewriting
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ managerId, managerComment })
    })
    
    console.log('[API] Fetch response received, status:', response.status)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'خطا در رد ماموریت' }))
      throw new Error(errorData.error || errorData.message || 'خطا در رد ماموریت')
    }
    
    const data = await response.json()
    console.log('[API] rejectAssignment success:', response.status)
    return data
  } catch (error: any) {
    console.error('[API] rejectAssignment error:', error)
    console.error('[API] Error details:', {
      message: error.message,
      name: error.name
    })
    
    throw error
  }
}

export const approveAssignment = async (id: string, managerId: number, personalPayment: number = 0, managerComment?: string) => {
  try {
    console.log('[API] ===== approveAssignment NEW VERSION =====')
    console.log('[API] approveAssignment called with:', { id, managerId, personalPayment, managerComment })
    
    // Use Next.js API route to avoid CORS issues
    // Use full URL to bypass Next.js rewrite and go directly to API route
    const apiUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/api/assignments/${id}/approve`
      : `/api/assignments/${id}/approve`
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    
    console.log('[API] Using Next.js API route (NOT direct backend):', apiUrl)
    console.log('[API] Token exists:', !!token)
    console.log('[API] Request payload:', { managerId, personalPayment, managerComment })
    console.log('[API] About to call fetch with URL:', apiUrl)
    
    // Use fetch directly to avoid axios interceptor rewriting
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ managerId, personalPayment, managerComment })
    })
    
    console.log('[API] Fetch response received, status:', response.status)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'خطا در تایید ماموریت' }))
      throw new Error(errorData.error || errorData.message || 'خطا در تایید ماموریت')
    }
    
    const data = await response.json()
    console.log('[API] approveAssignment success:', response.status)
    return data
  } catch (error: any) {
    console.error('[API] approveAssignment error:', error)
    console.error('[API] Error details:', {
      message: error.message,
      name: error.name
    })
    
    throw error
  }
}

export const updateAssignment = async (id: string, data: any) => {
  const response = await api.put(`/assignments/${id}`, data)
  return response.data
}

export const deleteAssignment = async (id: string) => {
  const response = await api.delete(`/assignments/${id}`)
  return response.data
}

// Contacts API
export const getContacts = async (filters?: any) => {
  const params = new URLSearchParams()
  if (filters?.personnelId) params.append('personnelId', filters.personnelId)
  if (filters?.centerId) params.append('centerId', filters.centerId)
  if (filters?.contactType) params.append('contactType', filters.contactType)
  if (filters?.search) params.append('search', filters.search)
  
  const response = await api.get(`/contacts?${params.toString()}`)
  return response.data
}

export const getContactById = async (id: string) => {
  const response = await api.get(`/contacts/${id}`)
  return response.data
}

export const createContact = async (data: any) => {
  const response = await api.post('/contacts', data)
  return response.data
}

export const updateContact = async (id: string, data: any) => {
  const response = await api.put(`/contacts/${id}`, data)
  return response.data
}

export const deleteContact = async (id: string) => {
  const response = await api.delete(`/contacts/${id}`)
  return response.data
}

// PDF API
export const generatePDF = async (title: string, headers: string[][], rows: any[][], filename: string = 'گزارش') => {
  const response = await api.post('/pdf/generate', {
    title,
    headers,
    rows,
    filename
  }, {
    responseType: 'blob' // مهم: برای دریافت PDF به صورت blob
  })
  
  // ایجاد blob URL و دانلود
  const blob = new Blob([response.data], { type: 'application/pdf' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

// Reports API
export const getReportsSummary = async () => {
  try {
    const response = await api.get('/reports/summary')
    return response.data
  } catch (error: any) {
    console.error('Error in getReportsSummary:', error.response?.data || error.message)
    throw error
  }
}

export const getReportsByPersonnel = async (filters?: any) => {
  const params = new URLSearchParams()
  if (filters?.personnelId) params.append('personnelId', filters.personnelId)
  if (filters?.startDate) params.append('startDate', filters.startDate)
  if (filters?.endDate) params.append('endDate', filters.endDate)
  
  const response = await api.get(`/reports/by-personnel?${params.toString()}`)
  return response.data
}

export const getReportsByCenter = async () => {
  const response = await api.get('/reports/by-center')
  return response.data
}

export const getReportsByDiscount = async () => {
  const response = await api.get('/reports/by-discount')
  return response.data
}

export const getReportsDetails = async (filters?: any) => {
  const params = new URLSearchParams()
  if (filters?.personnelId) params.append('personnelId', filters.personnelId)
  if (filters?.centerId) params.append('centerId', filters.centerId)
  if (filters?.status) params.append('status', filters.status)
  if (filters?.discountCode) params.append('discountCode', filters.discountCode)
  if (filters?.startDate) params.append('startDate', filters.startDate)
  if (filters?.endDate) params.append('endDate', filters.endDate)
  
  const response = await api.get(`/reports/details?${params.toString()}`)
  return response.data
}

// Discount Codes API
export const getDiscountCodes = async () => {
  const response = await api.get('/discount-codes')
  return response.data
}

export const getDiscountCodeById = async (id: string) => {
  const response = await api.get(`/discount-codes/${id}`)
  return response.data
}

export const createDiscountCode = async (data: any) => {
  const response = await api.post('/discount-codes', data)
  return response.data
}

export const updateDiscountCode = async (id: string, data: any) => {
  const response = await api.put(`/discount-codes/${id}`, data)
  return response.data
}

export const deleteDiscountCode = async (id: string) => {
  const response = await api.delete(`/discount-codes/${id}`)
  return response.data
}

// Customer sources API
export const getCustomerSources = async () => {
  const response = await api.get('/customer-sources')
  return response.data
}

export const createCustomerSource = async (data: { name: string, description?: string, color?: string }) => {
  const response = await api.post('/customer-sources', data)
  return response.data
}

// Weekly Reports API
export const getWeeklyReport = async (week?: number) => {
  const params = week ? `?week=${week}` : ''
  const response = await api.get(`/reports/weekly${params}`)
  return response.data
}

// Monthly Reports API
export const getMonthlyReport = async (month?: number, year?: number) => {
  const params = new URLSearchParams()
  if (month) params.append('month', month.toString())
  if (year) params.append('year', year.toString())
  const queryString = params.toString() ? `?${params.toString()}` : ''
  const response = await api.get(`/reports/monthly${queryString}`)
  return response.data
}

// Helper to get App2 (Leave) API URL - Use Next.js API routes as proxy
const getApp2Url = () => {
  // Use Next.js API routes to avoid CORS issues
  if (typeof window !== 'undefined') {
    return '/api/leaves'
  }
  return 'http://localhost:8002/api/leave-requests'
}

// Helper to get App3 (Medical) API URL - Use Next.js API routes as proxy
const getApp3Url = () => {
  // Use Next.js API routes to avoid CORS issues
  if (typeof window !== 'undefined') {
    return '/api/medical'
  }
  return 'http://localhost:8003/api/medical-files'
}

// Helper to get App3 Categories API URL
const getApp3CategoriesUrl = () => {
  if (typeof window !== 'undefined') {
    return '/api/medical/categories'
  }
  return 'http://localhost:8003/api/categories'
}

// Leave Requests API (App2) - Using Next.js API proxy
export const getLeaveRequests = async (filters?: {
  employee_id?: number
  status?: 'pending' | 'approved' | 'rejected'
  skip?: number
  limit?: number
}) => {
  try {
    const params = new URLSearchParams()
    if (filters?.employee_id) params.append('employee_id', filters.employee_id.toString())
    if (filters?.status) params.append('status', filters.status)
    if (filters?.skip) params.append('skip', filters.skip.toString())
    if (filters?.limit) params.append('limit', filters.limit.toString())
    
    const queryString = params.toString() ? `?${params.toString()}` : ''
    const response = await axios.get(`${getApp2Url()}${queryString}`)
    return response.data
  } catch (error: any) {
    // Handle service unavailable errors gracefully
    if (error.response?.status === 503 || error.response?.status === 500) {
      console.warn('[Leave Requests] Service unavailable, returning empty array')
      return { data: [], items: [] }
    }
    throw error
  }
}

export const createLeaveRequest = async (data: {
  employee_id: number
  leave_type: 'annual' | 'sick' | 'emergency' | 'unpaid'
  start_date: string
  end_date: string
  days_count: number
  reason?: string
}) => {
  const response = await axios.post(getApp2Url(), data)
  return response.data
}

export const updateLeaveRequest = async (id: number, data: {
  status?: 'pending' | 'approved' | 'rejected'
  [key: string]: any
}) => {
  const response = await axios.put(`${getApp2Url()}/${id}`, data)
  return response.data
}

export const deleteLeaveRequest = async (id: number) => {
  const response = await axios.delete(`${getApp2Url()}/${id}`)
  return response.data
}

// Medical Files API (App3) - Using Next.js API proxy
export const getMedicalFiles = async (filters?: {
  category?: string
  brand?: string
  product?: string
  center_id?: number
  search?: string
  skip?: number
  limit?: number
}) => {
  try {
    const params = new URLSearchParams()
    if (filters?.category) params.append('category', filters.category)
    if (filters?.brand) params.append('brand', filters.brand)
    if (filters?.product) params.append('product', filters.product)
    if (filters?.center_id) params.append('center_id', filters.center_id.toString())
    if (filters?.search) params.append('search', filters.search)
    if (filters?.skip) params.append('skip', filters.skip.toString())
    if (filters?.limit) params.append('limit', filters.limit.toString())
    
    const queryString = params.toString() ? `?${params.toString()}` : ''
    const response = await axios.get(`${getApp3Url()}${queryString}`)
    return response.data
  } catch (error: any) {
    // Handle service unavailable errors gracefully
    if (error.response?.status === 503 || error.response?.status === 500) {
      console.warn('[Medical Files] Service unavailable, returning empty array')
      return { data: [], items: [] }
    }
    throw error
  }
}

export const getMedicalFileById = async (id: number) => {
  try {
    const response = await axios.get(`${getApp3Url()}/${id}`)
    return response.data
  } catch (error: any) {
    // Handle service unavailable errors gracefully
    if (error.response?.status === 503 || error.response?.status === 500) {
      console.warn('[Medical File] Service unavailable')
      throw new Error('سیستم مدیریت فایل‌های پزشکی در دسترس نیست')
    }
    throw error
  }
}

export const uploadMedicalFile = async (formData: FormData) => {
  const response = await axios.post(`${getApp3Url()}/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export const updateMedicalFile = async (id: number, data: any) => {
  const response = await axios.put(`${getApp3Url()}/${id}`, data)
  return response.data
}

export const deleteMedicalFile = async (id: number) => {
  const response = await axios.delete(`${getApp3Url()}/${id}`)
  return response.data
}

export const downloadMedicalFile = async (id: number) => {
  const response = await axios.get(`${getApp3Url()}/${id}/download`, {
    responseType: 'blob',
  })
  
  // Create blob URL and download
  const blob = new Blob([response.data], { type: response.data.type || 'application/octet-stream' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `medical_file_${id}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
  return response.data
}

// Medical Categories API (App3) - Using Next.js API proxy
export const getMedicalCategories = async () => {
  try {
    const response = await axios.get(getApp3CategoriesUrl())
    return response.data
  } catch (error: any) {
    // Handle service unavailable errors gracefully
    if (error.response?.status === 503 || error.response?.status === 500) {
      console.warn('[Medical Categories] Service unavailable, returning empty array')
      return { data: [], items: [] }
    }
    throw error
  }
}

export const createMedicalCategory = async (data: { name: string; description?: string }) => {
  const response = await axios.post(getApp3CategoriesUrl(), data)
  return response.data
}

// Workflow / Kanban API
export const getWorkflowBoards = async (includeCards = false) => {
  const params = includeCards ? '?includeCards=true' : ''
  const response = await api.get(`/workflow/boards${params}`)
  return response.data
}

export const getWorkflowBoard = async (slug: string, options: { includeCards?: boolean } = {}) => {
  const params = new URLSearchParams()
  if (options.includeCards) params.append('includeCards', 'true')
  const suffix = params.toString() ? `?${params.toString()}` : ''
  const response = await api.get(`/workflow/boards/${slug}${suffix}`)
  return response.data
}

export const getWorkflowCards = async (slug: string) => {
  const response = await api.get(`/workflow/boards/${slug}/cards`)
  return response.data
}

export const getWorkflowCard = async (cardId: number) => {
  const response = await api.get(`/workflow/cards/${cardId}`)
  return response.data
}

export const createWorkflowCard = async (cardData: any) => {
  const response = await api.post('/workflow/cards', cardData)
  return response.data
}

export const updateWorkflowCard = async (cardId: number, updates: any) => {
  const response = await api.patch(`/workflow/cards/${cardId}`, updates)
  return response.data
}

export const moveWorkflowCard = async (cardId: number, listId: number, actorId?: number) => {
  const body: any = { listId }
  if (actorId) body.actorId = actorId
  const response = await api.post(`/workflow/cards/${cardId}/move`, body)
  return response.data
}

export const getWorkflowCardActivity = async (cardId: number, limit = 50) => {
  const params = limit ? `?limit=${limit}` : ''
  const response = await api.get(`/workflow/cards/${cardId}/activity${params}`)
  return response.data
}

// Workflow Card Reports (Chat/Messages)
export const getWorkflowCardReports = async (cardId: number) => {
  const response = await api.get(`/workflow/cards/${cardId}/reports`)
  return response.data
}

export const createWorkflowCardReport = async (
  cardId: number,
  data: { authorId: number; message: string; taggedPersonnelIds?: number[]; files?: File[] }
) => {
  const formData = new FormData()
  formData.append('authorId', data.authorId.toString())
  formData.append('message', data.message)
  formData.append('taggedPersonnelIds', JSON.stringify(data.taggedPersonnelIds || []))

  if (data.files?.length) {
    data.files.forEach((file) => {
      formData.append('files', file)
    })
  }

  const response = await api.post(`/workflow/cards/${cardId}/reports`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return response.data
}

export const deleteWorkflowCardReport = async (cardId: number, reportId: number) => {
  const response = await api.delete(`/workflow/cards/${cardId}/reports/${reportId}`)
  return response.data
}

// Workflow Card Approval
export const approveWorkflowCard = async (cardId: number, approverId: number) => {
  const response = await api.post(`/workflow/cards/${cardId}/approve`, { approverId })
  return response.data
}

export const rejectWorkflowCard = async (cardId: number, approverId: number, reason?: string) => {
  const response = await api.post(`/workflow/cards/${cardId}/reject`, { approverId, reason })
  return response.data
}

// Activity Logs API
export const getActivityLogs = async (filters?: {
  userId?: number
  action?: string
  resourceType?: string
  resourceId?: number
  startDate?: string
  endDate?: string
  limit?: number
}) => {
  try {
    const params = new URLSearchParams()
    if (filters?.userId) params.append('userId', filters.userId.toString())
    if (filters?.action) params.append('action', filters.action)
    if (filters?.resourceType) params.append('resourceType', filters.resourceType)
    if (filters?.resourceId) params.append('resourceId', filters.resourceId.toString())
    if (filters?.startDate) params.append('startDate', filters.startDate)
    if (filters?.endDate) params.append('endDate', filters.endDate)
    if (filters?.limit) params.append('limit', filters.limit.toString())
    
    const queryString = params.toString() ? `?${params.toString()}` : ''
    const response = await api.get(`/activity${queryString}`)
    return response.data
  } catch (error: any) {
    console.error('GetActivityLogs API Error:', error.response?.data || error.message)
    throw error
  }
}

export const getMyActivityLogs = async (limit = 50) => {
  try {
    const response = await api.get(`/activity/me?limit=${limit}`)
    return response.data
  } catch (error: any) {
    console.error('GetMyActivityLogs API Error:', error.response?.data || error.message)
    throw error
  }
}

// Permissions API
export const getPermissionModules = async () => {
  try {
    const response = await api.get('/permissions/modules')
    return response.data
  } catch (error: any) {
    console.error('GetPermissionModules API Error:', error.response?.data || error.message)
    throw error
  }
}

export const getUserPermissions = async (userId: number) => {
  try {
    const response = await api.get(`/permissions/user/${userId}`)
    return response.data
  } catch (error: any) {
    console.error('GetUserPermissions API Error:', error.response?.data || error.message)
    throw error
  }
}

export const grantPermission = async (data: {
  userId: number
  moduleKey: string
  permission: string
  notes?: string
}) => {
  try {
    const response = await api.post('/permissions/grant', data)
    return response.data
  } catch (error: any) {
    console.error('GrantPermission API Error:', error.response?.data || error.message)
    throw error
  }
}

export const revokePermission = async (data: {
  userId: number
  moduleKey: string
  permission: string
  reason?: string
}) => {
  try {
    const response = await api.post('/permissions/revoke', data)
    return response.data
  } catch (error: any) {
    console.error('RevokePermission API Error:', error.response?.data || error.message)
    throw error
  }
}

export const bulkUpdatePermissions = async (data: {
  userId: number
  permissions: Array<{
    moduleKey: string
    permission: string
    granted: boolean
    notes?: string
  }>
}) => {
  try {
    const response = await api.post('/permissions/bulk-update', data)
    return response.data
  } catch (error: any) {
    console.error('BulkUpdatePermissions API Error:', error.response?.data || error.message)
    throw error
  }
}

export const getAllPermissions = async (filters?: {
  userId?: number
  moduleKey?: string
  granted?: boolean
}) => {
  try {
    const params = new URLSearchParams()
    if (filters?.userId) params.append('userId', filters.userId.toString())
    if (filters?.moduleKey) params.append('moduleKey', filters.moduleKey)
    if (filters?.granted !== undefined) params.append('granted', filters.granted.toString())
    
    const queryString = params.toString() ? `?${params.toString()}` : ''
    const response = await api.get(`/permissions/all${queryString}`)
    return response.data
  } catch (error: any) {
    console.error('GetAllPermissions API Error:', error.response?.data || error.message)
    throw error
  }
}

export const getPermissionLogs = async (userId: number, limit = 50) => {
  try {
    const response = await api.get(`/permissions/logs/${userId}?limit=${limit}`)
    return response.data
  } catch (error: any) {
    console.error('GetPermissionLogs API Error:', error.response?.data || error.message)
    throw error
  }
}

export const checkPermission = async (userId: number, moduleKey: string, permission: string) => {
  try {
    const response = await api.get(`/permissions/check?userId=${userId}&moduleKey=${moduleKey}&permission=${permission}`)
    return response.data
  } catch (error: any) {
    console.error('CheckPermission API Error:', error.response?.data || error.message)
    throw error
  }
}

// ========== Workspace APIs ==========
export const getWorkspaces = async () => {
  try {
    const response = await api.get('/workspaces')
    return response.data
  } catch (error: any) {
    console.error('GetWorkspaces API Error:', error.response?.data || error.message)
    throw error
  }
}

export const getDefaultWorkspace = async () => {
  try {
    const response = await api.get('/workspaces/default')
    return response.data
  } catch (error: any) {
    console.error('GetDefaultWorkspace API Error:', error.response?.data || error.message)
    throw error
  }
}

export const getWorkspaceById = async (id: string) => {
  try {
    const response = await api.get(`/workspaces/${id}`)
    return response.data
  } catch (error: any) {
    console.error('GetWorkspaceById API Error:', error.response?.data || error.message)
    throw error
  }
}

export const createWorkspace = async (data: {
  name: string
  description?: string
  color?: string
  icon?: string
  settings?: any
}) => {
  try {
    const response = await api.post('/workspaces', data)
    return response.data
  } catch (error: any) {
    console.error('CreateWorkspace API Error:', error.response?.data || error.message)
    throw error
  }
}

export const updateWorkspace = async (id: string, data: {
  name?: string
  description?: string
  color?: string
  icon?: string
  isDefault?: boolean
  settings?: any
}) => {
  try {
    const response = await api.put(`/workspaces/${id}`, data)
    return response.data
  } catch (error: any) {
    console.error('UpdateWorkspace API Error:', error.response?.data || error.message)
    throw error
  }
}

export const setDefaultWorkspace = async (id: string) => {
  try {
    const response = await api.post(`/workspaces/${id}/set-default`)
    return response.data
  } catch (error: any) {
    console.error('SetDefaultWorkspace API Error:', error.response?.data || error.message)
    throw error
  }
}

export const deleteWorkspace = async (id: string) => {
  try {
    const response = await api.delete(`/workspaces/${id}`)
    return response.data
  } catch (error: any) {
    console.error('DeleteWorkspace API Error:', error.response?.data || error.message)
    throw error
  }
}

// Workspace Tags
export const getWorkspaceTags = async (workspaceId: string) => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/tags`)
    return response.data
  } catch (error: any) {
    console.error('GetWorkspaceTags API Error:', error.response?.data || error.message)
    throw error
  }
}

export const createWorkspaceTag = async (workspaceId: string, data: { name: string; color?: string; category?: string }) => {
  try {
    const response = await api.post(`/workspaces/${workspaceId}/tags`, data)
    return response.data
  } catch (error: any) {
    console.error('CreateWorkspaceTag API Error:', error.response?.data || error.message)
    throw error
  }
}

export const updateWorkspaceTag = async (workspaceId: string, tagId: string, data: any) => {
  try {
    const response = await api.put(`/workspaces/${workspaceId}/tags/${tagId}`, data)
    return response.data
  } catch (error: any) {
    console.error('UpdateWorkspaceTag API Error:', error.response?.data || error.message)
    throw error
  }
}

export const deleteWorkspaceTag = async (workspaceId: string, tagId: string) => {
  try {
    const response = await api.delete(`/workspaces/${workspaceId}/tags/${tagId}`)
    return response.data
  } catch (error: any) {
    console.error('DeleteWorkspaceTag API Error:', error.response?.data || error.message)
    throw error
  }
}

export const assignTagToAssignment = async (workspaceId: string, tagId: string, assignmentId: string) => {
  try {
    const response = await api.post(`/workspaces/${workspaceId}/tags/${tagId}/assignments/${assignmentId}`)
    return response.data
  } catch (error: any) {
    console.error('AssignTagToAssignment API Error:', error.response?.data || error.message)
    throw error
  }
}

export const removeTagFromAssignment = async (workspaceId: string, tagId: string, assignmentId: string) => {
  try {
    const response = await api.delete(`/workspaces/${workspaceId}/tags/${tagId}/assignments/${assignmentId}`)
    return response.data
  } catch (error: any) {
    console.error('RemoveTagFromAssignment API Error:', error.response?.data || error.message)
    throw error
  }
}

// Workspace Notes
export const getWorkspaceNotes = async (workspaceId: string, filters?: any) => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/notes`, { params: filters })
    return response.data
  } catch (error: any) {
    console.error('GetWorkspaceNotes API Error:', error.response?.data || error.message)
    throw error
  }
}

export const createWorkspaceNote = async (workspaceId: string, data: { title: string; content?: string; tags?: string[] }) => {
  try {
    const response = await api.post(`/workspaces/${workspaceId}/notes`, data)
    return response.data
  } catch (error: any) {
    console.error('CreateWorkspaceNote API Error:', error.response?.data || error.message)
    throw error
  }
}

export const updateWorkspaceNote = async (workspaceId: string, noteId: string, data: any) => {
  try {
    const response = await api.put(`/workspaces/${workspaceId}/notes/${noteId}`, data)
    return response.data
  } catch (error: any) {
    console.error('UpdateWorkspaceNote API Error:', error.response?.data || error.message)
    throw error
  }
}

export const deleteWorkspaceNote = async (workspaceId: string, noteId: string) => {
  try {
    const response = await api.delete(`/workspaces/${workspaceId}/notes/${noteId}`)
    return response.data
  } catch (error: any) {
    console.error('DeleteWorkspaceNote API Error:', error.response?.data || error.message)
    throw error
  }
}

export const togglePinWorkspaceNote = async (workspaceId: string, noteId: string) => {
  try {
    const response = await api.post(`/workspaces/${workspaceId}/notes/${noteId}/toggle-pin`)
    return response.data
  } catch (error: any) {
    console.error('TogglePinWorkspaceNote API Error:', error.response?.data || error.message)
    throw error
  }
}

// Workspace Goals
export const getWorkspaceGoals = async (workspaceId: string, filters?: any) => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/goals`, { params: filters })
    return response.data
  } catch (error: any) {
    console.error('GetWorkspaceGoals API Error:', error.response?.data || error.message)
    throw error
  }
}

export const createWorkspaceGoal = async (workspaceId: string, data: {
  title: string
  description?: string
  targetValue: number
  unit?: string
  deadline?: string
}) => {
  try {
    const response = await api.post(`/workspaces/${workspaceId}/goals`, data)
    return response.data
  } catch (error: any) {
    console.error('CreateWorkspaceGoal API Error:', error.response?.data || error.message)
    throw error
  }
}

export const updateWorkspaceGoal = async (workspaceId: string, goalId: string, data: any) => {
  try {
    const response = await api.put(`/workspaces/${workspaceId}/goals/${goalId}`, data)
    return response.data
  } catch (error: any) {
    console.error('UpdateWorkspaceGoal API Error:', error.response?.data || error.message)
    throw error
  }
}

export const updateWorkspaceGoalProgress = async (workspaceId: string, goalId: string, currentValue: number) => {
  try {
    const response = await api.post(`/workspaces/${workspaceId}/goals/${goalId}/update-progress`, { currentValue })
    return response.data
  } catch (error: any) {
    console.error('UpdateWorkspaceGoalProgress API Error:', error.response?.data || error.message)
    throw error
  }
}

export const toggleCompleteWorkspaceGoal = async (workspaceId: string, goalId: string) => {
  try {
    const response = await api.post(`/workspaces/${workspaceId}/goals/${goalId}/toggle-complete`)
    return response.data
  } catch (error: any) {
    console.error('ToggleCompleteWorkspaceGoal API Error:', error.response?.data || error.message)
    throw error
  }
}

export const deleteWorkspaceGoal = async (workspaceId: string, goalId: string) => {
  try {
    const response = await api.delete(`/workspaces/${workspaceId}/goals/${goalId}`)
    return response.data
  } catch (error: any) {
    console.error('DeleteWorkspaceGoal API Error:', error.response?.data || error.message)
    throw error
  }
}

// Workspace Shares
export const getWorkspaceShares = async (workspaceId: string) => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/shares`)
    return response.data
  } catch (error: any) {
    console.error('GetWorkspaceShares API Error:', error.response?.data || error.message)
    throw error
  }
}

export const createWorkspaceShare = async (workspaceId: string, data: {
  sharedWithPersonnelId: number
  permission: 'read' | 'write' | 'admin'
}) => {
  try {
    const response = await api.post(`/workspaces/${workspaceId}/shares`, data)
    return response.data
  } catch (error: any) {
    console.error('CreateWorkspaceShare API Error:', error.response?.data || error.message)
    throw error
  }
}

export const updateWorkspaceShare = async (workspaceId: string, shareId: string, data: { permission: string }) => {
  try {
    const response = await api.put(`/workspaces/${workspaceId}/shares/${shareId}`, data)
    return response.data
  } catch (error: any) {
    console.error('UpdateWorkspaceShare API Error:', error.response?.data || error.message)
    throw error
  }
}

export const deleteWorkspaceShare = async (workspaceId: string, shareId: string) => {
  try {
    const response = await api.delete(`/workspaces/${workspaceId}/shares/${shareId}`)
    return response.data
  } catch (error: any) {
    console.error('DeleteWorkspaceShare API Error:', error.response?.data || error.message)
    throw error
  }
}

export const getSharedWorkspaces = async () => {
  try {
    const response = await api.get('/workspaces/shared/me')
    return response.data
  } catch (error: any) {
    console.error('GetSharedWorkspaces API Error:', error.response?.data || error.message)
    throw error
  }
}

// Workspace Dashboard
export const getWorkspaceDashboard = async (workspaceId: string) => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/dashboard`)
    return response.data
  } catch (error: any) {
    console.error('GetWorkspaceDashboard API Error:', error.response?.data || error.message)
    throw error
  }
}

// Notifications API
export const getNotifications = async (filters?: {
  isRead?: boolean
  type?: string
  entityType?: string
  entityId?: number
  limit?: number
}) => {
  try {
    const params = new URLSearchParams()
    if (filters?.isRead !== undefined) params.append('isRead', filters.isRead.toString())
    if (filters?.type) params.append('type', filters.type)
    if (filters?.entityType) params.append('entityType', filters.entityType)
    if (filters?.entityId) params.append('entityId', filters.entityId.toString())
    if (filters?.limit) params.append('limit', filters.limit.toString())
    
    const queryString = params.toString() ? `?${params.toString()}` : ''
    const response = await api.get(`/notifications${queryString}`)
    return response.data
  } catch (error: any) {
    console.error('GetNotifications API Error:', error.response?.data || error.message)
    throw error
  }
}

export const getUnreadNotificationCount = async () => {
  try {
    const response = await api.get('/notifications/unread-count')
    return response.data.count
  } catch (error: any) {
    console.error('GetUnreadNotificationCount API Error:', error.response?.data || error.message)
    throw error
  }
}

export const markNotificationAsRead = async (id: string) => {
  try {
    const response = await api.patch(`/notifications/${id}/read`)
    return response.data
  } catch (error: any) {
    console.error('MarkNotificationAsRead API Error:', error.response?.data || error.message)
    throw error
  }
}

export const markAllNotificationsAsRead = async () => {
  try {
    const response = await api.patch('/notifications/read-all')
    return response.data
  } catch (error: any) {
    console.error('MarkAllNotificationsAsRead API Error:', error.response?.data || error.message)
    throw error
  }
}

export const deleteNotification = async (id: string) => {
  try {
    const response = await api.delete(`/notifications/${id}`)
    return response.data
  } catch (error: any) {
    console.error('DeleteNotification API Error:', error.response?.data || error.message)
    throw error
  }
}

export const createNotification = async (data: {
  personnelId: number
  title: string
  message: string
  type?: string
  entityType?: string
  entityId?: number
  actionUrl?: string
}) => {
  try {
    const response = await api.post('/notifications', data)
    return response.data
  } catch (error: any) {
    console.error('CreateNotification API Error:', error.response?.data || error.message)
    throw error
  }
}

// Reminders API
export const getReminders = async (filters?: {
  personnelId?: number
  isCompleted?: boolean
  entityType?: string
  entityId?: number
  upcoming?: boolean
  past?: boolean
  limit?: number
}) => {
  try {
    const params = new URLSearchParams()
    if (filters?.personnelId) params.append('personnelId', filters.personnelId.toString())
    if (filters?.isCompleted !== undefined) params.append('isCompleted', filters.isCompleted.toString())
    if (filters?.entityType) params.append('entityType', filters.entityType)
    if (filters?.entityId) params.append('entityId', filters.entityId.toString())
    if (filters?.upcoming) params.append('upcoming', 'true')
    if (filters?.past) params.append('past', 'true')
    if (filters?.limit) params.append('limit', filters.limit.toString())
    
    const queryString = params.toString() ? `?${params.toString()}` : ''
    const response = await api.get(`/reminders${queryString}`)
    return response.data
  } catch (error: any) {
    console.error('GetReminders API Error:', error.response?.data || error.message)
    throw error
  }
}

export const getUpcomingReminders = async (limit?: number) => {
  try {
    const params = limit ? `?limit=${limit}` : ''
    const response = await api.get(`/reminders/upcoming${params}`)
    return response.data
  } catch (error: any) {
    console.error('GetUpcomingReminders API Error:', error.response?.data || error.message)
    throw error
  }
}

export const createReminder = async (data: {
  title: string
  description?: string
  entityType?: string
  entityId?: number
  reminderAt: string
}) => {
  try {
    const response = await api.post('/reminders', data)
    return response.data
  } catch (error: any) {
    console.error('CreateReminder API Error:', error.response?.data || error.message)
    throw error
  }
}

export const updateReminder = async (id: string, data: {
  title?: string
  description?: string
  reminderAt?: string
}) => {
  try {
    const response = await api.patch(`/reminders/${id}`, data)
    return response.data
  } catch (error: any) {
    console.error('UpdateReminder API Error:', error.response?.data || error.message)
    throw error
  }
}

export const markReminderAsCompleted = async (id: string) => {
  try {
    const response = await api.patch(`/reminders/${id}/complete`)
    return response.data
  } catch (error: any) {
    console.error('MarkReminderAsCompleted API Error:', error.response?.data || error.message)
    throw error
  }
}

export const deleteReminder = async (id: string) => {
  try {
    const response = await api.delete(`/reminders/${id}`)
    return response.data
  } catch (error: any) {
    console.error('DeleteReminder API Error:', error.response?.data || error.message)
    throw error
  }
}

// Workspace Filters & Settings
export const updateWorkspaceFilters = async (workspaceId: string, filters: any) => {
  try {
    const response = await api.put(`/workspaces/${workspaceId}/filters`, { filters })
    return response.data
  } catch (error: any) {
    console.error('UpdateWorkspaceFilters API Error:', error.response?.data || error.message)
    throw error
  }
}

export const updateWorkspaceViewSettings = async (workspaceId: string, viewSettings: any) => {
  try {
    const response = await api.put(`/workspaces/${workspaceId}/view-settings`, { viewSettings })
    return response.data
  } catch (error: any) {
    console.error('UpdateWorkspaceViewSettings API Error:', error.response?.data || error.message)
    throw error
  }
}

// Export the axios instance for use in other modules (e.g., proxyApi)
export default api