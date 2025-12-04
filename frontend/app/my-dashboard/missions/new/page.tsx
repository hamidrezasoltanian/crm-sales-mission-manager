'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../../../contexts/AuthContext'
import ProtectedRoute from '../../../components/ProtectedRoute'
import EmployeeLayout from '../../../components/EmployeeLayout'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { showToast } from '../../../components/Toast'
import { createAssignment, getDiscountCodes } from '../../../lib/api'
import CenterSearch from '../../../components/CenterSearch'
import LocationPicker from '../../../components/LocationPicker'
import PersianDatePicker from '../../../components/PersianDatePicker'
import { ArrowRight, Save, X, Plus, Trash2 } from 'lucide-react'

function NewMissionPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Form data
  const [selectedCenters, setSelectedCenters] = useState<any[]>([])
  const [centerNotes, setCenterNotes] = useState<Record<number, string>>({})
  const [missionDate, setMissionDate] = useState<Date | null>(new Date())
  const [notes, setNotes] = useState('')
  const [snapLocation, setSnapLocation] = useState<{ lat: number, lng: number, address: string } | null>(null)
  const [snapCost, setSnapCost] = useState<number | null>(null)
  const [discountCode, setDiscountCode] = useState<string>('')
  const [discountCodeId, setDiscountCodeId] = useState<number | null>(null)
  const [discountCodes, setDiscountCodes] = useState<any[]>([])
  const [calculatingCost, setCalculatingCost] = useState(false)
  const [tempCenter, setTempCenter] = useState<any>(null)

  useEffect(() => {
    loadDiscountCodes()
  }, [])

  useEffect(() => {
    // If centerId is in query params, load and add it
    const centerId = searchParams.get('centerId')
    if (centerId && !selectedCenters.find(c => c.id === parseInt(centerId))) {
      // Load center data (you might need to fetch it from API)
      // For now, we'll just set it as tempCenter and let user add it
      setTempCenter({ id: parseInt(centerId) })
    }
  }, [searchParams])

  const loadDiscountCodes = async () => {
    try {
      const codes = await getDiscountCodes()
      setDiscountCodes(Array.isArray(codes) ? codes : [])
    } catch (error) {
      console.error('Error loading discount codes:', error)
    }
  }

  const addCenter = () => {
    if (tempCenter && !selectedCenters.find(c => c.id === tempCenter.id)) {
      setSelectedCenters([...selectedCenters, tempCenter])
      setTempCenter(null)
    } else if (tempCenter) {
      showToast('این مرکز قبلاً اضافه شده است', 'warning')
    }
  }

  const removeCenter = (centerId: number) => {
    setSelectedCenters(selectedCenters.filter(c => c.id !== centerId))
    const newNotes = { ...centerNotes }
    delete newNotes[centerId]
    setCenterNotes(newNotes)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.id) {
      showToast('خطا در شناسایی کاربر', 'error')
      return
    }

    if (selectedCenters.length === 0) {
      showToast('لطفاً حداقل یک مرکز را انتخاب کنید', 'error')
      return
    }

    if (!missionDate) {
      showToast('لطفاً تاریخ ماموریت را انتخاب کنید', 'error')
      return
    }

    setSubmitting(true)
    try {
      const createdAssignments = []
      
      for (const center of selectedCenters) {
        const assignmentData: any = {
          personnelId: user.id,
          centerId: center.id,
          notes: centerNotes[center.id] || notes || null,
          createdAt: missionDate.toISOString()
        }

        // Add snap location if available
        if (snapLocation && snapLocation.lat && snapLocation.lng) {
          assignmentData.snapLocationLatitude = snapLocation.lat
          assignmentData.snapLocationLongitude = snapLocation.lng
          assignmentData.snapLocationAddress = snapLocation.address || null
        }

        // Add snap cost if available (divide by number of centers)
        if (snapCost !== null && snapCost > 0) {
          assignmentData.snapCost = Math.round(snapCost / selectedCenters.length)
        }

        // Add discount code if provided
        if (discountCodeId) {
          const foundCode = discountCodes.find((code: any) => code.id === discountCodeId)
          if (foundCode && foundCode.isActive) {
            assignmentData.discountCode = foundCode.code
            assignmentData.discountCodeId = foundCode.id
          }
        }

        try {
          const assignment = await createAssignment(assignmentData)
          createdAssignments.push(assignment)
        } catch (error: any) {
          console.error(`Error creating assignment for center ${center.id}:`, error)
          showToast(`خطا در ثبت ماموریت برای ${center.name}: ${error.response?.data?.error || error.message}`, 'error')
        }
      }

      if (createdAssignments.length > 0) {
        showToast(`${createdAssignments.length} ماموریت با موفقیت ثبت شد`, 'success')
        router.push('/my-dashboard/missions')
      }
    } catch (error: any) {
      console.error('Error creating assignments:', error)
      showToast('خطا در ثبت ماموریت: ' + (error.response?.data?.error || error.message), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ProtectedRoute>
      <EmployeeLayout>
        <div className="p-4 md:p-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowRight size={18} />
              <span>بازگشت</span>
            </button>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              ثبت ماموریت جدید
            </h1>
            <p className="text-gray-600">
              فرم ثبت ماموریت حضوری - می‌توانید چند مرکز را انتخاب کنید
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 md:p-8 space-y-6">
            {/* Center Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                انتخاب مراکز <span className="text-red-500">*</span>
                <span className="text-gray-500 text-xs mr-2">({selectedCenters.length} مرکز انتخاب شده)</span>
              </label>
              
              {/* Center Search */}
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <CenterSearch
                    onSelect={setTempCenter}
                    selectedCenter={tempCenter}
                    placeholder="جستجو و انتخاب مرکز..."
                  />
                </div>
                <button
                  type="button"
                  onClick={addCenter}
                  disabled={!tempCenter}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Plus size={18} />
                  افزودن
                </button>
              </div>

              {/* Selected Centers List */}
              {selectedCenters.length > 0 && (
                <div className="mt-4 space-y-2">
                  {selectedCenters.map((center) => (
                    <div key={center.id} className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{center.name}</p>
                        {center.city && (
                          <p className="text-xs text-gray-600 mt-1">{center.city}{center.province && center.province !== center.city ? ` - ${center.province}` : ''}</p>
                        )}
                        <textarea
                          value={centerNotes[center.id] || ''}
                          onChange={(e) => setCenterNotes({ ...centerNotes, [center.id]: e.target.value })}
                          placeholder="یادداشت مخصوص این مرکز (اختیاری)"
                          rows={2}
                          className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCenter(center.id)}
                        className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mission Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تاریخ ماموریت <span className="text-red-500">*</span>
              </label>
              <PersianDatePicker
                value={missionDate}
                onChange={setMissionDate}
                placeholder="انتخاب تاریخ..."
              />
            </div>

            {/* General Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                یادداشت عمومی (برای همه مراکز)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="یادداشت عمومی مربوط به ماموریت..."
              />
            </div>

            {/* Snap Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                موقعیت اسنپ (اختیاری)
              </label>
              <LocationPicker
                onLocationSelect={(lat, lng, address) => {
                  setSnapLocation({ lat, lng, address })
                }}
                initialLocation={snapLocation || undefined}
              />
            </div>

            {/* Snap Cost */}
            {snapLocation && selectedCenters.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  هزینه اسنپ کل (تقسیم بین {selectedCenters.length} مرکز)
                </label>
                <input
                  type="number"
                  value={snapCost || ''}
                  onChange={(e) => setSnapCost(e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="هزینه اسنپ کل (تومان)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {snapCost && (
                  <p className="mt-2 text-sm text-gray-600">
                    هزینه کل: {snapCost.toLocaleString('fa-IR')} تومان
                    {selectedCenters.length > 1 && (
                      <span className="mr-2">({Math.round(snapCost / selectedCenters.length).toLocaleString('fa-IR')} تومان برای هر مرکز)</span>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Discount Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                کد تخفیف (اختیاری)
              </label>
              <select
                value={discountCodeId || ''}
                onChange={(e) => {
                  const selectedId = e.target.value ? parseInt(e.target.value) : null
                  setDiscountCodeId(selectedId)
                  if (selectedId) {
                    const selectedCode = discountCodes.find((code: any) => code.id === selectedId)
                    setDiscountCode(selectedCode?.code || '')
                  } else {
                    setDiscountCode('')
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">بدون کد تخفیف</option>
                {discountCodes
                  .filter((code: any) => code.isActive)
                  .map((code: any) => {
                    const discountText = code.discountType === 'fixed' 
                      ? `${code.discountValue.toLocaleString('fa-IR')} تومان`
                      : `${code.discountValue}%`
                    return (
                      <option key={code.id} value={code.id}>
                        {code.code} - {discountText}
                      </option>
                    )
                  })}
              </select>
              {discountCodeId && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  {(() => {
                    const selectedCode = discountCodes.find((code: any) => code.id === discountCodeId)
                    if (!selectedCode) return null
                    const discountText = selectedCode.discountType === 'fixed'
                      ? `${selectedCode.discountValue.toLocaleString('fa-IR')} تومان`
                      : `${selectedCode.discountValue}%`
                    return (
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">کد انتخاب شده:</span> {selectedCode.code} 
                        {' - '}
                        <span className="text-green-700">تخفیف: {discountText}</span>
                      </p>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={submitting || selectedCenters.length === 0 || !missionDate}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={20} />
                {submitting ? 'در حال ثبت...' : `ثبت ${selectedCenters.length} ماموریت`}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X size={20} />
                انصراف
              </button>
            </div>
          </form>
        </div>
      </EmployeeLayout>
    </ProtectedRoute>
  )
}

export default function NewMissionPage() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <NewMissionPageContent />
    </Suspense>
  )
}
