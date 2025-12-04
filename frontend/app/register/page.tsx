'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { register } from '../lib/api'
import { showToast } from '../components/Toast'
import { LogIn, User, Phone, MessageSquare, Lock, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    telegramId: '',
    username: '',
    password: '',
    confirmPassword: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // اگر پسورد وارد شده، باید تکرار آن هم وارد شود
    if (formData.password && formData.password !== formData.confirmPassword) {
      showToast('رمز عبور و تکرار آن مطابقت ندارند', 'error')
      return
    }

    if (formData.password && formData.password.length < 6) {
      showToast('رمز عبور باید حداقل 6 کاراکتر باشد', 'error')
      return
    }

    setLoading(true)
    try {
      const response = await register({
        name: formData.name,
        phone: formData.phone,
        telegramId: formData.telegramId || undefined,
        username: formData.username || undefined,
        password: formData.password || undefined
      })
      
      const defaultPassword = response?.data?.defaultPassword || '123456'
      const username = response?.data?.username || formData.username || `user_${formData.phone.replace(/\D/g, '')}`
      const message = response?.data?.message || `ثبت‌نام موفق بود. رمز عبور پیش‌فرض: ${defaultPassword}`
      showToast(message, 'success')
      
      // نمایش پیام کامل در یک alert
      setTimeout(() => {
        alert(`ثبت‌نام موفق بود!\n\nنام کاربری شما: ${username}\nرمز عبور پیش‌فرض: ${defaultPassword}\n\nلطفاً پس از ورود، رمز عبور خود را تغییر دهید.`)
        router.push('/login')
      }, 500)
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'خطا در ثبت‌نام'
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4" dir="rtl">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-md border border-white/20">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600/20 rounded-full mb-4 border border-blue-500/30 ring-4 ring-blue-600/10">
            <User className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">ثبت‌نام در سیستم</h1>
          <p className="text-blue-200">لطفاً اطلاعات خود را وارد کنید</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-blue-100 block">نام و نام خانوادگی *</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-blue-300" />
              </div>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="block w-full pr-10 pl-3 py-3 bg-white/5 border border-blue-500/30 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="نام و نام خانوادگی"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-blue-100 block">شماره تماس *</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-blue-300" />
              </div>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="block w-full pr-10 pl-3 py-3 bg-white/5 border border-blue-500/30 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="09123456789"
                pattern="09\d{9}"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-blue-100 block">Telegram ID (اختیاری)</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <MessageSquare className="h-5 w-5 text-blue-300" />
              </div>
              <input
                type="text"
                value={formData.telegramId}
                onChange={(e) => setFormData({ ...formData, telegramId: e.target.value })}
                className="block w-full pr-10 pl-3 py-3 bg-white/5 border border-blue-500/30 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="@username یا ID عددی"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-blue-100 block">نام کاربری (اختیاری)</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-blue-300" />
              </div>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="block w-full pr-10 pl-3 py-3 bg-white/5 border border-blue-500/30 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="در صورت عدم وارد کردن، خودکار ایجاد می‌شود"
                dir="ltr"
              />
            </div>
            <p className="text-xs text-blue-300/70">در صورت عدم وارد کردن، از شماره تماس شما ساخته می‌شود</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-blue-100 block">رمز عبور (اختیاری)</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-blue-300" />
              </div>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="block w-full pr-10 pl-3 py-3 bg-white/5 border border-blue-500/30 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="در صورت عدم وارد کردن، رمز پیش‌فرض: 123456"
                dir="ltr"
                minLength={6}
              />
            </div>
            <p className="text-xs text-blue-300/70">در صورت عدم وارد کردن، رمز پیش‌فرض 123456 استفاده می‌شود</p>
          </div>

          {formData.password && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-blue-100 block">تکرار رمز عبور</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-blue-300" />
                </div>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="block w-full pr-10 pl-3 py-3 bg-white/5 border border-blue-500/30 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  dir="ltr"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`
              w-full py-3.5 px-4 rounded-xl font-bold text-white shadow-lg transition-all duration-200 transform hover:scale-[1.02]
              ${loading
                ? 'bg-blue-600/50 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/30'
              }
            `}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>در حال ثبت‌نام...</span>
              </div>
            ) : (
              'ثبت‌نام'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-blue-300/70">
            قبلاً ثبت‌نام کرده‌اید؟{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 underline">
              ورود به حساب کاربری
            </Link>
          </p>
        </div>

        <div className="mt-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
          <p className="text-xs text-blue-200 text-center">
            💡 رمز عبور پیش‌فرض: <strong>123456</strong><br />
            پس از ورود، لطفاً رمز عبور خود را تغییر دهید.
          </p>
        </div>
      </div>
    </div>
  )
}

