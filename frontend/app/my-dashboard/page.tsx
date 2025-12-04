'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAssignments, getContacts, getReportsSummary } from '../lib/api'
import ProtectedRoute from '../components/ProtectedRoute'
import EmployeeLayout from '../components/EmployeeLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import { showToast } from '../components/Toast'
import { 
  Target, 
  CheckCircle, 
  Clock, 
  DollarSign,
  Phone,
  TrendingUp,
  Plus,
  ArrowRight
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toPersianDate } from '../lib/dateUtils'
import Link from 'next/link'

export default function EmployeeDashboard() {
  const { user, isManager } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    pendingMissions: 0,
    approvedMissions: 0,
    totalMissions: 0,
    totalContacts: 0,
    totalCost: 0
  })
  const [recentMissions, setRecentMissions] = useState<any[]>([])
  const [recentContacts, setRecentContacts] = useState<any[]>([])

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user])

  const loadDashboardData = async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      // Load assignments for this user
      const assignmentsResponse = await getAssignments({ personnelId: user.id })
      const assignments = Array.isArray(assignmentsResponse) 
        ? assignmentsResponse 
        : (assignmentsResponse?.data || [])
      
      // Load contacts for this user
      const contactsResponse = await getContacts({ personnelId: user.id })
      const contacts = Array.isArray(contactsResponse) 
        ? contactsResponse 
        : (contactsResponse?.data || [])
      
      // Calculate stats
      const pendingMissions = assignments.filter((a: any) => a.status === 'pending').length
      const approvedMissions = assignments.filter((a: any) => a.status === 'approved' || a.status === 'completed').length
      const totalCost = assignments.reduce((sum: number, a: any) => sum + (parseFloat(a.totalCost) || 0), 0)
      
      // Get current month data
      const now = new Date()
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const currentMonthMissions = assignments.filter((a: any) => {
        const missionDate = new Date(a.createdAt)
        return missionDate >= currentMonthStart
      })
      const currentMonthContacts = contacts.filter((c: any) => {
        const contactDate = new Date(c.createdAt)
        return contactDate >= currentMonthStart
      })
      
      setStats({
        pendingMissions,
        approvedMissions,
        totalMissions: currentMonthMissions.length,
        totalContacts: currentMonthContacts.length,
        totalCost: currentMonthMissions.reduce((sum: number, a: any) => sum + (parseFloat(a.totalCost) || 0), 0)
      })
      
      // Get recent missions (last 5)
      const sortedMissions = [...assignments].sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setRecentMissions(sortedMissions.slice(0, 5))
      
      // Get recent contacts (last 5)
      const sortedContacts = [...contacts].sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setRecentContacts(sortedContacts.slice(0, 5))
      
    } catch (error: any) {
      console.error('Error loading dashboard data:', error)
      showToast('خطا در بارگذاری داده‌ها', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: any = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-blue-100 text-blue-800 border-blue-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
    }
    return badges[status] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

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

  const getContactTypeLabel = (type: string) => {
    return type === 'province' ? 'استان' : 'تهران'
  }

  return (
    <ProtectedRoute>
      <EmployeeLayout>
        <div className="p-4 md:p-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner fullScreen={false} />
              <span className="mr-3 text-gray-600">در حال بارگذاری داشبورد...</span>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-8">
                {isManager && (
                  <div className="mb-4">
                    <Link
                      href="/assignments"
                      className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <ArrowRight size={18} />
                      <span>بازگشت به داشبورد اصلی ماموریت</span>
                    </Link>
                  </div>
                )}
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                  داشبورد من
                </h1>
                <p className="text-gray-600">
                  خوش آمدید {user?.name} 👋
                </p>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Link
                  href="/my-dashboard/missions/new"
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-xl font-bold mb-2">ثبت ماموریت جدید</h3>
                    <p className="text-blue-100 text-sm">ثبت ماموریت حضوری</p>
                  </div>
                  <Plus size={32} className="opacity-80" />
                </Link>
                <Link
                  href="/my-dashboard/contacts/new"
                  className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-xl font-bold mb-2">ثبت تماس استان</h3>
                    <p className="text-purple-100 text-sm">ثبت تماس با مراکز استان</p>
                  </div>
                  <Phone size={32} className="opacity-80" />
                </Link>
                <Link
                  href="/my-dashboard/contacts/new/tehran"
                  className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-xl font-bold mb-2">ثبت تماس تهران</h3>
                    <p className="text-indigo-100 text-sm">ثبت تماس با مراکز تهران</p>
                  </div>
                  <Phone size={32} className="opacity-80" />
                </Link>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm mb-1">در انتظار تایید</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.pendingMissions}</p>
                    </div>
                    <Clock className="text-yellow-500" size={32} />
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm mb-1">تایید شده</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.approvedMissions}</p>
                    </div>
                    <CheckCircle className="text-blue-500" size={32} />
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm mb-1">ماموریت‌های این ماه</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.totalMissions}</p>
                    </div>
                    <Target className="text-green-500" size={32} />
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm mb-1">تماس‌های این ماه</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.totalContacts}</p>
                    </div>
                    <Phone className="text-purple-500" size={32} />
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-indigo-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm mb-1">هزینه این ماه</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {stats.totalCost.toLocaleString('fa-IR')}
                      </p>
                      <p className="text-xs text-gray-500">تومان</p>
                    </div>
                    <DollarSign className="text-indigo-500" size={32} />
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Missions */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">آخرین ماموریت‌ها</h2>
                    <Link
                      href="/my-dashboard/missions"
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                    >
                      مشاهده همه
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                  {recentMissions.length > 0 ? (
                    <div className="space-y-3">
                      {recentMissions.map((mission) => (
                        <div
                          key={mission.id}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 mb-1">
                                {mission.centerName}
                              </h3>
                              <p className="text-sm text-gray-600 mb-2">
                                {toPersianDate(mission.createdAt)}
                              </p>
                              <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusBadge(mission.status)}`}>
                                {getStatusLabel(mission.status)}
                              </span>
                            </div>
                            {mission.totalCost && (
                              <div className="text-left">
                                <p className="text-sm font-semibold text-gray-900">
                                  {parseFloat(mission.totalCost).toLocaleString('fa-IR')}
                                </p>
                                <p className="text-xs text-gray-500">تومان</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">هیچ ماموریتی ثبت نشده است</p>
                  )}
                </div>

                {/* Recent Contacts */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">آخرین تماس‌ها</h2>
                    <Link
                      href="/my-dashboard/contacts"
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                    >
                      مشاهده همه
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                  {recentContacts.length > 0 ? (
                    <div className="space-y-3">
                      {recentContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 mb-1">
                                {contact.centerName}
                              </h3>
                              <p className="text-sm text-gray-600 mb-2">
                                {toPersianDate(contact.createdAt)}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  contact.contactType === 'province' 
                                    ? 'bg-purple-100 text-purple-800' 
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {getContactTypeLabel(contact.contactType)}
                                </span>
                                {contact.tags && Array.isArray(contact.tags) && contact.tags.length > 0 && (
                                  <span className="text-xs text-gray-600">
                                    {contact.tags.join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">هیچ تماسی ثبت نشده است</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </EmployeeLayout>
    </ProtectedRoute>
  )
}

