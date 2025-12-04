'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getProfile, updateProfile, changePassword } from '../lib/api'
import { showToast } from '../components/Toast'
import { User, Phone, MessageSquare, Lock, Save, Loader2, Mail, UserCircle, Shield } from 'lucide-react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import TwoFactorAuthSettings from '../components/TwoFactorAuthSettings'

export default function ProfilePage() {
  const { user: authUser } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    name: '',
    phone: '',
    email: '',
    telegramId: '',
    username: '',
    role: ''
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const data = await getProfile()
      setProfile(data)
      setFormData({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
        phone: data.phone || '',
        email: data.email || '',
        telegramId: data.telegramId || '',
        username: data.username || '',
        role: data.role || ''
      })
    } catch (error: any) {
      showToast('خطا در دریافت پروفایل', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Prepare data for update - use first_name and last_name instead of name
      const updateData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        telegramId: formData.telegramId
      }
      const updated = await updateProfile(updateData)
      setProfile(updated)
      showToast('پروفایل با موفقیت به‌روزرسانی شد', 'success')
      // Reload profile to get updated data
      await loadProfile()
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'خطا در به‌روزرسانی'
      showToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast('رمز عبور و تکرار آن مطابقت ندارند', 'error')
      return
    }

    if (passwordData.newPassword.length < 6) {
      showToast('رمز عبور باید حداقل 6 کاراکتر باشد', 'error')
      return
    }

    setChangingPassword(true)
    try {
      await changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      })
      showToast('رمز عبور با موفقیت تغییر کرد', 'success')
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'خطا در تغییر رمز عبور'
      showToast(message, 'error')
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 transition-colors">
            <ArrowRight size={18} />
            <span>بازگشت به داشبورد</span>
          </Link>
        </div>

        <h1 className="text-4xl font-bold text-gray-800 mb-8">پروفایل من</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <User className="w-6 h-6 text-blue-600" />
              اطلاعات شخصی
            </h2>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    نام
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    نام خانوادگی
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نام کاربری
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <UserCircle className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    dir="ltr"
                    placeholder="نام کاربری خود را وارد کنید"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">برای ورود به سیستم از این نام کاربری استفاده می‌کنید</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ایمیل
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    dir="ltr"
                    placeholder="example@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  شماره تماس
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    pattern="09\d{9}"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telegram ID (اختیاری)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <MessageSquare className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.telegramId}
                    onChange={(e) => setFormData({ ...formData, telegramId: e.target.value })}
                    className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="@username"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نقش
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Shield className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.role === 'super_admin' ? 'سوپر ادمین' : formData.role === 'admin' ? 'مدیر کل' : formData.role === 'manager' ? 'مدیر' : 'کارمند'}
                    className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    disabled
                    readOnly
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">نقش قابل تغییر نیست</p>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>در حال ذخیره...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>ذخیره تغییرات</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <Lock className="w-6 h-6 text-blue-600" />
              تغییر رمز عبور
            </h2>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  رمز عبور فعلی
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  رمز عبور جدید
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  minLength={6}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">حداقل 6 کاراکتر</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  تکرار رمز عبور جدید
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {changingPassword ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>در حال تغییر...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      <span>تغییر رمز عبور</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Account Information */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4">اطلاعات حساب کاربری</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">نام کاربری</p>
              <p className="text-lg font-medium">{profile?.username || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">نقش</p>
              <p className="text-lg font-medium">
                {profile?.role === 'admin' ? 'مدیر' : 
                 profile?.role === 'manager' ? 'مدیر میانی' : 
                 profile?.role === 'staff' ? 'کارمند' : profile?.role}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">وضعیت حساب</p>
              <p className="text-lg font-medium">
                <span className={`inline-block px-3 py-1 rounded-full text-sm ${
                  profile?.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {profile?.isActive ? 'فعال' : 'غیرفعال - در انتظار تایید'}
                </span>
              </p>
            </div>
            {profile?.createdAt && (
              <div>
                <p className="text-sm text-gray-600">تاریخ عضویت</p>
                <p className="text-lg font-medium">
                  {new Date(profile.createdAt).toLocaleDateString('fa-IR')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 2FA Settings */}
        <div className="mt-6">
          <TwoFactorAuthSettings />
        </div>
      </div>
    </main>
  )
}

