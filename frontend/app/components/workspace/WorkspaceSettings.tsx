'use client'

import { useState } from 'react'
import { updateWorkspaceViewSettings } from '../../lib/api'
import { Save } from 'lucide-react'

interface WorkspaceSettingsProps {
  workspaceId: string
  workspace: any
  onUpdate: () => void
}

export default function WorkspaceSettings({ workspaceId, workspace, onUpdate }: WorkspaceSettingsProps) {
  const [viewSettings, setViewSettings] = useState(workspace.viewSettings || {
    assignmentsView: 'list',
    assignmentsColumns: ['id', 'centerName', 'status', 'createdAt'],
    assignmentsSortBy: 'createdAt',
    assignmentsSortOrder: 'desc'
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    try {
      setSaving(true)
      await updateWorkspaceViewSettings(workspaceId, viewSettings)
      onUpdate()
      alert('تنظیمات نمایش با موفقیت ذخیره شدند')
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در ذخیره تنظیمات')
    } finally {
      setSaving(false)
    }
  }

  const availableColumns = [
    { id: 'id', label: 'شناسه' },
    { id: 'centerName', label: 'نام مرکز' },
    { id: 'status', label: 'وضعیت' },
    { id: 'personnelName', label: 'کارمند' },
    { id: 'managerName', label: 'مدیر' },
    { id: 'createdAt', label: 'تاریخ ایجاد' },
    { id: 'updatedAt', label: 'تاریخ به‌روزرسانی' }
  ]

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-semibold mb-4">تنظیمات نمایش ماموریت‌ها</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">نوع نمایش</label>
            <select
              value={viewSettings.assignmentsView}
              onChange={(e) => setViewSettings({
                ...viewSettings,
                assignmentsView: e.target.value
              })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="list">لیست</option>
              <option value="card">کارت</option>
              <option value="table">جدول</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">ستون‌های قابل نمایش</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {availableColumns.map((col) => (
                <label key={col.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={viewSettings.assignmentsColumns?.includes(col.id)}
                    onChange={(e) => {
                      const columns = viewSettings.assignmentsColumns || []
                      if (e.target.checked) {
                        setViewSettings({
                          ...viewSettings,
                          assignmentsColumns: [...columns, col.id]
                        })
                      } else {
                        setViewSettings({
                          ...viewSettings,
                          assignmentsColumns: columns.filter((c: string) => c !== col.id)
                        })
                      }
                    }}
                  />
                  <span className="text-sm">{col.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">مرتب‌سازی بر اساس</label>
              <select
                value={viewSettings.assignmentsSortBy}
                onChange={(e) => setViewSettings({
                  ...viewSettings,
                  assignmentsSortBy: e.target.value
                })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="createdAt">تاریخ ایجاد</option>
                <option value="updatedAt">تاریخ به‌روزرسانی</option>
                <option value="status">وضعیت</option>
                <option value="centerName">نام مرکز</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ترتیب</label>
              <select
                value={viewSettings.assignmentsSortOrder}
                onChange={(e) => setViewSettings({
                  ...viewSettings,
                  assignmentsSortOrder: e.target.value
                })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="desc">نزولی</option>
                <option value="asc">صعودی</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        <Save size={18} />
        ذخیره تنظیمات
      </button>
    </div>
  )
}

