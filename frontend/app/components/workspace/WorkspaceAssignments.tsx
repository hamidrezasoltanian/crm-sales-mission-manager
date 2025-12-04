'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAssignments, deleteAssignment, approveAssignment } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { Search, Filter, Plus, Edit, Trash2, Check, X } from 'lucide-react'
import { toPersianDate } from '../../lib/dateUtils'
import { showToast } from '../Toast'

interface WorkspaceAssignmentsProps {
  workspaceId: string
  workspace: any
}

export default function WorkspaceAssignments({ workspaceId, workspace }: WorkspaceAssignmentsProps) {
  const router = useRouter()
  const { user, isManager } = useAuth()
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    centerId: ''
  })

  useEffect(() => {
    loadAssignments()
  }, [workspaceId, filters])

  const loadAssignments = async () => {
    try {
      setLoading(true)
      const workspaceFilters = workspace.filters?.assignments || {}
      const response = await getAssignments({
        ...workspaceFilters,
        ...filters,
        personnelId: workspaceFilters.personnelId || user?.id
      })
      setAssignments(response.assignments || [])
    } catch (error) {
      console.error('Error loading assignments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('آیا از حذف این ماموریت اطمینان دارید؟')) return
    
    try {
      await deleteAssignment(id.toString())
      showToast('ماموریت با موفقیت حذف شد', 'success')
      await loadAssignments()
    } catch (error: any) {
      showToast(error.response?.data?.error || 'خطا در حذف ماموریت', 'error')
    }
  }

  if (loading) {
    return <div className="text-center py-8">در حال بارگذاری...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">ماموریت‌ها</h3>
        <button
          onClick={() => router.push('/my-dashboard/missions/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} />
          ثبت ماموریت جدید
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">جستجو</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="جستجو در ماموریت‌ها..."
                className="w-full border rounded px-3 py-2 pr-10"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">وضعیت</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">همه</option>
              <option value="pending">در انتظار</option>
              <option value="approved">تایید شده</option>
              <option value="in-progress">در حال انجام</option>
              <option value="completed">تکمیل شده</option>
            </select>
          </div>
        </div>
      </div>

      {/* Assignments List */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-sm font-medium">شناسه</th>
                <th className="px-4 py-3 text-right text-sm font-medium">مرکز</th>
                <th className="px-4 py-3 text-right text-sm font-medium">وضعیت</th>
                <th className="px-4 py-3 text-right text-sm font-medium">تاریخ</th>
                <th className="px-4 py-3 text-right text-sm font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {assignments.map((assignment) => (
                <tr key={assignment.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">#{assignment.id}</td>
                  <td className="px-4 py-3 text-sm">{assignment.centerName || 'نامشخص'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded ${
                      assignment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      assignment.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                      assignment.status === 'completed' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {assignment.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {assignment.createdAt ? toPersianDate(new Date(assignment.createdAt)) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/assignments?id=${assignment.id}`)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit size={16} />
                      </button>
                      {isManager && assignment.status === 'pending' && (
                        <button
                          onClick={async () => {
                            try {
                              await approveAssignment(assignment.id.toString(), user?.id || 0)
                              showToast('ماموریت تایید شد', 'success')
                              await loadAssignments()
                            } catch (error: any) {
                              showToast(error.response?.data?.error || 'خطا در تایید ماموریت', 'error')
                            }
                          }}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(assignment.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {assignments.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            هیچ ماموریتی یافت نشد
          </div>
        )}
      </div>
    </div>
  )
}

