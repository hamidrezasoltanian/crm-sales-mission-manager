'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import { showToast } from './Toast'

declare global {
  interface Window {
    onTelegramAuth?: (user: any) => void
  }
}

interface TelegramLoginButtonProps {
  botName: string
  buttonSize?: 'large' | 'medium' | 'small'
  cornerRadius?: number
  requestAccess?: boolean
  usePic?: boolean
  lang?: string
}

export default function TelegramLoginButton({
  botName,
  buttonSize = 'large',
  cornerRadius = 0,
  requestAccess = true,
  usePic = true,
  lang = 'fa'
}: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    // Load Telegram Login Widget script
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botName)
    script.setAttribute('data-size', buttonSize)
    script.setAttribute('data-corner-radius', cornerRadius.toString())
    script.setAttribute('data-request-access', requestAccess ? 'write' : '')
    script.setAttribute('data-userpic', usePic.toString())
    script.setAttribute('data-lang', lang)
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.async = true

    if (containerRef.current) {
      containerRef.current.innerHTML = ''
      containerRef.current.appendChild(script)
    }

    // Set up global callback
    window.onTelegramAuth = async (user: any) => {
      try {
        // Call backend to verify and login
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(user)
        })

        const data = await response.json()

        if (response.ok && data.token) {
          // Store token
          localStorage.setItem('token', data.token)
          
          // Reload page to trigger auth context update
          showToast('ورود با Telegram موفقیت‌آمیز بود', 'success')
          window.location.href = '/'
        } else {
          showToast(data.message || 'خطا در ورود با Telegram', 'error')
          // If user not found, suggest registration
          if (response.status === 404) {
            setTimeout(() => {
              if (confirm('حساب کاربری یافت نشد. آیا می‌خواهید ثبت‌نام کنید؟')) {
                router.push('/register')
              }
            }, 1000)
          }
        }
      } catch (error: any) {
        console.error('Telegram login error:', error)
        showToast('خطا در ارتباط با سرور', 'error')
      }
    }

    return () => {
      // Cleanup
      if (window.onTelegramAuth) {
        delete window.onTelegramAuth
      }
    }
  }, [botName, buttonSize, cornerRadius, requestAccess, usePic, lang, router])

  return (
    <div ref={containerRef} className="flex justify-center my-4">
      {/* Telegram widget will be injected here */}
    </div>
  )
}

