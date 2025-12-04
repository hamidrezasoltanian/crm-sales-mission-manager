'use client'

import { useState, useEffect } from 'react'
import { getPersonnel, createPersonnel, updatePersonnel, deletePersonnel, activatePersonnel, deactivatePersonnel } from '../lib/api'
import { showToast } from '../components/Toast'
import Link from 'next/link'
import { ArrowRight, CheckCircle, XCircle } from 'lucide-react'

export default function PersonnelPage() {
  const [personnel, setPersonnel] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPersonnel, setEditingPersonnel] = useState<any>(null)

  useEffect(() => {
    fetchPersonnel()
  }, [])

  const fetchPersonnel = async () => {
    setLoading(true)
    // Safety timeout - force loading to false after 65 seconds
    const safetyTimeout = setTimeout(() => {
      console.warn('[Personnel] Loading timeout - forcing state to false')
      setLoading(false)
    }, 65000)
    
    try {
      console.log('[Personnel] Fetching personnel...')
      const data = await getPersonnel()
      console.log('[Personnel] Personnel loaded:', data?.length || 0)
      setPersonnel(data || [])
    } catch (error: any) {
      console.error('[Personnel] Error fetching personnel:', error)
      setPersonnel([])
      alert('خطا در دریافت اطلاعات: ' + (error.response?.data?.error || error.message))
    } finally {
      clearTimeout(safetyTimeout)
      setLoading(false)
      console.log('[Personnel] Loading finished')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    const data: any = {
      first_name: formData.get('first_name'),
      last_name: formData.get('last_name'),
      phone: formData.get('phone'),
      email: formData.get('email') || null,
      username: formData.get('username') || null,
      telegramId: formData.get('telegramId') || null,
      role: formData.get('role') || 'staff',
      isActive: formData.get('isActive') === 'true'
    }
    
    // Add password if provided
    const password = formData.get('password')
    if (password && password.toString().trim()) {
      data.password = password.toString()
    }

    try {
      if (editingPersonnel) {
        await updatePersonnel(editingPersonnel._id || editingPersonnel.id, data)
        showToast('پرسنل با موفقیت به‌روزرسانی شد', 'success')
      } else {
        await createPersonnel(data)
        showToast('پرسنل با موفقیت اضافه شد', 'success')
      }
      await fetchPersonnel()
      setShowForm(false)
      setEditingPersonnel(null)
    } catch (error: any) {
      showToast(error.response?.data?.error || error.message || 'خطا در ذخیره', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('آیا مطمئن هستید؟')) {
      try {
        await deletePersonnel(id)
        showToast('پرسنل با موفقیت حذف شد', 'success')
        await fetchPersonnel()
      } catch (error: any) {
        showToast(error.response?.data?.error || error.message || 'خطا در حذف', 'error')
      }
    }
  }

  const handleActivate = async (id: string) => {
    try {
      await activatePersonnel(id)
      showToast('پرسنل فعال شد', 'success')
      await fetchPersonnel()
    } catch (error: any) {
      showToast(error.response?.data?.error || error.message || 'خطا در فعال‌سازی', 'error')
    }
  }

  const handleDeactivate = async (id: string) => {
    if (confirm('آیا مطمئن هستید که می‌خواهید این کاربر را غیرفعال کنید؟')) {
      try {
        await deactivatePersonnel(id)
        showToast('پرسنل غیرفعال شد', 'success')
        await fetchPersonnel()
      } catch (error: any) {
        showToast(error.response?.data?.error || error.message || 'خطا در غیرفعال‌سازی', 'error')
      }
    }
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 transition-colors">
            <ArrowRight size={18} />
            <span>بازگشت به داشبورد</span>
          </Link>
        </div>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800">مدیریت پرسنل</h1>
          </div>
          <button
            onClick={() => {
              setEditingPersonnel(null)
              setShowForm(true)
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            افزودن پرسنل
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">{editingPersonnel ? 'ویرایش' : 'افزودن'} پرسنل</h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">نام *</label>
                  <input type="text" name="first_name" required 
                    defaultValue={editingPersonnel?.first_name || editingPersonnel?.name?.split(' ')[0] || ''}
                    className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">نام خانوادگی *</label>
                  <input type="text" name="last_name" required 
                    defaultValue={editingPersonnel?.last_name || editingPersonnel?.name?.split(' ').slice(1).join(' ') || ''}
                    className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">نام کاربری</label>
                  <input type="text" name="username" defaultValue={editingPersonnel?.username || ''}
                    className="w-full px-4 py-2 border rounded-lg" dir="ltr" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">ایمیل</label>
                  <input type="email" name="email" defaultValue={editingPersonnel?.email || ''}
                    className="w-full px-4 py-2 border rounded-lg" dir="ltr" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">شماره تماس *</label>
                  <input type="text" name="phone" required defaultValue={editingPersonnel?.phone}
                    className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Telegram ID</label>
                  <input type="text" name="telegramId" defaultValue={editingPersonnel?.telegramId || ''}
                    className="w-full px-4 py-2 border rounded-lg" dir="ltr" />
                </div>
                {editingPersonnel && (
                  <div>
                    <label className="block text-sm font-medium mb-2">رمز عبور جدید (اختیاری)</label>
                    <input type="password" name="password" placeholder="خالی بگذارید برای عدم تغییر"
                      className="w-full px-4 py-2 border rounded-lg" />
                    <p className="text-xs text-gray-500 mt-1">در صورت نیاز به تغییر رمز عبور، مقدار جدید را وارد کنید</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-2">نقش</label>
                  <select name="role" defaultValue={editingPersonnel?.role || 'staff'}
                    className="w-full px-4 py-2 border rounded-lg">
                    <option value="staff">کارمند</option>
                    <option value="manager">مدیر</option>
                    <option value="admin">مدیر کل</option>
                    <option value="super_admin">سوپر ادمین</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">وضعیت</label>
                  <select name="isActive" defaultValue={editingPersonnel?.isActive !== false ? 'true' : 'false'}
                    className="w-full px-4 py-2 border rounded-lg">
                    <option value="true">فعال</option>
                    <option value="false">غیرفعال</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <button type="submit" className="bg-blue-500 text-white px-6 py-2 rounded-lg">
                  ذخیره
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingPersonnel(null); }}
                  className="bg-gray-300 px-6 py-2 rounded-lg">
                  انصراف
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-600"></div>
            <span>در حال بارگذاری پرسنل...</span>
          </div>
        )}
        
        {/* Personnel Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-right">نام</th>
                <th className="px-4 py-3 text-right">نام کاربری</th>
                <th className="px-4 py-3 text-right">ایمیل</th>
                <th className="px-4 py-3 text-right">شماره تماس</th>
                <th className="px-4 py-3 text-right">آیدی تلگرام</th>
                <th className="px-4 py-3 text-right">نقش</th>
                <th className="px-4 py-3 text-right">وضعیت</th>
                <th className="px-4 py-3 text-right">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {personnel.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    هیچ پرسنلی یافت نشد
                  </td>
                </tr>
              ) : (
                personnel.map((p: any) => (
                  <tr key={p._id || p.id} className="border-t">
                    <td className="px-4 py-3">{p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim()}</td>
                    <td className="px-4 py-3">{p.username || '-'}</td>
                    <td className="px-4 py-3">{p.email || '-'}</td>
                    <td className="px-4 py-3">{p.phone}</td>
                    <td className="px-4 py-3">{p.telegramId || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-sm ${
                        p.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                        p.role === 'admin' ? 'bg-red-100 text-red-800' :
                        p.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {p.role === 'super_admin' ? 'سوپر ادمین' : 
                         p.role === 'admin' ? 'مدیر کل' : 
                         p.role === 'manager' ? 'مدیر' : 'کارمند'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm ${
                        p.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {p.isActive ? (
                          <>
                            <CheckCircle size={14} />
                            <span>فعال</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={14} />
                            <span>غیرفعال</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => { setEditingPersonnel(p); setShowForm(true); }}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          ویرایش
                        </button>
                        {p.isActive ? (
                          <button 
                            onClick={() => handleDeactivate(p._id || p.id)}
                            className="text-yellow-600 hover:underline text-sm flex items-center gap-1"
                            title="غیرفعال کردن"
                          >
                            <XCircle size={14} />
                            غیرفعال
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleActivate(p._id || p.id)}
                            className="text-green-600 hover:underline text-sm flex items-center gap-1"
                            title="فعال کردن"
                          >
                            <CheckCircle size={14} />
                            فعال
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(p._id || p.id)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
