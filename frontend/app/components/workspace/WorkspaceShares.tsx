'use client'

import { useState, useEffect } from 'react'
import { getWorkspaceShares, createWorkspaceShare, deleteWorkspaceShare, updateWorkspaceShare } from '../../lib/api'
import { getPersonnel } from '../../lib/api'
import { Plus, User, Trash2, X, Shield, Edit } from 'lucide-react'

interface WorkspaceSharesProps {
  workspaceId: string
  workspace: any
}

export default function WorkspaceShares({ workspaceId, workspace }: WorkspaceSharesProps) {
  const [shares, setShares] = useState<any[]>([])
  const [personnel, setPersonnel] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    sharedWithPersonnelId: '',
    permission: 'read'
  })

  useEffect(() => {
    loadShares()
    loadPersonnel()
  }, [workspaceId])

  const loadShares = async () => {
    try {
      setLoading(true)
      const response = await getWorkspaceShares(workspaceId)
      setShares(response.shares || [])
    } catch (error) {
      console.error('Error loading shares:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPersonnel = async () => {
    try {
      const response = await getPersonnel()
      setPersonnel(response || [])
    } catch (error) {
      console.error('Error loading personnel:', error)
    }
  }

  const handleCreate = async () => {
    try {
      await createWorkspaceShare(workspaceId, {
        sharedWithPersonnelId: parseInt(formData.sharedWithPersonnelId),
        permission: formData.permission as 'read' | 'write' | 'admin'
      })
      setShowCreateModal(false)
      setFormData({ sharedWithPersonnelId: '', permission: 'read' })
      await loadShares()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در اشتراک‌گذاری')
    }
  }

  const handleDelete = async (shareId: number) => {
    if (!confirm('آیا از حذف این اشتراک‌گذاری اطمینان دارید؟')) return
    
    try {
      await deleteWorkspaceShare(workspaceId, shareId.toString())
      await loadShares()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در حذف اشتراک‌گذاری')
    }
  }

  const handleUpdatePermission = async (shareId: number, permission: string) => {
    try {
      await updateWorkspaceShare(workspaceId, shareId.toString(), { permission })
      await loadShares()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در تغییر دسترسی')
    }
  }

  if (loading) {
    return <div className="text-center py-8">در حال بارگذاری...</div>
  }

  const permissionLabels: { [key: string]: string } = {
    read: 'خواندن',
    write: 'نوشتن',
    admin: 'مدیریت'
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">اشتراک‌گذاری</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} />
          اشتراک‌گذاری با کارمند
        </button>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <div className="space-y-3">
          {shares.map((share) => {
            const person = personnel.find(p => p.id === share.sharedWithPersonnelId)
            return (
              <div
                key={share.id}
                className="flex items-center justify-between border-b pb-3 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <User size={20} className="text-gray-400" />
                  <div>
                    <p className="font-medium">{person?.name || `کارمند #${share.sharedWithPersonnelId}`}</p>
                    <p className="text-sm text-gray-600">{person?.phone || ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={share.permission}
                    onChange={(e) => handleUpdatePermission(share.id, e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="read">خواندن</option>
                    <option value="write">نوشتن</option>
                    <option value="admin">مدیریت</option>
                  </select>
                  <button
                    onClick={() => handleDelete(share.id)}
                    className="p-1 hover:bg-red-100 rounded text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        
        {shares.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            این workspace با کسی اشتراک گذاشته نشده است
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">اشتراک‌گذاری با کارمند</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">کارمند</label>
                <select
                  value={formData.sharedWithPersonnelId}
                  onChange={(e) => setFormData({ ...formData, sharedWithPersonnelId: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">انتخاب کنید...</option>
                  {personnel
                    .filter(p => p.id !== workspace.personnelId)
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name} ({person.phone})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">سطح دسترسی</label>
                <select
                  value={formData.permission}
                  onChange={(e) => setFormData({ ...formData, permission: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="read">خواندن - فقط مشاهده</option>
                  <option value="write">نوشتن - مشاهده و ویرایش</option>
                  <option value="admin">مدیریت - دسترسی کامل</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  اشتراک‌گذاری
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

