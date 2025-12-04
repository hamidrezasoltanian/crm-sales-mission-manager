'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import ProtectedRoute from '../../components/ProtectedRoute'
import EmployeeLayout from '../../components/EmployeeLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import { showToast } from '../../components/Toast'
import { getAssignments, getContacts, getReportsSummary } from '../../lib/api'
import { toPersianDate, toPersianMonth } from '../../lib/dateUtils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Calendar, TrendingUp, Target, Phone, DollarSign } from 'lucide-react'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function MyReportsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'custom'>('month')
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null)
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null)
  const [stats, setStats] = useState<any>({
    missions: { total: 0, byStatus: {} },
    contacts: { total: 0, byType: {} },
    costs: { total: 0 }
  })

  useEffect(() => {
    if (user?.id) {
      loadReports()
    }
  }, [user, timeRange, customStartDate, customEndDate])

  const loadReports = async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      // Load assignments
      const assignmentsResponse = await getAssignments({ personnelId: user.id })
      const assignments = Array.isArray(assignmentsResponse) 
        ? assignmentsResponse 
        : (assignmentsResponse?.data || [])
      
      // Load contacts
      const contactsResponse = await getContacts({ personnelId: user.id })
      const contacts = Array.isArray(contactsResponse) 
        ? contactsResponse 
        : (contactsResponse?.data || [])
      
      // Filter by time range
      const now = new Date()
      let startDate: Date
      
      if (timeRange === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      } else if (timeRange === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      } else {
        startDate = customStartDate || new Date(0)
      }
      
      const endDate = timeRange === 'custom' ? (customEndDate || now) : now
      
      const filteredAssignments = assignments.filter((a: any) => {
        const date = new Date(a.createdAt)
        return date >= startDate && date <= endDate
      })
      
      const filteredContacts = contacts.filter((c: any) => {
        const date = new Date(c.createdAt)
        return date >= startDate && date <= endDate
      })
      
      // Calculate stats
      const missionsByStatus: any = {}
      filteredAssignments.forEach((a: any) => {
        missionsByStatus[a.status] = (missionsByStatus[a.status] || 0) + 1
      })
      
      const contactsByType: any = {}
      filteredContacts.forEach((c: any) => {
        contactsByType[c.contactType] = (contactsByType[c.contactType] || 0) + 1
      })
      
      const totalCost = filteredAssignments.reduce((sum: number, a: any) => 
        sum + (parseFloat(a.totalCost) || 0), 0
      )
      
      setStats({
        missions: {
          total: filteredAssignments.length,
          byStatus: missionsByStatus
        },
        contacts: {
          total: filteredContacts.length,
          byType: contactsByType
        },
        costs: {
          total: totalCost
        }
      })
    } catch (error: any) {
      console.error('Error loading reports:', error)
      showToast('خطا در بارگذاری گزارش‌ها', 'error')
    } finally {
      setLoading(false)
    }
  }

  const missionStatusData = Object.entries(stats.missions.byStatus).map(([status, count]) => ({
    name: getStatusLabel(status),
    value: count
  }))

  const contactTypeData = Object.entries(stats.contacts.byType).map(([type, count]) => ({
    name: type === 'province' ? 'استان' : 'تهران',
    value: count
  }))

  const getStatusLabel = (status: string) => {
    const labels: any = {
      pending: 'در انتظار',
      approved: 'تایید شده',
      completed: 'تکمیل شده',
      rejected: 'رد شده',
      cancelled: 'لغو شده',
    }
    return labels[status] || status
  }

  return (
    <ProtectedRoute>
      <EmployeeLayout>
        <div className="p-4 md:p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              گزارش‌های من
            </h1>
            <p className="text-gray-600">
              مشاهده آمار و گزارش‌های فعالیت‌های شما
            </p>
          </div>

          {/* Time Range Selector */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="text-gray-500" size={20} />
              <h3 className="text-lg font-semibold text-gray-900">انتخاب بازه زمانی</h3>
            </div>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => setTimeRange('week')}
                className={`px-6 py-2 rounded-lg transition-colors ${
                  timeRange === 'week'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                هفته گذشته
              </button>
              <button
                onClick={() => setTimeRange('month')}
                className={`px-6 py-2 rounded-lg transition-colors ${
                  timeRange === 'month'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                این ماه
              </button>
              <button
                onClick={() => setTimeRange('custom')}
                className={`px-6 py-2 rounded-lg transition-colors ${
                  timeRange === 'custom'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                بازه سفارشی
              </button>
            </div>
            {timeRange === 'custom' && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">از تاریخ</label>
                  <input
                    type="date"
                    value={customStartDate ? customStartDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => setCustomStartDate(e.target.value ? new Date(e.target.value) : null)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">تا تاریخ</label>
                  <input
                    type="date"
                    value={customEndDate ? customEndDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => setCustomEndDate(e.target.value ? new Date(e.target.value) : null)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <LoadingSpinner fullScreen={false} />
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm mb-1">ماموریت‌ها</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.missions.total}</p>
                    </div>
                    <Target className="text-blue-500" size={32} />
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm mb-1">تماس‌ها</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.contacts.total}</p>
                    </div>
                    <Phone className="text-purple-500" size={32} />
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm mb-1">هزینه کل</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {stats.costs.total.toLocaleString('fa-IR')}
                      </p>
                      <p className="text-xs text-gray-500">تومان</p>
                    </div>
                    <DollarSign className="text-green-500" size={32} />
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Missions by Status */}
                {missionStatusData.length > 0 && (
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">ماموریت‌ها بر اساس وضعیت</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={missionStatusData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {missionStatusData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => value.toLocaleString('fa-IR')} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Contacts by Type */}
                {contactTypeData.length > 0 && (
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">تماس‌ها بر اساس نوع</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={contactTypeData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} />
                          <YAxis axisLine={false} tickLine={false} />
                          <Tooltip formatter={(value: number) => value.toLocaleString('fa-IR')} />
                          <Legend />
                          <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

              {/* Empty State */}
              {stats.missions.total === 0 && stats.contacts.total === 0 && (
                <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                  <p className="text-gray-500 text-lg">
                    در بازه زمانی انتخابی فعالیتی ثبت نشده است
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </EmployeeLayout>
    </ProtectedRoute>
  )
}

