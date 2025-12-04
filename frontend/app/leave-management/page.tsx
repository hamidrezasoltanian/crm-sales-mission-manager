'use client'

import { useState, useEffect } from 'react'
import MainLayout from '../components/MainLayout'
import ProtectedRoute from '../components/ProtectedRoute'
import { useAuth } from '../contexts/AuthContext'
import { leaveManagementApi, medicalFilesApi } from '../lib/proxyApi'
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Loader2, 
  Users, 
  DollarSign,
  Filter,
  RefreshCw,
  Search,
  FileText,
  Stethoscope,
  Download,
  Edit,
  Eye,
  TrendingUp
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { showToast } from '../components/Toast'

interface LeaveRequest {
  id: string
  employeeName?: string
  employee?: { name: string }
  startDate?: string
  endDate?: string
  leaveType?: string
  status?: string
  reason?: string
  days?: number
}

interface Attendance {
  id: string
  employeeName?: string
  date?: string
  checkIn?: string
  checkOut?: string
  workHours?: number
  status?: string
}

interface Salary {
  id: string
  employeeName?: string
  month?: string
  baseSalary?: number
  totalSalary?: number
  deductions?: number
  bonuses?: number
}

export default function LeaveManagementPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [salaries, setSalaries] = useState<Salary[]>([])
  const [medicalFiles, setMedicalFiles] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'requests' | 'attendance' | 'salaries' | 'medical'>('requests')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      if (activeTab === 'requests') {
        const filters: any = {}
        if (statusFilter !== 'all') filters.status = statusFilter
        
        const response = await leaveManagementApi.getLeaveRequests(filters)
        setLeaveRequests(response.data || [])
        
        // Calculate stats
        const total = response.data?.length || 0
        const pending = response.data?.filter((r: LeaveRequest) => r.status === 'pending').length || 0
        const approved = response.data?.filter((r: LeaveRequest) => r.status === 'approved').length || 0
        const rejected = response.data?.filter((r: LeaveRequest) => r.status === 'rejected').length || 0
        
        setStats({ total, pending, approved, rejected })
      } else if (activeTab === 'attendance') {
        const response = await leaveManagementApi.getAttendances()
        setAttendances(response.data || [])
        
        const total = response.data?.length || 0
        const present = response.data?.filter((a: Attendance) => a.status === 'present').length || 0
        const absent = response.data?.filter((a: Attendance) => a.status === 'absent').length || 0
        const totalHours = response.data?.reduce((sum: number, a: Attendance) => sum + (a.workHours || 0), 0) || 0
        
        setStats({ total, present, absent, totalHours })
      } else if (activeTab === 'salaries') {
        const response = await leaveManagementApi.getSalaries()
        setSalaries(response.data || [])
        
        const total = response.data?.length || 0
        const totalSalary = response.data?.reduce((sum: number, s: Salary) => sum + (s.totalSalary || 0), 0) || 0
        const totalDeductions = response.data?.reduce((sum: number, s: Salary) => sum + (s.deductions || 0), 0) || 0
        const totalBonuses = response.data?.reduce((sum: number, s: Salary) => sum + (s.bonuses || 0), 0) || 0
        
        setStats({ total, totalSalary, totalDeductions, totalBonuses })
      } else if (activeTab === 'medical') {
        const [filesRes, categoriesRes] = await Promise.all([
          medicalFilesApi.getMedicalFiles().catch(() => ({ data: [] })),
          medicalFilesApi.getCategories().catch(() => ({ data: [] }))
        ])
        setMedicalFiles(filesRes.data || [])
        setStats({ categories: categoriesRes.data || [] })
      }
    } catch (err: any) {
      // Handle service unavailable errors gracefully (503, 500)
      if (err.response?.status === 503 || err.response?.status === 500) {
        console.warn('[Leave Management] Service unavailable')
        setError('سیستم مدیریت مرخصی در دسترس نیست. لطفاً بعداً تلاش کنید.')
        // Set empty data for unavailable services
        if (activeTab === 'requests') {
          // Leave requests are already handled in the try block with .catch()
        }
        if (activeTab === 'medical') {
          setMedicalFiles([])
          setStats({ categories: [] })
        }
      } else if (err.response?.status === 401) {
        // Don't log 401 errors for proxy requests as they're expected when external service is unavailable
        setError('سیستم مدیریت مرخصی در دسترس نیست. لطفاً بعداً تلاش کنید.')
      } else {
        console.error('Error loading leave management data:', err)
        setError(err.response?.data?.message || 'خطا در بارگذاری داده‌ها')
        showToast('خطا در بارگذاری داده‌های مدیریت مرخصی', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
    showToast('داده‌ها به‌روزرسانی شد', 'success')
  }

  const handleApprove = async (id: string) => {
    try {
      await leaveManagementApi.approveLeaveRequest(id, { approved: true })
      showToast('درخواست مرخصی تایید شد', 'success')
      loadData()
    } catch (err: any) {
      showToast('خطا در تایید درخواست', 'error')
    }
  }

  const handleReject = async (id: string) => {
    try {
      await leaveManagementApi.approveLeaveRequest(id, { approved: false })
      showToast('درخواست مرخصی رد شد', 'success')
      loadData()
    } catch (err: any) {
      showToast('خطا در رد درخواست', 'error')
    }
  }

  const handleCreateLeave = () => {
    setShowCreateModal(true)
  }

  const handleCreateAttendance = () => {
    showToast('این قابلیت به زودی اضافه می‌شود', 'info')
  }

  const filteredLeaveRequests = leaveRequests.filter(request => {
    const matchesSearch = !searchTerm || 
      request.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.employee?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.leaveType?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const filteredAttendances = attendances.filter(attendance => {
    return !searchTerm || 
      attendance.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attendance.date?.includes(searchTerm)
  })

  if (loading && !stats) {
    return (
      <ProtectedRoute allowedRoles={['admin', 'manager', 'staff']}>
        <MainLayout>
          <LoadingSpinner fullScreen={false} />
        </MainLayout>
      </ProtectedRoute>
    )
  }

  const canApprove = user?.role === 'admin' || user?.role === 'manager'
  const canCreate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'staff'

  return (
    <ProtectedRoute allowedRoles={['admin', 'manager', 'staff']}>
      <MainLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  مدیریت مرخصی و حضور
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  مدیریت درخواست‌های مرخصی، حضور و غیاب و حقوق
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                به‌روزرسانی
              </button>
              {activeTab === 'requests' && canCreate && (
                <button
                  onClick={handleCreateLeave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  درخواست مرخصی جدید
                </button>
              )}
              {activeTab === 'attendance' && canCreate && (
                <button
                  onClick={handleCreateAttendance}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  ثبت حضور
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 space-x-reverse">
              <button
                onClick={() => setActiveTab('requests')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'requests'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                درخواست‌های مرخصی
              </button>
              <button
                onClick={() => setActiveTab('attendance')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'attendance'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                حضور و غیاب
              </button>
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <>
                  <button
                    onClick={() => setActiveTab('salaries')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'salaries'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    حقوق و دستمزد
                  </button>
                  <button
                    onClick={() => setActiveTab('medical')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'medical'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    فایل‌های پزشکی
                  </button>
                </>
              )}
            </nav>
          </div>

          {error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-200">{error}</p>
              <button
                onClick={loadData}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                تلاش مجدد
              </button>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              {stats && activeTab === 'requests' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm font-medium mb-2">کل درخواست‌ها</p>
                        <p className="text-3xl font-bold">
                          {stats.total || 0}
                        </p>
                      </div>
                      <Calendar className="w-12 h-12 text-blue-200 opacity-50" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-yellow-100 text-sm font-medium mb-2">در انتظار تایید</p>
                        <p className="text-3xl font-bold">
                          {stats.pending || 0}
                        </p>
                      </div>
                      <Clock className="w-12 h-12 text-yellow-200 opacity-50" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm font-medium mb-2">تایید شده</p>
                        <p className="text-3xl font-bold">
                          {stats.approved || 0}
                        </p>
                      </div>
                      <CheckCircle className="w-12 h-12 text-green-200 opacity-50" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-red-100 text-sm font-medium mb-2">رد شده</p>
                        <p className="text-3xl font-bold">
                          {stats.rejected || 0}
                        </p>
                      </div>
                      <XCircle className="w-12 h-12 text-red-200 opacity-50" />
                    </div>
                  </div>
                </div>
              )}

              {stats && activeTab === 'attendance' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm font-medium mb-2">کل رکوردها</p>
                        <p className="text-3xl font-bold">
                          {stats.total || 0}
                        </p>
                      </div>
                      <Clock className="w-12 h-12 text-blue-200 opacity-50" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm font-medium mb-2">حاضر</p>
                        <p className="text-3xl font-bold">
                          {stats.present || 0}
                        </p>
                      </div>
                      <CheckCircle className="w-12 h-12 text-green-200 opacity-50" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-red-100 text-sm font-medium mb-2">غایب</p>
                        <p className="text-3xl font-bold">
                          {stats.absent || 0}
                        </p>
                      </div>
                      <XCircle className="w-12 h-12 text-red-200 opacity-50" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100 text-sm font-medium mb-2">ساعات کار</p>
                        <p className="text-3xl font-bold">
                          {stats.totalHours || 0}
                        </p>
                      </div>
                      <Clock className="w-12 h-12 text-purple-200 opacity-50" />
                    </div>
                  </div>
                </div>
              )}

              {stats && activeTab === 'salaries' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm font-medium mb-2">کل حقوق</p>
                        <p className="text-3xl font-bold">
                          {stats.totalSalary?.toLocaleString('fa-IR') || '0'} تومان
                        </p>
                      </div>
                      <DollarSign className="w-12 h-12 text-blue-200 opacity-50" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm font-medium mb-2">کل پاداش</p>
                        <p className="text-3xl font-bold">
                          {stats.totalBonuses?.toLocaleString('fa-IR') || '0'} تومان
                        </p>
                      </div>
                      <TrendingUp className="w-12 h-12 text-green-200 opacity-50" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-red-100 text-sm font-medium mb-2">کل کسورات</p>
                        <p className="text-3xl font-bold">
                          {stats.totalDeductions?.toLocaleString('fa-IR') || '0'} تومان
                        </p>
                      </div>
                      <TrendingUp className="w-12 h-12 text-red-200 opacity-50" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100 text-sm font-medium mb-2">تعداد کارمندان</p>
                        <p className="text-3xl font-bold">
                          {stats.total || 0}
                        </p>
                      </div>
                      <Users className="w-12 h-12 text-purple-200 opacity-50" />
                    </div>
                  </div>
                </div>
              )}

              {/* Search and Filters */}
              {(activeTab === 'requests' || activeTab === 'attendance') && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="relative">
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="جستجو..."
                          className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    {activeTab === 'requests' && (
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="all">همه وضعیت‌ها</option>
                        <option value="pending">در انتظار</option>
                        <option value="approved">تایید شده</option>
                        <option value="rejected">رد شده</option>
                      </select>
                    )}
                  </div>
                </div>
              )}

              {/* Leave Requests Table */}
              {activeTab === 'requests' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      لیست درخواست‌های مرخصی ({filteredLeaveRequests.length})
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            کارمند
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            تاریخ شروع
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            تاریخ پایان
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            نوع مرخصی
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            تعداد روز
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            وضعیت
                          </th>
                          {canApprove && (
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              عملیات
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredLeaveRequests.length > 0 ? (
                          filteredLeaveRequests.map((request) => (
                            <tr key={request.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                {request.employeeName || request.employee?.name || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                {request.startDate || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                {request.endDate || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                {request.leaveType || 'عادی'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                {request.days || '-'} روز
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  request.status === 'approved' 
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : request.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }`}>
                                  {request.status === 'approved' ? 'تایید شده' : 
                                   request.status === 'pending' ? 'در انتظار' : 
                                   request.status === 'rejected' ? 'رد شده' : 
                                   request.status || 'نامشخص'}
                                </span>
                              </td>
                              {canApprove && request.status === 'pending' && (
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleApprove(request.id)}
                                      className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                                      title="تایید"
                                    >
                                      <CheckCircle className="w-5 h-5" />
                                    </button>
                                    <button
                                      onClick={() => handleReject(request.id)}
                                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                      title="رد"
                                    >
                                      <XCircle className="w-5 h-5" />
                                    </button>
                                  </div>
                                </td>
                              )}
                              {canApprove && request.status !== 'pending' && (
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                  -
                                </td>
                              )}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={canApprove ? 7 : 6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                              درخواست مرخصی یافت نشد
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Attendance Table */}
              {activeTab === 'attendance' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      حضور و غیاب ({filteredAttendances.length})
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            کارمند
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            تاریخ
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            ورود
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            خروج
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            ساعات کار
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            وضعیت
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredAttendances.length > 0 ? (
                          filteredAttendances.map((attendance) => (
                            <tr key={attendance.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                {attendance.employeeName || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                {attendance.date || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                {attendance.checkIn || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                {attendance.checkOut || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                {attendance.workHours || 0} ساعت
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  attendance.status === 'present' 
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }`}>
                                  {attendance.status === 'present' ? 'حاضر' : 'غایب'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                              رکوردی یافت نشد
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Salaries Table */}
              {activeTab === 'salaries' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      حقوق و دستمزد ({salaries.length})
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            کارمند
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            ماه
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            حقوق پایه
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            پاداش
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            کسورات
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            حقوق نهایی
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {salaries.length > 0 ? (
                          salaries.map((salary) => (
                            <tr key={salary.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                {salary.employeeName || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                {salary.month || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                {salary.baseSalary?.toLocaleString('fa-IR') || '0'} تومان
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
                                +{salary.bonuses?.toLocaleString('fa-IR') || '0'} تومان
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400">
                                -{salary.deductions?.toLocaleString('fa-IR') || '0'} تومان
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                                {salary.totalSalary?.toLocaleString('fa-IR') || '0'} تومان
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                              داده‌ای یافت نشد
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Medical Files */}
              {activeTab === 'medical' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Stethoscope className="w-5 h-5 text-blue-600" />
                      فایل‌های پزشکی ({medicalFiles.length})
                    </h2>
                    <button
                      onClick={() => showToast('این قابلیت به زودی اضافه می‌شود', 'info')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      آپلود فایل
                    </button>
                  </div>
                  <div className="p-6">
                    {medicalFiles.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {medicalFiles.map((file: any) => (
                          <div key={file.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <div className="flex items-start justify-between mb-2">
                              <FileText className="w-8 h-8 text-blue-600" />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => showToast('این قابلیت به زودی اضافه می‌شود', 'info')}
                                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                                  title="مشاهده"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => showToast('این قابلیت به زودی اضافه می‌شود', 'info')}
                                  className="text-green-600 hover:text-green-800 dark:text-green-400"
                                  title="دانلود"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                              {file.title || file.fileName || 'بدون عنوان'}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {file.category || file.categoryName || '-'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              {file.uploadDate || file.createdAt || '-'}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Stethoscope className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-400">فایل پزشکی یافت نشد</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </MainLayout>
    </ProtectedRoute>
  )
}
