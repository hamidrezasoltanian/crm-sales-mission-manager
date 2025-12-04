'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getActivityLogs } from '../lib/api'
import ProtectedRoute from '../components/ProtectedRoute'
import MainLayout from '../components/MainLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import { Clock, User, Activity, Filter } from 'lucide-react'

interface ActivityLog {
  id: number
  userId: number
  action: string
  resourceType?: string
  resourceId?: number
  details?: any
  ipAddress?: string
  userAgent?: string
  createdAt: string
  user?: {
    id: number
    name: string
    role: string
  }
}

export default function ActivityLogsPage() {
  const { user, isAdmin, isManager } = useAuth()
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    action: '',
    userId: ''
  })

  useEffect(() => {
    loadLogs()
  }, [filter])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const data = await getActivityLogs({
        ...filter,
        userId: filter.userId ? Number(filter.userId) : undefined
      })
      setLogs(data.logs || [])
    } catch (error: any) {
      console.error('Error loading activity logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'login': 'ورود به سیستم',
      'telegram_login': 'ورود با Telegram',
      'logout': 'خروج از سیستم',
      'create_mission': 'ایجاد ماموریت',
      'update_mission': 'به‌روزرسانی ماموریت',
      'delete_mission': 'حذف ماموریت',
      'create_contact': 'ایجاد تماس',
      'update_profile': 'به‌روزرسانی پروفایل',
      'change_password': 'تغییر رمز عبور'
    }
    return labels[action] || action
  }

  const getActionColor = (action: string) => {
    if (action.includes('login')) return 'bg-green-100 text-green-800'
    if (action.includes('create')) return 'bg-blue-100 text-blue-800'
    if (action.includes('update')) return 'bg-yellow-100 text-yellow-800'
    if (action.includes('delete')) return 'bg-red-100 text-red-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <ProtectedRoute allowedRoles={isAdmin || isManager ? ['admin', 'manager'] : undefined}>
      <MainLayout>
        <div className="p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
              <Activity className="w-8 h-8 text-blue-600" />
              لاگ فعالیت‌های کاربران
            </h1>
            <p className="text-gray-600">تاریخچه تمام فعالیت‌های انجام شده در سیستم</p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="flex items-center gap-4">
              <Filter className="w-5 h-5 text-gray-500" />
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    نوع فعالیت
                  </label>
                  <select
                    value={filter.action}
                    onChange={(e) => setFilter({ ...filter, action: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">همه</option>
                    <option value="login">ورود</option>
                    <option value="telegram_login">ورود با Telegram</option>
                    <option value="create_mission">ایجاد ماموریت</option>
                    <option value="update_mission">به‌روزرسانی ماموریت</option>
                    <option value="create_contact">ایجاد تماس</option>
                    <option value="update_profile">به‌روزرسانی پروفایل</option>
                  </select>
                </div>
                {isAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      کاربر
                    </label>
                    <input
                      type="text"
                      value={filter.userId}
                      onChange={(e) => setFilter({ ...filter, userId: e.target.value })}
                      placeholder="شناسه کاربر"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Logs Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner fullScreen={false} />
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <p className="text-gray-500">هیچ لاگی یافت نشد</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-right">زمان</th>
                    <th className="px-4 py-3 text-right">کاربر</th>
                    <th className="px-4 py-3 text-right">فعالیت</th>
                    <th className="px-4 py-3 text-right">جزئیات</th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-right">IP Address</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>{new Date(log.createdAt).toLocaleString('fa-IR')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span>{log.user?.name || `کاربر #${log.userId}`}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-sm ${getActionColor(log.action)}`}>
                          {getActionLabel(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {log.details ? (
                          <details className="cursor-pointer">
                            <summary className="text-blue-600 hover:underline">
                              مشاهده جزئیات
                            </summary>
                            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          '-'
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {log.ipAddress || '-'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </MainLayout>
    </ProtectedRoute>
  )
}

