'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import ProtectedRoute from '../../components/ProtectedRoute'
import EmployeeLayout from '../../components/EmployeeLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import { showToast } from '../../components/Toast'
import { getContacts, deleteContact, updateContact } from '../../lib/api'
import { toPersianDate } from '../../lib/dateUtils'
import { Plus, Search, Filter, Edit, Trash2, Phone } from 'lucide-react'
import Link from 'next/link'

export default function MyContactsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [contacts, setContacts] = useState<any[]>([])
  const [filteredContacts, setFilteredContacts] = useState<any[]>([])
  const [filters, setFilters] = useState({
    search: '',
    contactType: '',
    tag: ''
  })
  const [selectedContact, setSelectedContact] = useState<any>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    notes: '',
    tags: [] as string[]
  })
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    if (user?.id) {
      loadContacts()
    }
  }, [user, currentPage])

  useEffect(() => {
    applyFilters()
  }, [filters, contacts])

  const loadContacts = async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      const response = await getContacts({ personnelId: user.id })
      const data = Array.isArray(response) 
        ? response 
        : (response?.data || [])
      
      // Sort by date (newest first)
      const sorted = [...data].sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      
      setContacts(sorted)
    } catch (error: any) {
      console.error('Error loading contacts:', error)
      showToast('خطا در بارگذاری تماس‌ها', 'error')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...contacts]

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter((contact: any) =>
        contact.centerName?.toLowerCase().includes(searchLower) ||
        contact.notes?.toLowerCase().includes(searchLower) ||
        contact.id?.toString().includes(searchLower)
      )
    }

    // Contact type filter
    if (filters.contactType) {
      filtered = filtered.filter((contact: any) => contact.contactType === filters.contactType)
    }

    // Tag filter
    if (filters.tag) {
      filtered = filtered.filter((contact: any) => {
        if (Array.isArray(contact.tags)) {
          return contact.tags.includes(filters.tag)
        }
        return contact.tags === filters.tag
      })
    }

    setFilteredContacts(filtered)
    setCurrentPage(1) // Reset to first page when filters change
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
    return type === 'province' ? 'استان' : 'تهران'
  }

  const getContactTypeBadge = (type: string) => {
    return type === 'province' 
      ? 'bg-purple-100 text-purple-800 border-purple-200'
      : 'bg-blue-100 text-blue-800 border-blue-200'
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

  const paginatedContacts = filteredContacts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage)

  return (
    <ProtectedRoute>
      <EmployeeLayout>
        <div className="p-4 md:p-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 md:mb-8 gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                تماس‌های من
              </h1>
              <p className="text-gray-600">
                مدیریت و مشاهده تماس‌های شما
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/my-dashboard/contacts/new"
                className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Plus size={20} />
                ثبت تماس استان
              </Link>
              <Link
                href="/my-dashboard/contacts/new/tehran"
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={20} />
                ثبت تماس تهران
              </Link>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="text-gray-500" size={20} />
              <h3 className="text-lg font-semibold text-gray-900">فیلترها</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="جستجو در نام مرکز یا یادداشت..."
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
                <option value="">همه انواع</option>
                <option value="province">تماس استان</option>
                <option value="tehran">تماس تهران</option>
              </select>
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                value={filters.tag}
                onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
              >
                <option value="">همه برچسب‌ها</option>
                <option value="lead">سرنخ</option>
                <option value="opportunity">فرصت</option>
                <option value="customer">مشتری</option>
                <option value="old_customer">قدیمی</option>
              </select>
            </div>
            {(filters.search || filters.contactType || filters.tag) && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setFilters({ search: '', contactType: '', tag: '' })}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  پاک کردن فیلترها
                </button>
              </div>
            )}
          </div>

          {/* Contacts List */}
          {loading ? (
            <LoadingSpinner fullScreen={false} />
          ) : paginatedContacts.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <p className="text-gray-500 text-lg mb-4">
                {filters.search || filters.contactType || filters.tag
                  ? 'تماسی با فیلترهای انتخابی یافت نشد'
                  : 'هیچ تماسی ثبت نشده است'
                }
              </p>
              {!filters.search && !filters.contactType && !filters.tag && (
                <div className="flex gap-2 justify-center">
                  <Link
                    href="/my-dashboard/contacts/new"
                    className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus size={20} />
                    ثبت تماس استان
                  </Link>
                  <Link
                    href="/my-dashboard/contacts/new/tehran"
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={20} />
                    ثبت تماس تهران
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
                      <tr>
                        <th className="text-right py-4 px-6 font-semibold">شناسه</th>
                        <th className="text-right py-4 px-6 font-semibold">نوع</th>
                        <th className="text-right py-4 px-6 font-semibold">مرکز</th>
                        <th className="text-right py-4 px-6 font-semibold">یادداشت</th>
                        <th className="text-right py-4 px-6 font-semibold">برچسب</th>
                        <th className="text-right py-4 px-6 font-semibold">تاریخ</th>
                        <th className="text-right py-4 px-6 font-semibold">عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedContacts.map((contact) => (
                        <tr key={contact.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-6 text-sm font-medium text-gray-900">#{contact.id}</td>
                          <td className="py-4 px-6">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getContactTypeBadge(contact.contactType)}`}>
                              {getContactTypeLabel(contact.contactType)}
                            </span>
                          </td>
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
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-4 md:px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-600">
                      نمایش {((currentPage - 1) * itemsPerPage) + 1} تا {Math.min(currentPage * itemsPerPage, filteredContacts.length)} از {filteredContacts.length} تماس
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
            </>
          )}

          {/* Edit Modal */}
          {showEditModal && selectedContact && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold text-gray-900 mb-4">ویرایش تماس #{selectedContact.id}</h3>
                <div className="space-y-4 mb-6">
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
                      برچسب‌ها (فقط یک برچسب قابل انتخاب است)
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
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setEditForm({ ...editForm, tags: [] })
                              } else {
                                setEditForm({ ...editForm, tags: [tag] })
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
      </EmployeeLayout>
    </ProtectedRoute>
  )
}

