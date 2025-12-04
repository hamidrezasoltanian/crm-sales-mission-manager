'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../../../contexts/AuthContext'
import ProtectedRoute from '../../../components/ProtectedRoute'
import EmployeeLayout from '../../../components/EmployeeLayout'
import { showToast } from '../../../components/Toast'
import { createContact } from '../../../lib/api'
import CenterSearch from '../../../components/CenterSearch'
import { ArrowRight, Save, X, Plus, Trash2 } from 'lucide-react'
import LoadingSpinner from '../../../components/LoadingSpinner'

function NewContactPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [submitting, setSubmitting] = useState(false)
  
  // Form data
  const [selectedCenters, setSelectedCenters] = useState<any[]>([])
  const [centerNotes, setCenterNotes] = useState<Record<number, string>>({})
  const [centerTags, setCenterTags] = useState<Record<number, string>>({})
  const [tempCenter, setTempCenter] = useState<any>(null)

  useEffect(() => {
    // If centerId is in query params, load and add it
    const centerId = searchParams.get('centerId')
    if (centerId && !selectedCenters.find(c => c.id === parseInt(centerId))) {
      setTempCenter({ id: parseInt(centerId) })
    }
  }, [searchParams])

  const tagOptions = [
    { value: 'lead', label: 'سرنخ' },
    { value: 'opportunity', label: 'فرصت' },
    { value: 'customer', label: 'مشتری' },
    { value: 'old_customer', label: 'قدیمی' }
  ]

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
    const newTags = { ...centerTags }
    delete newNotes[centerId]
    delete newTags[centerId]
    setCenterNotes(newNotes)
    setCenterTags(newTags)
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

    setSubmitting(true)
    try {
      const createdContacts = []
      
      for (const center of selectedCenters) {
        const contactData: any = {
          personnelId: user.id,
          centerId: center.id,
          contactType: 'province',
          notes: centerNotes[center.id] || null,
          tags: centerTags[center.id] || null
        }

        try {
          const contact = await createContact(contactData)
          createdContacts.push(contact)
        } catch (error: any) {
          console.error(`Error creating contact for center ${center.id}:`, error)
          showToast(`خطا در ثبت تماس برای ${center.name}: ${error.response?.data?.error || error.message}`, 'error')
        }
      }

      if (createdContacts.length > 0) {
        showToast(`${createdContacts.length} تماس با موفقیت ثبت شد`, 'success')
        router.push('/my-dashboard/contacts')
      }
    } catch (error: any) {
      console.error('Error creating contacts:', error)
      showToast('خطا در ثبت تماس: ' + (error.response?.data?.error || error.message), 'error')
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
              ثبت تماس استان
            </h1>
            <p className="text-gray-600">
              ثبت تماس با مراکز استان - می‌توانید چند مرکز را انتخاب کنید
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
                    placeholder="جستجو بر اساس نام مرکز، استان یا کارشناس..."
                    filters={{ province: undefined }}
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
                <div className="mt-4 space-y-4">
                  {selectedCenters.map((center) => (
                    <div key={center.id} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">{center.name}</p>
                          {center.city && (
                            <p className="text-xs text-gray-600 mt-1">{center.city}{center.province && center.province !== center.city ? ` - ${center.province}` : ''}</p>
                          )}
                          {center.tags && (
                            <p className="text-xs text-gray-500 mt-1">
                              وضعیت فعلی: {center.tags === 'lead' ? 'سرنخ' : center.tags === 'opportunity' ? 'فرصت' : center.tags === 'customer' ? 'مشتری' : center.tags === 'old_customer' ? 'قدیمی' : center.tags}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCenter(center.id)}
                          className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      
                      {/* Notes for this center */}
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          یادداشت تماس
                        </label>
                        <textarea
                          value={centerNotes[center.id] || ''}
                          onChange={(e) => setCenterNotes({ ...centerNotes, [center.id]: e.target.value })}
                          placeholder="یادداشت مربوط به تماس..."
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      {/* Tags for this center */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          برچسب (فقط یک برچسب قابل انتخاب است)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {tagOptions.map((tag) => {
                            const isSelected = centerTags[center.id] === tag.value
                            return (
                              <button
                                key={tag.value}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    const newTags = { ...centerTags }
                                    delete newTags[center.id]
                                    setCenterTags(newTags)
                                  } else {
                                    setCenterTags({ ...centerTags, [center.id]: tag.value })
                                  }
                                }}
                                className={`
                                  px-3 py-1 rounded-lg text-xs font-medium transition-colors
                                  ${isSelected
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }
                                `}
                              >
                                {tag.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={submitting || selectedCenters.length === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={20} />
                {submitting ? 'در حال ثبت...' : `ثبت ${selectedCenters.length} تماس`}
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

export default function NewContactPage() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <NewContactPageContent />
    </Suspense>
  )
}
