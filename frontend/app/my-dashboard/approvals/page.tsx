'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import ProtectedRoute from '../../components/ProtectedRoute'
import EmployeeLayout from '../../components/EmployeeLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import { showToast } from '../../components/Toast'
import { getAssignments } from '../../lib/api'
import { toPersianDate } from '../../lib/dateUtils'
import { ArrowRight, Check, X, Eye, Bell } from 'lucide-react'
import Link from 'next/link'

export default function ApprovalsPage() {
  const { user, isManager } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [pendingMissions, setPendingMissions] = useState<any[]>([])
  const [selectedMission, setSelectedMission] = useState<any>(null)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [managerComment, setManagerComment] = useState('')
  const [personalPayment, setPersonalPayment] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (user && isManager) {
      loadPendingMissions()
    } else if (user && !isManager) {
      router.push('/my-dashboard')
      showToast('شما دسترسی به این صفحه را ندارید', 'error')
    }
  }, [user, isManager])

  const loadPendingMissions = async () => {
    setLoading(true)
    try {
      const response = await getAssignments({ status: 'pending' })
      const data = Array.isArray(response) 
        ? response 
        : (response?.data || [])
      setPendingMissions(data)
    } catch (error: any) {
      console.error('Error loading pending missions:', error)
      showToast('خطا در بارگذاری ماموریت‌های در انتظار تایید', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedMission || !user?.id) return

    setProcessing(true)
    try {
      const response = await fetch(`http://192.168.4.29:2001/api/assignments/${selectedMission.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          managerId: user.id,
          personalPayment: personalPayment || 0,
          managerComment: managerComment || null
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'خطا در تایید ماموریت')
      }

      showToast('ماموریت با موفقیت تایید شد', 'success')
      setShowApproveModal(false)
      setSelectedMission(null)
      setManagerComment('')
      setPersonalPayment(null)
      loadPendingMissions()
    } catch (error: any) {
      console.error('Error approving mission:', error)
      showToast('خطا در تایید ماموریت: ' + error.message, 'error')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedMission || !user?.id) return

    setProcessing(true)
    try {
      const response = await fetch(`http://192.168.4.29:2001/api/assignments/${selectedMission.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'rejected',
          userId: user.id,
          managerComment: managerComment || null
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'خطا در رد ماموریت')
      }

      showToast('ماموریت با موفقیت رد شد', 'success')
      setShowRejectModal(false)
      setSelectedMission(null)
      setManagerComment('')
      loadPendingMissions()
    } catch (error: any) {
      console.error('Error rejecting mission:', error)
      showToast('خطا در رد ماموریت: ' + error.message, 'error')
    } finally {
      setProcessing(false)
    }
  }

  if (!isManager) {
    return null
  }

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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                  کارتابل تایید ماموریت‌ها
                  {pendingMissions.length > 0 && (
                    <span className="bg-red-500 text-white text-lg px-3 py-1 rounded-full flex items-center gap-2">
                      <Bell size={18} />
                      {pendingMissions.length}
                    </span>
                  )}
                </h1>
                <p className="text-gray-600">
                  ماموریت‌های در انتظار تایید شما
                </p>
              </div>
            </div>
          </div>

          {/* Pending Missions List */}
          {pendingMissions.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Check className="mx-auto text-green-500 mb-4" size={48} />
              <p className="text-gray-600 text-lg">هیچ ماموریتی در انتظار تایید نیست</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingMissions.map((mission: any) => (
                <div
                  key={mission.id}
                  className="bg-white rounded-lg shadow p-6 border-r-4 border-yellow-500 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-bold text-gray-900">
                          ماموریت #{mission.id}
                        </h3>
                        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                          در انتظار تایید
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">پرسنل:</p>
                          <p className="font-semibold text-gray-900">{mission.personnelName || 'نامشخص'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">مرکز:</p>
                          <p className="font-semibold text-gray-900">{mission.centerName || 'نامشخص'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">تاریخ:</p>
                          <p className="font-semibold text-gray-900">
                            {mission.createdAt ? toPersianDate(new Date(mission.createdAt)) : 'نامشخص'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">هزینه کل:</p>
                          <p className="font-semibold text-gray-900">
                            {mission.totalCost ? `${mission.totalCost.toLocaleString('fa-IR')} تومان` : 'تعیین نشده'}
                          </p>
                        </div>
                      </div>

                      {mission.notes && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-600 mb-1">یادداشت:</p>
                          <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{mission.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 mr-4">
                      <button
                        onClick={() => {
                          setSelectedMission(mission)
                          setShowApproveModal(true)
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Check size={18} />
                        تایید
                      </button>
                      <button
                        onClick={() => {
                          setSelectedMission(mission)
                          setShowRejectModal(true)
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <X size={18} />
                        رد
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Approve Modal */}
          {showApproveModal && selectedMission && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">تایید ماموریت #{selectedMission.id}</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      پرداخت شخصی (تومان)
                    </label>
                    <input
                      type="number"
                      value={personalPayment || ''}
                      onChange={(e) => setPersonalPayment(e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="مبلغ پرداخت شخصی"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      یادداشت (اختیاری)
                    </label>
                    <textarea
                      value={managerComment}
                      onChange={(e) => setManagerComment(e.target.value)}
                      rows={3}
                      placeholder="یادداشت برای تایید..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleApprove}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <Check size={18} />
                    {processing ? 'در حال تایید...' : 'تایید'}
                  </button>
                  <button
                    onClick={() => {
                      setShowApproveModal(false)
                      setSelectedMission(null)
                      setManagerComment('')
                      setPersonalPayment(null)
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    انصراف
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reject Modal */}
          {showRejectModal && selectedMission && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">رد ماموریت #{selectedMission.id}</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    دلیل رد (اختیاری)
                  </label>
                  <textarea
                    value={managerComment}
                    onChange={(e) => setManagerComment(e.target.value)}
                    rows={3}
                    placeholder="دلیل رد ماموریت..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleReject}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    <X size={18} />
                    {processing ? 'در حال رد...' : 'رد'}
                  </button>
                  <button
                    onClick={() => {
                      setShowRejectModal(false)
                      setSelectedMission(null)
                      setManagerComment('')
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    انصراف
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

