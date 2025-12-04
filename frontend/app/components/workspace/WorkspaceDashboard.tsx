'use client'

import { useState, useEffect } from 'react'
import { getWorkspaceDashboard } from '../../lib/api'
import { Target, Phone, MapPin, TrendingUp, AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react'

interface WorkspaceDashboardProps {
  workspaceId: string
  workspace: any
}

export default function WorkspaceDashboard({ workspaceId, workspace }: WorkspaceDashboardProps) {
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [workspaceId])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const response = await getWorkspaceDashboard(workspaceId)
      setDashboard(response)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">در حال بارگذاری...</div>
  }

  if (!dashboard) {
    return <div className="text-center py-8 text-red-600">خطا در بارگذاری داشبورد</div>
  }

  const { stats, recent } = dashboard

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ماموریت‌های در انتظار</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.assignments.pending}</p>
            </div>
            <Clock className="text-yellow-600" size={32} />
          </div>
        </div>
        
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ماموریت‌های تایید شده</p>
              <p className="text-2xl font-bold text-blue-600">{stats.assignments.approved}</p>
            </div>
            <CheckCircle2 className="text-blue-600" size={32} />
          </div>
        </div>
        
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ماموریت‌های در حال انجام</p>
              <p className="text-2xl font-bold text-purple-600">{stats.assignments.inProgress}</p>
            </div>
            <TrendingUp className="text-purple-600" size={32} />
          </div>
        </div>
        
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ماموریت‌های تکمیل شده</p>
              <p className="text-2xl font-bold text-green-600">{stats.assignments.completed}</p>
            </div>
            <CheckCircle2 className="text-green-600" size={32} />
          </div>
        </div>
      </div>

      {/* Recent Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Assignments */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Target size={18} />
            آخرین ماموریت‌ها
          </h3>
          <div className="space-y-2">
            {recent.assignments?.length > 0 ? (
              recent.assignments.slice(0, 5).map((assignment: any) => (
                <div key={assignment.id} className="border-b pb-2 last:border-0">
                  <p className="font-medium text-sm">#{assignment.id} - {assignment.centerName}</p>
                  <p className="text-xs text-gray-600">{assignment.status}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">هیچ ماموریتی وجود ندارد</p>
            )}
          </div>
        </div>

        {/* Recent Contacts */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Phone size={18} />
            آخرین تماس‌ها
          </h3>
          <div className="space-y-2">
            {recent.contacts?.length > 0 ? (
              recent.contacts.slice(0, 5).map((contact: any) => (
                <div key={contact.id} className="border-b pb-2 last:border-0">
                  <p className="font-medium text-sm">{contact.centerName}</p>
                  <p className="text-xs text-gray-600">{contact.contactType}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">هیچ تماسی وجود ندارد</p>
            )}
          </div>
        </div>

        {/* Recent Centers */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <MapPin size={18} />
            آخرین مراکز
          </h3>
          <div className="space-y-2">
            {recent.centers?.length > 0 ? (
              recent.centers.slice(0, 5).map((center: any) => (
                <div key={center.id} className="border-b pb-2 last:border-0">
                  <p className="font-medium text-sm">{center.name}</p>
                  <p className="text-xs text-gray-600">{center.city}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">هیچ مرکزی وجود ندارد</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

