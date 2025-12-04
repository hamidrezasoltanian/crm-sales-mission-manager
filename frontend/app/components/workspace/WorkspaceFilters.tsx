'use client'

import { useState, useEffect } from 'react'
import { updateWorkspaceFilters } from '../../lib/api'
import { Save } from 'lucide-react'

interface WorkspaceFiltersProps {
  workspaceId: string
  workspace: any
  onUpdate: () => void
}

export default function WorkspaceFilters({ workspaceId, workspace, onUpdate }: WorkspaceFiltersProps) {
  const [filters, setFilters] = useState(workspace.filters || {
    assignments: {},
    contacts: {},
    centers: {}
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    try {
      setSaving(true)
      await updateWorkspaceFilters(workspaceId, filters)
      onUpdate()
      alert('فیلترها با موفقیت ذخیره شدند')
    } catch (error: any) {
      alert(error.response?.data?.error || 'خطا در ذخیره فیلترها')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-semibold mb-4">فیلترهای ماموریت‌ها</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">وضعیت</label>
            <select
              value={filters.assignments?.status || ''}
              onChange={(e) => setFilters({
                ...filters,
                assignments: { ...filters.assignments, status: e.target.value || undefined }
              })}
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

      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-semibold mb-4">فیلترهای تماس‌ها</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">نوع تماس</label>
            <select
              value={filters.contacts?.contactType || ''}
              onChange={(e) => setFilters({
                ...filters,
                contacts: { ...filters.contacts, contactType: e.target.value || undefined }
              })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">همه</option>
              <option value="call">تماس تلفنی</option>
              <option value="visit">بازدید</option>
              <option value="email">ایمیل</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-semibold mb-4">فیلترهای مراکز</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">نوع مرکز</label>
            <select
              value={filters.centers?.type || ''}
              onChange={(e) => setFilters({
                ...filters,
                centers: { ...filters.centers, type: e.target.value || undefined }
              })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">همه</option>
              <option value="pharmacy">داروخانه</option>
              <option value="clinic">کلینیک</option>
              <option value="hospital">بیمارستان</option>
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        <Save size={18} />
        ذخیره فیلترها
      </button>
    </div>
  )
}

