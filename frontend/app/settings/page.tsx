'use client'

import { useState, useEffect } from 'react'
import { Settings, Save, Database, Bell, Shield, User, ArrowRight, Tag, Users, Lock } from 'lucide-react'
import Link from 'next/link'
import { getDiscountCodes, createDiscountCode, updateDiscountCode, deleteDiscountCode, getPersonnel, createPersonnel, updatePersonnel, deletePersonnel, getPermissionModules, getUserPermissions, bulkUpdatePermissions, getPersonnel as getPersonnelList } from '../lib/api'
import { Plus, Edit, Trash2, X, Check, XCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'discounts' | 'personnel' | 'permissions'>('general')
  const [settings, setSettings] = useState({
    notifications: true,
    autoSave: true,
    theme: 'light',
    language: 'fa',
  })
  const [codes, setCodes] = useState<any[]>([])
  const [personnel, setPersonnel] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [personnelLoading, setPersonnelLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showPersonnelForm, setShowPersonnelForm] = useState(false)
  const [editingCode, setEditingCode] = useState<any>(null)
  const [editingPersonnel, setEditingPersonnel] = useState<any>(null)
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
    if (activeTab === 'discounts') {
      loadCodes()
    } else if (activeTab === 'personnel') {
      loadPersonnel()
    }
  }, [activeTab])

  const loadPersonnel = async () => {
    try {
      setPersonnelLoading(true)
      const data = await getPersonnel()
      setPersonnel(data || [])
    } catch (error) {
      console.error('Error loading personnel:', error)
    } finally {
      setPersonnelLoading(false)
    }
  }

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

  const handleSave = () => {
    // TODO: Save settings to backend
    alert('تنظیمات با موفقیت ذخیره شد')
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 transition-colors">
          <ArrowRight size={18} />
          <span>بازگشت به داشبورد</span>
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">تنظیمات</h1>
        <p className="text-gray-600">مدیریت تنظیمات سیستم</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-lg mb-6">
        <div className="flex border-b overflow-x-auto">
          <button
            onClick={() => setActiveTab('general')}
            className={`
              flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap
              ${activeTab === 'general'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }
            `}
          >
            <Settings size={18} />
            تنظیمات عمومی
          </button>
          <button
            onClick={() => setActiveTab('discounts')}
            className={`
              flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap
              ${activeTab === 'discounts'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }
            `}
          >
            <Tag size={18} />
            کدهای تخفیف
          </button>
          <button
            onClick={() => setActiveTab('personnel')}
            className={`
              flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap
              ${activeTab === 'personnel'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }
            `}
          >
            <Users size={18} />
            پرسنل و تیم
          </button>
        </div>

        <div className="p-6">
          {/* General Settings Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
        {/* General Settings */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings className="text-blue-600" size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">تنظیمات عمومی</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-gray-700 font-medium">ذخیره خودکار</label>
                <p className="text-sm text-gray-500">ذخیره خودکار تغییرات</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoSave}
                  onChange={(e) => setSettings({ ...settings, autoSave: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-gray-700 font-medium">زبان</label>
                <p className="text-sm text-gray-500">زبان رابط کاربری</p>
              </div>
              <select
                value={settings.language}
                onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="fa">فارسی</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-100 rounded-lg">
              <Bell className="text-green-600" size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">اعلان‌ها</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-gray-700 font-medium">فعال کردن اعلان‌ها</label>
                <p className="text-sm text-gray-500">دریافت اعلان برای رویدادهای مهم</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications}
                  onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Database Info */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Database className="text-purple-600" size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">اطلاعات دیتابیس</h2>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">نوع دیتابیس</span>
              <span className="font-medium text-gray-900">SQLite</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">مسیر دیتابیس</span>
              <span className="font-medium text-gray-900 text-sm">backend/data/missions.db</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-600">وضعیت</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">متصل</span>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-red-100 rounded-lg">
              <Shield className="text-red-600" size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">امنیت</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-gray-700 font-medium">تغییر رمز عبور</label>
                <p className="text-sm text-gray-500">رمز عبور خود را تغییر دهید</p>
              </div>
              <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors">
                تغییر رمز
              </button>
            </div>
          </div>
        </div>
      </div>
          )}

          {/* Discount Codes Tab */}
          {activeTab === 'discounts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">مدیریت کدهای تخفیف</h2>
                <button
                  onClick={() => {
                    setEditingCode(null)
                    setFormData({
                      code: '',
                      discountType: 'fixed',
                      discountValue: 0,
                      maxUses: null,
                      validFrom: '',
                      validUntil: '',
                      isActive: true
                    })
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
                          setFormData({
                            code: '',
                            discountType: 'fixed',
                            discountValue: 0,
                            maxUses: null,
                            validFrom: '',
                            validUntil: '',
                            isActive: true
                          })
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                      >
                        <X size={24} />
                      </button>
                    </div>

                    <form onSubmit={async (e) => {
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
                        setFormData({
                          code: '',
                          discountType: 'fixed',
                          discountValue: 0,
                          maxUses: null,
                          validFrom: '',
                          validUntil: '',
                          isActive: true
                        })
                      } catch (error: any) {
                        alert('خطا: ' + (error.response?.data?.error || error.message))
                      }
                    }} className="space-y-4">
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
                            setFormData({
                              code: '',
                              discountType: 'fixed',
                              discountValue: 0,
                              maxUses: null,
                              validFrom: '',
                              validUntil: '',
                              isActive: true
                            })
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
                                  onClick={() => {
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
                                  }}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="ویرایش"
                                >
                                  <Edit size={18} />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm('آیا مطمئن هستید که می‌خواهید این کد تخفیف را حذف کنید؟')) {
                                      return
                                    }
                                    try {
                                      await deleteDiscountCode(code.id.toString())
                                      await loadCodes()
                                    } catch (error: any) {
                                      alert('خطا: ' + (error.response?.data?.error || error.message))
                                    }
                                  }}
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
          )}

          {/* Personnel Tab */}
          {activeTab === 'personnel' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">مدیریت پرسنل و تیم</h2>
                <button
                  onClick={() => {
                    setEditingPersonnel(null)
                    setShowPersonnelForm(true)
                  }}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg flex items-center gap-2"
                >
                  <Plus size={20} />
                  افزودن پرسنل
                </button>
              </div>

              {/* Form Modal */}
              {showPersonnelForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-gray-900">
                        {editingPersonnel ? 'ویرایش پرسنل' : 'افزودن پرسنل'}
                      </h2>
                      <button
                        onClick={() => {
                          setShowPersonnelForm(false)
                          setEditingPersonnel(null)
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                      >
                        <X size={24} />
                      </button>
                    </div>

                    <form onSubmit={async (e) => {
                      e.preventDefault()
                      const formData = new FormData(e.target as HTMLFormElement)
                      const data = {
                        name: formData.get('name'),
                        phone: formData.get('phone'),
                        telegramId: formData.get('telegramId') || null,
                        role: formData.get('role') || 'staff'
                      }

                      try {
                        if (editingPersonnel) {
                          await updatePersonnel(editingPersonnel._id || editingPersonnel.id, data)
                        } else {
                          await createPersonnel(data)
                        }
                        await loadPersonnel()
                        setShowPersonnelForm(false)
                        setEditingPersonnel(null)
                      } catch (error: any) {
                        alert('خطا: ' + (error.response?.data?.error || error.message))
                      }
                    }} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">نام *</label>
                          <input
                            type="text"
                            name="name"
                            required
                            defaultValue={editingPersonnel?.name}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">شماره تماس *</label>
                          <input
                            type="text"
                            name="phone"
                            required
                            defaultValue={editingPersonnel?.phone}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Telegram ID</label>
                          <input
                            type="text"
                            name="telegramId"
                            defaultValue={editingPersonnel?.telegramId}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">نقش</label>
                          <select
                            name="role"
                            defaultValue={editingPersonnel?.role || 'staff'}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="staff">کارمند</option>
                            <option value="manager">مدیر</option>
                            <option value="admin">مدیر کل</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-4 pt-4">
                        <button
                          type="submit"
                          className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                        >
                          ذخیره
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPersonnelForm(false)
                            setEditingPersonnel(null)
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

              {/* Personnel List */}
              {personnelLoading ? (
                <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-4">در حال بارگذاری...</p>
                </div>
              ) : personnel.length === 0 ? (
                <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                  <Users className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-600">هیچ پرسنلی یافت نشد</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                        <tr>
                          <th className="text-right py-4 px-6 font-semibold">نام</th>
                          <th className="text-right py-4 px-6 font-semibold">شماره تماس</th>
                          <th className="text-right py-4 px-6 font-semibold">آیدی تلگرام</th>
                          <th className="text-right py-4 px-6 font-semibold">نقش</th>
                          <th className="text-right py-4 px-6 font-semibold">عملیات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {personnel.map((p: any) => (
                          <tr key={p._id || p.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-4 px-6 text-sm font-medium text-gray-900">{p.name}</td>
                            <td className="py-4 px-6 text-sm text-gray-700">{p.phone}</td>
                            <td className="py-4 px-6 text-sm text-gray-700">{p.telegramId || '-'}</td>
                            <td className="py-4 px-6">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                p.role === 'admin' ? 'bg-red-100 text-red-800' :
                                p.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {p.role === 'admin' ? 'مدیر کل' : p.role === 'manager' ? 'مدیر' : 'کارمند'}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditingPersonnel(p)
                                    setShowPersonnelForm(true)
                                  }}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="ویرایش"
                                >
                                  <Edit size={18} />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm('آیا مطمئن هستید که می‌خواهید این پرسنل را حذف کنید؟')) {
                                      return
                                    }
                                    try {
                                      await deletePersonnel((p._id || p.id).toString())
                                      await loadPersonnel()
                                    } catch (error: any) {
                                      alert('خطا: ' + (error.response?.data?.error || error.message))
                                    }
                                  }}
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
          )}
        </div>
      </div>

      {/* Save Button - Only for General Settings */}
      {activeTab === 'general' && (
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg flex items-center gap-2"
          >
            <Save size={20} />
            ذخیره تنظیمات
          </button>
        </div>
      )}

      {/* Permissions Tab */}
      {activeTab === 'permissions' && (
        <PermissionsTab />
      )}
    </div>
  )
}

// Permissions Tab Component
function PermissionsTab() {
  const { user: currentUser } = useAuth()
  const [personnel, setPersonnel] = useState<any[]>([])
  const [modules, setModules] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<number | null>(null)
  const [userPermissions, setUserPermissions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [permissionMatrix, setPermissionMatrix] = useState<Record<string, Record<string, boolean>>>({})

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedUser) {
      loadUserPermissions(selectedUser)
    }
  }, [selectedUser])

  const loadData = async () => {
    try {
      setLoading(true)
      const [personnelData, modulesData] = await Promise.all([
        getPersonnelList(),
        getPermissionModules()
      ])
      setPersonnel(personnelData || [])
      setModules(modulesData?.modules || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUserPermissions = async (userId: number) => {
    try {
      setLoading(true)
      const data = await getUserPermissions(userId)
      const permissions = data?.permissions || []
      setUserPermissions(permissions)

      // Build permission matrix
      const matrix: Record<string, Record<string, boolean>> = {}
      modules.forEach(module => {
        matrix[module.key] = {
          read: permissions.some((p: any) => p.moduleKey === module.key && p.permission === 'read' && p.granted),
          write: permissions.some((p: any) => p.moduleKey === module.key && p.permission === 'write' && p.granted),
          delete: permissions.some((p: any) => p.moduleKey === module.key && p.permission === 'delete' && p.granted),
          manage: permissions.some((p: any) => p.moduleKey === module.key && p.permission === 'manage' && p.granted)
        }
      })
      setPermissionMatrix(matrix)
    } catch (error) {
      console.error('Error loading user permissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePermissionToggle = (moduleKey: string, permission: string, granted: boolean) => {
    setPermissionMatrix(prev => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [permission]: granted
      }
    }))
  }

  const handleSavePermissions = async () => {
    if (!selectedUser) return

    try {
      setSaving(true)
      const permissions: Array<{
        moduleKey: string
        permission: string
        granted: boolean
      }> = []

      Object.entries(permissionMatrix).forEach(([moduleKey, perms]) => {
        Object.entries(perms).forEach(([perm, granted]) => {
          permissions.push({
            moduleKey,
            permission: perm,
            granted
          })
        })
      })

      await bulkUpdatePermissions({
        userId: selectedUser,
        permissions
      })

      alert('دسترسی‌ها با موفقیت ذخیره شدند')
      await loadUserPermissions(selectedUser)
    } catch (error: any) {
      console.error('Error saving permissions:', error)
      alert('خطا در ذخیره دسترسی‌ها: ' + (error.response?.data?.message || error.message))
    } finally {
      setSaving(false)
    }
  }

  // Check if current user can manage permissions
  const canManagePermissions = currentUser?.role === 'super_admin' || currentUser?.role === 'admin'

  if (!canManagePermissions) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">شما دسترسی به این بخش را ندارید</p>
      </div>
    )
  }

  // Group modules by category
  const modulesByCategory = modules.reduce((acc: any, module: any) => {
    const category = module.category || 'other'
    if (!acc[category]) acc[category] = []
    acc[category].push(module)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">مدیریت سطح دسترسی</h2>
      </div>

      {/* User Selection */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          انتخاب کاربر
        </label>
        <select
          value={selectedUser || ''}
          onChange={(e) => setSelectedUser(e.target.value ? parseInt(e.target.value) : null)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">-- انتخاب کاربر --</option>
          {personnel.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim()} ({p.role})
            </option>
          ))}
        </select>
      </div>

      {selectedUser && (
        <>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">در حال بارگذاری...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Permission Matrix */}
              {Object.entries(modulesByCategory).map(([category, categoryModules]: [string, any]) => (
                <div key={category} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                  <div className="bg-gray-100 px-6 py-3 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 capitalize">{category}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ماژول
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            مشاهده
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ایجاد/ویرایش
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            حذف
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            مدیریت
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {categoryModules.map((module: any) => (
                          <tr key={module.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {module.icon && <span className="text-gray-400">{module.icon}</span>}
                                <span className="text-sm font-medium text-gray-900">{module.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <button
                                onClick={() => handlePermissionToggle(module.key, 'read', !permissionMatrix[module.key]?.read)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                  permissionMatrix[module.key]?.read
                                    ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                {permissionMatrix[module.key]?.read ? <Check size={16} /> : <XCircle size={16} />}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <button
                                onClick={() => handlePermissionToggle(module.key, 'write', !permissionMatrix[module.key]?.write)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                  permissionMatrix[module.key]?.write
                                    ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                {permissionMatrix[module.key]?.write ? <Check size={16} /> : <XCircle size={16} />}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <button
                                onClick={() => handlePermissionToggle(module.key, 'delete', !permissionMatrix[module.key]?.delete)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                  permissionMatrix[module.key]?.delete
                                    ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                {permissionMatrix[module.key]?.delete ? <Check size={16} /> : <XCircle size={16} />}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <button
                                onClick={() => handlePermissionToggle(module.key, 'manage', !permissionMatrix[module.key]?.manage)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                  permissionMatrix[module.key]?.manage
                                    ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                {permissionMatrix[module.key]?.manage ? <Check size={16} /> : <XCircle size={16} />}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* Save Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleSavePermissions}
                  disabled={saving}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      در حال ذخیره...
                    </>
                  ) : (
                    <>
                      <Save size={20} />
                      ذخیره دسترسی‌ها
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {!selectedUser && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Shield className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">لطفاً یک کاربر را انتخاب کنید</p>
        </div>
      )}
    </div>
  )
}

