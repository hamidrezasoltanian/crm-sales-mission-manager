'use client'

import { useState, useEffect } from 'react'
import { getWorkspaceGoals, createWorkspaceGoal, updateWorkspaceGoal, deleteWorkspaceGoal, toggleCompleteWorkspaceGoal, updateWorkspaceGoalProgress } from '../../lib/api'
import { Plus, Target, CheckCircle2, XCircle, Edit2, Trash2, X, TrendingUp } from 'lucide-react'

interface WorkspaceGoalsProps {
  workspaceId: string
  workspace: any
}

export default function WorkspaceGoals({ workspaceId, workspace }: WorkspaceGoalsProps) {
  const [goals, setGoals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<any>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    targetValue: 0,
    unit: 'عدد',
    deadline: ''
  })

  useEffect(() => {
    loadGoals()
  }, [workspaceId])

  const loadGoals = async () => {
    try {
      setLoading(true)
      const response = await getWorkspaceGoals(workspaceId)
      setGoals(response.goals || [])
    } catch (error) {
      console.error('Error loading goals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      await createWorkspaceGoal(workspaceId, formData)
      setShowCreateModal(false)
      setFormData({ title: '', description: '', targetValue: 0, unit: 'عدد', deadline: '' })
      await loadGoals()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در ایجاد هدف')
    }
  }

  const handleEdit = (goal: any) => {
    setEditingGoal(goal)
    setFormData({
      title: goal.title,
      description: goal.description || '',
      targetValue: goal.targetValue || 0,
      unit: goal.unit || 'عدد',
      deadline: goal.deadline || ''
    })
    setShowCreateModal(true)
  }

  const handleUpdate = async () => {
    if (!editingGoal) return
    
    try {
      await updateWorkspaceGoal(workspaceId, editingGoal.id.toString(), formData)
      setShowCreateModal(false)
      setEditingGoal(null)
      setFormData({ title: '', description: '', targetValue: 0, unit: 'عدد', deadline: '' })
      await loadGoals()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در ویرایش هدف')
    }
  }

  const handleDelete = async (goalId: number) => {
    if (!confirm('آیا از حذف این هدف اطمینان دارید؟')) return
    
    try {
      await deleteWorkspaceGoal(workspaceId, goalId.toString())
      await loadGoals()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در حذف هدف')
    }
  }

  const handleToggleComplete = async (goalId: number) => {
    try {
      await toggleCompleteWorkspaceGoal(workspaceId, goalId.toString())
      await loadGoals()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در تغییر وضعیت هدف')
    }
  }

  const handleUpdateProgress = async (goalId: number, currentValue: number) => {
    try {
      await updateWorkspaceGoalProgress(workspaceId, goalId.toString(), currentValue)
      await loadGoals()
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در به‌روزرسانی پیشرفت')
    }
  }

  if (loading) {
    return <div className="text-center py-8">در حال بارگذاری...</div>
  }

  const activeGoals = goals.filter(g => !g.isCompleted)
  const completedGoals = goals.filter(g => g.isCompleted)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">اهداف و KPI</h3>
        <button
          onClick={() => {
            setEditingGoal(null)
            setFormData({ title: '', description: '', targetValue: 0, unit: 'عدد', deadline: '' })
            setShowCreateModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} />
          ایجاد هدف جدید
        </button>
      </div>

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-2">اهداف فعال</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeGoals.map((goal) => (
              <div
                key={goal.id}
                className="border rounded-lg p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h5 className="font-semibold flex items-center gap-2">
                      <Target size={18} className="text-blue-600" />
                      {goal.title}
                    </h5>
                    {goal.description && (
                      <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleToggleComplete(goal.id)}
                      className="p-1 hover:bg-green-100 rounded text-green-600"
                      title="تکمیل"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(goal)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="p-1 hover:bg-red-100 rounded text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{goal.currentValue} / {goal.targetValue} {goal.unit}</span>
                    <span>{goal.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, goal.progress)}%` }}
                    />
                  </div>
                </div>
                
                {goal.deadline && (
                  <p className="text-xs text-gray-500 mt-2">
                    مهلت: {new Date(goal.deadline).toLocaleDateString('fa-IR')}
                  </p>
                )}
                
                <div className="mt-3">
                  <input
                    type="number"
                    placeholder="به‌روزرسانی پیشرفت"
                    className="w-full border rounded px-2 py-1 text-sm"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const value = parseFloat((e.target as HTMLInputElement).value)
                        if (!isNaN(value)) {
                          handleUpdateProgress(goal.id, value)
                          ;(e.target as HTMLInputElement).value = ''
                        }
                      }
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-2">اهداف تکمیل شده</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedGoals.map((goal) => (
              <div
                key={goal.id}
                className="border rounded-lg p-4 bg-green-50 opacity-75"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h5 className="font-semibold flex items-center gap-2 line-through">
                      <CheckCircle2 size={18} className="text-green-600" />
                      {goal.title}
                    </h5>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleToggleComplete(goal.id)}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="بازگشت به فعال"
                    >
                      <XCircle size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="p-1 hover:bg-red-100 rounded text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-sm text-green-600">✓ تکمیل شده</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {goals.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          هیچ هدفی ایجاد نشده است
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {editingGoal ? 'ویرایش هدف' : 'ایجاد هدف جدید'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setEditingGoal(null)
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
                <label className="block text-sm font-medium mb-1">توضیحات</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">هدف</label>
                  <input
                    type="number"
                    value={formData.targetValue}
                    onChange={(e) => setFormData({ ...formData, targetValue: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">واحد</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="عدد"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">مهلت</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={editingGoal ? handleUpdate : handleCreate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingGoal ? 'ذخیره' : 'ایجاد'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingGoal(null)
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

