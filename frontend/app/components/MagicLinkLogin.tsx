'use client'

import { useState } from 'react'
import { Mail, Loader2, CheckCircle, ArrowLeft, Link as LinkIcon } from 'lucide-react'
import { sendMagicLink } from '../lib/api'
import { showToast } from './Toast'

interface MagicLinkLoginProps {
  onBack?: () => void
}

export default function MagicLinkLogin({ onBack }: MagicLinkLoginProps) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      showToast('لطفاً ایمیل خود را وارد کنید', 'error')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      showToast('فرمت ایمیل نامعتبر است', 'error')
      return
    }

    setSending(true)
    try {
      await sendMagicLink(email.trim())
      showToast('لینک ورود به ایمیل شما ارسال شد', 'success')
      setSent(true)
    } catch (error: any) {
      console.error('Send magic link error:', error)
      const message = error.response?.data?.message || error.message || 'خطا در ارسال لینک'
      showToast(message, 'error')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">لینک ارسال شد</h2>
          <p className="text-blue-200 text-sm mb-4">
            لینک ورود به ایمیل <strong>{email}</strong> ارسال شد
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-right">
            <p className="text-sm text-blue-800 mb-2">
              <strong>نکات مهم:</strong>
            </p>
            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
              <li>لینک به مدت 15 دقیقه معتبر است</li>
              <li>لینک فقط یکبار قابل استفاده است</li>
              <li>اگر ایمیل را دریافت نکردید، پوشه Spam را بررسی کنید</li>
            </ul>
          </div>
        </div>

        {onBack && (
          <button
            onClick={() => {
              setSent(false)
              setEmail('')
            }}
            className="w-full flex items-center justify-center gap-2 text-blue-300 hover:text-blue-200 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            ارسال مجدد لینک
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 rounded-full mb-4 border border-blue-500/30">
          <LinkIcon className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">ورود با لینک جادویی</h2>
        <p className="text-blue-200 text-sm">
          لینک ورود بدون نیاز به رمز عبور به ایمیل شما ارسال می‌شود
        </p>
      </div>

      <form onSubmit={handleSendMagicLink} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-blue-100 block mb-2">
            آدرس ایمیل
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-blue-300" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full pr-10 pl-3 py-3 bg-white/5 border border-blue-500/30 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="example@domain.com"
              dir="ltr"
              required
              autoFocus
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={sending}
          className={`
            w-full py-3.5 px-4 rounded-xl font-bold text-white shadow-lg transition-all duration-200 transform hover:scale-[1.02]
            ${sending
              ? 'bg-blue-600/50 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30'
            }
          `}
        >
          {sending ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>در حال ارسال...</span>
            </div>
          ) : (
            'ارسال لینک ورود'
          )}
        </button>
      </form>

      {onBack && (
        <button
          onClick={onBack}
          className="w-full flex items-center justify-center gap-2 text-blue-300 hover:text-blue-200 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          بازگشت به روش‌های دیگر
        </button>
      )}
    </div>
  )
}

