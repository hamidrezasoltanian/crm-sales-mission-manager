'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import StatsCard from './components/StatsCard'
import ProtectedRoute from './components/ProtectedRoute'
import MainLayout from './components/MainLayout'
import LoadingSpinner from './components/LoadingSpinner'
import { useAuth } from './contexts/AuthContext'
import { showToast } from './components/Toast'
import { 
  Target, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  TrendingUp,
  Users,
  MapPin,
  Check,
  X,
  Bell
} from 'lucide-react'
import { getReportsSummary, getAssignments, approveAssignment, getPersonnel } from './lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { toPersianDate, toPersianDateWithMonth, toPersianMonth } from './lib/dateUtils'
import jalaali from 'jalaali-js'
import DashboardCustomizer from './components/DashboardCustomizer'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function Dashboard() {
  const { user, isManager, loading: authLoading } = useAuth()
  const [summary, setSummary] = useState<any>({ total: 0, byStatus: [], costs: { totalCost: 0, totalDiscount: 0, totalPersonalPayment: 0 } })
  const [assignments, setAssignments] = useState<any[]>([])
  const [personnel, setPersonnel] = useState<any[]>([])
  const [loading, setLoading] = useState(false) // Start with false, will be set to true when loading starts
  const [error, setError] = useState<string | null>(null)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null)
  const [approveForm, setApproveForm] = useState({
    personalPayment: 0,
    managerComment: ''
  })
  const [currentManagerId, setCurrentManagerId] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('currentManagerId')
      return saved ? parseInt(saved) : null
    }
    return null
  })
  // Initialize with default values to avoid hydration mismatch
  const defaultCards = ['totalAssignments', 'pendingAssignments', 'completedAssignments', 'totalCost', 'statusChart', 'monthlyChart', 'recentAssignments']
  const [visibleCards, setVisibleCards] = useState<string[]>(defaultCards)
  
  // Load from localStorage only on client side after mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboardCards')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setVisibleCards(parsed)
        } catch (e) {
          console.error('Error parsing dashboardCards from localStorage:', e)
        }
      }
    }
  }, [])

  useEffect(() => {
    // Only load data if user is authenticated
    if (!authLoading && user) {
      loadData()
      loadPersonnel()
    } else if (!authLoading && !user) {
      // If not authenticated, don't show loading spinner
      setLoading(false)
    }
  }, [authLoading, user])

  const loadPersonnel = async () => {
    try {
      const data = await getPersonnel()
      setPersonnel(data || [])
      // اگر currentManagerId تنظیم نشده، اولین مدیر را انتخاب کن
      if (!currentManagerId && data && data.length > 0) {
        const manager = data.find((p: any) => p.role === 'admin' || p.role === 'manager') || data[0]
        if (manager) {
          setCurrentManagerId(manager.id)
          localStorage.setItem('currentManagerId', manager.id.toString())
        }
      }
    } catch (error) {
      console.error('Error loading personnel:', error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    console.log('[Dashboard] loadData called')
    
    // Safety timeout - force loading to false after 10 seconds (reduced from 65)
    const safetyTimeout = setTimeout(() => {
      console.warn('[Dashboard] Loading timeout - forcing state to false')
      setLoading(false)
    }, 10000)
    
    try {
      console.log('[Dashboard] Starting to load data...')
      // Get API URL dynamically
      const apiUrl = typeof window !== 'undefined' 
        ? (process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:2001/api`)
        : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:2001/api')
      console.log('[Dashboard] API URL:', apiUrl)
      
      const summaryPromise = getReportsSummary().catch(err => {
        console.error('[Dashboard] Error loading summary:', err)
        return { total: 0, byStatus: [], costs: { totalCost: 0, totalDiscount: 0, totalPersonalPayment: 0 } }
      })
      
      const assignmentsPromise = getAssignments().catch(err => {
        console.error('[Dashboard] Error loading assignments:', err)
        return { data: [], pagination: {} }
      })
      
      console.log('[Dashboard] Waiting for promises...')
      const [summaryData, assignmentsResponse] = await Promise.all([summaryPromise, assignmentsPromise])
      
      // Handle paginated response - extract data array
      const assignmentsData = Array.isArray(assignmentsResponse) 
        ? assignmentsResponse 
        : (assignmentsResponse?.data || [])
      
      console.log('[Dashboard] Data received:', {
        summary: summaryData,
        assignmentsCount: assignmentsData?.length || 0
      })
      
      setSummary(summaryData || { total: 0, byStatus: [], costs: { totalCost: 0, totalDiscount: 0, totalPersonalPayment: 0 } })
      setAssignments(Array.isArray(assignmentsData) ? assignmentsData : [])
      console.log('[Dashboard] State updated')
    } catch (error: any) {
      console.error('[Dashboard] Error loading data:', error)
      setError('خطا در بارگذاری داده‌ها: ' + (error.message || 'خطای نامشخص'))
      setSummary({ total: 0, byStatus: [], costs: { totalCost: 0, totalDiscount: 0, totalPersonalPayment: 0 } })
      setAssignments([])
    } finally {
      clearTimeout(safetyTimeout)
      setLoading(false)
      console.log('[Dashboard] Loading finished, loading state:', false)
    }
  }

  // Always render - don't block the UI

  // محاسبه آمار - با fallback values
  // Ensure assignments is always an array
  const safeAssignments: any[] = Array.isArray(assignments) 
    ? assignments 
    : ((assignments as any)?.data && Array.isArray((assignments as any).data) ? (assignments as any).data : [])
  const totalAssignments = safeAssignments.length
  const pendingAssignments = safeAssignments.filter(a => a.status === 'pending').length
  const approvedAssignments = safeAssignments.filter(a => a.status === 'approved').length
  const completedAssignments = safeAssignments.filter(a => a.status === 'completed').length
  const totalCost = safeAssignments.reduce((sum, a) => sum + (a.totalCost || 0), 0)

  // داده‌های نمودار وضعیت
  const statusData = [
    { name: 'در انتظار', value: pendingAssignments, color: '#f59e0b' },
    { name: 'تایید شده', value: approvedAssignments, color: '#3b82f6' },
    { name: 'تکمیل شده', value: completedAssignments, color: '#10b981' },
  ].filter(item => item.value > 0) // فقط مواردی که مقدار دارند

  // داده‌های نمودار ماهانه (آخرین 6 ماه) - محاسبه دقیق روزانه از یکم ماه تا پایان ماه
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const now = new Date()
    const jNow = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate())
    
    // محاسبه ماه هدف (0 = ماه جاری، 1 = ماه قبل، ...)
    const targetMonthOffset = 5 - i
    let jTargetYear = jNow.jy
    let jTargetMonth = jNow.jm - targetMonthOffset
    
    // تصحیح سال و ماه در صورت منفی شدن یا بیشتر از 12 شدن
    while (jTargetMonth <= 0) {
      jTargetMonth += 12
      jTargetYear -= 1
    }
    while (jTargetMonth > 12) {
      jTargetMonth -= 12
      jTargetYear += 1
    }
    
    // تعیین تاریخ شروع (یکم ماه شمسی)
    const startDate = jalaali.toGregorian(jTargetYear, jTargetMonth, 1)
    const start = new Date(startDate.gy, startDate.gm - 1, startDate.gd)
    start.setHours(0, 0, 0, 0)
    
    // تعیین تاریخ پایان
    let end: Date
    const isCurrentMonth = targetMonthOffset === 0
    if (isCurrentMonth) {
      // برای ماه جاری: تا امروز
      end = new Date(now)
      end.setHours(23, 59, 59, 999)
    } else {
      // برای ماه‌های گذشته: تا آخر ماه شمسی
      const daysInMonth = jalaali.jalaaliMonthLength(jTargetYear, jTargetMonth)
      const endDate = jalaali.toGregorian(jTargetYear, jTargetMonth, daysInMonth)
      end = new Date(endDate.gy, endDate.gm - 1, endDate.gd)
      end.setHours(23, 59, 59, 999)
    }
    
    const monthNames = [
      'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
      'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
    ]
    const monthName = monthNames[jTargetMonth - 1] || 'نامشخص'
    
    // فیلتر کردن ماموریت‌ها بر اساس محدوده دقیق تاریخ (روزانه)
    const monthAssignments = safeAssignments.filter(a => {
      if (!a.createdAt) return false
      try {
        const assignDate = new Date(a.createdAt)
        if (isNaN(assignDate.getTime())) return false
        
        // بررسی اینکه تاریخ در محدوده دقیق ماه باشد (از یکم تا پایان ماه)
        return assignDate >= start && assignDate <= end
      } catch {
        return false
      }
    })
    
    return {
      name: monthName,
      تعداد: monthAssignments.length,
      هزینه: monthAssignments.reduce((sum, a) => sum + (a.totalCost || 0), 0)
    }
  })

  // ماموریت‌های اخیر
  const recentAssignments = safeAssignments
    .filter(a => a.createdAt) // فقط مواردی که تاریخ دارند
    .sort((a, b) => {
      try {
        const dateA = new Date(a.createdAt).getTime()
        const dateB = new Date(b.createdAt).getTime()
        if (isNaN(dateA) || isNaN(dateB)) return 0
        return dateB - dateA
      } catch {
        return 0
      }
    })
    .slice(0, 5)

  const getStatusBadge = (status: string) => {
    const badges: any = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }
    return badges[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status: string) => {
    const labels: any = {
      pending: 'در انتظار',
      approved: 'تایید شده',
      completed: 'تکمیل شده',
      rejected: 'رد شده',
    }
    return labels[status] || status
  }

  // ماموریت‌های در انتظار تایید
  const pendingAssignmentsList = safeAssignments
    .filter(a => a.status === 'pending')
    .sort((a, b) => {
      try {
        const dateA = new Date(a.createdAt).getTime()
        const dateB = new Date(b.createdAt).getTime()
        if (isNaN(dateA) || isNaN(dateB)) return 0
        return dateB - dateA
      } catch {
        return 0
      }
    })
    .slice(0, 10)

  const handleApprove = async () => {
    console.log('[Dashboard] handleApprove called')
    if (!selectedAssignment) {
      console.error('[Dashboard] No selected assignment')
      showToast('لطفاً یک ماموریت را انتخاب کنید', 'error')
      return
    }
    if (!currentManagerId) {
      console.error('[Dashboard] No current manager ID')
      showToast('لطفاً ابتدا مدیر جاری را انتخاب کنید', 'error')
      return
    }
    try {
      console.log('[Dashboard] Approving assignment:', {
        id: selectedAssignment.id,
        managerId: currentManagerId,
        personalPayment: approveForm.personalPayment,
        managerComment: approveForm.managerComment
      })
      
      const assignmentId = selectedAssignment.id?.toString() || String(selectedAssignment.id)
      const personalPaymentValue = approveForm.personalPayment 
        ? (typeof approveForm.personalPayment === 'number' 
            ? approveForm.personalPayment 
            : parseFloat(String(approveForm.personalPayment)) || 0)
        : 0
      
      console.log('[Dashboard] Calling approveAssignment with:', {
        id: assignmentId,
        managerId: currentManagerId,
        personalPayment: personalPaymentValue,
        managerComment: approveForm.managerComment || undefined
      })
      
      await approveAssignment(
        assignmentId, 
        currentManagerId, 
        personalPaymentValue,
        approveForm.managerComment || undefined
      )
      
      console.log('[Dashboard] approveAssignment completed successfully')
      showToast('ماموریت با موفقیت تایید شد', 'success')
      await loadData()
      setShowApproveModal(false)
      setSelectedAssignment(null)
      setApproveForm({ personalPayment: 0, managerComment: '' })
    } catch (error: any) {
      console.error('[Dashboard] Error approving assignment:', error)
      console.error('[Dashboard] Error details:', {
        message: error?.message,
        response: error?.response?.data,
        stack: error?.stack
      })
      const errorMessage = error?.response?.data?.error || error?.message || 'خطا در تایید ماموریت'
      showToast(errorMessage, 'error')
    }
  }

  const router = useRouter()

  // Check onboarding for new users
  useEffect(() => {
    if (!authLoading && !loading && user) {
      const onboardingCompleted = localStorage.getItem('onboarding_completed')
      if (!onboardingCompleted) {
        router.push('/onboarding')
        return
      }
    }
  }, [user, authLoading, loading, router])

  // Redirect staff/expert users to their dashboard
  useEffect(() => {
    if (user && ['staff', 'expert'].includes(user.role)) {
      router.push('/my-dashboard')
    }
  }, [user, router])

  // Show loading spinner if auth is loading
  if (authLoading) {
    return (
      <ProtectedRoute allowedRoles={['super_admin', 'admin', 'manager', 'hr']}>
        <MainLayout>
          <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 text-sm">در حال بارگذاری...</p>
            </div>
          </div>
        </MainLayout>
      </ProtectedRoute>
    )
  }

  // Don't render main dashboard for staff/expert users
  if (user && ['staff', 'expert'].includes(user.role)) {
    return null
  }

  return (
    <ProtectedRoute allowedRoles={['super_admin', 'admin', 'manager', 'hr']}>
      <MainLayout>
        <div className="p-8">
      {/* Manager Selector */}
      {personnel.length > 0 && (
        <div className="mb-6 bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              مدیر جاری:
            </label>
            <select
              value={currentManagerId || ''}
              onChange={(e) => {
                const id = parseInt(e.target.value)
                setCurrentManagerId(id)
                localStorage.setItem('currentManagerId', id.toString())
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {personnel.filter((p: any) => p.role === 'admin' || p.role === 'manager').map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role === 'admin' ? 'مدیر کل' : 'مدیر'})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      
      {/* Loading Indicator */}
      {loading && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-600"></div>
          <span>در حال بارگذاری داده‌ها...</span>
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          <p className="font-medium">خطا</p>
          <p className="text-sm">{error}</p>
          <button 
            onClick={() => {
              setError(null)
              loadData()
            }}
            className="mt-2 text-sm bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            تلاش مجدد
          </button>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">داشبورد مدیریت</h1>
          <p className="text-gray-600">خوش آمدید! اینجا می‌توانید همه چیز را مدیریت کنید</p>
        </div>
        <DashboardCustomizer visibleCards={visibleCards} onCardsChange={setVisibleCards} />
      </div>

      {/* Stats Cards */}
      {visibleCards.some(c => ['totalAssignments', 'pendingAssignments', 'completedAssignments', 'totalCost'].includes(c)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {visibleCards.includes('totalAssignments') && (
            <StatsCard
              title="کل ماموریت‌ها"
              value={totalAssignments}
              icon={Target}
              color="blue"
            />
          )}
          {visibleCards.includes('pendingAssignments') && (
            <StatsCard
              title="در انتظار تایید"
              value={pendingAssignments}
              icon={Clock}
              color="orange"
            />
          )}
          {visibleCards.includes('completedAssignments') && (
            <StatsCard
              title="تکمیل شده"
              value={completedAssignments}
              icon={CheckCircle}
              color="green"
            />
          )}
          {visibleCards.includes('totalCost') && (
            <StatsCard
              title="کل هزینه"
              value={`${totalCost.toLocaleString('fa-IR')} تومان`}
              icon={DollarSign}
              color="purple"
            />
          )}
        </div>
      )}

      {/* Charts */}
      {(visibleCards.includes('statusChart') || visibleCards.includes('monthlyChart')) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* نمودار وضعیت */}
          {visibleCards.includes('statusChart') && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">وضعیت ماموریت‌ها</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* نمودار ماهانه */}
          {visibleCards.includes('monthlyChart') && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">روند ماهانه</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="تعداد" fill="#3b82f6" />
                  <Bar dataKey="هزینه" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Pending Approvals Card - Only for Managers */}
      {isManager && pendingAssignmentsList.length > 0 && (
        <div className="bg-yellow-50 border-r-4 border-yellow-500 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="text-yellow-600" size={24} />
              کارتابل تایید ماموریت‌ها
              <span className="bg-red-500 text-white text-sm px-3 py-1 rounded-full">
                {pendingAssignmentsList.length}
              </span>
            </h2>
            <a href="/assignments?status=pending" className="text-blue-600 hover:text-blue-800 font-medium">
              مشاهده همه →
            </a>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {pendingAssignmentsList.slice(0, 5).map((mission: any) => (
              <div
                key={mission.id}
                className="bg-white rounded-lg p-4 border border-yellow-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-gray-900">ماموریت #{mission.id}</span>
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
                        در انتظار تایید
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">پرسنل: </span>
                        <span className="font-semibold">{mission.personnelName || 'نامشخص'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">مرکز: </span>
                        <span className="font-semibold">{mission.centerName || 'نامشخص'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">تاریخ: </span>
                        <span className="font-semibold">
                          {mission.createdAt ? toPersianDate(new Date(mission.createdAt)) : 'نامشخص'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">هزینه: </span>
                        <span className="font-semibold">
                          {mission.snapCost ? `${mission.snapCost.toLocaleString('fa-IR')} تومان` : 'تعیین نشده'}
                        </span>
                      </div>
                    </div>
                    {mission.notes && (
                      <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        {mission.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 mr-4">
                    <button
                      onClick={() => {
                        setSelectedAssignment(mission)
                        setShowApproveModal(true)
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Check size={16} />
                      تایید
                    </button>
                    <button
                      onClick={() => {
                        router.push(`/assignments?id=${mission.id}`)
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      جزئیات
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {pendingAssignmentsList.length > 5 && (
            <div className="mt-4 text-center text-gray-600 text-sm">
              و {pendingAssignmentsList.length - 5} ماموریت دیگر...
            </div>
          )}
        </div>
      )}

      {/* Pending Assignments Table - Fallback for non-managers */}
      {!isManager && pendingAssignmentsList.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">ماموریت‌های در انتظار تایید</h2>
            <a href="/assignments?status=pending" className="text-blue-600 hover:text-blue-800 font-medium">
              مشاهده همه →
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">شناسه</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">پرسنل</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">مرکز</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">هزینه اسنپ</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">تاریخ</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {pendingAssignmentsList.map((assignment) => (
                  <tr key={assignment.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-900">#{assignment.id}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{assignment.personnelName || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{assignment.centerName || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-900 font-medium">
                      {assignment.snapCost ? `${assignment.snapCost.toLocaleString('fa-IR')} تومان` : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {assignment.createdAt ? toPersianDate(assignment.createdAt) : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => {
                          setSelectedAssignment(assignment)
                          setShowApproveModal(true)
                        }}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
                      >
                        <Check size={16} />
                        تایید
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Assignments */}
      {visibleCards.includes('recentAssignments') && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">ماموریت‌های اخیر</h2>
            <a href="/assignments" className="text-blue-600 hover:text-blue-800 font-medium">
              مشاهده همه →
            </a>
          </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">شناسه</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">پرسنل</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">مرکز</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">مسئول مرکز</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">وضعیت</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">هزینه</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {recentAssignments.length > 0 ? (
                recentAssignments.map((assignment) => (
                  <tr key={assignment.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-900">#{assignment.id}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{assignment.personnelName || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {assignment.centerName || '-'}
                      {assignment.centerNotes && (
                        <div className="mt-1 text-xs text-gray-500 italic">
                          📝 {assignment.centerNotes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {assignment.centerResponsiblePersonnelName ? (
                        <span className="text-blue-600 font-medium">
                          {assignment.centerResponsiblePersonnelName}
                        </span>
                      ) : (
                        <span className="text-gray-400">بدون مسئول</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(assignment.status || 'pending')}`}>
                        {getStatusLabel(assignment.status || 'pending')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 font-medium">
                      {assignment.totalCost ? `${assignment.totalCost.toLocaleString('fa-IR')} تومان` : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {assignment.createdAt ? toPersianDate(assignment.createdAt) : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    هیچ ماموریتی یافت نشد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">تایید ماموریت #{selectedAssignment.id}</h3>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">پرسنل: <span className="font-medium text-gray-900">{selectedAssignment.personnelName}</span></p>
              <p className="text-sm text-gray-600 mb-1">مرکز: <span className="font-medium text-gray-900">{selectedAssignment.centerName}</span></p>
              <p className="text-sm text-gray-600">هزینه اسنپ: <span className="font-medium text-gray-900">{selectedAssignment.snapCost ? `${selectedAssignment.snapCost.toLocaleString('fa-IR')} تومان` : '-'}</span></p>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  هزینه شخصی (تومان)
                </label>
                <input
                  type="number"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={approveForm.personalPayment}
                  onChange={(e) => setApproveForm({ ...approveForm, personalPayment: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  کامنت مدیر (اختیاری)
                </label>
                <textarea
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  value={approveForm.managerComment}
                  onChange={(e) => setApproveForm({ ...approveForm, managerComment: e.target.value })}
                  placeholder="نظرات و توضیحات مدیر..."
                />
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleApprove}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <Check size={18} />
                تایید ماموریت
              </button>
              <button
                onClick={() => {
                  setShowApproveModal(false)
                  setSelectedAssignment(null)
                  setApproveForm({ personalPayment: 0, managerComment: '' })
                }}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
              >
                <X size={18} />
                لغو
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
      </MainLayout>
    </ProtectedRoute>
  )
}
