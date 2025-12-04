'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  getAssignments, 
  getContacts, 
  getPersonnel, 
  rejectAssignment, 
  approveAssignment,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getReminders,
  getUpcomingReminders,
  createReminder,
  markReminderAsCompleted,
  deleteReminder,
  getWorkflowBoard
} from '../lib/api'
import { 
  Search, Filter, Check, X, Bell, Target, Phone, ArrowRight, 
  Clock, AlertCircle, CheckCircle, Info, Trash2, Plus, Calendar, Columns
} from 'lucide-react'
import { toPersianDate } from '../lib/dateUtils'
import { useAuth } from '../contexts/AuthContext'
import { showToast } from '../components/Toast'
import ProtectedRoute from '../components/ProtectedRoute'
import MainLayout from '../components/MainLayout'
import PersianDateTimePicker from '../components/PersianDateTimePicker'

export default function InboxPage() {
  const router = useRouter()
  const { user, isManager } = useAuth()
  const [activeTab, setActiveTab] = useState<'notifications' | 'reminders' | 'missions' | 'contacts' | 'approvals'>('notifications')
  
  // Notifications
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [notificationTypeFilter, setNotificationTypeFilter] = useState<string>('')
  
  // Reminders
  const [reminders, setReminders] = useState<any[]>([])
  const [autoReminders, setAutoReminders] = useState<any[]>([]) // Auto reminders from assignments, contacts, workflow cards
  const [reminderFilter, setReminderFilter] = useState<'all' | 'upcoming' | 'past' | 'completed'>('all')
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [newReminder, setNewReminder] = useState({
    title: '',
    description: '',
    reminderAt: new Date()
  })
  
  // Missions & Contacts
  const [missions, setMissions] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
  })

  useEffect(() => {
    loadData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (activeTab === 'notifications') {
        loadNotifications()
      } else if (activeTab === 'reminders') {
        loadReminders()
        loadAutoReminders()
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'notifications') {
      loadNotifications()
    } else if (activeTab === 'reminders') {
      loadReminders()
      loadAutoReminders()
    } else if (activeTab === 'missions') {
      loadMissions()
    } else if (activeTab === 'contacts') {
      loadContacts()
    } else if (activeTab === 'approvals' && isManager) {
      loadPendingApprovals()
    }
  }, [filters, activeTab, isManager, notificationFilter, notificationTypeFilter, reminderFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'notifications') {
        await loadNotifications()
      } else if (activeTab === 'reminders') {
        await loadReminders()
        await loadAutoReminders()
      } else if (activeTab === 'missions') {
        await loadMissions()
      } else if (activeTab === 'contacts') {
        await loadContacts()
      } else if (activeTab === 'approvals' && isManager) {
        await loadPendingApprovals()
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadNotifications = async () => {
    try {
      const filters: any = {}
      if (notificationFilter === 'unread') {
        filters.isRead = false
      } else if (notificationFilter === 'read') {
        filters.isRead = true
      }
      if (notificationTypeFilter) {
        filters.type = notificationTypeFilter
      }
      filters.limit = 100
      
      const data = await getNotifications(filters)
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch (error) {
      console.error('Error loading notifications:', error)
    }
  }

  const loadReminders = async () => {
    try {
      const filters: any = {}
      if (reminderFilter === 'upcoming') {
        filters.upcoming = true
      } else if (reminderFilter === 'past') {
        filters.past = true
      } else if (reminderFilter === 'completed') {
        filters.isCompleted = true
      } else {
        filters.isCompleted = false
      }
      filters.limit = 100
      
      const data = await getReminders(filters)
      setReminders(data.reminders || [])
    } catch (error) {
      console.error('Error loading reminders:', error)
    }
  }

  const loadAutoReminders = async () => {
    try {
      const autoRemindersList: any[] = []
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)

      // Load workflow cards with dueDate or reminderAt
      try {
        const boardData = await getWorkflowBoard('ops-master', { includeCards: true })
        const cards = boardData.board?.cards || []
        
        cards.forEach((card: any) => {
          const date = card.dueDate || card.reminderAt
          if (date) {
            const reminderAt = new Date(date)
            const isOverdue = reminderAt < now
            const isNear = reminderAt >= now && reminderAt <= threeDaysFromNow
            
            // Show all reminders that are overdue, near, or if filter is 'all'
            if (isOverdue || isNear || reminderFilter === 'all') {
              autoRemindersList.push({
                id: `workflow-${card.id}`,
                type: 'workflow',
                entityType: 'workflow_card',
                entityId: card.id,
                title: card.title,
                description: card.center?.name || card.description || 'کارت عملیات',
                reminderAt: date,
                isOverdue,
                isNear,
                isCompleted: card.status === 'completed',
                actionUrl: `/workflow?cardId=${card.id}`
              })
            }
          }
        })
      } catch (error) {
        console.error('Error loading workflow cards for reminders:', error)
      }

      // Also check reminders table for reminders linked to assignments or contacts
      try {
        const remindersData = await getReminders({
          personnelId: user?.id,
          limit: 1000
        })
        const remindersArray = remindersData.reminders || []
        
        remindersArray.forEach((reminder: any) => {
          if (reminder.entityType && reminder.entityId && reminder.reminderAt) {
            const reminderAt = new Date(reminder.reminderAt)
            const isOverdue = reminderAt < now
            const isNear = reminderAt >= now && reminderAt <= threeDaysFromNow
            
            if (isOverdue || isNear || reminderFilter === 'all') {
              let actionUrl = ''
              if (reminder.entityType === 'assignment') {
                actionUrl = `/assignments?id=${reminder.entityId}`
              } else if (reminder.entityType === 'contact') {
                actionUrl = `/contacts?id=${reminder.entityId}`
              }
              
              autoRemindersList.push({
                id: `reminder-${reminder.id}`,
                type: reminder.entityType,
                entityType: reminder.entityType,
                entityId: reminder.entityId,
                title: reminder.title,
                description: reminder.description || '',
                reminderAt: reminder.reminderAt,
                isOverdue,
                isNear,
                isCompleted: reminder.isCompleted || false,
                actionUrl
              })
            }
          }
        })
      } catch (error) {
        console.error('Error loading reminders for auto reminders:', error)
      }

      // Filter based on reminderFilter
      let filtered = autoRemindersList
      if (reminderFilter === 'past') {
        filtered = autoRemindersList.filter(r => r.isOverdue && !r.isCompleted)
      } else if (reminderFilter === 'upcoming') {
        filtered = autoRemindersList.filter(r => !r.isOverdue && !r.isCompleted)
      } else if (reminderFilter === 'completed') {
        filtered = autoRemindersList.filter(r => r.isCompleted)
      } else {
        filtered = autoRemindersList.filter(r => !r.isCompleted)
      }

      // Sort: overdue first, then by date
      filtered.sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1
        if (!a.isOverdue && b.isOverdue) return 1
        return new Date(a.reminderAt).getTime() - new Date(b.reminderAt).getTime()
      })

      setAutoReminders(filtered)
    } catch (error) {
      console.error('Error loading auto reminders:', error)
    }
  }

  const loadMissions = async () => {
    try {
      const response = await getAssignments({
        status: filters.status || undefined,
        personnelId: user?.id || undefined,
      })
      const data = Array.isArray(response) ? response : (response?.data || [])
      let filtered = Array.isArray(data) ? data : []
      
      if (filters.search) {
        const search = filters.search.toLowerCase()
        filtered = filtered.filter((a: any) => 
          a.centerName?.toLowerCase().includes(search) ||
          a.id.toString().includes(search)
        )
      }
      
      setMissions(filtered)
    } catch (error) {
      console.error('Error loading missions:', error)
    }
  }

  const loadContacts = async () => {
    try {
      const response = await getContacts({
        personnelId: user?.id || undefined,
      })
      const data = Array.isArray(response) ? response : (response?.data || [])
      let filtered = Array.isArray(data) ? data : []
      
      if (filters.search) {
        const search = filters.search.toLowerCase()
        filtered = filtered.filter((c: any) => 
          c.centerName?.toLowerCase().includes(search) ||
          c.contactName?.toLowerCase().includes(search) ||
          c.phoneNumber?.includes(search)
        )
      }
      
      setContacts(filtered)
    } catch (error) {
      console.error('Error loading contacts:', error)
    }
  }

  const loadPendingApprovals = async () => {
    if (!isManager) return
    try {
      const response = await getAssignments({ status: 'pending' })
      const data = Array.isArray(response) ? response : (response?.data || [])
      setPendingApprovals(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading pending approvals:', error)
    }
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id)
      await loadNotifications()
      showToast('نوتیفیکیشن به عنوان خوانده شده علامت گذاری شد', 'success')
    } catch (error: any) {
      showToast('خطا در به‌روزرسانی: ' + (error.message || 'خطای نامشخص'), 'error')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead()
      await loadNotifications()
      showToast('همه نوتیفیکیشن‌ها به عنوان خوانده شده علامت گذاری شدند', 'success')
    } catch (error: any) {
      showToast('خطا در به‌روزرسانی: ' + (error.message || 'خطای نامشخص'), 'error')
    }
  }

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteNotification(id)
      await loadNotifications()
      showToast('نوتیفیکیشن حذف شد', 'success')
    } catch (error: any) {
      showToast('خطا در حذف: ' + (error.message || 'خطای نامشخص'), 'error')
    }
  }

  const handleCreateReminder = async () => {
    if (!newReminder.title || !newReminder.reminderAt) {
      showToast('لطفاً عنوان و تاریخ یادآوری را وارد کنید', 'error')
      return
    }

    try {
      await createReminder({
        title: newReminder.title,
        description: newReminder.description || undefined,
        reminderAt: newReminder.reminderAt.toISOString()
      })
      showToast('یادآوری با موفقیت ایجاد شد', 'success')
      setShowReminderModal(false)
      setNewReminder({ title: '', description: '', reminderAt: new Date() })
      await loadReminders()
    } catch (error: any) {
      showToast('خطا در ایجاد یادآوری: ' + (error.message || 'خطای نامشخص'), 'error')
    }
  }

  const handleCompleteReminder = async (id: string) => {
    try {
      await markReminderAsCompleted(id)
      await loadReminders()
      showToast('یادآوری به عنوان انجام شده علامت گذاری شد', 'success')
    } catch (error: any) {
      showToast('خطا در به‌روزرسانی: ' + (error.message || 'خطای نامشخص'), 'error')
    }
  }

  const handleDeleteReminder = async (id: string) => {
    try {
      await deleteReminder(id)
      await loadReminders()
      showToast('یادآوری حذف شد', 'success')
    } catch (error: any) {
      showToast('خطا در حذف: ' + (error.message || 'خطای نامشخص'), 'error')
    }
  }

  const handleApprove = async (mission: any) => {
    if (!user?.id) return
    try {
      await approveAssignment(mission.id.toString(), user.id, 0)
      showToast('ماموریت با موفقیت تایید شد', 'success')
      await loadPendingApprovals()
      await loadNotifications() // Refresh notifications
    } catch (error: any) {
      console.error('Error approving mission:', error)
      showToast('خطا در تایید ماموریت: ' + (error.message || 'خطای نامشخص'), 'error')
    }
  }

  const handleReject = async (mission: any) => {
    if (!user?.id) return
    try {
      await rejectAssignment(mission.id.toString(), user.id)
      showToast('ماموریت با موفقیت رد شد', 'success')
      await loadPendingApprovals()
      await loadNotifications() // Refresh notifications
    } catch (error: any) {
      console.error('Error rejecting mission:', error)
      showToast('خطا در رد ماموریت: ' + (error.message || 'خطای نامشخص'), 'error')
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="text-green-600" size={20} />
      case 'warning':
      case 'reminder':
        return <AlertCircle className="text-yellow-600" size={20} />
      case 'error':
        return <X className="text-red-600" size={20} />
      case 'mission':
        return <Target className="text-blue-600" size={20} />
      case 'contact':
        return <Phone className="text-purple-600" size={20} />
      case 'approval':
        return <CheckCircle className="text-orange-600" size={20} />
      default:
        return <Info className="text-blue-600" size={20} />
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

  const isReminderPast = (reminderAt: string) => {
    return new Date(reminderAt) < new Date()
  }

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="p-8">
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
                <Bell className="text-blue-600" size={32} />
                مرکز نوتیفیکیشن
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-lg px-3 py-1 rounded-full flex items-center gap-2">
                    {unreadCount} خوانده نشده
                  </span>
                )}
              </h1>
              <p className="text-gray-600">
                تمام نوتیفیکیشن‌ها، یادآوری‌ها و کارهای شما در یکجا
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-lg mb-6">
            <div className="flex border-b overflow-x-auto">
              <button
                onClick={() => setActiveTab('notifications')}
                className={`
                  flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap relative
                  ${activeTab === 'notifications'
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }
                `}
              >
                <Bell size={18} />
                نوتیفیکیشن‌ها
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-2">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('reminders')}
                className={`
                  flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap
                  ${activeTab === 'reminders'
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }
                `}
              >
                <Clock size={18} />
                یادآوری‌ها
                {(autoReminders.filter(r => r.isOverdue && !r.isCompleted).length > 0) && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-2">
                    {autoReminders.filter(r => r.isOverdue && !r.isCompleted).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('missions')}
                className={`
                  flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap
                  ${activeTab === 'missions'
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }
                `}
              >
                <Target size={18} />
                ماموریت‌ها
              </button>
              <button
                onClick={() => setActiveTab('contacts')}
                className={`
                  flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap
                  ${activeTab === 'contacts'
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }
                `}
              >
                <Phone size={18} />
                تماس‌ها
              </button>
              {isManager && (
                <button
                  onClick={() => setActiveTab('approvals')}
                  className={`
                    flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap relative
                    ${activeTab === 'approvals'
                      ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                    }
                  `}
                >
                  <CheckCircle size={18} />
                  تاییدها
                  {pendingApprovals.length > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-2">
                      {pendingApprovals.length}
                    </span>
                  )}
                </button>
              )}
            </div>

            <div className="p-6">
              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="flex items-center gap-4 mb-4 flex-wrap">
                    <select
                      value={notificationFilter}
                      onChange={(e) => setNotificationFilter(e.target.value as any)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">همه</option>
                      <option value="unread">خوانده نشده</option>
                      <option value="read">خوانده شده</option>
                    </select>
                    <select
                      value={notificationTypeFilter}
                      onChange={(e) => setNotificationTypeFilter(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">همه انواع</option>
                      <option value="info">اطلاعات</option>
                      <option value="success">موفقیت</option>
                      <option value="warning">هشدار</option>
                      <option value="error">خطا</option>
                      <option value="mission">ماموریت</option>
                      <option value="contact">تماس</option>
                      <option value="approval">تایید</option>
                      <option value="reminder">یادآوری</option>
                    </select>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        علامت‌گذاری همه به عنوان خوانده شده
                      </button>
                    )}
                  </div>

                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">در حال بارگذاری...</p>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      هیچ نوتیفیکیشنی وجود ندارد
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`
                            rounded-lg p-4 border transition-all
                            ${notification.isRead 
                              ? 'bg-gray-50 border-gray-200' 
                              : 'bg-blue-50 border-blue-200 shadow-sm'
                            }
                            hover:shadow-md
                          `}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-1">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h3 className={`font-semibold ${notification.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                                    {notification.title}
                                  </h3>
                                  <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                                </div>
                                {!notification.isRead && (
                                  <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap mr-2">
                                    جدید
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between mt-3">
                                <span className="text-xs text-gray-500">
                                  {notification.createdAt ? toPersianDate(new Date(notification.createdAt)) : ''}
                                </span>
                                <div className="flex items-center gap-2">
                                  {!notification.isRead && (
                                    <button
                                      onClick={() => handleMarkAsRead(notification.id.toString())}
                                      className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 hover:bg-blue-100 rounded"
                                    >
                                      علامت‌گذاری به عنوان خوانده شده
                                    </button>
                                  )}
                                  {notification.actionUrl && (
                                    <button
                                      onClick={() => router.push(notification.actionUrl)}
                                      className="text-xs text-green-600 hover:text-green-800 px-2 py-1 hover:bg-green-100 rounded"
                                    >
                                      مشاهده
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteNotification(notification.id.toString())}
                                    className="text-xs text-red-600 hover:text-red-800 px-2 py-1 hover:bg-red-100 rounded"
                                  >
                                    <Trash2 size={14} className="inline" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Reminders Tab */}
              {activeTab === 'reminders' && (
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                    <select
                      value={reminderFilter}
                      onChange={(e) => setReminderFilter(e.target.value as any)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">همه</option>
                      <option value="upcoming">آینده</option>
                      <option value="past">گذشته</option>
                      <option value="completed">انجام شده</option>
                    </select>
                    <button
                      onClick={() => setShowReminderModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus size={18} />
                      ایجاد یادآوری جدید
                    </button>
                  </div>

                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">در حال بارگذاری...</p>
                    </div>
                  ) : reminders.length === 0 && autoReminders.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      هیچ یادآوری وجود ندارد
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Auto Reminders (from assignments, contacts, workflow cards) */}
                      {autoReminders.map((reminder) => {
                        const isPast = reminder.isOverdue
                        const isNear = reminder.isNear && !reminder.isOverdue
                        return (
                          <div
                            key={reminder.id}
                            className={`
                              rounded-lg p-4 border transition-all cursor-pointer
                              ${reminder.isCompleted 
                                ? 'bg-gray-50 border-gray-200 opacity-60' 
                                : isPast
                                ? 'bg-red-50 border-red-300 shadow-sm'
                                : isNear
                                ? 'bg-orange-50 border-orange-200'
                                : 'bg-yellow-50 border-yellow-200'
                              }
                              hover:shadow-md
                            `}
                            onClick={() => reminder.actionUrl && router.push(reminder.actionUrl)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-1">
                                {reminder.type === 'assignment' ? (
                                  <Target className={reminder.isCompleted ? 'text-gray-400' : isPast ? 'text-red-600' : isNear ? 'text-orange-600' : 'text-yellow-600'} size={20} />
                                ) : reminder.type === 'contact' ? (
                                  <Phone className={reminder.isCompleted ? 'text-gray-400' : isPast ? 'text-red-600' : isNear ? 'text-orange-600' : 'text-yellow-600'} size={20} />
                                ) : (
                                  <Columns className={reminder.isCompleted ? 'text-gray-400' : isPast ? 'text-red-600' : isNear ? 'text-orange-600' : 'text-yellow-600'} size={20} />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <h3 className={`font-semibold ${reminder.isCompleted ? 'line-through text-gray-500' : isPast ? 'text-red-900' : 'text-gray-900'}`}>
                                      {reminder.title}
                                    </h3>
                                    {reminder.description && (
                                      <p className="text-sm text-gray-600 mt-1">{reminder.description}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {reminder.isCompleted && (
                                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full whitespace-nowrap">
                                        انجام شده
                                      </span>
                                    )}
                                    {!reminder.isCompleted && isPast && (
                                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full whitespace-nowrap font-bold">
                                        گذشته از موعد
                                      </span>
                                    )}
                                    {!reminder.isCompleted && isNear && !isPast && (
                                      <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full whitespace-nowrap">
                                        نزدیک به موعد
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                  <span className={`text-xs flex items-center gap-1 ${isPast ? 'text-red-700 font-semibold' : 'text-gray-500'}`}>
                                    <Calendar size={14} />
                                    {reminder.reminderAt ? toPersianDate(new Date(reminder.reminderAt)) : ''}
                                  </span>
                                  {reminder.actionUrl && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        router.push(reminder.actionUrl)
                                      }}
                                      className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 hover:bg-blue-100 rounded"
                                    >
                                      مشاهده
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}

                      {/* Manual Reminders */}
                      {reminders.map((reminder) => {
                        const isPast = !reminder.isCompleted && isReminderPast(reminder.reminderAt)
                        return (
                          <div
                            key={reminder.id}
                            className={`
                              rounded-lg p-4 border transition-all
                              ${reminder.isCompleted 
                                ? 'bg-gray-50 border-gray-200 opacity-60' 
                                : isPast
                                ? 'bg-red-50 border-red-300 shadow-sm'
                                : 'bg-yellow-50 border-yellow-200'
                              }
                              hover:shadow-md
                            `}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-1">
                                <Clock className={reminder.isCompleted ? 'text-gray-400' : isPast ? 'text-red-600' : 'text-yellow-600'} size={20} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <h3 className={`font-semibold ${reminder.isCompleted ? 'line-through text-gray-500' : isPast ? 'text-red-900' : 'text-gray-900'}`}>
                                      {reminder.title}
                                    </h3>
                                    {reminder.description && (
                                      <p className="text-sm text-gray-600 mt-1">{reminder.description}</p>
                                    )}
                                  </div>
                                  {reminder.isCompleted && (
                                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full whitespace-nowrap mr-2">
                                      انجام شده
                                    </span>
                                  )}
                                  {!reminder.isCompleted && isPast && (
                                    <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full whitespace-nowrap mr-2 font-bold">
                                      گذشته از موعد
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                  <span className={`text-xs flex items-center gap-1 ${isPast ? 'text-red-700 font-semibold' : 'text-gray-500'}`}>
                                    <Calendar size={14} />
                                    {reminder.reminderAt ? toPersianDate(new Date(reminder.reminderAt)) : ''}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {!reminder.isCompleted && (
                                      <button
                                        onClick={() => handleCompleteReminder(reminder.id.toString())}
                                        className="text-xs text-green-600 hover:text-green-800 px-2 py-1 hover:bg-green-100 rounded"
                                      >
                                        <CheckCircle size={14} className="inline" /> انجام شد
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteReminder(reminder.id.toString())}
                                      className="text-xs text-red-600 hover:text-red-800 px-2 py-1 hover:bg-red-100 rounded"
                                    >
                                      <Trash2 size={14} className="inline" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Missions Tab */}
              {activeTab === 'missions' && (
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  </div>

                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">در حال بارگذاری...</p>
                    </div>
                  ) : missions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      هیچ ماموریتی یافت نشد
                    </div>
                  ) : (
                    missions.map((mission) => (
                      <div
                        key={mission.id}
                        className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => router.push(`/assignments?id=${mission.id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-bold text-gray-900">ماموریت #{mission.id}</span>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(mission.status)}`}>
                                {getStatusLabel(mission.status)}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
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
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Contacts Tab */}
              {activeTab === 'contacts' && (
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="mb-6">
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
                  </div>

                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">در حال بارگذاری...</p>
                    </div>
                  ) : contacts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      هیچ تماسی یافت نشد
                    </div>
                  ) : (
                    contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => router.push(`/contacts?id=${contact.id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-bold text-gray-900">{contact.contactName || 'نامشخص'}</span>
                              <span className="text-gray-600">{contact.phoneNumber || '-'}</span>
                            </div>
                            <div className="text-sm text-gray-600">
                              <span className="font-semibold">مرکز: </span>
                              {contact.centerName || 'نامشخص'}
                            </div>
                            {contact.notes && (
                              <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                {contact.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Approvals Tab (Managers Only) */}
              {activeTab === 'approvals' && isManager && (
                <div className="space-y-4">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">در حال بارگذاری...</p>
                    </div>
                  ) : pendingApprovals.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      هیچ درخواست تاییدی در انتظار نیست
                    </div>
                  ) : (
                    pendingApprovals.map((mission) => (
                      <div
                        key={mission.id}
                        className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 hover:shadow-md transition-shadow"
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
                              onClick={() => handleApprove(mission)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <Check size={16} />
                              تایید
                            </button>
                            <button
                              onClick={() => handleReject(mission)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                            >
                              <X size={16} />
                              رد
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reminder Modal */}
        {showReminderModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">ایجاد یادآوری جدید</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">عنوان *</label>
                  <input
                    type="text"
                    value={newReminder.title}
                    onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="عنوان یادآوری"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">توضیحات</label>
                  <textarea
                    value={newReminder.description}
                    onChange={(e) => setNewReminder({ ...newReminder, description: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    rows={3}
                    placeholder="توضیحات (اختیاری)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">تاریخ و زمان یادآوری *</label>
                  <PersianDateTimePicker
                    value={newReminder.reminderAt}
                    onChange={(date) => setNewReminder({ ...newReminder, reminderAt: date || new Date() })}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateReminder}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    ایجاد
                  </button>
                  <button
                    onClick={() => {
                      setShowReminderModal(false)
                      setNewReminder({ title: '', description: '', reminderAt: new Date() })
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
      </MainLayout>
    </ProtectedRoute>
  )
}
