'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getCenterById, updateCenter, deleteCenter, getPersonnel, getCustomerSources, createCustomerSource, getAssignments, getContacts, getActivityLogs, getWorkflowBoard } from '../../lib/api'
import Link from 'next/link'
import { ArrowRight, MapPin, Phone, Mail, Globe, Building, User, CreditCard, FileText, Edit, Trash2, Save, X, Activity, TrendingUp, Calendar, Target, MessageSquare, Plus, Clock, CheckCircle, Columns } from 'lucide-react'
import { toPersianDate } from '../../lib/dateUtils'

export default function CenterDetailPage() {
  const params = useParams()
  const router = useRouter()
  const centerId = params.id as string
  
  const [center, setCenter] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [personnel, setPersonnel] = useState<any[]>([])
  const [customerSources, setCustomerSources] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [workflowCards, setWorkflowCards] = useState<any[]>([])
  const [activityLogs, setActivityLogs] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalAssignments: 0,
    completedAssignments: 0,
    pendingAssignments: 0,
    totalContacts: 0,
    totalWorkflowCards: 0,
    recentActivity: 0
  })
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'assignments' | 'contacts' | 'workflow'>('overview')
  
  // Form state
  const [formData, setFormData] = useState<any>({})
  
  useEffect(() => {
    if (centerId) {
      console.log('[Center Detail] Component mounted with centerId:', centerId, 'Type:', typeof centerId)
      fetchCenter()
      fetchPersonnel()
      fetchCustomerSources()
      fetchAssignments()
      fetchContacts()
      fetchWorkflowCards()
      fetchActivityLogs()
    }
  }, [centerId])

  const fetchAssignments = async () => {
    try {
      const data = await getAssignments({ centerId: parseInt(centerId) })
      const assignmentsArray = Array.isArray(data) ? data : (data?.data || [])
      setAssignments(assignmentsArray)
      
      // Calculate stats
      setStats(prev => ({
        ...prev,
        totalAssignments: assignmentsArray.length,
        completedAssignments: assignmentsArray.filter((a: any) => a.status === 'completed').length,
        pendingAssignments: assignmentsArray.filter((a: any) => a.status === 'pending' || a.status === 'approved').length
      }))
    } catch (error) {
      console.error('Error fetching assignments:', error)
    }
  }

  const fetchContacts = async () => {
    try {
      const data = await getContacts({ centerId: parseInt(centerId) })
      const contactsArray = Array.isArray(data) ? data : (data?.data || [])
      setContacts(contactsArray)
      setStats(prev => ({
        ...prev,
        totalContacts: contactsArray.length
      }))
    } catch (error) {
      console.error('Error fetching contacts:', error)
    }
  }

  const fetchWorkflowCards = async () => {
    try {
      // Get workflow board and filter cards by centerId
      const boardData = await getWorkflowBoard('ops-master', { includeCards: true })
      const allCards = boardData.board?.cards || []
      const centerCards = allCards.filter((card: any) => card.centerId === parseInt(centerId))
      setWorkflowCards(centerCards)
      setStats(prev => ({
        ...prev,
        totalWorkflowCards: centerCards.length
      }))
    } catch (error) {
      console.error('Error fetching workflow cards:', error)
    }
  }

  const fetchActivityLogs = async () => {
    try {
      const data = await getActivityLogs({ 
        resourceType: 'center',
        resourceId: parseInt(centerId),
        limit: 50
      })
      setActivityLogs(data.logs || [])
      setStats(prev => ({
        ...prev,
        recentActivity: (data.logs || []).length
      }))
    } catch (error) {
      console.error('Error fetching activity logs:', error)
    }
  }
  
  const fetchCenter = async () => {
    try {
      setLoading(true)
      console.log('[Center Detail] Fetching center with ID:', centerId)
      
      const found = await getCenterById(centerId)
      
      if (!found) {
        console.error('[Center Detail] Center not found:', centerId)
        alert('مرکز یافت نشد')
        router.push('/centers')
        return
      }
      
      console.log('[Center Detail] Center found:', found)
      setCenter(found)
      setFormData({
        name: found.name || '',
        type: found.type || 'lead',
        customerType: found.customerType || 'individual',
        legalType: found.legal_type || found.legalType || '',
        mobile: found.mobile || '',
        website: found.website || '',
        economicCode: found.economic_code || found.economicCode || '',
        nationalId: found.national_id || found.nationalId || '',
        financialCredit: found.financial_credit || found.financialCredit || '',
        creditRating: found.credit_rating || found.creditRating || '',
        potentialLevel: found.potentialLevel || found.potential_level || '',
        potentialNotes: found.potentialNotes || found.potential_notes || '',
        bankInfo: found.bank_info || found.bankInfo || '',
        warehouseReceiver: found.warehouse_receiver || found.warehouseReceiver || '',
        description: found.description || '',
        responsiblePersonnelId: found.responsiblePersonnelId || '',
        sourceId: found.sourceId || found.source?.id || '',
        addresses: found.addresses || [],
        phones: found.phones || [],
        deliveryContacts: found.deliveryContacts || [],
        customFields: found.customFields || []
      })
    } catch (error: any) {
      console.error('[Center Detail] Error fetching center:', error)
      console.error('[Center Detail] Error details:', error.response?.data || error.message)
      alert('خطا در دریافت اطلاعات مرکز: ' + (error.response?.data?.error || error.message))
      router.push('/centers')
    } finally {
      setLoading(false)
    }
  }
  
  const fetchPersonnel = async () => {
    try {
      const data = await getPersonnel()
      setPersonnel(data || [])
    } catch (error) {
      console.error('Error fetching personnel:', error)
    }
  }
  
  const fetchCustomerSources = async () => {
    try {
      const data = await getCustomerSources()
      setCustomerSources(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching customer sources:', error)
    }
  }
  
  const handleSave = async () => {
    try {
      setSaving(true)
      
      // Prepare payload similar to centers/page.tsx
      const payload: any = {
        name: formData.name || '',
        type: formData.type || 'lead',
        customerType: formData.customerType || 'individual',
        legalType: formData.legalType || null,
        mobile: formData.mobile || null,
        website: formData.website || null,
        economicCode: formData.economicCode || null,
        nationalId: formData.nationalId || null,
        financialCredit: formData.financialCredit ? parseFloat(formData.financialCredit) : null,
        creditRating: formData.creditRating || null,
        potentialLevel: formData.potentialLevel || null,
        potentialNotes: formData.potentialNotes || null,
        bankInfo: formData.bankInfo || null,
        warehouseReceiver: formData.warehouseReceiver || null,
        description: formData.description || null,
        responsiblePersonnelId: formData.responsiblePersonnelId ? parseInt(formData.responsiblePersonnelId) : null,
        sourceId: formData.sourceId ? parseInt(formData.sourceId) : null,
        addresses: Array.isArray(formData.addresses) ? formData.addresses : [],
        phones: Array.isArray(formData.phones) ? formData.phones : [],
        deliveryContacts: Array.isArray(formData.deliveryContacts) ? formData.deliveryContacts : [],
        customFields: Array.isArray(formData.customFields) ? formData.customFields : []
      }
      
      // Set primary address fields from first address
      if (payload.addresses && payload.addresses.length > 0) {
        const primaryAddress = payload.addresses[0]
        payload.address = primaryAddress.addressLine || ''
        payload.city = primaryAddress.city || ''
        payload.province = primaryAddress.province || ''
        payload.district = primaryAddress.district || ''
        payload.postal_code = primaryAddress.postalCode || ''
        payload.latitude = primaryAddress.latitude || null
        payload.longitude = primaryAddress.longitude || null
      }
      
      await updateCenter(centerId, payload)
      await fetchCenter()
      setEditing(false)
      alert('مرکز با موفقیت به‌روزرسانی شد')
    } catch (error: any) {
      console.error('[Center Detail] Error updating center:', error)
      alert('خطا در به‌روزرسانی: ' + (error.response?.data?.error || error.message))
    } finally {
      setSaving(false)
    }
  }
  
  const handleDelete = async () => {
    if (!confirm('آیا مطمئن هستید که می‌خواهید این مرکز را حذف کنید؟')) {
      return
    }
    
    try {
      await deleteCenter(centerId)
      alert('مرکز با موفقیت حذف شد')
      router.push('/centers')
    } catch (error: any) {
      alert('خطا در حذف: ' + (error.response?.data?.error || error.message))
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">در حال بارگذاری...</p>
        </div>
      </div>
    )
  }
  
  if (!center) {
    return null
  }
  
  const getTypeBadge = (type: string) => {
    const badges: any = {
      'lead': { text: 'سرنخ', color: 'bg-blue-100 text-blue-800 border-blue-300' },
      'opportunity': { text: 'فرصت', color: 'bg-green-100 text-green-800 border-green-300' },
      'customer': { text: 'مشتری', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      'old_customer': { text: 'قدیمی', color: 'bg-orange-100 text-orange-800 border-orange-300' }
    }
    return badges[type] || badges['lead']
  }
  
  const badge = getTypeBadge(center.type || 'lead')
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/centers" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors">
            <ArrowRight className="w-5 h-5 rotate-180" />
            <span>بازگشت به لیست مراکز</span>
          </Link>
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">{center.name}</h1>
                  <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold border ${badge.color}`}>
                    {badge.text}
                  </span>
                </div>
                {center.responsiblePersonnelName && (
                  <p className="text-gray-600 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    مسئول: <span className="font-semibold text-gray-900">{center.responsiblePersonnelName}</span>
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {/* Quick Actions */}
                <button
                  onClick={() => router.push(`/assignments?centerId=${centerId}&action=create`)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                  title="ایجاد ماموریت جدید"
                >
                  <Plus className="w-4 h-4" />
                  ماموریت جدید
                </button>
                <button
                  onClick={() => router.push(`/contacts?centerId=${centerId}&action=create`)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                  title="ایجاد تماس جدید"
                >
                  <MessageSquare className="w-4 h-4" />
                  تماس جدید
                </button>
                {!editing ? (
                  <>
                    <button
                      onClick={() => setEditing(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      ویرایش
                    </button>
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'در حال ذخیره...' : 'ذخیره'}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false)
                        fetchCenter()
                      }}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      انصراف
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-6 pt-6 border-t">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setActiveTab('assignments')}>
                <div className="flex items-center justify-between mb-2">
                  <Target className="w-6 h-6 opacity-80" />
                </div>
                <div className="text-2xl font-bold">{stats.totalAssignments}</div>
                <div className="text-sm opacity-90">کل ماموریت‌ها</div>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-white cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setActiveTab('assignments')}>
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle className="w-6 h-6 opacity-80" />
                </div>
                <div className="text-2xl font-bold">{stats.completedAssignments}</div>
                <div className="text-sm opacity-90">ماموریت‌های تکمیل شده</div>
              </div>
              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg p-4 text-white cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setActiveTab('assignments')}>
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-6 h-6 opacity-80" />
                </div>
                <div className="text-2xl font-bold">{stats.pendingAssignments}</div>
                <div className="text-sm opacity-90">در انتظار</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setActiveTab('contacts')}>
                <div className="flex items-center justify-between mb-2">
                  <MessageSquare className="w-6 h-6 opacity-80" />
                </div>
                <div className="text-2xl font-bold">{stats.totalContacts}</div>
                <div className="text-sm opacity-90">تماس‌ها</div>
              </div>
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg p-4 text-white cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setActiveTab('workflow')}>
                <div className="flex items-center justify-between mb-2">
                  <Columns className="w-6 h-6 opacity-80" />
                </div>
                <div className="text-2xl font-bold">{stats.totalWorkflowCards}</div>
                <div className="text-sm opacity-90">کارت‌های عملیات</div>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-4 text-white cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setActiveTab('timeline')}>
                <div className="flex items-center justify-between mb-2">
                  <Activity className="w-6 h-6 opacity-80" />
                </div>
                <div className="text-2xl font-bold">{stats.recentActivity}</div>
                <div className="text-sm opacity-90">فعالیت‌های اخیر</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg mb-6">
          <div className="flex border-b overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <Building className="w-4 h-4 inline ml-2" />
              اطلاعات کلی
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'timeline'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <Activity className="w-4 h-4 inline ml-2" />
              Timeline فعالیت‌ها
            </button>
            <button
              onClick={() => setActiveTab('assignments')}
              className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'assignments'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <Target className="w-4 h-4 inline ml-2" />
              ماموریت‌ها ({stats.totalAssignments})
            </button>
            <button
              onClick={() => setActiveTab('contacts')}
              className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'contacts'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <MessageSquare className="w-4 h-4 inline ml-2" />
              تماس‌ها ({stats.totalContacts})
            </button>
            <button
              onClick={() => setActiveTab('workflow')}
              className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'workflow'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <Columns className="w-4 h-4 inline ml-2" />
              کارت‌های عملیات ({stats.totalWorkflowCards})
            </button>
          </div>
        </div>
        
        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* اطلاعات پایه */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-600" />
                اطلاعات پایه
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">نام مرکز</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-semibold">{center.name}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">نوع مرکز</label>
                  {editing ? (
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="lead">سرنخ</option>
                      <option value="opportunity">فرصت</option>
                      <option value="customer">مشتری</option>
                      <option value="old_customer">قدیمی</option>
                    </select>
                  ) : (
                    <p className="text-gray-900">{badge.text}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">نوع مشتری</label>
                  {editing ? (
                    <select
                      value={formData.customerType}
                      onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="individual">حقیقی</option>
                      <option value="legal">حقوقی</option>
                    </select>
                  ) : (
                    <p className="text-gray-900">{center.customerType === 'legal' ? 'حقوقی' : 'حقیقی'}</p>
                  )}
                </div>
                
                {editing && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">نوع حقوقی</label>
                    <input
                      type="text"
                      value={formData.legalType || ''}
                      onChange={(e) => setFormData({ ...formData, legalType: e.target.value })}
                      placeholder="مثال: شرکت سهامی خاص"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}
                
                {center.legal_type && !editing && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">نوع حقوقی</label>
                    <p className="text-gray-900">{center.legal_type}</p>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">مسئول</label>
                  {editing ? (
                    <select
                      value={formData.responsiblePersonnelId}
                      onChange={(e) => setFormData({ ...formData, responsiblePersonnelId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">بدون مسئول</option>
                      {personnel.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-900">{center.responsiblePersonnelName || 'بدون مسئول'}</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* آدرس‌ها */}
            {Array.isArray(center.addresses) && center.addresses.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  آدرس‌ها
                </h2>
                <div className="space-y-4">
                  {center.addresses.map((addr: any, idx: number) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{addr.title || `آدرس ${idx + 1}`}</h3>
                        {addr.latitude && addr.longitude && (
                          <a
                            href={`https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                          >
                            <MapPin className="w-4 h-4" />
                            نقشه
                          </a>
                        )}
                      </div>
                      <p className="text-gray-700 mb-2">{addr.addressLine}</p>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        {addr.city && <span>شهر: {addr.city}</span>}
                        {addr.province && <span>استان: {addr.province}</span>}
                        {addr.district && <span>منطقه: {addr.district}</span>}
                        {addr.postalCode && <span>کد پستی: {addr.postalCode}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* شماره تماس‌ها */}
            {Array.isArray(center.phones) && center.phones.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-blue-600" />
                  شماره تماس‌ها
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {center.phones.map((phone: any, idx: number) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{phone.phone}</p>
                          {phone.label && <p className="text-sm text-gray-600">{phone.label}</p>}
                          {phone.extension && <p className="text-xs text-gray-500">داخلی: {phone.extension}</p>}
                        </div>
                        {phone.isPrimary && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">اصلی</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* اطلاعات مالی */}
            {(editing || center.financial_credit || center.credit_rating || center.economic_code || center.national_id) && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  اطلاعات مالی
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">اعتبار مالی</label>
                    {editing ? (
                      <input
                        type="number"
                        step="any"
                        value={formData.financialCredit || ''}
                        onChange={(e) => setFormData({ ...formData, financialCredit: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                      />
                    ) : center.financial_credit ? (
                      <p className="text-lg font-bold text-green-600">
                        {center.financial_credit.toLocaleString('fa-IR')} تومان
                      </p>
                    ) : (
                      <p className="text-gray-400">-</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">رتبه اعتباری</label>
                    {editing ? (
                      <input
                        type="text"
                        value={formData.creditRating || ''}
                        onChange={(e) => setFormData({ ...formData, creditRating: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : center.credit_rating ? (
                      <p className="text-lg font-bold text-blue-600">{center.credit_rating}</p>
                    ) : (
                      <p className="text-gray-400">-</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">کد اقتصادی</label>
                    {editing ? (
                      <input
                        type="text"
                        value={formData.economicCode || ''}
                        onChange={(e) => setFormData({ ...formData, economicCode: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : center.economic_code ? (
                      <p className="text-gray-900">{center.economic_code}</p>
                    ) : (
                      <p className="text-gray-400">-</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">کد ملی / شناسه</label>
                    {editing ? (
                      <input
                        type="text"
                        value={formData.nationalId || ''}
                        onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : center.national_id ? (
                      <p className="text-gray-900">{center.national_id}</p>
                    ) : (
                      <p className="text-gray-400">-</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* توضیحات */}
            {center.description && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  توضیحات
                </h2>
                {editing ? (
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap">{center.description}</p>
                )}
              </div>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* اطلاعات تماس */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">اطلاعات تماس</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">موبایل</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.mobile || ''}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : center.mobile ? (
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-700">{center.mobile}</span>
                    </div>
                  ) : (
                    <p className="text-gray-400">-</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">وب‌سایت</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.website || ''}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : center.website ? (
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-gray-400" />
                      <a href={center.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {center.website}
                      </a>
                    </div>
                  ) : (
                    <p className="text-gray-400">-</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">نحوه آشنایی</label>
                  {editing ? (
                    <select
                      value={formData.sourceId || ''}
                      onChange={(e) => setFormData({ ...formData, sourceId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">بدون انتخاب</option>
                      {customerSources.map((source: any) => (
                        <option key={source.id} value={source.id}>{source.name}</option>
                      ))}
                    </select>
                  ) : center.sourceName ? (
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-700">{center.sourceName}</span>
                    </div>
                  ) : (
                    <p className="text-gray-400">-</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* افراد مرتبط */}
            {Array.isArray(center.deliveryContacts) && center.deliveryContacts.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  افراد مرتبط
                </h2>
                <div className="space-y-4">
                  {center.deliveryContacts.map((contact: any, idx: number) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {contact.title && `${contact.title} `}{contact.fullName}
                          </h3>
                          {contact.position && (
                            <p className="text-sm text-gray-600 mt-1">سمت: {contact.position}</p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mt-2">
                        {contact.mobile && <span>موبایل: {contact.mobile}</span>}
                        {contact.phone && <span>تلفن: {contact.phone}</span>}
                        {contact.extension && <span>داخلی: {contact.extension}</span>}
                        {contact.nationalId && <span>کد ملی: {contact.nationalId}</span>}
                      </div>
                      {contact.notes && (
                        <p className="text-sm text-gray-700 mt-2">{contact.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* فیلدهای سفارشی */}
            {Array.isArray(center.customFields) && center.customFields.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  فیلدهای سفارشی
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {center.customFields.map((field: any, idx: number) => (
                    <div key={idx}>
                      <label className="block text-sm font-medium text-gray-500 mb-1">{field.fieldLabel || field.fieldKey}</label>
                      <p className="text-gray-900">{field.fieldValue}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* اطلاعات اضافی */}
            {(editing || center.warehouse_receiver || center.bank_info || center.potentialLevel || center.potentialNotes) && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">اطلاعات اضافی</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">تحویل‌گیرنده کالا</label>
                    {editing ? (
                      <input
                        type="text"
                        value={formData.warehouseReceiver || ''}
                        onChange={(e) => setFormData({ ...formData, warehouseReceiver: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : center.warehouse_receiver ? (
                      <p className="text-gray-900">{center.warehouse_receiver}</p>
                    ) : (
                      <p className="text-gray-400">-</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">اطلاعات بانکی</label>
                    {editing ? (
                      <textarea
                        value={formData.bankInfo || ''}
                        onChange={(e) => setFormData({ ...formData, bankInfo: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : center.bank_info ? (
                      <p className="text-gray-900 whitespace-pre-wrap">{center.bank_info}</p>
                    ) : (
                      <p className="text-gray-400">-</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">پتانسیل مشتری</label>
                    {editing ? (
                      <select
                        value={formData.potentialLevel || ''}
                        onChange={(e) => setFormData({ ...formData, potentialLevel: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">نامشخص</option>
                        <option value="A">بالا (A)</option>
                        <option value="B">متوسط (B)</option>
                        <option value="C">پایین (C)</option>
                      </select>
                    ) : center.potentialLevel ? (
                      <p className="text-gray-900">{center.potentialLevel}</p>
                    ) : (
                      <p className="text-gray-400">-</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">توضیح پتانسیل</label>
                    {editing ? (
                      <textarea
                        value={formData.potentialNotes || ''}
                        onChange={(e) => setFormData({ ...formData, potentialNotes: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : center.potentialNotes ? (
                      <p className="text-gray-900 whitespace-pre-wrap">{center.potentialNotes}</p>
                    ) : (
                      <p className="text-gray-400">-</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {activeTab === 'timeline' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-600" />
              Timeline فعالیت‌ها
            </h2>
            {activityLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                هیچ فعالیتی ثبت نشده است
              </div>
            ) : (
              <div className="space-y-4">
                {activityLogs.map((log, idx) => (
                  <div key={idx} className="border-r-4 border-blue-500 pr-4 pb-4 relative">
                    {idx < activityLogs.length - 1 && (
                      <div className="absolute right-0 top-8 w-0.5 h-full bg-gray-200"></div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                        <Activity className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold text-gray-900">{log.action || 'فعالیت'}</h4>
                          <span className="text-xs text-gray-500">
                            {log.createdAt ? toPersianDate(new Date(log.createdAt)) : ''}
                          </span>
                        </div>
                        {log.details && (
                          <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                        )}
                        {log.userName && (
                          <p className="text-xs text-gray-500 mt-1">
                            توسط: {log.userName}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Target className="w-6 h-6 text-blue-600" />
                ماموریت‌ها
              </h2>
              <button
                onClick={() => router.push(`/assignments?centerId=${centerId}&action=create`)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                ماموریت جدید
              </button>
            </div>
            {assignments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                هیچ ماموریتی ثبت نشده است
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map((assignment: any) => (
                  <div
                    key={assignment.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/assignments?id=${assignment.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-bold text-gray-900">ماموریت #{assignment.id}</span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            assignment.status === 'completed' ? 'bg-green-100 text-green-800' :
                            assignment.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                            assignment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {assignment.status === 'completed' ? 'تکمیل شده' :
                             assignment.status === 'approved' ? 'تایید شده' :
                             assignment.status === 'pending' ? 'در انتظار' :
                             assignment.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                          <div>
                            <span>تاریخ: </span>
                            <span className="font-semibold">
                              {assignment.createdAt ? toPersianDate(new Date(assignment.createdAt)) : 'نامشخص'}
                            </span>
                          </div>
                          {assignment.totalCost && (
                            <div>
                              <span>هزینه: </span>
                              <span className="font-semibold">
                                {assignment.totalCost.toLocaleString('fa-IR')} تومان
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-blue-600" />
                تماس‌ها
              </h2>
              <button
                onClick={() => router.push(`/contacts?centerId=${centerId}&action=create`)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                تماس جدید
              </button>
            </div>
            {contacts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                هیچ تماسی ثبت نشده است
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact: any) => (
                  <div
                    key={contact.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/contacts?id=${contact.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-bold text-gray-900">{contact.contactName || 'نامشخص'}</span>
                          {contact.phoneNumber && (
                            <span className="text-gray-600">{contact.phoneNumber}</span>
                          )}
                        </div>
                        {contact.notes && (
                          <p className="text-sm text-gray-600 mt-2">{contact.notes}</p>
                        )}
                        {contact.createdAt && (
                          <p className="text-xs text-gray-500 mt-2">
                            تاریخ: {toPersianDate(new Date(contact.createdAt))}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Columns className="w-6 h-6 text-blue-600" />
                کارت‌های عملیات
              </h2>
              <button
                onClick={() => router.push(`/workflow?centerId=${centerId}`)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                کارت جدید
              </button>
            </div>
            {workflowCards.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                هیچ کارت عملیاتی ثبت نشده است
              </div>
            ) : (
              <div className="space-y-3">
                {workflowCards.map((card: any) => (
                  <div
                    key={card.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/workflow?cardId=${card.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-bold text-gray-900">{card.title}</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            card.priority === 'high' ? 'bg-red-100 text-red-800' :
                            card.priority === 'normal' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {card.priority === 'high' ? 'اولویت بالا' :
                             card.priority === 'normal' ? 'اولویت عادی' :
                             'اولویت پایین'}
                          </span>
                          {card.listTitle && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              {card.listTitle}
                            </span>
                          )}
                        </div>
                        {card.description && (
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{card.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          {card.dueDate && (
                            <span className="flex items-center gap-1">
                              <Clock size={14} />
                              {toPersianDate(new Date(card.dueDate))}
                            </span>
                          )}
                          {card.assignee && (
                            <span className="flex items-center gap-1">
                              <User size={14} />
                              {card.assignee.name}
                            </span>
                          )}
                          {card.entityType && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                              {card.entityType === 'mission' ? 'ماموریت' : 'تماس'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

