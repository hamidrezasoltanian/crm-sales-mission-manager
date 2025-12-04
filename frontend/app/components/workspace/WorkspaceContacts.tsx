'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getContacts, deleteContact } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { Search, Plus, Edit, Trash2 } from 'lucide-react'
import { toPersianDate } from '../../lib/dateUtils'
import { showToast } from '../Toast'

interface WorkspaceContactsProps {
  workspaceId: string
  workspace: any
}

export default function WorkspaceContacts({ workspaceId, workspace }: WorkspaceContactsProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    contactType: ''
  })

  useEffect(() => {
    loadContacts()
  }, [workspaceId, filters])

  const loadContacts = async () => {
    try {
      setLoading(true)
      const workspaceFilters = workspace.filters?.contacts || {}
      const response = await getContacts({
        ...workspaceFilters,
        ...filters,
        personnelId: workspaceFilters.personnelId || user?.id
      })
      setContacts(response.contacts || [])
    } catch (error) {
      console.error('Error loading contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('آیا از حذف این تماس اطمینان دارید؟')) return
    
    try {
      await deleteContact(id.toString())
      showToast('تماس با موفقیت حذف شد', 'success')
      await loadContacts()
    } catch (error: any) {
      showToast(error.response?.data?.error || 'خطا در حذف تماس', 'error')
    }
  }

  if (loading) {
    return <div className="text-center py-8">در حال بارگذاری...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">تماس‌ها</h3>
        <button
          onClick={() => router.push('/my-dashboard/contacts/new')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Plus size={18} />
          ثبت تماس جدید
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">جستجو</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="جستجو در تماس‌ها..."
                className="w-full border rounded px-3 py-2 pr-10"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">نوع تماس</label>
            <select
              value={filters.contactType}
              onChange={(e) => setFilters({ ...filters, contactType: e.target.value })}
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

      {/* Contacts List */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-sm font-medium">مرکز</th>
                <th className="px-4 py-3 text-right text-sm font-medium">نوع تماس</th>
                <th className="px-4 py-3 text-right text-sm font-medium">تاریخ</th>
                <th className="px-4 py-3 text-right text-sm font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{contact.centerName || 'نامشخص'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">
                      {contact.contactType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {contact.createdAt ? toPersianDate(new Date(contact.createdAt)) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/contacts?id=${contact.id}`)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
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
        {contacts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            هیچ تماسی یافت نشد
          </div>
        )}
      </div>
    </div>
  )
}

