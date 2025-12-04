'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import ProtectedRoute from '../../components/ProtectedRoute'
import EmployeeLayout from '../../components/EmployeeLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import { showToast } from '../../components/Toast'
import { getAssignments, deleteAssignment, updateAssignment } from '../../lib/api'
import { toPersianDate } from '../../lib/dateUtils'
import { Plus, Search, Filter, Edit, Trash2, Eye, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function MyMissionsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [missions, setMissions] = useState<any[]>([])
  const [filteredMissions, setFilteredMissions] = useState<any[]>([])
  const [filters, setFilters] = useState({
    search: '',
    status: ''
  })
  const [selectedMission, setSelectedMission] = useState<any>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    if (user?.id) {
      loadMissions()
    }
  }, [user, currentPage])

  useEffect(() => {
    applyFilters()
  }, [filters, missions])

  const loadMissions = async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      const response = await getAssignments({ personnelId: user.id })
      const data = Array.isArray(response) 
        ? response 
        : (response?.data || [])
      
      // Sort by date (newest first)
      const sorted = [...data].sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      
      setMissions(sorted)
      
      // Calculate pagination
      const total = sorted.length
      setTotalPages(Math.ceil(total / itemsPerPage))
    } catch (error: any) {
      console.error('Error loading missions:', error)
      showToast('خطا در بارگذاری ماموریت‌ها', 'error')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...missions]

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter((mission: any) =>
        mission.centerName?.toLowerCase().includes(searchLower) ||
        mission.notes?.toLowerCase().includes(searchLower) ||
        mission.id?.toString().includes(searchLower)
      )
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter((mission: any) => mission.status === filters.status)
    }

    setFilteredMissions(filtered)
    setTotalPages(Math.ceil(filtered.length / itemsPerPage))
    setCurrentPage(1) // Reset to first page when filters change
  }

  const handleDelete = async () => {
    if (!selectedMission) return
    
    // Only allow deletion of pending missions
    if (selectedMission.status !== 'pending') {
      showToast('فقط ماموریت‌های در انتظار تایید قابل حذف هستند', 'error')
      setShowDeleteModal(false)
      return
    }

    try {
      await deleteAssignment(selectedMission.id.toString())
      showToast('ماموریت با موفقیت حذف شد', 'success')
      await loadMissions()
      setShowDeleteModal(false)
      setSelectedMission(null)
    } catch (error: any) {
      showToast('خطا در حذف ماموریت: ' + (error.response?.data?.error || error.message), 'error')
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: any = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-blue-100 text-blue-800 border-blue-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
    }
    return badges[status] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getStatusLabel = (status: string) => {
    const labels: any = {
      pending: 'در انتظار تایید',
      approved: 'تایید شده',
      completed: 'تکمیل شده',
      rejected: 'رد شده',
      cancelled: 'لغو شده',
    }
    return labels[status] || status
  }

  const paginatedMissions = filteredMissions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <ProtectedRoute>
      <EmployeeLayout>
        <div className="p-4 md:p-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 md:mb-8 gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                ماموریت‌های من
              </h1>
              <p className="text-gray-600">
                مدیریت و مشاهده ماموریت‌های شما
              </p>
            </div>
            <Link
              href="/my-dashboard/missions/new"
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              ثبت ماموریت جدید
            </Link>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="text-gray-500" size={20} />
              <h3 className="text-lg font-semibold text-gray-900">فیلترها</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="جستجو در نام مرکز، یادداشت یا شناسه..."
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">همه وضعیت‌ها</option>
                <option value="pending">در انتظار تایید</option>
                <option value="approved">تایید شده</option>
                <option value="completed">تکمیل شده</option>
                <option value="rejected">رد شده</option>
                <option value="cancelled">لغو شده</option>
              </select>
            </div>
            {(filters.search || filters.status) && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setFilters({ search: '', status: '' })}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  پاک کردن فیلترها
                </button>
              </div>
            )}
          </div>

          {/* Missions List */}
          {loading ? (
            <LoadingSpinner fullScreen={false} />
          ) : paginatedMissions.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <p className="text-gray-500 text-lg mb-4">
                {filters.search || filters.status 
                  ? 'ماموریتی با فیلترهای انتخابی یافت نشد'
                  : 'هیچ ماموریتی ثبت نشده است'
                }
              </p>
              {!filters.search && !filters.status && (
                <Link
                  href="/my-dashboard/missions/new"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={20} />
                  ثبت اولین ماموریت
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                      <tr>
                        <th className="text-right py-4 px-6 font-semibold">شناسه</th>
                        <th className="text-right py-4 px-6 font-semibold">مرکز</th>
                        <th className="text-right py-4 px-6 font-semibold">تاریخ</th>
                        <th className="text-right py-4 px-6 font-semibold">وضعیت</th>
                        <th className="text-right py-4 px-6 font-semibold">هزینه</th>
                        <th className="text-right py-4 px-6 font-semibold">عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedMissions.map((mission) => (
                        <tr key={mission.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-6 text-sm font-medium text-gray-900">#{mission.id}</td>
                          <td className="py-4 px-6 text-sm text-gray-700">{mission.centerName}</td>
                          <td className="py-4 px-6 text-sm text-gray-600">
                            {toPersianDate(mission.createdAt)}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(mission.status)}`}>
                              {getStatusLabel(mission.status)}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-700">
                            {mission.totalCost 
                              ? `${parseFloat(mission.totalCost).toLocaleString('fa-IR')} تومان`
                              : '-'
                            }
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedMission(mission)
                                  setShowDetailsModal(true)
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="مشاهده جزئیات"
                              >
                                <Eye size={18} />
                              </button>
                              {mission.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => router.push(`/my-dashboard/missions/edit/${mission.id}`)}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                    title="ویرایش"
                                  >
                                    <Edit size={18} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedMission(mission)
                                      setShowDeleteModal(true)
                                    }}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="حذف"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </>
                              )}
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
                      نمایش {((currentPage - 1) * itemsPerPage) + 1} تا {Math.min(currentPage * itemsPerPage, filteredMissions.length)} از {filteredMissions.length} ماموریت
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

          {/* Details Modal */}
          {showDetailsModal && selectedMission && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  جزئیات ماموریت #{selectedMission.id}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">مرکز</label>
                    <p className="text-gray-900">{selectedMission.centerName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">تاریخ</label>
                    <p className="text-gray-900">{toPersianDate(selectedMission.createdAt)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">وضعیت</label>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(selectedMission.status)}`}>
                      {getStatusLabel(selectedMission.status)}
                    </span>
                  </div>
                  {selectedMission.notes && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">یادداشت</label>
                      <p className="text-gray-900">{selectedMission.notes}</p>
                    </div>
                  )}
                  {selectedMission.snapLocationAddress && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">آدرس اسنپ</label>
                      <p className="text-gray-900">{selectedMission.snapLocationAddress}</p>
                    </div>
                  )}
                  {selectedMission.snapCost && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">هزینه اسنپ</label>
                      <p className="text-gray-900">{parseFloat(selectedMission.snapCost).toLocaleString('fa-IR')} تومان</p>
                    </div>
                  )}
                  {selectedMission.discountCode && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">کد تخفیف</label>
                      <p className="text-gray-900">{selectedMission.discountCode}</p>
                    </div>
                  )}
                  {selectedMission.discountAmount && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ تخفیف</label>
                      <p className="text-gray-900">{parseFloat(selectedMission.discountAmount).toLocaleString('fa-IR')} تومان</p>
                    </div>
                  )}
                  {selectedMission.totalCost && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">هزینه کل</label>
                      <p className="text-gray-900 font-semibold">{parseFloat(selectedMission.totalCost).toLocaleString('fa-IR')} تومان</p>
                    </div>
                  )}
                  {selectedMission.managerComment && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">یادداشت مدیر</label>
                      <p className="text-gray-900 bg-blue-50 p-3 rounded-lg">{selectedMission.managerComment}</p>
                    </div>
                  )}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      setShowDetailsModal(false)
                      setSelectedMission(null)
                    }}
                    className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    بستن
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Modal */}
          {showDeleteModal && selectedMission && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">حذف ماموریت</h2>
                <p className="text-gray-600 mb-6">
                  آیا مطمئن هستید که می‌خواهید ماموریت #{selectedMission.id} را حذف کنید؟
                  <br />
                  <span className="font-semibold">{selectedMission.centerName}</span>
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false)
                      setSelectedMission(null)
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

