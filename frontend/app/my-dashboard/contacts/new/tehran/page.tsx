'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../../contexts/AuthContext'
import ProtectedRoute from '../../../../components/ProtectedRoute'
import EmployeeLayout from '../../../../components/EmployeeLayout'
import { showToast } from '../../../../components/Toast'
import { createContact, getCenters } from '../../../../lib/api'
import CenterSearch from '../../../../components/CenterSearch'
import { ArrowRight, Save, X } from 'lucide-react'

export default function NewTehranContactPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  
  // Form data
  const [selectedCenter, setSelectedCenter] = useState<any>(null)
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])

  const tagOptions = [
    { value: 'lead', label: 'سرنخ' },
    { value: 'opportunity', label: 'فرصت' },
    { value: 'customer', label: 'مشتری' },
    { value: 'old_customer', label: 'قدیمی' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.id) {
      showToast('خطا در شناسایی کاربر', 'error')
      return
    }

    if (!selectedCenter) {
      showToast('لطفاً مرکز را انتخاب کنید', 'error')
      return
    }

    setSubmitting(true)
    try {
      const contactData: any = {
        personnelId: user.id,
        centerId: selectedCenter.id,
        contactType: 'tehran',
        notes: notes || null,
        tags: tags.length > 0 ? tags : null
      }

      await createContact(contactData)
      showToast('تماس با موفقیت ثبت شد', 'success')
      router.push('/my-dashboard/contacts')
    } catch (error: any) {
      console.error('Error creating contact:', error)
      showToast('خطا در ثبت تماس: ' + (error.response?.data?.error || error.message), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleTag = (tagValue: string) => {
    if (tags.includes(tagValue)) {
      setTags(tags.filter(t => t !== tagValue))
    } else {
      // Only allow one tag at a time
      setTags([tagValue])
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
              ثبت تماس تهران
            </h1>
            <p className="text-gray-600">
              ثبت تماس با مراکز تهران
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 md:p-8 space-y-6">
            {/* Center Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                انتخاب مرکز <span className="text-red-500">*</span>
              </label>
              <CenterSearch
                onSelect={setSelectedCenter}
                selectedCenter={selectedCenter}
                placeholder="جستجو در مراکز تهران..."
                filters={{ 
                  province: 'تهران',
                  type: 'tehran'
                }}
              />
              {selectedCenter && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">مرکز انتخاب شده:</span> {selectedCenter.name}
                    {selectedCenter.city && ` - ${selectedCenter.city}`}
                  </p>
                  {selectedCenter.tags && (
                    <p className="text-xs text-gray-600 mt-1">
                      وضعیت فعلی: {selectedCenter.tags}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                یادداشت تماس
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="یادداشت مربوط به تماس..."
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                برچسب (فقط یک برچسب قابل انتخاب است)
              </label>
              <div className="flex flex-wrap gap-2">
                {tagOptions.map((tag) => {
                  const isSelected = tags.includes(tag.value)
                  return (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={() => toggleTag(tag.value)}
                      className={`
                        px-4 py-2 rounded-lg text-sm font-medium transition-colors
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
              {tags.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  برچسب انتخاب شده: {tagOptions.find(t => tags.includes(t.value))?.label}
                </p>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={submitting || !selectedCenter}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={20} />
                {submitting ? 'در حال ثبت...' : 'ثبت تماس'}
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

