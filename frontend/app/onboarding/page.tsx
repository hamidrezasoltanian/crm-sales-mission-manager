'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { CheckCircle, ArrowRight, User, Target, Phone, Settings, Loader2 } from 'lucide-react'
import Link from 'next/link'

const steps = [
  {
    id: 1,
    title: 'خوش آمدید',
    description: 'به سیستم مدیریت یکپارچه خوش آمدید',
    icon: User,
    content: (
      <div className="space-y-4">
        <p className="text-gray-700">
          این سیستم به شما امکان مدیریت ماموریت‌ها، تماس‌ها و کارهای روزمره را می‌دهد.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">نکات مهم:</h4>
          <ul className="list-disc list-inside text-blue-800 space-y-1 text-sm">
            <li>تمام فعالیت‌های شما ثبت می‌شود</li>
            <li>می‌توانید از Telegram Bot نیز استفاده کنید</li>
            <li>برای سوالات با مدیر تماس بگیرید</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 2,
    title: 'ماموریت‌ها',
    description: 'چگونه ماموریت ایجاد و مدیریت کنیم',
    icon: Target,
    content: (
      <div className="space-y-4">
        <p className="text-gray-700">
          می‌توانید ماموریت‌های جدید ایجاد کنید و وضعیت آن‌ها را رهگیری کنید.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <h5 className="font-semibold text-green-900 mb-1">ایجاد ماموریت</h5>
            <p className="text-sm text-green-800">از منوی "ماموریت‌ها" استفاده کنید</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h5 className="font-semibold text-blue-900 mb-1">Telegram Bot</h5>
            <p className="text-sm text-blue-800">از ربات Telegram نیز می‌توانید استفاده کنید</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 3,
    title: 'برد عملیات',
    description: 'مدیریت کارها با Kanban Board',
    icon: Settings,
    content: (
      <div className="space-y-4">
        <p className="text-gray-700">
          از برد عملیات برای مدیریت کارها، ماموریت‌ها و تماس‌ها استفاده کنید.
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>کارت‌ها را بین ستون‌ها جابجا کنید</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>گزارشات و فایل‌ها را به کارت‌ها اضافه کنید</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>افراد را در گزارشات تگ کنید</span>
          </div>
        </div>
      </div>
    )
  }
]

export default function OnboardingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = async () => {
    try {
      // Mark onboarding as completed
      localStorage.setItem('onboarding_completed', 'true')
      setCompleted(true)
      
      // Redirect to dashboard after a moment
      setTimeout(() => {
        router.push('/')
      }, 1500)
    } catch (error) {
      console.error('Error completing onboarding:', error)
    }
  }

  const handleSkip = () => {
    localStorage.setItem('onboarding_completed', 'true')
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">عالی! 🎉</h2>
          <p className="text-gray-600 mb-4">راهنمای شما تکمیل شد</p>
          <p className="text-sm text-gray-500">در حال هدایت به داشبورد...</p>
        </div>
      </div>
    )
  }

  const step = steps[currentStep]
  const StepIcon = step.icon

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4" dir="rtl">
      <div className="max-w-4xl mx-auto py-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              مرحله {currentStep + 1} از {steps.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              رد کردن
            </button>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
              <StepIcon className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">{step.title}</h1>
            <p className="text-gray-600">{step.description}</p>
          </div>

          <div className="min-h-[200px]">
            {step.content}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              currentStep === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            قبلی
          </button>

          <div className="flex gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-blue-600 w-8'
                    : index < currentStep
                    ? 'bg-green-500'
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            {currentStep === steps.length - 1 ? (
              <>
                <span>شروع کار</span>
                <CheckCircle className="w-5 h-5" />
              </>
            ) : (
              <>
                <span>بعدی</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

