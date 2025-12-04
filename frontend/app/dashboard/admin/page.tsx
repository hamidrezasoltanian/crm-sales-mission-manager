'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import MainLayout from '../../components/MainLayout'
import ProtectedRoute from '../../components/ProtectedRoute'
import { useAuth } from '../../contexts/AuthContext'
import { 
  Users, 
  Target, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  TrendingUp,
  Settings,
  Activity,
  Shield,
  AlertCircle
} from 'lucide-react'
import { getPersonnel, getReportsSummary, getAssignments } from '../../lib/api'
import { showToast } from '../../components/Toast'
import LoadingSpinner from '../../components/LoadingSpinner'
import Link from 'next/link'

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    totalMissions: 0,
    pendingMissions: 0,
    completedMissions: 0,
    totalCost: 0,
    monthlyGrowth: 0
  })
  const [loading, setLoading] = useState(true)
  const [recentActivity, setRecentActivity] = useState<any[]>([])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
      return
    }

    if (user && !['admin', 'super_admin'].includes(user.role)) {
      router.push('/')
      return
    }

    loadDashboardData()
  }, [user, authLoading, router])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // Load personnel data
      const personnel = await getPersonnel()
      const activeUsers = personnel.filter((p: any) => p.isActive).length
      const pendingUsers = personnel.filter((p: any) => !p.isActive).length

      // Load missions summary
      const summary = await getReportsSummary()
      const assignments = await getAssignments()

      const pendingMissions = assignments.filter((a: any) => a.status === 'pending').length
      const completedMissions = assignments.filter((a: any) => a.status === 'completed').length

      setStats({
        totalUsers: personnel.length,
        activeUsers,
        pendingUsers,
        totalMissions: assignments.length,
        pendingMissions,
        completedMissions,
        totalCost: summary?.costs?.totalCost || 0,
        monthlyGrowth: 0 // TODO: Calculate from historical data
      })

      // Load recent activity (last 10 pending missions)
      const recentPending = assignments
        .filter((a: any) => a.status === 'pending')
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
      
      setRecentActivity(recentPending)
    } catch (error: any) {
      console.error('Error loading admin dashboard:', error)
      showToast('خطا در بارگذاری اطلاعات', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
        <MainLayout>
          <LoadingSpinner fullScreen />
        </MainLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
      <MainLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">داشبورد مدیریت</h1>
              <p className="text-gray-600 mt-1">خوش آمدید {user?.name}</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/personnel"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Users className="w-5 h-5" />
                مدیریت کاربران
              </Link>
              <Link
                href="/settings"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <Settings className="w-5 h-5" />
                تنظیمات
              </Link>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Users */}
            <div className="bg-white rounded-lg shadow-md p-6 border-r-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-1">کل کاربران</p>
                  <p className="text-3xl font-bold text-gray-800">{stats.totalUsers}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <span className="text-green-600 font-semibold">{stats.activeUsers} فعال</span>
                {stats.pendingUsers > 0 && (
                  <span className="text-orange-600 font-semibold">{stats.pendingUsers} در انتظار</span>
                )}
              </div>
            </div>

            {/* Total Missions */}
            <div className="bg-white rounded-lg shadow-md p-6 border-r-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-1">کل ماموریت‌ها</p>
                  <p className="text-3xl font-bold text-gray-800">{stats.totalMissions}</p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <Target className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <span className="text-green-600 font-semibold">{stats.completedMissions} تکمیل شده</span>
                {stats.pendingMissions > 0 && (
                  <span className="text-orange-600 font-semibold">{stats.pendingMissions} در انتظار</span>
                )}
              </div>
            </div>

            {/* Total Cost */}
            <div className="bg-white rounded-lg shadow-md p-6 border-r-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-1">هزینه کل</p>
                  <p className="text-3xl font-bold text-gray-800">
                    {stats.totalCost.toLocaleString('fa-IR')} تومان
                  </p>
                </div>
                <div className="bg-purple-100 p-3 rounded-full">
                  <DollarSign className="w-8 h-8 text-purple-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                <TrendingUp className="w-4 h-4" />
                <span>این ماه</span>
              </div>
            </div>

            {/* Pending Approvals */}
            <div className="bg-white rounded-lg shadow-md p-6 border-r-4 border-orange-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-1">در انتظار تایید</p>
                  <p className="text-3xl font-bold text-gray-800">{stats.pendingMissions}</p>
                </div>
                <div className="bg-orange-100 p-3 rounded-full">
                  <Clock className="w-8 h-8 text-orange-600" />
                </div>
              </div>
              <div className="mt-4">
                <Link
                  href="/inbox"
                  className="text-sm text-orange-600 hover:text-orange-700 font-semibold"
                >
                  مشاهده کارتابل →
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">دسترسی سریع</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/personnel"
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center gap-3"
              >
                <Users className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="font-semibold text-gray-800">مدیریت کاربران</p>
                  <p className="text-sm text-gray-600">افزودن، ویرایش و مدیریت کاربران</p>
                </div>
              </Link>

              <Link
                href="/activity"
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all flex items-center gap-3"
              >
                <Activity className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-gray-800">لاگ فعالیت‌ها</p>
                  <p className="text-sm text-gray-600">مشاهده فعالیت‌های سیستم</p>
                </div>
              </Link>

              <Link
                href="/settings"
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all flex items-center gap-3"
              >
                <Settings className="w-6 h-6 text-purple-600" />
                <div>
                  <p className="font-semibold text-gray-800">تنظیمات سیستم</p>
                  <p className="text-sm text-gray-600">تنظیمات و پیکربندی سیستم</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Pending Missions */}
          {stats.pendingMissions > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-orange-500" />
                  ماموریت‌های در انتظار تایید
                </h2>
                <Link
                  href="/inbox"
                  className="text-blue-600 hover:text-blue-700 font-semibold"
                >
                  مشاهده همه →
                </Link>
              </div>
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((mission: any) => (
                  <div
                    key={mission.id}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-800">{mission.personnelName || 'نامشخص'}</p>
                        <p className="text-sm text-gray-600">{mission.centerName || 'مرکز نامشخص'}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-sm text-gray-600">
                          {new Date(mission.createdAt).toLocaleDateString('fa-IR')}
                        </p>
                        <Link
                          href={`/assignments?id=${mission.id}`}
                          className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
                        >
                          مشاهده جزئیات →
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Status */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">وضعیت سیستم</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-800">سیستم فعال</span>
                </div>
                <p className="text-sm text-green-700">همه سرویس‌ها در حال اجرا هستند</p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-blue-800">امنیت</span>
                </div>
                <p className="text-sm text-blue-700">سیستم امنیتی فعال است</p>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold text-purple-800">فعالیت</span>
                </div>
                <p className="text-sm text-purple-700">{stats.activeUsers} کاربر فعال</p>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  )
}
