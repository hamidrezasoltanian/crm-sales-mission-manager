'use client'

import { useState, useEffect } from 'react'
import { getWorkspaceNotes, createWorkspaceNote, updateWorkspaceNote, deleteWorkspaceNote, togglePinWorkspaceNote } from '../../lib/api'
import { Plus, Pin, PinOff, Edit2, Trash2, X } from 'lucide-react'

interface WorkspaceNotesProps {
  workspaceId: string
  workspace: any
}

export default function WorkspaceNotes({ workspaceId, workspace }: WorkspaceNotesProps) {
  const [notes, setNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingNote, setEditingNote] = useState<any>(null)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: []
  })

  useEffect(() => {
    loadNotes()
  }, [workspaceId])

  const loadNotes = async () => {
    try {
      setLoading(true)
      const response = await getWorkspaceNotes(workspaceId)
      setNotes(response.notes || [])
    } catch (error) {
      console.error('Error loading notes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      await createWorkspaceNote(workspaceId, formData)
      setShowCreateModal(false)
      setFormData({ title: '', content: '', tags: [] })
      await loadNotes()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در ایجاد یادداشت')
    }
  }

  const handleEdit = (note: any) => {
    setEditingNote(note)
    setFormData({
      title: note.title,
      content: note.content || '',
      tags: note.tags || []
    })
    setShowCreateModal(true)
  }

  const handleUpdate = async () => {
    if (!editingNote) return
    
    try {
      await updateWorkspaceNote(workspaceId, editingNote.id.toString(), formData)
      setShowCreateModal(false)
      setEditingNote(null)
      setFormData({ title: '', content: '', tags: [] })
      await loadNotes()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در ویرایش یادداشت')
    }
  }

  const handleDelete = async (noteId: number) => {
    if (!confirm('آیا از حذف این یادداشت اطمینان دارید؟')) return
    
    try {
      await deleteWorkspaceNote(workspaceId, noteId.toString())
      await loadNotes()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در حذف یادداشت')
    }
  }

  const handleTogglePin = async (noteId: number) => {
    try {
      await togglePinWorkspaceNote(workspaceId, noteId.toString())
      await loadNotes()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در تغییر وضعیت یادداشت')
    }
  }

  if (loading) {
    return <div className="text-center py-8">در حال بارگذاری...</div>
  }

  const pinnedNotes = notes.filter(n => n.isPinned)
  const unpinnedNotes = notes.filter(n => !n.isPinned)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">یادداشت‌ها</h3>
        <button
          onClick={() => {
            setEditingNote(null)
            setFormData({ title: '', content: '', tags: [] })
            setShowCreateModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} />
          ایجاد یادداشت جدید
        </button>
      </div>

      {/* Pinned Notes */}
      {pinnedNotes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-2">یادداشت‌های مهم</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinnedNotes.map((note) => (
              <div
                key={note.id}
                className="border rounded-lg p-4 bg-yellow-50"
              >
                <div className="flex justify-between items-start mb-2">
                  <h5 className="font-semibold">{note.title}</h5>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleTogglePin(note.id)}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="لغو پین"
                    >
                      <PinOff size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(note)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="p-1 hover:bg-red-100 rounded text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {note.content && (
                  <p className="text-sm text-gray-600">{note.content}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unpinned Notes */}
      <div>
        {pinnedNotes.length > 0 && (
          <h4 className="text-sm font-medium text-gray-600 mb-2">سایر یادداشت‌ها</h4>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {unpinnedNotes.map((note) => (
            <div
              key={note.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-2">
                <h5 className="font-semibold">{note.title}</h5>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleTogglePin(note.id)}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="پین کردن"
                  >
                    <Pin size={16} />
                  </button>
                  <button
                    onClick={() => handleEdit(note)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="p-1 hover:bg-red-100 rounded text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {note.content && (
                <p className="text-sm text-gray-600 line-clamp-3">{note.content}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {notes.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          هیچ یادداشتی ایجاد نشده است
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {editingNote ? 'ویرایش یادداشت' : 'ایجاد یادداشت جدید'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setEditingNote(null)
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">عنوان</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">محتوا</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={10}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={editingNote ? handleUpdate : handleCreate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingNote ? 'ذخیره' : 'ایجاد'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingNote(null)
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

