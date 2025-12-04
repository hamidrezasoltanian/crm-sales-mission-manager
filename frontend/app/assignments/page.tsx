'use client'

import { useEffect, useState } from 'react'
import { getAssignments, getPersonnel, getCenters, deleteAssignment, approveAssignment, updateAssignment } from '../lib/api'
import { Search, Filter, Plus, Edit, Trash2, Check, X, MoreVertical, Bell, ArrowRight } from 'lucide-react'
import { toPersianDate } from '../lib/dateUtils'
import PersianDatePicker from '../components/PersianDatePicker'
import { useAuth } from '../contexts/AuthContext'
import { showToast } from '../components/Toast'
import ProtectedRoute from '../components/ProtectedRoute'
import { useRouter } from 'next/navigation'

export default function AssignmentsPage() {
  const router = useRouter()
  const { user, isManager } = useAuth()
  const [assignments, setAssignments] = useState<any[]>([])
  const [personnel, setPersonnel] = useState<any[]>([])
  const [centers, setCenters] = useState<any[]>([])
  const [pendingMissions, setPendingMissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    personnelId: '',
    centerId: '',
  })
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [approveForm, setApproveForm] = useState({
    personalPayment: 0,
    managerComment: ''
  })
  const [rejectComment, setRejectComment] = useState('')
  const [processing, setProcessing] = useState(false)
  const [editForm, setEditForm] = useState({
    snapCost: '',
    discountCode: '',
    notes: '',
    centerNotes: '',
    managerComment: '',
    status: '',
    createdAt: null as Date | null
  })

  useEffect(() => {
    loadData()
    if (isManager) {
      loadPendingMissions()
    }
  }, [])

  useEffect(() => {
    loadAssignments()
  }, [filters])

  useEffect(() => {
    // Reload pending missions when assignments change
    if (isManager) {
      loadPendingMissions()
    }
  }, [assignments, isManager])

  const loadData = async () => {
    setLoading(true)
    // Safety timeout - force loading to false after 65 seconds
    const safetyTimeout = setTimeout(() => {
      console.warn('[Assignments] Loading timeout - forcing state to false')
      setLoading(false)
    }, 65000)
    
    try {
      console.log('[Assignments] Starting to load data...')
      const currentUserId = user?.id || null
      const [assignmentsResponse, personnelData, centersResponse] = await Promise.all([
        getAssignments().catch(err => {
          console.error('[Assignments] Error loading assignments:', err)
          return { data: [], pagination: {} }
        }),
        getPersonnel().catch(err => {
          console.error('[Assignments] Error loading personnel:', err)
          return []
        }),
        // Load all centers with pagination
        (async () => {
          let allCenters: any[] = []
          let page = 1
          let hasMore = true
          const apiUrl = typeof window !== 'undefined' 
            ? `http://${window.location.hostname}:2001/api`
            : 'http://localhost:2001/api'
          
          while (hasMore) {
            try {
              const response = await fetch(`${apiUrl}/centers?page=${page}&limit=100`)
              if (!response.ok) break
              const data = await response.json()
              const centersData = Array.isArray(data) ? data : (data?.data || [])
              
              if (centersData.length > 0) {
                allCenters = [...allCenters, ...centersData]
                if (data.pagination) {
                  hasMore = page < data.pagination.totalPages
                  page++
                } else {
                  hasMore = centersData.length === 100
                  page++
                }
              } else {
                hasMore = false
              }
            } catch (err) {
              console.error(`[Assignments] Error loading centers page ${page}:`, err)
              hasMore = false
            }
          }
          
          // Filter centers based on user role if needed
          if (currentUserId && user?.role === 'staff') {
            return { data: allCenters.filter((c: any) => c.responsiblePersonnelId?.toString() === currentUserId.toString()), pagination: {} }
          }
          return { data: allCenters, pagination: {} }
        })().catch(err => {
          console.error('[Assignments] Error loading centers:', err)
          return { data: [], pagination: {} }
        })
      ])
      console.log('[Assignments] Data loaded successfully')
      // Handle paginated response - extract data array
      const assignmentsData = Array.isArray(assignmentsResponse) 
        ? assignmentsResponse 
        : (assignmentsResponse?.data || [])
      // Handle paginated response for centers - extract data array
      const centersData = Array.isArray(centersResponse) 
        ? centersResponse 
        : (centersResponse?.data || [])
      setAssignments(Array.isArray(assignmentsData) ? assignmentsData : [])
      setPersonnel(personnelData || [])
      setCenters(Array.isArray(centersData) ? centersData : [])
    } catch (error) {
      console.error('[Assignments] Error loading data:', error)
    } finally {
      clearTimeout(safetyTimeout)
      setLoading(false)
      console.log('[Assignments] Loading finished')
    }
  }

  const loadAssignments = async () => {
    try {
      const response = await getAssignments({
        status: filters.status || undefined,
        personnelId: filters.personnelId || undefined,
        centerId: filters.centerId || undefined,
      })
      
      // Handle paginated response - extract data array
      const data = Array.isArray(response) 
        ? response 
        : (response?.data || [])
      
      let filtered = Array.isArray(data) ? data : []
      if (filters.search) {
        const search = filters.search.toLowerCase()
        filtered = filtered.filter((a: any) => 
          a.personnelName?.toLowerCase().includes(search) ||
          a.centerName?.toLowerCase().includes(search) ||
          a.id.toString().includes(search)
        )
      }
      
      setAssignments(filtered)
    } catch (error) {
      console.error('Error loading assignments:', error)
    }
  }

  const handleDelete = async () => {
    if (!selectedAssignment) return
    try {
      await deleteAssignment(selectedAssignment.id.toString())
      await loadAssignments()
      setShowDeleteModal(false)
      setSelectedAssignment(null)
    } catch (error) {
      console.error('Error deleting assignment:', error)
      alert('خطا در حذف ماموریت')
    }
  }

  const loadPendingMissions = async () => {
    if (!isManager) return
    try {
      const response = await getAssignments({ status: 'pending' })
      const data = Array.isArray(response) 
        ? response 
        : (response?.data || [])
      setPendingMissions(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading pending missions:', error)
    }
  }

  const handleApproveFromCard = async (mission: any) => {
    if (!user?.id) return
    setProcessing(true)
    try {
      const response = await fetch(`${typeof window !== 'undefined' ? `http://${window.location.hostname}:2001` : 'http://localhost:2001'}/api/assignments/${mission.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          managerId: user.id,
          personalPayment: approveForm.personalPayment || 0,
          managerComment: approveForm.managerComment || null
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'خطا در تایید ماموریت')
      }

      showToast('ماموریت با موفقیت تایید شد', 'success')
      setShowApproveModal(false)
      setApproveForm({ personalPayment: 0, managerComment: '' })
      await loadAssignments()
      await loadPendingMissions()
    } catch (error: any) {
      console.error('Error approving mission:', error)
      showToast('خطا در تایید ماموریت: ' + error.message, 'error')
    } finally {
      setProcessing(false)
    }
  }

  const handleRejectFromCard = async (mission: any) => {
    if (!user?.id) return
    setProcessing(true)
    try {
      const response = await fetch(`${typeof window !== 'undefined' ? `http://${window.location.hostname}:2001` : 'http://localhost:2001'}/api/assignments/${mission.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'rejected',
          userId: user.id,
          managerComment: rejectComment || null
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'خطا در رد ماموریت')
      }

      showToast('ماموریت با موفقیت رد شد', 'success')
      setShowRejectModal(false)
      setRejectComment('')
      await loadAssignments()
      await loadPendingMissions()
    } catch (error: any) {
      console.error('Error rejecting mission:', error)
      showToast('خطا در رد ماموریت: ' + error.message, 'error')
    } finally {
      setProcessing(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedAssignment || !user?.id) return
    setProcessing(true)
    try {
      const response = await fetch(`${typeof window !== 'undefined' ? `http://${window.location.hostname}:2001` : 'http://localhost:2001'}/api/assignments/${selectedAssignment.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          managerId: user.id,
          personalPayment: approveForm.personalPayment || 0,
          managerComment: approveForm.managerComment || null
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'خطا در تایید ماموریت')
      }

      showToast('ماموریت با موفقیت تایید شد', 'success')
      await loadAssignments()
      if (isManager) {
        await loadPendingMissions()
      }
      setShowApproveModal(false)
      setSelectedAssignment(null)
      setApproveForm({ personalPayment: 0, managerComment: '' })
    } catch (error: any) {
      console.error('Error approving assignment:', error)
      showToast('خطا در تایید ماموریت: ' + error.message, 'error')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedAssignment || !user?.id) return
    setProcessing(true)
    try {
      const response = await fetch(`${typeof window !== 'undefined' ? `http://${window.location.hostname}:2001` : 'http://localhost:2001'}/api/assignments/${selectedAssignment.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'rejected',
          userId: user.id,
          managerComment: rejectComment || null
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'خطا در رد ماموریت')
      }

      showToast('ماموریت با موفقیت رد شد', 'success')
      await loadAssignments()
      if (isManager) {
        await loadPendingMissions()
      }
      setShowRejectModal(false)
      setSelectedAssignment(null)
      setRejectComment('')
    } catch (error: any) {
      console.error('Error rejecting assignment:', error)
      showToast('خطا در رد ماموریت: ' + error.message, 'error')
    } finally {
      setProcessing(false)
    }
  }

  const handleEdit = (assignment: any) => {
    if (!assignment) return
    setSelectedAssignment(assignment)
    // تبدیل تاریخ به Date object برای PersianDatePicker
    let createdAtValue: Date | null = null
    if (assignment.createdAt) {
      const date = new Date(assignment.createdAt)
      if (!isNaN(date.getTime())) {
        createdAtValue = date
      }
    }
    setEditForm({
      snapCost: assignment.snapCost?.toString() || '',
      discountCode: assignment.discountCode || '',
      notes: assignment.notes || '',
      centerNotes: assignment.centerNotes || '',
      managerComment: assignment.managerComment || '',
      status: assignment.status || '',
      createdAt: createdAtValue
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedAssignment) return
    try {
      const updateData: any = {}
      
      if (editForm.snapCost !== '') {
        updateData.snapCost = parseFloat(editForm.snapCost) || 0
      }
      if (editForm.discountCode !== undefined) {
        updateData.discountCode = editForm.discountCode || null
      }
      if (editForm.notes !== undefined) {
        updateData.notes = editForm.notes || null
      }
      if (editForm.centerNotes !== undefined) {
        updateData.centerNotes = editForm.centerNotes || null
      }
      if (editForm.managerComment !== undefined) {
        updateData.managerComment = editForm.managerComment || null
      }
      if (editForm.status !== undefined && editForm.status !== '') {
        updateData.status = editForm.status
      }
      if (editForm.createdAt !== null && editForm.createdAt !== undefined) {
        // تبدیل تاریخ از Date object به ISO string
        const date = editForm.createdAt instanceof Date ? editForm.createdAt : new Date(editForm.createdAt)
        if (!isNaN(date.getTime())) {
          // تنظیم ساعت به نیمه شب برای جلوگیری از مشکلات timezone
          date.setHours(12, 0, 0, 0)
          updateData.createdAt = date.toISOString()
        }
      }

      await updateAssignment(selectedAssignment.id.toString(), updateData)
      showToast('ماموریت با موفقیت ویرایش شد', 'success')
      await loadAssignments()
      setShowEditModal(false)
      setSelectedAssignment(null)
      setEditForm({
        snapCost: '',
        discountCode: '',
        notes: '',
        centerNotes: '',
        managerComment: '',
        status: '',
        createdAt: null
      })
    } catch (error: any) {
      console.error('Error updating assignment:', error)
      showToast('خطا در ویرایش ماموریت: ' + (error.response?.data?.error || error.message), 'error')
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: any = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-blue-100 text-blue-800 border-blue-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
    }
    return badges[status] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getStatusLabel = (status: string) => {
    const labels: any = {
      pending: 'در انتظار',
      approved: 'تایید شده',
      completed: 'تکمیل شده',
      rejected: 'رد شده',
    }
    return labels[status] || status
  }

  return (
    <ProtectedRoute>
      <div className="p-8">
      {/* Loading Indicator */}
      {loading && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-600"></div>
          <span>در حال بارگذاری...</span>
        </div>
      )}
      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowRight size={18} />
          <span>بازگشت به داشبورد</span>
        </button>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            ماموریت‌ها
            {isManager && pendingMissions.length > 0 && (
              <span className="bg-red-500 text-white text-lg px-3 py-1 rounded-full flex items-center gap-2">
                <Bell size={18} />
                {pendingMissions.length} در انتظار تایید
              </span>
            )}
          </h1>
          <p className="text-gray-600">مدیریت و پیگیری ماموریت‌های فروش</p>
        </div>
        <button className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg flex items-center gap-2">
          <Plus size={20} />
          ماموریت جدید
        </button>
      </div>

      {/* Pending Approvals Card - Only for Managers */}
      {isManager && pendingMissions.length > 0 && (
        <div className="bg-yellow-50 border-r-4 border-yellow-500 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="text-yellow-600" size={24} />
              کارتابل تایید ماموریت‌ها
              <span className="bg-red-500 text-white text-sm px-3 py-1 rounded-full">
                {pendingMissions.length}
              </span>
            </h2>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {pendingMissions.slice(0, 5).map((mission: any) => (
              <div
                key={mission.id}
                className="bg-white rounded-lg p-4 border border-yellow-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-gray-900">ماموریت #{mission.id}</span>
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
                        در انتظار تایید
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">پرسنل: </span>
                        <span className="font-semibold">{mission.personnelName || 'نامشخص'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">مرکز: </span>
                        <span className="font-semibold">{mission.centerName || 'نامشخص'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">تاریخ: </span>
                        <span className="font-semibold">
                          {mission.createdAt ? toPersianDate(new Date(mission.createdAt)) : 'نامشخص'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">هزینه: </span>
                        <span className="font-semibold">
                          {mission.totalCost ? `${mission.totalCost.toLocaleString('fa-IR')} تومان` : 'تعیین نشده'}
                        </span>
                      </div>
                    </div>
                    {mission.notes && (
                      <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        {mission.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 mr-4">
                    <button
                      onClick={() => {
                        setSelectedAssignment(mission)
                        setShowApproveModal(true)
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Check size={16} />
                      تایید
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAssignment(mission)
                        setShowRejectModal(true)
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <X size={16} />
                      رد
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {pendingMissions.length > 5 && (
              <div className="text-center text-sm text-gray-600 pt-2">
                و {pendingMissions.length - 5} ماموریت دیگر...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="جستجو..."
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">همه وضعیت‌ها</option>
            <option value="pending">در انتظار</option>
            <option value="approved">تایید شده</option>
            <option value="completed">تکمیل شده</option>
            <option value="rejected">رد شده</option>
          </select>
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={filters.personnelId}
            onChange={(e) => setFilters({ ...filters, personnelId: e.target.value })}
          >
            <option value="">همه پرسنل</option>
            {personnel.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={filters.centerId}
            onChange={(e) => setFilters({ ...filters, centerId: e.target.value })}
          >
            <option value="">همه مراکز</option>
            {Array.isArray(centers) && centers.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Assignments Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <tr>
                <th className="text-right py-4 px-6 font-semibold">شناسه</th>
                <th className="text-right py-4 px-6 font-semibold">پرسنل</th>
                <th className="text-right py-4 px-6 font-semibold">مرکز</th>
                <th className="text-right py-4 px-6 font-semibold">وضعیت</th>
                <th className="text-right py-4 px-6 font-semibold">هزینه اسنپ</th>
                <th className="text-right py-4 px-6 font-semibold">هزینه کل</th>
                <th className="text-right py-4 px-6 font-semibold">تاریخ ایجاد</th>
                <th className="text-right py-4 px-6 font-semibold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading && assignments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-600"></div>
                      <span className="text-gray-600">در حال بارگذاری...</span>
                    </div>
                  </td>
                </tr>
              ) : assignments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    هیچ ماموریتی یافت نشد
                  </td>
                </tr>
              ) : (
                assignments.map((assignment) => (
                  <tr key={assignment.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 text-sm font-medium text-gray-900">#{assignment.id}</td>
                    <td className="py-4 px-6 text-sm text-gray-700">{assignment.personnelName}</td>
                    <td className="py-4 px-6 text-sm text-gray-700">
                      {assignment.centerName}
                      {assignment.centerNotes && (
                        <div className="mt-1 text-xs text-gray-500 italic">
                          📝 {assignment.centerNotes}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(assignment.status)}`}>
                        {getStatusLabel(assignment.status)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-900">
                      {assignment.snapCost ? `${assignment.snapCost.toLocaleString('fa-IR')} تومان` : '-'}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-900 font-medium">
                      {assignment.totalCost ? `${assignment.totalCost.toLocaleString('fa-IR')} تومان` : '-'}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {toPersianDate(assignment.createdAt)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        {assignment.status === 'pending' && isManager && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedAssignment(assignment)
                                setShowApproveModal(true)
                              }}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="تایید"
                            >
                              <Check size={18} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAssignment(assignment)
                                setShowRejectModal(true)
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="رد"
                            >
                              <X size={18} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleEdit(assignment)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="ویرایش"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAssignment(assignment)
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
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">تایید ماموریت #{selectedAssignment.id}</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  هزینه شخصی (تومان)
                </label>
                <input
                  type="number"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={approveForm.personalPayment}
                  onChange={(e) => setApproveForm({ ...approveForm, personalPayment: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  کامنت مدیر (اختیاری)
                </label>
                <textarea
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  value={approveForm.managerComment}
                  onChange={(e) => setApproveForm({ ...approveForm, managerComment: e.target.value })}
                  placeholder="نظرات و توضیحات مدیر..."
                />
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleApprove}
                disabled={processing}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Check size={18} />
                {processing ? 'در حال تایید...' : 'تایید ماموریت'}
              </button>
              <button
                onClick={() => {
                  setShowApproveModal(false)
                  setSelectedAssignment(null)
                  setApproveForm({ personalPayment: 0, managerComment: '' })
                }}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                لغو
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">رد ماموریت #{selectedAssignment.id}</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  دلیل رد (اختیاری)
                </label>
                <textarea
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  rows={4}
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="دلیل رد ماموریت..."
                />
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleReject}
                disabled={processing}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <X size={18} />
                {processing ? 'در حال رد...' : 'رد ماموریت'}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setSelectedAssignment(null)
                  setRejectComment('')
                }}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                لغو
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">ویرایش ماموریت #{selectedAssignment.id}</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  هزینه اسنپ (تومان)
                </label>
                <input
                  type="number"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={editForm.snapCost}
                  onChange={(e) => setEditForm({ ...editForm, snapCost: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  کد تخفیف
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={editForm.discountCode}
                  onChange={(e) => setEditForm({ ...editForm, discountCode: e.target.value })}
                  placeholder="کد تخفیف (اختیاری)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  وضعیت
                </label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                >
                  <option value="pending">در انتظار</option>
                  <option value="approved">تایید شده</option>
                  <option value="completed">تکمیل شده</option>
                  <option value="rejected">رد شده</option>
                  <option value="cancelled">لغو شده</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تاریخ ماموریت
                </label>
                <PersianDatePicker
                  value={editForm.createdAt}
                  onChange={(date) => setEditForm({ ...editForm, createdAt: date })}
                  placeholder="انتخاب تاریخ ماموریت"
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  تاریخ ثبت ماموریت را می‌توانید تغییر دهید
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  یادداشت‌ها
                </label>
                <textarea
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="یادداشت‌های ماموریت..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  یادداشت‌های مرکز
                </label>
                <textarea
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  value={editForm.centerNotes}
                  onChange={(e) => setEditForm({ ...editForm, centerNotes: e.target.value })}
                  placeholder="یادداشت‌های مربوط به مرکز..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نظر مدیر
                </label>
                <textarea
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  value={editForm.managerComment}
                  onChange={(e) => setEditForm({ ...editForm, managerComment: e.target.value })}
                  placeholder="نظرات و توضیحات مدیر..."
                />
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
                  setSelectedAssignment(null)
                  setEditForm({
                    snapCost: '',
                    discountCode: '',
                    notes: '',
                    centerNotes: '',
                    managerComment: '',
                    status: '',
                    createdAt: null
                  })
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
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">حذف ماموریت</h3>
            <p className="text-gray-600 mb-6">
              آیا مطمئن هستید که می‌خواهید ماموریت #{selectedAssignment?.id} را حذف کنید؟
            </p>
            <div className="flex gap-4">
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                حذف
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setSelectedAssignment(null)
                }}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                لغو
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ProtectedRoute>
  )
}
