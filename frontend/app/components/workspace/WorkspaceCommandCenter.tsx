'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  getWorkspaceDashboard,
  getAssignments,
  getContacts,
  getCenters,
  createAssignment,
  createContact
} from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { 
  Target, Phone, MapPin, Plus, Search, Filter, 
  Calendar, Clock, CheckCircle2, XCircle, TrendingUp,
  FileText, BarChart3, Columns, Users, Activity
} from 'lucide-react'
import CenterSearch from '../CenterSearch'
import PersianDatePicker from '../PersianDatePicker'
import { showToast } from '../Toast'

interface WorkspaceCommandCenterProps {
  workspaceId: string
  workspace: any
}

export default function WorkspaceCommandCenter({ workspaceId, workspace }: WorkspaceCommandCenterProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Quick Actions
  const [showQuickMission, setShowQuickMission] = useState(false)
  const [showQuickContact, setShowQuickContact] = useState(false)
  const [quickMissionData, setQuickMissionData] = useState({
    centerId: null as number | null,
    center: null as any,
    date: new Date(),
    notes: ''
  })
  const [quickContactData, setQuickContactData] = useState({
    centerId: null as number | null,
    center: null as any,
    contactType: 'call',
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)

  // Filters
  const [filters, setFilters] = useState({
    assignments: { status: '', search: '' },
    contacts: { contactType: '', search: '' },
    centers: { type: '', search: '' }
  })

  useEffect(() => {
    loadDashboard()
  }, [workspaceId, filters])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const workspaceFilters = workspace.filters || {}
      const mergedFilters = {
        assignments: { ...workspaceFilters.assignments, ...filters.assignments },
        contacts: { ...workspaceFilters.contacts, ...filters.contacts },
        centers: { ...workspaceFilters.centers, ...filters.centers }
      }
      
      // Load data with filters
      const [dashboardData, assignmentsData, contactsData, centersData] = await Promise.all([
        getWorkspaceDashboard(workspaceId),
        getAssignments({ 
          ...mergedFilters.assignments,
          personnelId: mergedFilters.assignments.personnelId || user?.id,
          limit: 10
        }),
        getContacts({ 
          ...mergedFilters.contacts,
          personnelId: mergedFilters.contacts.personnelId || user?.id,
          limit: 10
        }),
        getCenters({ 
          ...mergedFilters.centers,
          responsiblePersonnelId: mergedFilters.centers.responsiblePersonnelId || user?.id,
          limit: 10
        })
      ])
      
      setDashboard({
        ...dashboardData,
        assignments: assignmentsData.assignments || [],
        contacts: contactsData.contacts || [],
        centers: centersData.centers || []
      })
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickMission = async () => {
    if (!quickMissionData.centerId || !user?.id) {
      showToast('لطفاً مرکز را انتخاب کنید', 'error')
      return
    }

    setSubmitting(true)
    try {
      await createAssignment({
        personnelId: user.id,
        centerId: quickMissionData.centerId,
        notes: quickMissionData.notes,
        createdAt: quickMissionData.date.toISOString()
      })
      showToast('ماموریت با موفقیت ثبت شد', 'success')
      setShowQuickMission(false)
      setQuickMissionData({ centerId: null, center: null, date: new Date(), notes: '' })
      await loadDashboard()
    } catch (error: any) {
      showToast(error.response?.data?.error || 'خطا در ثبت ماموریت', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuickContact = async () => {
    if (!quickContactData.centerId || !user?.id) {
      showToast('لطفاً مرکز را انتخاب کنید', 'error')
      return
    }

    setSubmitting(true)
    try {
      await createContact({
        personnelId: user.id,
        centerId: quickContactData.centerId,
        contactType: quickContactData.contactType,
        notes: quickContactData.notes
      })
      showToast('تماس با موفقیت ثبت شد', 'success')
      setShowQuickContact(false)
      setQuickContactData({ centerId: null, center: null, contactType: 'call', notes: '' })
      await loadDashboard()
    } catch (error: any) {
      showToast(error.response?.data?.error || 'خطا در ثبت تماس', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">در حال بارگذاری...</div>
  }

  if (!dashboard) {
    return <div className="text-center py-8 text-red-600">خطا در بارگذاری داشبورد</div>
  }

  const { stats, assignments, contacts, centers } = dashboard

  return (
    <div className="space-y-6">
      {/* Quick Actions Bar */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold">مرکز فرماندهی</h2>
            <p className="text-sm opacity-90">ثبت و پیگیری سریع وظایف و کارها</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowQuickMission(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-gray-100 font-medium"
            >
              <Plus size={18} />
              ثبت ماموریت
            </button>
            <button
              onClick={() => setShowQuickContact(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-gray-100 font-medium"
            >
              <Plus size={18} />
              ثبت تماس
            </button>
            <button
              onClick={() => router.push('/centers?action=new')}
              className="flex items-center gap-2 px-4 py-2 bg-white text-green-600 rounded-lg hover:bg-gray-100 font-medium"
            >
              <Plus size={18} />
              ثبت مرکز
            </button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ماموریت‌های در انتظار</p>
              <p className="text-2xl font-bold text-yellow-600">{stats?.assignments?.pending || 0}</p>
            </div>
            <Clock className="text-yellow-600" size={32} />
          </div>
          <button
            onClick={() => router.push('/assignments?status=pending')}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            مشاهده همه →
          </button>
        </div>
        
        <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ماموریت‌های تایید شده</p>
              <p className="text-2xl font-bold text-blue-600">{stats?.assignments?.approved || 0}</p>
            </div>
            <CheckCircle2 className="text-blue-600" size={32} />
          </div>
          <button
            onClick={() => router.push('/assignments?status=approved')}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            مشاهده همه →
          </button>
        </div>
        
        <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">تماس‌های امروز</p>
              <p className="text-2xl font-bold text-purple-600">{stats?.contacts?.total || 0}</p>
            </div>
            <Phone className="text-purple-600" size={32} />
          </div>
          <button
            onClick={() => router.push('/contacts')}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            مشاهده همه →
          </button>
        </div>
        
        <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">مراکز فعال</p>
              <p className="text-2xl font-bold text-green-600">{stats?.centers?.total || 0}</p>
            </div>
            <MapPin className="text-green-600" size={32} />
          </div>
          <button
            onClick={() => router.push('/centers')}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            مشاهده همه →
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assignments Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Target size={18} />
                ماموریت‌ها
              </h3>
              <div className="flex gap-2">
                <select
                  value={filters.assignments.status}
                  onChange={(e) => setFilters({
                    ...filters,
                    assignments: { ...filters.assignments, status: e.target.value }
                  })}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="">همه وضعیت‌ها</option>
                  <option value="pending">در انتظار</option>
                  <option value="approved">تایید شده</option>
                  <option value="in-progress">در حال انجام</option>
                  <option value="completed">تکمیل شده</option>
                </select>
                <button
                  onClick={() => router.push('/assignments')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  همه →
                </button>
              </div>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {assignments?.length > 0 ? (
                assignments.map((assignment: any) => (
                  <div
                    key={assignment.id}
                    onClick={() => router.push(`/assignments?id=${assignment.id}`)}
                    className="border rounded p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">#{assignment.id} - {assignment.centerName || 'مرکز نامشخص'}</p>
                        <p className="text-xs text-gray-600 mt-1">{assignment.status}</p>
                        {assignment.notes && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{assignment.notes}</p>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        assignment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        assignment.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                        assignment.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {assignment.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">هیچ ماموریتی وجود ندارد</p>
              )}
            </div>
          </div>

          {/* Contacts Section */}
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Phone size={18} />
                تماس‌ها
              </h3>
              <div className="flex gap-2">
                <select
                  value={filters.contacts.contactType}
                  onChange={(e) => setFilters({
                    ...filters,
                    contacts: { ...filters.contacts, contactType: e.target.value }
                  })}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="">همه انواع</option>
                  <option value="call">تماس تلفنی</option>
                  <option value="visit">بازدید</option>
                  <option value="email">ایمیل</option>
                </select>
                <button
                  onClick={() => router.push('/contacts')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  همه →
                </button>
              </div>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {contacts?.length > 0 ? (
                contacts.map((contact: any) => (
                  <div
                    key={contact.id}
                    onClick={() => router.push(`/contacts?id=${contact.id}`)}
                    className="border rounded p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{contact.centerName || 'مرکز نامشخص'}</p>
                        <p className="text-xs text-gray-600 mt-1">{contact.contactType}</p>
                        {contact.notes && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{contact.notes}</p>
                        )}
                      </div>
                      <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">
                        {contact.contactType}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">هیچ تماسی وجود ندارد</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick Links */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3">دسترسی سریع</h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/workflow')}
                className="w-full flex items-center gap-2 px-3 py-2 text-right hover:bg-gray-50 rounded text-sm"
              >
                <Columns size={16} />
                برد عملیات
              </button>
              <button
                onClick={() => router.push('/reports')}
                className="w-full flex items-center gap-2 px-3 py-2 text-right hover:bg-gray-50 rounded text-sm"
              >
                <BarChart3 size={16} />
                گزارش‌ها
              </button>
              <button
                onClick={() => router.push('/activity')}
                className="w-full flex items-center gap-2 px-3 py-2 text-right hover:bg-gray-50 rounded text-sm"
              >
                <Activity size={16} />
                لاگ فعالیت‌ها
              </button>
            </div>
          </div>

          {/* Recent Centers */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <MapPin size={18} />
              مراکز اخیر
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {centers?.length > 0 ? (
                centers.map((center: any) => (
                  <div
                    key={center.id}
                    onClick={() => router.push(`/centers/${center.id}`)}
                    className="border rounded p-2 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <p className="font-medium text-sm">{center.name}</p>
                    <p className="text-xs text-gray-600">{center.city}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-2">هیچ مرکزی وجود ندارد</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Mission Modal */}
      {showQuickMission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">ثبت ماموریت سریع</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">مرکز</label>
                <CenterSearch
                  onSelect={(center) => {
                    setQuickMissionData({ ...quickMissionData, centerId: center.id, center })
                  }}
                  selectedCenter={quickMissionData.center}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">تاریخ</label>
                <PersianDatePicker
                  value={quickMissionData.date}
                  onChange={(date) => setQuickMissionData({ ...quickMissionData, date: date || new Date() })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">یادداشت (اختیاری)</label>
                <textarea
                  value={quickMissionData.notes}
                  onChange={(e) => setQuickMissionData({ ...quickMissionData, notes: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleQuickMission}
                  disabled={submitting || !quickMissionData.centerId}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  ثبت
                </button>
                <button
                  onClick={() => {
                    setShowQuickMission(false)
                    setQuickMissionData({ centerId: null, center: null, date: new Date(), notes: '' })
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

      {/* Quick Contact Modal */}
      {showQuickContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">ثبت تماس سریع</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">مرکز</label>
                <CenterSearch
                  onSelect={(center) => {
                    setQuickContactData({ ...quickContactData, centerId: center.id, center })
                  }}
                  selectedCenter={quickContactData.center}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">نوع تماس</label>
                <select
                  value={quickContactData.contactType}
                  onChange={(e) => setQuickContactData({ ...quickContactData, contactType: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="call">تماس تلفنی</option>
                  <option value="visit">بازدید</option>
                  <option value="email">ایمیل</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">یادداشت (اختیاری)</label>
                <textarea
                  value={quickContactData.notes}
                  onChange={(e) => setQuickContactData({ ...quickContactData, notes: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleQuickContact}
                  disabled={submitting || !quickContactData.centerId}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  ثبت
                </button>
                <button
                  onClick={() => {
                    setShowQuickContact(false)
                    setQuickContactData({ centerId: null, center: null, contactType: 'call', notes: '' })
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

