'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { verifyMagicLink } from '../../lib/api'
import { showToast } from '../../components/Toast'
import LoadingSpinner from '../../components/LoadingSpinner'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

function MagicLinkContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    
    if (!token) {
      setStatus('error')
      setMessage('لینک نامعتبر است')
      return
    }

    const verify = async () => {
      try {
        const result = await verifyMagicLink(token)
        
        if (result.token && result.user) {
          // Store token
          localStorage.setItem('token', result.token)
          
          setStatus('success')
          setMessage('ورود موفقیت‌آمیز بود. در حال هدایت...')
          
          // Redirect after 1 second
          setTimeout(() => {
            window.location.href = '/'
          }, 1500)
        } else {
          setStatus('error')
          setMessage('لینک نامعتبر است')
        }
      } catch (error: any) {
        console.error('Verify magic link error:', error)
        setStatus('error')
        setMessage(error.response?.data?.message || error.message || 'لینک نامعتبر یا منقضی شده است')
      }
    }

    verify()
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4" dir="rtl">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-md border border-white/20 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-spin" />
            <h2 className="text-2xl font-bold text-white mb-2">در حال تأیید لینک...</h2>
            <p className="text-blue-200">لطفاً صبر کنید</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">ورود موفقیت‌آمیز</h2>
            <p className="text-blue-200">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">خطا</h2>
            <p className="text-blue-200 mb-4">{message}</p>
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
            >
              بازگشت به صفحه ورود
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function MagicLinkPage() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <MagicLinkContent />
    </Suspense>
  )
}

