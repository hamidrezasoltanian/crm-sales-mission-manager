'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { LogIn, Loader2, User, Lock, MessageSquare, Mail, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'
import TelegramLoginButton from '../components/TelegramLoginButton'
import EmailOTPLogin from '../components/EmailOTPLogin'
import MagicLinkLogin from '../components/MagicLinkLogin'

export default function LoginPage() {
  // Cleanup any stray keyboard event listeners that might cause errors
  useEffect(() => {
    // Add a global error handler for uncaught errors (with capture phase)
    const handleError = (event: ErrorEvent) => {
      if (event.message && (
        event.message.includes('Cannot read properties of undefined (reading \'length\')') ||
        (event.message.includes('length') && event.filename && event.filename.includes('page-events'))
      )) {
        event.preventDefault()
        event.stopPropagation()
        console.debug('Suppressed keyboard event error:', event.message)
        return false
      }
    }

    // Add error handler in capture phase to catch errors early
    window.addEventListener('error', handleError, true)
    
    // Also add unhandledrejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && event.reason.message && event.reason.message.includes('length')) {
        event.preventDefault()
        console.debug('Suppressed unhandled promise rejection:', event.reason.message)
      }
    }
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError, true)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [telegramBotName, setTelegramBotName] = useState<string | null>(null)
  const [loginMethod, setLoginMethod] = useState<'default' | 'email' | 'telegram' | 'magic'>('default')
  const { login } = useAuth()

  useEffect(() => {
    // Get Telegram bot username from environment or use default
    // Bot username: atenazistdarman_bot
    // Note: Telegram Login requires a public domain (not localhost or IP)
    // For development, use ngrok or localtunnel (see TELEGRAM_CSP_FIX.md)
    const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'atenazistdarman_bot'
    // Check if we're on a public domain (not localhost or IP)
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      const isLocal = hostname === 'localhost' || hostname.startsWith('127.') || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')
      if (isLocal && !hostname.includes('ngrok') && !hostname.includes('loca.lt')) {
        // Disable Telegram Login on local IP addresses
        console.warn('⚠️ Telegram Login disabled on local IP. Use ngrok for development (see TELEGRAM_CSP_FIX.md)')
        setTelegramBotName(null)
        return
      }
    }
    setTelegramBotName(botName)
  }, [])

  const [requires2FA, setRequires2FA] = useState(false)
  const [twoFACode, setTwoFACode] = useState('')
  const [verifying2FA, setVerifying2FA] = useState(false)
  const [twoFAUserId, setTwoFAUserId] = useState<number | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username) return

    setLoggingIn(true)
    try {
      const { login: apiLogin } = await import('../lib/api')
      const result = await apiLogin({ username, password })
      
      // Check if 2FA is required
      if (result?.requires2FA) {
        setRequires2FA(true)
        setTwoFAUserId(result.userId)
        return
      }
      
      // Normal login success - use context login
      await login({ username, password })
    } catch (error: any) {
      console.error('Login error:', error)
      // Check if 2FA is required from error response
      if (error.response?.data?.requires2FA) {
        setRequires2FA(true)
        setTwoFAUserId(error.response.data.userId)
      }
    } finally {
      setLoggingIn(false)
    }
  }

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!twoFACode || twoFACode.length !== 6 || !twoFAUserId) return

    setVerifying2FA(true)
    try {
      const { loginWith2FA } = await import('../lib/api')
      const result = await loginWith2FA(username, password, twoFACode)
      
      if (result.token && result.user) {
        localStorage.setItem('token', result.token)
        window.location.href = '/'
      }
    } catch (error: any) {
      console.error('2FA verification error:', error)
      alert(error.response?.data?.message || 'کد تأیید نامعتبر است')
      setTwoFACode('')
    } finally {
      setVerifying2FA(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4" dir="rtl">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-md border border-white/20">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600/20 rounded-full mb-4 border border-blue-500/30 ring-4 ring-blue-600/10">
            <LogIn className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">پورتال جامع مدیریت</h1>
          <p className="text-blue-200">لطفاً برای ورود اطلاعات خود را وارد کنید</p>
        </div>

        {requires2FA ? (
          <form onSubmit={handleVerify2FA} className="space-y-6">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-white mb-2">کد تأیید دو مرحله‌ای</h2>
              <p className="text-blue-200 text-sm">
                کد 6 رقمی به ایمیل شما ارسال شد
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-blue-100 block">
                کد تأیید
              </label>
              <input
                type="text"
                value={twoFACode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setTwoFACode(value)
                }}
                className="block w-full px-4 py-3 bg-white/5 border border-blue-500/30 rounded-xl text-white text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="000000"
                dir="ltr"
                maxLength={6}
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              disabled={verifying2FA || twoFACode.length !== 6}
              className={`
                w-full py-3.5 px-4 rounded-xl font-bold text-white shadow-lg transition-all duration-200 transform hover:scale-[1.02]
                ${verifying2FA || twoFACode.length !== 6
                  ? 'bg-blue-600/50 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-green-600/30'
                }
              `}
            >
              {verifying2FA ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>در حال تأیید...</span>
                </div>
              ) : (
                'تأیید و ورود'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setRequires2FA(false)
                setTwoFACode('')
                setTwoFAUserId(null)
              }}
              className="w-full text-sm text-blue-300 hover:text-blue-200"
            >
              بازگشت
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-blue-100 block">نام کاربری</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-blue-300" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full pr-10 pl-3 py-3 bg-white/5 border border-blue-500/30 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="نام کاربری خود را وارد کنید"
                dir="ltr"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-blue-100 block">رمز عبور</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-blue-300" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pr-10 pl-3 py-3 bg-white/5 border border-blue-500/30 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>
            <p className="text-xs text-blue-300/70 text-left mt-1">* برای ورود با ID قدیمی، رمز را خالی بگذارید</p>
          </div>

          <button
            type="submit"
            disabled={loggingIn}
            className={`
              w-full py-3.5 px-4 rounded-xl font-bold text-white shadow-lg transition-all duration-200 transform hover:scale-[1.02]
              ${loggingIn
                ? 'bg-blue-600/50 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/30'
              }
            `}
          >
            {loggingIn ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>در حال بررسی...</span>
              </div>
            ) : (
              'ورود به حساب کاربری'
            )}
          </button>
          </form>
        )}

        {!requires2FA && (
          <>
            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/20"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-slate-900/50 text-blue-200">یا</span>
              </div>
            </div>

            {/* Email OTP Login */}
            {loginMethod === 'email' ? (
              <EmailOTPLogin
                onBack={() => setLoginMethod('default')}
                onSuccess={(token, user) => {
                  window.location.href = '/'
                }}
              />
            ) : loginMethod === 'telegram' && telegramBotName ? (
              <div className="mb-6">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                  <p className="text-sm text-blue-200">ورود با Telegram</p>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
                  <p className="text-xs text-yellow-200 text-center mb-1">
                    ⚠️ برای استفاده از Telegram Login، باید domain این سایت در تنظیمات Bot در @BotFather ثبت شود.
                  </p>
                  <p className="text-xs text-yellow-300/70 text-center">
                    Domain فعلی: {typeof window !== 'undefined' ? window.location.hostname : 'localhost'}
                  </p>
                  <p className="text-xs text-yellow-300/70 text-center mt-1">
                    راهنما: فایل TELEGRAM_LOGIN_SETUP.md را مطالعه کنید
                  </p>
                </div>
                <TelegramLoginButton 
                  botName={telegramBotName}
                  buttonSize="large"
                  cornerRadius={12}
                  requestAccess={true}
                  usePic={true}
                  lang="fa"
                />
                <p className="text-xs text-blue-300/70 text-center mt-2">
                  با کلیک روی دکمه بالا، وارد حساب Telegram خود شوید
                </p>
                <button
                  onClick={() => setLoginMethod('default')}
                  className="w-full mt-4 text-sm text-blue-300 hover:text-blue-200"
                >
                  بازگشت
                </button>
              </div>
        ) : (
          <>
            {/* Alternative Login Methods */}
            {loginMethod === 'magic' ? (
              <MagicLinkLogin onBack={() => setLoginMethod('default')} />
            ) : (
              <div className={`grid gap-3 ${telegramBotName ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <button
                  onClick={() => setLoginMethod('email')}
                  className="flex flex-col items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-blue-500/30 rounded-xl text-blue-200 hover:bg-white/10 transition-all"
                >
                  <Mail className="w-5 h-5" />
                  <span className="text-xs">کد ایمیل</span>
                </button>
                <button
                  onClick={() => setLoginMethod('magic')}
                  className="flex flex-col items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-blue-500/30 rounded-xl text-blue-200 hover:bg-white/10 transition-all"
                >
                  <LinkIcon className="w-5 h-5" />
                  <span className="text-xs">لینک جادویی</span>
                </button>
                {telegramBotName && (
                  <button
                    onClick={() => setLoginMethod('telegram')}
                    className="flex flex-col items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-blue-500/30 rounded-xl text-blue-200 hover:bg-white/10 transition-all"
                    title="برای استفاده از Telegram Login، باید domain در تنظیمات Bot ثبت شود"
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span className="text-xs">Telegram</span>
                  </button>
                )}
              </div>
            )}
          </>
        )}

            <div className="mt-6 text-center">
              <p className="text-sm text-blue-300/70 mb-2">
                حساب کاربری ندارید؟{' '}
                <Link href="/register" className="text-blue-400 hover:text-blue-300 underline font-medium">
                  ثبت‌نام کنید
                </Link>
              </p>
            </div>
            
            <div className="mt-4 text-center">
              <p className="text-xs text-blue-300/50">
                سامانه یکپارچه مدیریت ماموریت و فروش &copy; ۲۰۲۵
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
