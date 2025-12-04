'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import ProtectedRoute from '../../components/ProtectedRoute'
import EmployeeLayout from '../../components/EmployeeLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import { showToast } from '../../components/Toast'
import { getCenters, getPersonnel } from '../../lib/api'
import { Search, Filter, MapPin, User, Building2, X, Plus, Phone, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function MyCentersPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [centers, setCenters] = useState<any[]>([])
  const [personnel, setPersonnel] = useState<any[]>([])
  const [filteredCenters, setFilteredCenters] = useState<any[]>([])
  const [filters, setFilters] = useState({
    search: '',
    city: '',
    province: '',
    responsiblePersonnelId: '',
    tag: ''
  })
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  useEffect(() => {
    applyFilters()
  }, [filters, centers])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load all centers with pagination - fetch all pages
      let allCenters: any[] = []
      let page = 1
      let hasMore = true
      const apiUrl = typeof window !== 'undefined' 
        ? `http://${window.location.hostname}:2001/api`
        : 'http://localhost:2001/api'
      
      while (hasMore) {
        try {
          const response = await fetch(`${apiUrl}/centers?page=${page}&limit=100`)
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          const data = await response.json()
          const centersData = Array.isArray(data) ? data : (data?.data || [])
          
          if (centersData.length > 0) {
            allCenters = [...allCenters, ...centersData]
            // Check if there are more pages
            if (data.pagination) {
              hasMore = page < data.pagination.totalPages
              page++
            } else {
              // If no pagination info, assume we got all if less than limit
              hasMore = centersData.length === 100
              page++
            }
          } else {
            hasMore = false
          }
        } catch (err) {
          console.error(`Error loading page ${page}:`, err)
          hasMore = false
        }
      }
      
      console.log(`[Centers] Loaded ${allCenters.length} total centers`)
      
      // Filter centers based on user role
      // Managers and admins see all centers, staff only see their assigned centers
      let centersArray = allCenters
      if (user && (user.role === 'admin' || user.role === 'manager')) {
        // Show all centers for managers/admins
        console.log(`[Centers] User is manager/admin - showing all ${centersArray.length} centers`)
      } else if (user && user.role === 'staff') {
        // Show only centers assigned to this staff member
        centersArray = allCenters.filter((center: any) => 
          center.responsiblePersonnelId?.toString() === user.id.toString()
        )
        console.log(`[Centers] User is staff - showing ${centersArray.length} assigned centers out of ${allCenters.length} total`)
      }
      
      const [personnelData] = await Promise.all([
        getPersonnel()
      ])
      
      setCenters(centersArray)
      setPersonnel(Array.isArray(personnelData) ? personnelData : [])
    } catch (error: any) {
      console.error('Error loading data:', error)
      showToast('خطا در بارگذاری اطلاعات', 'error')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...centers]

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter((center: any) =>
        center.name?.toLowerCase().includes(searchLower) ||
        center.address?.toLowerCase().includes(searchLower) ||
        center.city?.toLowerCase().includes(searchLower) ||
        center.province?.toLowerCase().includes(searchLower)
      )
    }

    // City filter
    if (filters.city) {
      filtered = filtered.filter((center: any) =>
        center.city?.toLowerCase() === filters.city.toLowerCase()
      )
    }

    // Province filter
    if (filters.province) {
      filtered = filtered.filter((center: any) =>
        center.province?.toLowerCase() === filters.province.toLowerCase()
      )
    }

    // Responsible personnel filter
    if (filters.responsiblePersonnelId) {
      filtered = filtered.filter((center: any) =>
        center.responsiblePersonnelId?.toString() === filters.responsiblePersonnelId
      )
    }

    // Tag filter
    if (filters.tag) {
      filtered = filtered.filter((center: any) =>
        center.tags?.toLowerCase() === filters.tag.toLowerCase()
      )
    }

    setFilteredCenters(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      city: '',
      province: '',
      responsiblePersonnelId: '',
      tag: ''
    })
  }

  const getTagBadge = (tag: string | null | undefined) => {
    if (!tag || typeof tag !== 'string') {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
          -
        </span>
      )
    }
    const badges: any = {
      'lead': { text: 'سرنخ', color: 'bg-blue-100 text-blue-800' },
      'opportunity': { text: 'فرصت', color: 'bg-green-100 text-green-800' },
      'customer': { text: 'مشتری', color: 'bg-yellow-100 text-yellow-800' },
      'old_customer': { text: 'مشتری قدیمی', color: 'bg-orange-100 text-orange-800' }
    }
    const tagLower = tag.toLowerCase().trim()
    const badge = badges[tagLower] || badges['lead']
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    )
  }

  // Get unique values for filters
  const uniqueCities = Array.from(new Set(centers.map((c: any) => c.city).filter(Boolean))).sort()
  const uniqueProvinces = Array.from(new Set(centers.map((c: any) => c.province).filter(Boolean))).sort()
  const uniqueTags = Array.from(new Set(centers.map((c: any) => c.tags).filter((tag: any) => tag && typeof tag === 'string'))).sort()

  // Pagination
  const totalPages = Math.ceil(filteredCenters.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedCenters = filteredCenters.slice(startIndex, endIndex)

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  if (loading) {
    return (
      <ProtectedRoute>
        <EmployeeLayout>
          <div className="p-4 md:p-8 flex items-center justify-center min-h-screen">
            <LoadingSpinner />
          </div>
        </EmployeeLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <EmployeeLayout>
        <div className="p-4 md:p-8">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowRight size={18} />
              <span>بازگشت</span>
            </button>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              لیست مراکز
            </h1>
            <p className="text-gray-600">
              {user && (user.role === 'admin' || user.role === 'manager') 
                ? 'مشاهده و جستجو در تمام مراکز' 
                : 'مشاهده مراکز تحت مسئولیت شما'}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">کل مراکز</p>
                  <p className="text-2xl font-bold text-gray-900">{centers.length}</p>
                </div>
                <Building2 className="text-blue-500" size={32} />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">نتایج فیلتر شده</p>
                  <p className="text-2xl font-bold text-gray-900">{filteredCenters.length}</p>
                </div>
                <Filter className="text-green-500" size={32} />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">صفحه فعلی</p>
                  <p className="text-2xl font-bold text-gray-900">{currentPage} / {totalPages || 1}</p>
                </div>
                <Search className="text-purple-500" size={32} />
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="جستجو در نام، آدرس، شهر..."
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  showFilters || hasActiveFilters
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Filter size={18} />
                فیلترها
                {hasActiveFilters && (
                  <span className="bg-white text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                    {Object.values(filters).filter(v => v !== '').length}
                  </span>
                )}
              </button>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <X size={18} />
                  پاک کردن
                </button>
              )}
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* City Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">شهر</label>
                  <select
                    value={filters.city}
                    onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">همه شهرها</option>
                    {uniqueCities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>

                {/* Province Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">استان</label>
                  <select
                    value={filters.province}
                    onChange={(e) => setFilters({ ...filters, province: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">همه استان‌ها</option>
                    {uniqueProvinces.map(province => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                </div>

                {/* Responsible Personnel Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">کارشناس مسئول</label>
                  <select
                    value={filters.responsiblePersonnelId}
                    onChange={(e) => setFilters({ ...filters, responsiblePersonnelId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">همه کارشناسان</option>
                    {personnel.map(p => (
                      <option key={p.id} value={p.id.toString()}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Tag Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">برچسب</label>
                  <select
                    value={filters.tag}
                    onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">همه برچسب‌ها</option>
                    {uniqueTags.map(tag => (
                      <option key={tag} value={tag}>
                        {tag === 'lead' ? 'سرنخ' : 
                         tag === 'opportunity' ? 'فرصت' : 
                         tag === 'customer' ? 'مشتری' : 
                         tag === 'old_customer' ? 'مشتری قدیمی' : tag}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Active Filter Badges */}
            {hasActiveFilters && (
              <div className="mt-4 flex flex-wrap gap-2">
                {filters.city && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm flex items-center gap-2">
                    شهر: {filters.city}
                    <button onClick={() => setFilters({ ...filters, city: '' })}>
                      <X size={14} />
                    </button>
                  </span>
                )}
                {filters.province && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-lg text-sm flex items-center gap-2">
                    استان: {filters.province}
                    <button onClick={() => setFilters({ ...filters, province: '' })}>
                      <X size={14} />
                    </button>
                  </span>
                )}
                {filters.responsiblePersonnelId && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-lg text-sm flex items-center gap-2">
                    کارشناس: {personnel.find(p => p.id.toString() === filters.responsiblePersonnelId)?.name}
                    <button onClick={() => setFilters({ ...filters, responsiblePersonnelId: '' })}>
                      <X size={14} />
                    </button>
                  </span>
                )}
                {filters.tag && (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-lg text-sm flex items-center gap-2">
                    برچسب: {filters.tag === 'lead' ? 'سرنخ' : filters.tag === 'opportunity' ? 'فرصت' : filters.tag === 'customer' ? 'مشتری' : filters.tag === 'old_customer' ? 'مشتری قدیمی' : filters.tag}
                    <button onClick={() => setFilters({ ...filters, tag: '' })}>
                      <X size={14} />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Centers Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {paginatedCenters.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600 text-lg">هیچ مرکزی یافت نشد</p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-4 text-blue-600 hover:text-blue-800"
                  >
                    پاک کردن فیلترها
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">نام مرکز</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">موقعیت</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">کارشناس مسئول</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">برچسب</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">آدرس</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedCenters.map((center: any) => (
                        <tr key={center.id || center._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">{center.name || 'نامشخص'}</div>
                            {center.type && (
                              <div className="text-xs text-gray-500 mt-1">{center.type}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <MapPin size={16} className="text-gray-400" />
                              <div>
                                {center.city && <div>{center.city}</div>}
                                {center.province && center.province !== center.city && (
                                  <div className="text-xs text-gray-500">{center.province}</div>
                                )}
                                {center.district && (
                                  <div className="text-xs text-gray-500">{center.district}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {center.responsiblePersonnelName ? (
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <User size={16} className="text-gray-400" />
                                {center.responsiblePersonnelName}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">تعیین نشده</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {center.tags ? getTagBadge(center.tags) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-600 max-w-xs truncate" title={center.address}>
                              {center.address || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/my-dashboard/missions/new?centerId=${center.id}`}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                <Plus size={14} />
                                ماموریت
                              </Link>
                              <Link
                                href={`/my-dashboard/contacts/new?centerId=${center.id}`}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
                              >
                                <Phone size={14} />
                                تماس
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      نمایش {startIndex + 1} تا {Math.min(endIndex, filteredCenters.length)} از {filteredCenters.length} مرکز
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      >
                        قبلی
                      </button>
                      <div className="flex gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum
                          if (totalPages <= 5) {
                            pageNum = i + 1
                          } else if (currentPage <= 3) {
                            pageNum = i + 1
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i
                          } else {
                            pageNum = currentPage - 2 + i
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
                          )
                        })}
                      </div>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      >
                        بعدی
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </EmployeeLayout>
    </ProtectedRoute>
  )
}

