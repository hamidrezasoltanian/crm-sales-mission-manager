'use client'

import { useState, useEffect } from 'react'
import { 
  getWorkspaces, 
  createWorkspace, 
  updateWorkspace, 
  deleteWorkspace, 
  setDefaultWorkspace 
} from '../lib/api'
import { Plus, Edit2, Trash2, Star, StarOff, X } from 'lucide-react'

interface Workspace {
  id: number
  personnelId: number
  name: string
  description?: string
  color: string
  icon: string
  isDefault: boolean
  isActive: boolean
  settings: any
  createdAt: string
  updatedAt: string
}

export default function WorkspaceManager() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    icon: '📋'
  })

  const icons = ['📋', '📊', '📈', '📉', '🎯', '✅', '📝', '💼', '🏢', '🚀', '⭐', '🔥']

  useEffect(() => {
    loadWorkspaces()
  }, [])

  const loadWorkspaces = async () => {
    try {
      setLoading(true)
      const response = await getWorkspaces()
      setWorkspaces(response.workspaces || [])
    } catch (error) {
      console.error('Error loading workspaces:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      await createWorkspace(formData)
      setShowCreateModal(false)
      setFormData({ name: '', description: '', color: '#3B82F6', icon: '📋' })
      await loadWorkspaces()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در ایجاد workspace')
    }
  }

  const handleEdit = (workspace: Workspace) => {
    setEditingWorkspace(workspace)
    setFormData({
      name: workspace.name,
      description: workspace.description || '',
      color: workspace.color,
      icon: workspace.icon
    })
    setShowEditModal(true)
  }

  const handleUpdate = async () => {
    if (!editingWorkspace) return
    
    try {
      await updateWorkspace(editingWorkspace.id.toString(), formData)
      setShowEditModal(false)
      setEditingWorkspace(null)
      setFormData({ name: '', description: '', color: '#3B82F6', icon: '📋' })
      await loadWorkspaces()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در ویرایش workspace')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('آیا از حذف این workspace اطمینان دارید؟')) return
    
    try {
      await deleteWorkspace(id.toString())
      await loadWorkspaces()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در حذف workspace')
    }
  }

  const handleSetDefault = async (id: number) => {
    try {
      await setDefaultWorkspace(id.toString())
      await loadWorkspaces()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در تنظیم workspace پیش‌فرض')
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">در حال بارگذاری...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">مدیریت Workspace ها</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          ایجاد Workspace جدید
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workspaces.map((workspace) => (
          <div
            key={workspace.id}
            className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
            style={{ borderLeftColor: workspace.color, borderLeftWidth: '4px' }}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{workspace.icon}</span>
                <h3 className="font-semibold text-lg">{workspace.name}</h3>
                {workspace.isDefault && (
                  <Star size={18} className="text-yellow-500 fill-yellow-500" />
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(workspace)}
                  className="p-1 hover:bg-gray-100 rounded"
                  title="ویرایش"
                >
                  <Edit2 size={16} />
                </button>
                {!workspace.isDefault && (
                  <>
                    <button
                      onClick={() => handleSetDefault(workspace.id)}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="تنظیم به عنوان پیش‌فرض"
                    >
                      <StarOff size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(workspace.id)}
                      className="p-1 hover:bg-red-100 rounded text-red-600"
                      title="حذف"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
            {workspace.description && (
              <p className="text-gray-600 text-sm mb-2">{workspace.description}</p>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: workspace.color }}
              />
              <span>رنگ: {workspace.color}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.location.href = `/workspaces/${workspace.id}`
              }}
              className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              باز کردن Workspace
            </button>
          </div>
        ))}
      </div>

      {workspaces.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          هیچ workspace ای ایجاد نشده است. برای شروع، یک workspace جدید ایجاد کنید.
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">ایجاد Workspace جدید</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">نام</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="مثال: پروژه فروش"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">توضیحات</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  placeholder="توضیحات اختیاری..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">آیکون</label>
                <div className="flex gap-2 flex-wrap">
                  {icons.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setFormData({ ...formData, icon })}
                      className={`p-2 border rounded text-2xl ${
                        formData.icon === icon ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">رنگ</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full h-10 border rounded"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  ایجاد
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

      {/* Edit Modal */}
      {showEditModal && editingWorkspace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">ویرایش Workspace</h3>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingWorkspace(null)
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">نام</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">توضیحات</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">آیکون</label>
                <div className="flex gap-2 flex-wrap">
                  {icons.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setFormData({ ...formData, icon })}
                      className={`p-2 border rounded text-2xl ${
                        formData.icon === icon ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">رنگ</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full h-10 border rounded"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  ذخیره
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingWorkspace(null)
                  }}
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

