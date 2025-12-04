'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Filter, Plus, Edit, Trash2, Check, X, Calendar, Users, FileText, ArrowRight } from 'lucide-react'
import { toPersianDate } from '../../lib/dateUtils'
import { useAuth } from '../../contexts/AuthContext'
import { showToast } from '../../components/Toast'
import ProtectedRoute from '../../components/ProtectedRoute'
import MainLayout from '../../components/MainLayout'
import { getPersonnel, getLeaveRequests, createLeaveRequest, updateLeaveRequest } from '../../lib/api'
import PersianDatePicker from '../../components/PersianDatePicker'

export default function LeavesPage() {
  const router = useRouter()
  const { user, isManager, isAdmin } = useAuth()
  const [leaves, setLeaves] = useState<any[]>([])
  const [personnel, setPersonnel] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    personnelId: '',
    leaveType: '',
  })
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    personnelId: '',
    leaveType: 'annual',
    startDate: null as Date | null,
    endDate: null as Date | null,
    reason: '',
    days: 0
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadLeaves()
  }, [filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const personnelData = await getPersonnel()
      setPersonnel(personnelData || [])
      await loadLeaves()
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadLeaves = async () => {
    try {
      const response = await getLeaveRequests({
        status: filters.status as any,
        employee_id: filters.personnelId ? parseInt(filters.personnelId) : undefined,
      })
      let data = Array.isArray(response) ? response : (response?.data || [])
      
      // Filter by leave type if specified
      if (filters.leaveType) {
        data = data.filter((l: any) => l.leave_type === filters.leaveType)
      }
      
      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase()
        data = data.filter((l: any) => 
          l.employee_name?.toLowerCase().includes(search) ||
          l.reason?.toLowerCase().includes(search) ||
          l.id.toString().includes(search)
        )
      }
      
      setLeaves(data)
    } catch (error: any) {
      // Handle service unavailable errors gracefully
      if (error.response?.status === 503 || error.response?.status === 500) {
        console.warn('[Leaves] Service unavailable, showing empty list')
        setLeaves([])
        showToast('سیستم مدیریت مرخصی در دسترس نیست', 'warning')
      } else {
        console.error('Error loading leaves:', error)
        showToast('خطا در بارگذاری درخواست‌های مرخصی', 'error')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.personnelId || !formData.startDate || !formData.endDate) {
      showToast('لطفاً تمام فیلدهای الزامی را پر کنید', 'error')
      return
    }
    
    try {
      const startDate = formData.startDate instanceof Date ? formData.startDate.toISOString().split('T')[0] : formData.startDate
      const endDate = formData.endDate instanceof Date ? formData.endDate.toISOString().split('T')[0] : formData.endDate
      
      // Calculate days
      const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
      
      await createLeaveRequest({
        employee_id: parseInt(formData.personnelId),
        leave_type: formData.leaveType as any,
        start_date: startDate,
        end_date: endDate,
        days_count: days,
        reason: formData.reason || undefined
      })
      showToast('درخواست مرخصی با موفقیت ثبت شد', 'success')
      setShowForm(false)
      setFormData({
        personnelId: '',
        leaveType: 'annual',
        startDate: null,
        endDate: null,
        reason: '',
        days: 0
      })
      await loadLeaves()
    } catch (error: any) {
      showToast('خطا در ثبت درخواست: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleApprove = async (leaveId: number) => {
    try {
      await updateLeaveRequest(leaveId, { status: 'approved' })
      showToast('مرخصی با موفقیت تایید شد', 'success')
      await loadLeaves()
    } catch (error: any) {
      showToast('خطا در تایید مرخصی: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleReject = async (leaveId: number) => {
    try {
      await updateLeaveRequest(leaveId, { status: 'rejected' })
      showToast('مرخصی رد شد', 'success')
      await loadLeaves()
    } catch (error: any) {
      showToast('خطا در رد مرخصی: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: any = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
    }
    return badges[status] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getStatusLabel = (status: string) => {
    const labels: any = {
      pending: 'در انتظار',
      approved: 'تایید شده',
      rejected: 'رد شده',
    }
    return labels[status] || status
  }

  const getLeaveTypeLabel = (type: string) => {
    const labels: any = {
      annual: 'استحقاقی',
      sick: 'استعلاجی',
      emergency: 'اضطراری',
      unpaid: 'بدون حقوق',
      hourly: 'ساعتی',
    }
    return labels[type] || type
  }

  return (
    <ProtectedRoute allowedRoles={['hr', 'admin', 'manager']}>
      <MainLayout>
        <div className="p-8">
          {/* Back Button */}
          <div className="mb-6">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
            >
              <ArrowRight size={18} />
              <span>بازگشت به داشبورد</span>
            </button>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <FileText className="text-blue-600" size={32} />
                مدیریت مرخصی
              </h1>
              <p className="text-gray-600">مدیریت درخواست‌های مرخصی کارمندان</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg flex items-center gap-2"
            >
              <Plus size={20} />
              درخواست مرخصی جدید
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="جستجو..."
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">همه وضعیت‌ها</option>
                <option value="pending">در انتظار</option>
                <option value="approved">تایید شده</option>
                <option value="rejected">رد شده</option>
              </select>
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.personnelId}
                onChange={(e) => setFilters({ ...filters, personnelId: e.target.value })}
              >
                <option value="">همه کارمندان</option>
                {personnel.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.leaveType}
                onChange={(e) => setFilters({ ...filters, leaveType: e.target.value })}
              >
                <option value="">همه انواع</option>
                <option value="annual">استحقاقی</option>
                <option value="sick">استعلاجی</option>
                <option value="emergency">اضطراری</option>
                <option value="unpaid">بدون حقوق</option>
              </select>
            </div>
          </div>

          {/* Leaves Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">در حال بارگذاری...</p>
              </div>
            ) : leaves.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FileText className="mx-auto text-gray-400 mb-4" size={48} />
                <p>هیچ درخواست مرخصی یافت نشد</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                    <tr>
                      <th className="text-right py-4 px-6 font-semibold">کارمند</th>
                      <th className="text-right py-4 px-6 font-semibold">نوع مرخصی</th>
                      <th className="text-right py-4 px-6 font-semibold">از تاریخ</th>
                      <th className="text-right py-4 px-6 font-semibold">تا تاریخ</th>
                      <th className="text-right py-4 px-6 font-semibold">تعداد روز</th>
                      <th className="text-right py-4 px-6 font-semibold">وضعیت</th>
                      <th className="text-right py-4 px-6 font-semibold">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((leave) => (
                      <tr key={leave.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-6 text-sm text-gray-700">{leave.employee_name || leave.employee?.first_name + ' ' + leave.employee?.last_name || '-'}</td>
                        <td className="py-4 px-6 text-sm text-gray-700">{getLeaveTypeLabel(leave.leave_type)}</td>
                        <td className="py-4 px-6 text-sm text-gray-600">
                          {leave.start_date ? toPersianDate(new Date(leave.start_date)) : '-'}
                        </td>
                        <td className="py-4 px-6 text-sm text-gray-600">
                          {leave.end_date ? toPersianDate(new Date(leave.end_date)) : '-'}
                        </td>
                        <td className="py-4 px-6 text-sm text-gray-900 font-medium">{leave.days_count || 0} روز</td>
                        <td className="py-4 px-6">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(leave.status)}`}>
                            {getStatusLabel(leave.status)}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {leave.status === 'pending' && (isManager || isAdmin) && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApprove(leave.id)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="تایید"
                              >
                                <Check size={18} />
                              </button>
                              <button
                                onClick={() => handleReject(leave.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="رد"
                              >
                                <X size={18} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">درخواست مرخصی جدید</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">کارمند *</label>
                    <select
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.personnelId}
                      onChange={(e) => setFormData({ ...formData, personnelId: e.target.value })}
                    >
                      <option value="">انتخاب کارمند</option>
                      {personnel.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">نوع مرخصی *</label>
                    <select
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.leaveType}
                      onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                    >
                      <option value="annual">استحقاقی</option>
                      <option value="sick">استعلاجی</option>
                      <option value="emergency">اضطراری</option>
                      <option value="unpaid">بدون حقوق</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">از تاریخ *</label>
                      <PersianDatePicker
                        value={formData.startDate}
                        onChange={(date) => setFormData({ ...formData, startDate: date })}
                        placeholder="انتخاب تاریخ شروع"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">تا تاریخ *</label>
                      <PersianDatePicker
                        value={formData.endDate}
                        onChange={(date) => setFormData({ ...formData, endDate: date })}
                        placeholder="انتخاب تاریخ پایان"
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">دلیل (اختیاری)</label>
                    <textarea
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={4}
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      placeholder="توضیحات..."
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                      ثبت درخواست
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false)
                        setFormData({
                          personnelId: '',
                          leaveType: 'annual',
                          startDate: null,
                          endDate: null,
                          reason: '',
                          days: 0
                        })
                      }}
                      className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                    >
                      لغو
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </MainLayout>
    </ProtectedRoute>
  )
}

