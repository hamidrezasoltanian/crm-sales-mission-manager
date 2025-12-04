'use client'

import { useState, useEffect } from 'react'
import { Shield, ShieldCheck, ShieldOff, Key, Loader2, Copy, CheckCircle } from 'lucide-react'
import { check2FA, enable2FA, disable2FA, regenerateBackupCodes } from '../lib/api'
import { showToast } from './Toast'

interface TwoFactorAuthSettingsProps {
  // userId is no longer needed - it's extracted from the token by the backend
}

export default function TwoFactorAuthSettings({}: TwoFactorAuthSettingsProps) {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enabling, setEnabling] = useState(false)
  const [disabling, setDisabling] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    load2FAStatus()
  }, [])

  const load2FAStatus = async () => {
    try {
      // userId is now extracted from the token by the backend
      const data = await check2FA()
      setEnabled(data.enabled || false)
    } catch (error: any) {
      console.error('Error loading 2FA status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEnable = async () => {
    setEnabling(true)
    try {
      const result = await enable2FA('email')
      setEnabled(true)
      setBackupCodes(result.backupCodes || [])
      setShowBackupCodes(true)
      showToast('احراز هویت دو مرحله‌ای فعال شد', 'success')
    } catch (error: any) {
      console.error('Error enabling 2FA:', error)
      showToast(error.response?.data?.message || 'خطا در فعال‌سازی 2FA', 'error')
    } finally {
      setEnabling(false)
    }
  }

  const handleDisable = async () => {
    if (!confirm('آیا مطمئن هستید که می‌خواهید احراز هویت دو مرحله‌ای را غیرفعال کنید؟')) {
      return
    }

    setDisabling(true)
    try {
      await disable2FA()
      setEnabled(false)
      setBackupCodes([])
      setShowBackupCodes(false)
      showToast('احراز هویت دو مرحله‌ای غیرفعال شد', 'success')
    } catch (error: any) {
      console.error('Error disabling 2FA:', error)
      showToast(error.response?.data?.message || 'خطا در غیرفعال‌سازی 2FA', 'error')
    } finally {
      setDisabling(false)
    }
  }

  const handleRegenerateBackupCodes = async () => {
    if (!confirm('آیا مطمئن هستید؟ کدهای پشتیبان قبلی دیگر قابل استفاده نخواهند بود.')) {
      return
    }

    try {
      const result = await regenerateBackupCodes()
      setBackupCodes(result.backupCodes || [])
      setShowBackupCodes(true)
      showToast('کدهای پشتیبان جدید ایجاد شدند', 'success')
    } catch (error: any) {
      console.error('Error regenerating backup codes:', error)
      showToast(error.response?.data?.message || 'خطا در ایجاد کدهای پشتیبان', 'error')
    }
  }

  const copyBackupCodes = () => {
    const codesText = backupCodes.join('\n')
    navigator.clipboard.writeText(codesText)
    setCopied(true)
    showToast('کدهای پشتیبان کپی شدند', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
        <Shield className="w-6 h-6 text-blue-600" />
        احراز هویت دو مرحله‌ای (2FA)
      </h2>

      {!enabled ? (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>توصیه می‌شود:</strong> برای امنیت بیشتر حساب کاربری خود، احراز هویت دو مرحله‌ای را فعال کنید.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-gray-700">چگونه کار می‌کند؟</h3>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>پس از وارد کردن رمز عبور، کد تأیید به ایمیل شما ارسال می‌شود</li>
              <li>کدهای پشتیبان برای مواقع اضطراری در اختیار شما قرار می‌گیرد</li>
              <li>امنیت حساب کاربری شما به طور قابل توجهی افزایش می‌یابد</li>
            </ul>
          </div>

          <button
            onClick={handleEnable}
            disabled={enabling}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {enabling ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>در حال فعال‌سازی...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                <span>فعال‌سازی 2FA</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-800">احراز هویت دو مرحله‌ای فعال است</span>
            </div>
            <p className="text-sm text-green-700">
              حساب کاربری شما با امنیت بالاتری محافظت می‌شود.
            </p>
          </div>

          {showBackupCodes && backupCodes.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  کدهای پشتیبان
                </h3>
                <button
                  onClick={copyBackupCodes}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>کپی شد</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>کپی</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-blue-700 mb-3">
                این کدها را در جای امنی نگهداری کنید. هر کد فقط یکبار قابل استفاده است.
              </p>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((code, index) => (
                  <div
                    key={index}
                    className="bg-white border border-blue-300 rounded px-3 py-2 text-center"
                  >
                    {code}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowBackupCodes(false)}
                className="mt-3 text-xs text-blue-600 hover:text-blue-800"
              >
                بستن
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleRegenerateBackupCodes}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded-md flex items-center justify-center gap-2"
            >
              <Key className="w-5 h-5" />
              <span>ایجاد کدهای پشتیبان جدید</span>
            </button>
            <button
              onClick={handleDisable}
              disabled={disabling}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {disabling ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>در حال غیرفعال‌سازی...</span>
                </>
              ) : (
                <>
                  <ShieldOff className="w-5 h-5" />
                  <span>غیرفعال‌سازی 2FA</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

