'use client'

import { useState } from 'react'
import { Mail, Loader2, CheckCircle, ArrowLeft } from 'lucide-react'
import { sendEmailOTP, verifyEmailOTP } from '../lib/api'
import { showToast } from './Toast'

interface EmailOTPLoginProps {
  onBack?: () => void
  onSuccess?: (token: string, user: any) => void
}

export default function EmailOTPLogin({ onBack, onSuccess }: EmailOTPLoginProps) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const handleSendOTP = async (e: React.FormEvent) => {
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
      await sendEmailOTP(email.trim())
      showToast('کد تأیید به ایمیل شما ارسال شد', 'success')
      setStep('code')
      setCountdown(300) // 5 minutes in seconds
      
      // Countdown timer
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (error: any) {
      console.error('Send OTP error:', error)
      const message = error.response?.data?.message || error.message || 'خطا در ارسال کد تأیید'
      showToast(message, 'error')
    } finally {
      setSending(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || code.length !== 6) {
      showToast('لطفاً کد 6 رقمی را وارد کنید', 'error')
      return
    }

    setVerifying(true)
    try {
      const result = await verifyEmailOTP(email.trim(), code.trim())
      
      if (result.token && result.user) {
        // Store token
        localStorage.setItem('token', result.token)
        
        showToast('ورود موفقیت‌آمیز بود', 'success')
        
        // Call success callback or reload page
        if (onSuccess) {
          onSuccess(result.token, result.user)
        } else {
          window.location.href = '/'
        }
      }
    } catch (error: any) {
      console.error('Verify OTP error:', error)
      const message = error.response?.data?.message || error.message || 'کد تأیید نامعتبر است'
      showToast(message, 'error')
      setCode('') // Clear code on error
    } finally {
      setVerifying(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (step === 'code') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">کد تأیید ارسال شد</h2>
          <p className="text-blue-200 text-sm">
            کد 6 رقمی به ایمیل <strong>{email}</strong> ارسال شد
          </p>
        </div>

        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-blue-100 block mb-2">
              کد تأیید
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                setCode(value)
              }}
              className="block w-full px-4 py-3 bg-white/5 border border-blue-500/30 rounded-xl text-white text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="000000"
              dir="ltr"
              maxLength={6}
              autoFocus
              required
            />
            {countdown > 0 && (
              <p className="text-xs text-blue-300/70 mt-2 text-center">
                زمان باقی‌مانده: {formatTime(countdown)}
              </p>
            )}
            {countdown === 0 && (
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setCode('')
                }}
                className="text-xs text-blue-400 hover:text-blue-300 mt-2 block mx-auto"
              >
                ارسال مجدد کد
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={verifying || code.length !== 6}
            className={`
              w-full py-3.5 px-4 rounded-xl font-bold text-white shadow-lg transition-all duration-200 transform hover:scale-[1.02]
              ${verifying || code.length !== 6
                ? 'bg-blue-600/50 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-green-600/30'
              }
            `}
          >
            {verifying ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>در حال تأیید...</span>
              </div>
            ) : (
              'تأیید و ورود'
            )}
          </button>
        </form>

        {onBack && (
          <button
            onClick={() => {
              setStep('email')
              setCode('')
              setCountdown(0)
            }}
            className="w-full flex items-center justify-center gap-2 text-blue-300 hover:text-blue-200 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            تغییر ایمیل
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 rounded-full mb-4 border border-blue-500/30">
          <Mail className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">ورود با ایمیل</h2>
        <p className="text-blue-200 text-sm">
          کد تأیید به ایمیل شما ارسال خواهد شد
        </p>
      </div>

      <form onSubmit={handleSendOTP} className="space-y-4">
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
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/30'
            }
          `}
        >
          {sending ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>در حال ارسال...</span>
            </div>
          ) : (
            'ارسال کد تأیید'
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

