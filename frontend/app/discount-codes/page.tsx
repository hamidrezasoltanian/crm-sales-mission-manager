'use client'

import { useEffect, useState } from 'react'
import { getDiscountCodes, createDiscountCode, updateDiscountCode, deleteDiscountCode } from '../lib/api'
import { Plus, Edit, Trash2, Save, X, Tag, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function DiscountCodesPage() {
  const [codes, setCodes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCode, setEditingCode] = useState<any>(null)
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'fixed',
    discountValue: 0,
    maxUses: null as number | null,
    validFrom: '',
    validUntil: '',
    isActive: true
  })

  useEffect(() => {
    loadCodes()
  }, [])

  const loadCodes = async () => {
    try {
      setLoading(true)
      const data = await getDiscountCodes()
      setCodes(data || [])
    } catch (error) {
      console.error('Error loading discount codes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingCode) {
        await updateDiscountCode(editingCode.id.toString(), formData)
      } else {
        await createDiscountCode(formData)
      }
      await loadCodes()
      setShowForm(false)
      setEditingCode(null)
      resetForm()
    } catch (error: any) {
      alert('خطا: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('آیا مطمئن هستید که می‌خواهید این کد تخفیف را حذف کنید؟')) {
      return
    }
    try {
      await deleteDiscountCode(id.toString())
      await loadCodes()
    } catch (error: any) {
      alert('خطا: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleEdit = (code: any) => {
    setEditingCode(code)
    setFormData({
      code: code.code || '',
      discountType: code.discountType || 'fixed',
      discountValue: code.discountValue || 0,
      maxUses: code.maxUses || null,
      validFrom: code.validFrom ? code.validFrom.split('T')[0] : '',
      validUntil: code.validUntil ? code.validUntil.split('T')[0] : '',
      isActive: code.isActive !== undefined ? code.isActive : true
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      code: '',
      discountType: 'fixed',
      discountValue: 0,
      maxUses: null,
      validFrom: '',
      validUntil: '',
      isActive: true
    })
  }

  return (
    <div className="p-8">
      {/* Back Button */}
      <div className="mb-6">
        <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 transition-colors">
          <ArrowRight size={18} />
          <span>بازگشت به داشبورد</span>
        </Link>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">کدهای تخفیف</h1>
          <p className="text-gray-600">مدیریت کدهای تخفیف اسنپ</p>
        </div>
        <button
          onClick={() => {
            setEditingCode(null)
            resetForm()
            setShowForm(true)
          }}
          className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg flex items-center gap-2"
        >
          <Plus size={20} />
          کد تخفیف جدید
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingCode ? 'ویرایش کد تخفیف' : 'کد تخفیف جدید'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false)
                  setEditingCode(null)
                  resetForm()
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  کد تخفیف *
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="مثال: SNAP2024"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    نوع تخفیف *
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                  >
                    <option value="fixed">مبلغ ثابت (تومان)</option>
                    <option value="percentage">درصدی (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {formData.discountType === 'fixed' ? 'مبلغ تخفیف (تومان) *' : 'درصد تخفیف *'}
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step={formData.discountType === 'percentage' ? '0.1' : '1'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
                    placeholder={formData.discountType === 'fixed' ? '10000' : '10'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    حداکثر استفاده (اختیاری)
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.maxUses || ''}
                    onChange={(e) => setFormData({ ...formData, maxUses: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="نامحدود"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    وضعیت
                  </label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.isActive ? '1' : '0'}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value === '1' })}
                  >
                    <option value="1">فعال</option>
                    <option value="0">غیرفعال</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    تاریخ شروع (اختیاری)
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    تاریخ پایان (اختیاری)
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {editingCode ? 'ذخیره تغییرات' : 'ایجاد کد تخفیف'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingCode(null)
                    resetForm()
                  }}
                  className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  لغو
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Codes List */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">در حال بارگذاری...</p>
        </div>
      ) : codes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <Tag className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-600">هیچ کد تخفیفی یافت نشد</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <tr>
                  <th className="text-right py-4 px-6 font-semibold">کد</th>
                  <th className="text-right py-4 px-6 font-semibold">نوع</th>
                  <th className="text-right py-4 px-6 font-semibold">مقدار</th>
                  <th className="text-right py-4 px-6 font-semibold">استفاده</th>
                  <th className="text-right py-4 px-6 font-semibold">وضعیت</th>
                  <th className="text-right py-4 px-6 font-semibold">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr key={code.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 text-sm font-medium text-gray-900">{code.code}</td>
                    <td className="py-4 px-6 text-sm text-gray-700">
                      {code.discountType === 'fixed' ? 'مبلغ ثابت' : 'درصدی'}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-900">
                      {code.discountType === 'fixed' 
                        ? `${code.discountValue.toLocaleString('fa-IR')} تومان`
                        : `${code.discountValue}%`
                      }
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-700">
                      {code.currentUses || 0} / {code.maxUses || '∞'}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        code.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {code.isActive ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(code)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="ویرایش"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(code.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

