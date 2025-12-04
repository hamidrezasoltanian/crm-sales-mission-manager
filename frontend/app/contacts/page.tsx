'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getContacts, getPersonnel, getCenters, deleteContact, updateContact } from '../lib/api'
import { Search, Filter, Plus, Edit, Trash2, Phone, Calendar, BarChart3, ArrowRight } from 'lucide-react'
import { toPersianDate } from '../lib/dateUtils'
import ProtectedRoute from '../components/ProtectedRoute'
import MainLayout from '../components/MainLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import { showToast } from '../components/Toast'
import { useAuth } from '../contexts/AuthContext'
import PersianDatePicker from '../components/PersianDatePicker'

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([])
  const [personnel, setPersonnel] = useState<any[]>([])
  const [centers, setCenters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    contactType: '',
    personnelId: '',
    centerId: '',
  })
  const [selectedContact, setSelectedContact] = useState<any>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    notes: '',
    tags: [] as string[]
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [stats, setStats] = useState({
    total: 0,
    province: 0,
    tehran: 0
  })
  const { user } = useAuth()

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadContacts()
  }, [filters, currentPage])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters.search, filters.contactType, filters.personnelId, filters.centerId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [contactsResponse, personnelData, centersResponse] = await Promise.all([
        getContacts().catch(err => {
          console.error('[Contacts] Error loading contacts:', err)
          return { data: [], pagination: {} }
        }),
        getPersonnel().catch(err => {
          console.error('[Contacts] Error loading personnel:', err)
          return []
        }),
        getCenters().catch(err => {
          console.error('[Contacts] Error loading centers:', err)
          return { data: [], pagination: {} }
        })
      ])
      
      // Handle paginated response - extract data array
      const contactsData = Array.isArray(contactsResponse) 
        ? contactsResponse 
        : (contactsResponse?.data || [])
      const centersData = Array.isArray(centersResponse) 
        ? centersResponse 
        : (centersResponse?.data || [])
      
      setContacts(Array.isArray(contactsData) ? contactsData : [])
      setPersonnel(personnelData || [])
      setCenters(Array.isArray(centersData) ? centersData : [])
    } catch (error) {
      console.error('[Contacts] Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadContacts = async () => {
    try {
      setLoading(true)
      const response = await getContacts({
        contactType: filters.contactType || undefined,
        personnelId: filters.personnelId || undefined,
        centerId: filters.centerId || undefined,
        search: filters.search || undefined,
        page: currentPage,
        limit: 20
      })
      
      // Handle paginated response - extract data array
      const data = Array.isArray(response) 
        ? response 
        : (response?.data || [])
      
      setContacts(Array.isArray(data) ? data : [])
      
      // Update pagination info
      if (response?.pagination) {
        setTotalPages(Math.ceil(response.pagination.total / (response.pagination.limit || 20)))
      }
      
      // Calculate stats from current page data (for display)
      // Note: For accurate stats, we should fetch all contacts or have a stats endpoint
      const provinceCount = data.filter((c: any) => c.contactType === 'province').length
      const tehranCount = data.filter((c: any) => c.contactType === 'tehran').length
      
      // If we have pagination info, use it for total
      if (response?.pagination?.total) {
        setStats({
          total: response.pagination.total,
          province: provinceCount, // This is only for current page
          tehran: tehranCount // This is only for current page
        })
      } else {
        // Fallback: calculate from current data
        setStats({
          total: data.length,
          province: provinceCount,
          tehran: tehranCount
        })
      }
    } catch (error) {
      console.error('Error loading contacts:', error)
      showToast('خطا در بارگذاری تماس‌ها', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedContact) return
    try {
      await deleteContact(selectedContact.id.toString())
      showToast('تماس با موفقیت حذف شد', 'success')
      await loadContacts()
      setShowDeleteModal(false)
      setSelectedContact(null)
    } catch (error: any) {
      showToast('خطا در حذف تماس: ' + (error.response?.data?.error || error.message), 'error')
    }
  }

  const handleEdit = (contact: any) => {
    setSelectedContact(contact)
    const tags = contact.tags ? (Array.isArray(contact.tags) ? contact.tags : [contact.tags]) : []
    setEditForm({
      notes: contact.notes || '',
      tags: tags
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedContact) return
    try {
      await updateContact(selectedContact.id.toString(), {
        notes: editForm.notes || null,
        tags: editForm.tags.length > 0 ? editForm.tags : null
      })
      showToast('تماس با موفقیت ویرایش شد', 'success')
      await loadContacts()
      setShowEditModal(false)
      setSelectedContact(null)
      setEditForm({ notes: '', tags: [] })
    } catch (error: any) {
      showToast('خطا در ویرایش تماس: ' + (error.response?.data?.error || error.message), 'error')
    }
  }

  const getContactTypeLabel = (type: string) => {
    const labels: any = {
      province: 'استان',
      tehran: 'تهران',
    }
    return labels[type] || type
  }

  const getContactTypeBadge = (type: string) => {
    const badges: any = {
      province: 'bg-purple-100 text-purple-800 border-purple-200',
      tehran: 'bg-blue-100 text-blue-800 border-blue-200',
    }
    return badges[type] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getTagsLabel = (tags: any) => {
    if (!tags || (Array.isArray(tags) && tags.length === 0)) {
      return 'بدون برچسب'
    }
    const tagLabels: any = {
      'lead': 'سرنخ',
      'opportunity': 'فرصت',
      'customer': 'مشتری',
      'old_customer': 'قدیمی'
    }
    if (Array.isArray(tags)) {
      return tags.map((tag: string) => tagLabels[tag] || tag).join(', ')
    }
    return tagLabels[tags] || tags
  }

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="p-4 md:p-8">
          {/* Back Button */}
          <div className="mb-6">
            <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 transition-colors">
              <ArrowRight size={18} />
              <span>بازگشت به داشبورد</span>
            </Link>
          </div>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 md:mb-8 gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">گزارش تماس‌ها</h1>
              <p className="text-gray-600">مدیریت و گزارش تماس‌های استان و تهران</p>
            </div>
            {stats.total > 0 && (
              <div className="flex gap-3 flex-wrap">
                <div className="bg-purple-100 text-purple-800 px-4 py-2 rounded-lg text-sm font-semibold">
                  کل: {stats.total}
                </div>
                <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg text-sm font-semibold">
                  تهران: {stats.tehran}
                </div>
                <div className="bg-indigo-100 text-indigo-800 px-4 py-2 rounded-lg text-sm font-semibold">
                  استان: {stats.province}
                </div>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="text-gray-500" size={20} />
              <h3 className="text-lg font-semibold text-gray-900">فیلترها</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="جستجو در نام مرکز، شهر، پرسنل یا یادداشت..."
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                value={filters.contactType}
                onChange={(e) => setFilters({ ...filters, contactType: e.target.value })}
              >
                <option value="">همه انواع تماس</option>
                <option value="province">تماس استان</option>
                <option value="tehran">تماس تهران</option>
              </select>
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                value={filters.personnelId}
                onChange={(e) => setFilters({ ...filters, personnelId: e.target.value })}
              >
                <option value="">همه پرسنل</option>
                {personnel.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                value={filters.centerId}
                onChange={(e) => setFilters({ ...filters, centerId: e.target.value })}
              >
                <option value="">همه مراکز</option>
                {Array.isArray(centers) && centers.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {(filters.search || filters.contactType || filters.personnelId || filters.centerId) && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setFilters({ search: '', contactType: '', personnelId: '', centerId: '' })}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  پاک کردن فیلترها
                </button>
              </div>
            )}
          </div>

          {/* Contacts Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
            <thead className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
              <tr>
                <th className="text-right py-4 px-6 font-semibold">شناسه</th>
                <th className="text-right py-4 px-6 font-semibold">نوع</th>
                <th className="text-right py-4 px-6 font-semibold">پرسنل</th>
                <th className="text-right py-4 px-6 font-semibold">مرکز</th>
                <th className="text-right py-4 px-6 font-semibold">یادداشت</th>
                <th className="text-right py-4 px-6 font-semibold">برچسب</th>
                <th className="text-right py-4 px-6 font-semibold">تاریخ ایجاد</th>
                <th className="text-right py-4 px-6 font-semibold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading && contacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <LoadingSpinner text="در حال بارگذاری تماس‌ها..." />
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    هیچ تماسی یافت نشد
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 text-sm font-medium text-gray-900">#{contact.id}</td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getContactTypeBadge(contact.contactType)}`}>
                        {getContactTypeLabel(contact.contactType)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-700">{contact.personnelName}</td>
                    <td className="py-4 px-6 text-sm text-gray-700">{contact.centerName}</td>
                    <td className="py-4 px-6 text-sm text-gray-600 max-w-xs">
                      <div className="truncate" title={contact.notes || ''}>
                        {contact.notes ? (contact.notes.length > 50 ? contact.notes.substring(0, 50) + '...' : contact.notes) : '-'}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {getTagsLabel(contact.tags)}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {toPersianDate(contact.createdAt)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(contact)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="ویرایش"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedContact(contact)
                            setShowDeleteModal(true)
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 md:px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              نمایش {((currentPage - 1) * 20) + 1} تا {Math.min(currentPage * 20, stats.total)} از {stats.total} تماس
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-sm"
              >
                ← قبلی
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-sm"
              >
                بعدی →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && selectedContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">ویرایش تماس #{selectedContact.id}</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نوع تماس
                </label>
                <div className="px-4 py-2 bg-gray-50 rounded-lg">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getContactTypeBadge(selectedContact.contactType)}`}>
                    {getContactTypeLabel(selectedContact.contactType)}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  پرسنل
                </label>
                <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-700">
                  {selectedContact.personnelName}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مرکز
                </label>
                <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-700">
                  {selectedContact.centerName}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  یادداشت
                </label>
                <textarea
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="یادداشت تماس..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  برچسب‌ها
                </label>
                <div className="flex flex-wrap gap-2">
                  {['lead', 'opportunity', 'customer', 'old_customer'].map((tag) => {
                    const tagLabels: any = {
                      'lead': 'سرنخ',
                      'opportunity': 'فرصت',
                      'customer': 'مشتری',
                      'old_customer': 'قدیمی'
                    }
                    const isSelected = editForm.tags.includes(tag)
                    return (
                      <button
                        key={tag}
                        onClick={() => {
                          if (isSelected) {
                            setEditForm({ ...editForm, tags: editForm.tags.filter(t => t !== tag) })
                          } else {
                            setEditForm({ ...editForm, tags: [...editForm.tags, tag] })
                          }
                        }}
                        className={`
                          px-4 py-2 rounded-lg text-sm font-medium transition-colors
                          ${isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }
                        `}
                      >
                        {tagLabels[tag]}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                ذخیره تغییرات
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedContact(null)
                  setEditForm({ notes: '', tags: [] })
                }}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                لغو
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">حذف تماس</h2>
            <p className="text-gray-600 mb-6">
              آیا مطمئن هستید که می‌خواهید تماس #{selectedContact.id} را حذف کنید؟
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setSelectedContact(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                لغو
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </MainLayout>
    </ProtectedRoute>
  )
}

