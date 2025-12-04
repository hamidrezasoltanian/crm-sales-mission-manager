'use client'

import { useState, useEffect } from 'react'
import { getWorkspaceTags, createWorkspaceTag, deleteWorkspaceTag } from '../../lib/api'
import { Plus, Edit2, Trash2, X } from 'lucide-react'

interface WorkspaceTagsProps {
  workspaceId: string
  workspace: any
}

export default function WorkspaceTags({ workspaceId, workspace }: WorkspaceTagsProps) {
  const [tags, setTags] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    color: '#3B82F6',
    category: ''
  })

  useEffect(() => {
    loadTags()
  }, [workspaceId])

  const loadTags = async () => {
    try {
      setLoading(true)
      const response = await getWorkspaceTags(workspaceId)
      setTags(response.tags || [])
    } catch (error) {
      console.error('Error loading tags:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      await createWorkspaceTag(workspaceId, formData)
      setShowCreateModal(false)
      setFormData({ name: '', color: '#3B82F6', category: '' })
      await loadTags()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در ایجاد برچسب')
    }
  }

  const handleDelete = async (tagId: number) => {
    if (!confirm('آیا از حذف این برچسب اطمینان دارید؟')) return
    
    try {
      await deleteWorkspaceTag(workspaceId, tagId.toString())
      await loadTags()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در حذف برچسب')
    }
  }

  if (loading) {
    return <div className="text-center py-8">در حال بارگذاری...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">برچسب‌ها</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} />
          ایجاد برچسب جدید
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tags.map((tag) => (
          <div
            key={tag.id}
            className="border rounded-lg p-4 flex items-center justify-between"
            style={{ borderLeftColor: tag.color, borderLeftWidth: '4px' }}
          >
            <div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="font-medium">{tag.name}</span>
              </div>
              {tag.category && (
                <p className="text-sm text-gray-600 mt-1">{tag.category}</p>
              )}
            </div>
            <button
              onClick={() => handleDelete(tag.id)}
              className="p-1 hover:bg-red-100 rounded text-red-600"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {tags.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          هیچ برچسبی ایجاد نشده است
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">ایجاد برچسب جدید</h3>
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
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">دسته‌بندی</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="اختیاری"
                />
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
    </div>
  )
}

