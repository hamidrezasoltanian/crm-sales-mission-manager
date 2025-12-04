'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import MainLayout from '../../components/MainLayout'
import ProtectedRoute from '../../components/ProtectedRoute'
import { useAuth } from '../../contexts/AuthContext'
import { 
  Target, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  TrendingUp,
  Users,
  AlertCircle,
  BarChart3
} from 'lucide-react'
import { getReportsSummary, getAssignments, getPersonnel } from '../../lib/api'
import { showToast } from '../../components/Toast'
import LoadingSpinner from '../../components/LoadingSpinner'
import Link from 'next/link'

export default function ManagerDashboard() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState({
    totalMissions: 0,
    pendingMissions: 0,
    completedMissions: 0,
    inProgressMissions: 0,
    totalCost: 0,
    teamSize: 0,
    approvalRate: 0
  })
  const [loading, setLoading] = useState(true)
  const [recentPending, setRecentPending] = useState<any[]>([])
  const [teamPerformance, setTeamPerformance] = useState<any[]>([])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
      return
    }

    if (user && !['manager', 'admin', 'super_admin'].includes(user.role)) {
      router.push('/')
      return
    }

    loadDashboardData()
  }, [user, authLoading, router])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // Load missions summary
      const summary = await getReportsSummary()
      const assignments = await getAssignments()
      const personnel = await getPersonnel()

      const pendingMissions = assignments.filter((a: any) => a.status === 'pending')
      const completedMissions = assignments.filter((a: any) => a.status === 'completed')
      const inProgressMissions = assignments.filter((a: any) => a.status === 'in_progress')

      // Calculate approval rate
      const totalProcessed = completedMissions.length + assignments.filter((a: any) => a.status === 'rejected').length
      const approvalRate = totalProcessed > 0 
        ? Math.round((completedMissions.length / totalProcessed) * 100) 
        : 0

      // Get team size (active staff)
      const teamSize = personnel.filter((p: any) => p.isActive && ['staff', 'expert'].includes(p.role)).length

      setStats({
        totalMissions: assignments.length,
        pendingMissions: pendingMissions.length,
        completedMissions: completedMissions.length,
        inProgressMissions: inProgressMissions.length,
        totalCost: summary?.costs?.totalCost || 0,
        teamSize,
        approvalRate
      })

      // Recent pending missions (last 10)
      const recent = pendingMissions
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
      
      setRecentPending(recent)

      // Team performance (top 5 by completed missions)
      const teamStats = personnel
        .filter((p: any) => p.isActive && ['staff', 'expert'].includes(p.role))
        .map((p: any) => {
          const userMissions = assignments.filter((a: any) => a.personnelId === p.id)
          return {
            id: p.id,
            name: p.name,
            total: userMissions.length,
            completed: userMissions.filter((a: any) => a.status === 'completed').length,
            pending: userMissions.filter((a: any) => a.status === 'pending').length
          }
        })
        .sort((a: any, b: any) => b.completed - a.completed)
        .slice(0, 5)

      setTeamPerformance(teamStats)
    } catch (error: any) {
      console.error('Error loading manager dashboard:', error)
      showToast('خطا در بارگذاری اطلاعات', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <ProtectedRoute allowedRoles={['manager', 'admin', 'super_admin']}>
        <MainLayout>
          <LoadingSpinner fullScreen />
        </MainLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['manager', 'admin', 'super_admin']}>
      <MainLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">داشبورد مدیریت میانی</h1>
              <p className="text-gray-600 mt-1">خوش آمدید {user?.name}</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/inbox"
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
              >
                <AlertCircle className="w-5 h-5" />
                کارتابل تایید ({stats.pendingMissions})
              </Link>
              <Link
                href="/reports"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <BarChart3 className="w-5 h-5" />
                گزارش‌ها
              </Link>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pending Missions */}
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

            {/* Total Missions */}
            <div className="bg-white rounded-lg shadow-md p-6 border-r-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-1">کل ماموریت‌ها</p>
                  <p className="text-3xl font-bold text-gray-800">{stats.totalMissions}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <Target className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <span className="text-green-600 font-semibold">{stats.completedMissions} تکمیل</span>
                <span className="text-blue-600 font-semibold">{stats.inProgressMissions} در حال انجام</span>
              </div>
            </div>

            {/* Team Size */}
            <div className="bg-white rounded-lg shadow-md p-6 border-r-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-1">تعداد تیم</p>
                  <p className="text-3xl font-bold text-gray-800">{stats.teamSize}</p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <Users className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4" />
                <span>کاربران فعال</span>
              </div>
            </div>

            {/* Approval Rate */}
            <div className="bg-white rounded-lg shadow-md p-6 border-r-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-1">نرخ تایید</p>
                  <p className="text-3xl font-bold text-gray-800">{stats.approvalRate}%</p>
                </div>
                <div className="bg-purple-100 p-3 rounded-full">
                  <TrendingUp className="w-8 h-8 text-purple-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                <BarChart3 className="w-4 h-4" />
                <span>ماموریت‌های تایید شده</span>
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Pending Missions */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-orange-500" />
                  ماموریت‌های در انتظار تایید
                </h2>
                <Link
                  href="/inbox"
                  className="text-blue-600 hover:text-blue-700 font-semibold text-sm"
                >
                  مشاهده همه →
                </Link>
              </div>
              {recentPending.length > 0 ? (
                <div className="space-y-3">
                  {recentPending.slice(0, 5).map((mission: any) => (
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
                            بررسی →
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>ماموریتی در انتظار تایید نیست</p>
                </div>
              )}
            </div>

            {/* Team Performance */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-500" />
                عملکرد تیم
              </h2>
              {teamPerformance.length > 0 ? (
                <div className="space-y-3">
                  {teamPerformance.map((member: any, index: number) => (
                    <div
                      key={member.id}
                      className="p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                            {index + 1}
                          </div>
                          <p className="font-semibold text-gray-800">{member.name}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-green-600">{member.completed} تکمیل</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>کل: {member.total}</span>
                        {member.pending > 0 && (
                          <span className="text-orange-600">در انتظار: {member.pending}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>اطلاعاتی موجود نیست</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">دسترسی سریع</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/inbox"
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all flex items-center gap-3"
              >
                <AlertCircle className="w-6 h-6 text-orange-600" />
                <div>
                  <p className="font-semibold text-gray-800">کارتابل تایید</p>
                  <p className="text-sm text-gray-600">بررسی و تایید ماموریت‌ها</p>
                </div>
              </Link>

              <Link
                href="/reports"
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center gap-3"
              >
                <BarChart3 className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="font-semibold text-gray-800">گزارش‌ها و آنالیز</p>
                  <p className="text-sm text-gray-600">مشاهده گزارش‌های عملکرد</p>
                </div>
              </Link>

              <Link
                href="/assignments"
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all flex items-center gap-3"
              >
                <Target className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-gray-800">مدیریت ماموریت‌ها</p>
                  <p className="text-sm text-gray-600">مشاهده و مدیریت همه ماموریت‌ها</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  )
}
