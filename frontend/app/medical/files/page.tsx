'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Filter, Plus, Edit, Trash2, Download, Upload, FileText, Stethoscope, ArrowRight } from 'lucide-react'
import { toPersianDate } from '../../lib/dateUtils'
import { useAuth } from '../../contexts/AuthContext'
import { showToast } from '../../components/Toast'
import ProtectedRoute from '../../components/ProtectedRoute'
import MainLayout from '../../components/MainLayout'
import { getMedicalFiles, getMedicalCategories, uploadMedicalFile, deleteMedicalFile, downloadMedicalFile } from '../../lib/api'

export default function MedicalFilesPage() {
  const router = useRouter()
  const { user, isAdmin } = useAuth()
  const [files, setFiles] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    categoryId: '',
    patientName: '',
    doctorName: '',
  })
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    category: '',
    patientName: '',
    doctorName: '',
    description: '',
    date: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadFiles()
  }, [filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const categoriesData = await getMedicalCategories()
      setCategories(Array.isArray(categoriesData) ? categoriesData : (categoriesData?.data || []))
      await loadFiles()
    } catch (error: any) {
      // Handle service unavailable errors gracefully
      if (error.response?.status === 503 || error.response?.status === 500) {
        console.warn('[Medical Categories] Service unavailable')
        setCategories([])
        // Don't show error toast for unavailable service
      } else {
        console.error('Error loading data:', error)
        showToast('خطا در بارگذاری دسته‌بندی‌ها', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const loadFiles = async () => {
    try {
      const response = await getMedicalFiles({
        category: filters.categoryId || undefined,
        search: filters.search || undefined,
        limit: 100
      })
      let data = Array.isArray(response) ? response : (response?.data || [])
      
      // Filter by patient name
      if (filters.patientName) {
        const patientSearch = filters.patientName.toLowerCase()
        data = data.filter((f: any) => 
          f.patient_name?.toLowerCase().includes(patientSearch)
        )
      }
      
      // Filter by doctor name
      if (filters.doctorName) {
        const doctorSearch = filters.doctorName.toLowerCase()
        data = data.filter((f: any) => 
          f.doctor_name?.toLowerCase().includes(doctorSearch)
        )
      }
      
      setFiles(data)
    } catch (error: any) {
      // Handle service unavailable errors gracefully
      if (error.response?.status === 503 || error.response?.status === 500) {
        console.warn('[Medical Files] Service unavailable, showing empty list')
        setFiles([])
        showToast('سیستم مدیریت فایل‌های پزشکی در دسترس نیست', 'warning')
      } else {
        console.error('Error loading files:', error)
        showToast('خطا در بارگذاری فایل‌ها', 'error')
      }
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadForm.file) {
      showToast('لطفاً فایلی انتخاب کنید', 'error')
      return
    }
    try {
      const formData = new FormData()
      formData.append('file', uploadForm.file)
      if (uploadForm.patientName) formData.append('patient_name', uploadForm.patientName)
      if (uploadForm.doctorName) formData.append('doctor_name', uploadForm.doctorName)
      if (uploadForm.description) formData.append('description', uploadForm.description)
      if (uploadForm.category) formData.append('category', uploadForm.category)
      if (uploadForm.date) formData.append('date', uploadForm.date)
      
      await uploadMedicalFile(formData)
      showToast('فایل با موفقیت آپلود شد', 'success')
      setShowUploadModal(false)
      setUploadForm({
        file: null,
        category: '',
        patientName: '',
        doctorName: '',
        description: '',
        date: ''
      })
      await loadFiles()
    } catch (error: any) {
      showToast('خطا در آپلود فایل: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleDelete = async (fileId: number) => {
    if (!confirm('آیا مطمئن هستید که می‌خواهید این فایل را حذف کنید؟')) {
      return
    }
    try {
      await deleteMedicalFile(fileId)
      showToast('فایل با موفقیت حذف شد', 'success')
      await loadFiles()
    } catch (error: any) {
      showToast('خطا در حذف فایل: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleDownload = async (file: any) => {
    try {
      await downloadMedicalFile(file.id)
      showToast('فایل با موفقیت دانلود شد', 'success')
    } catch (error: any) {
      showToast('خطا در دانلود فایل: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  return (
    <ProtectedRoute allowedRoles={['expert', 'admin', 'manager']}>
      <MainLayout>
        <div className="p-8">
          {/* Back Button */}
          <div className="mb-6">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
            >
              <ArrowRight size={18} />
              <span>بازگشت به داشبورد</span>
            </button>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <Stethoscope className="text-purple-600" size={32} />
                تاییدیه‌های پزشکان
              </h1>
              <p className="text-gray-600">مدیریت و نگهداری فایل‌های تاییدیه پزشکی</p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg flex items-center gap-2"
            >
              <Upload size={20} />
              آپلود فایل جدید
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="جستجو..."
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                value={filters.categoryId}
                onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
              >
                <option value="">همه دسته‌بندی‌ها</option>
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.name || cat.id}>{cat.name || '-'}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="نام بیمار..."
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                value={filters.patientName}
                onChange={(e) => setFilters({ ...filters, patientName: e.target.value })}
              />
              <input
                type="text"
                placeholder="نام پزشک..."
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                value={filters.doctorName}
                onChange={(e) => setFilters({ ...filters, doctorName: e.target.value })}
              />
            </div>
          </div>

          {/* Files Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">در حال بارگذاری...</p>
              </div>
            ) : files.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FileText className="mx-auto text-gray-400 mb-4" size={48} />
                <p>هیچ فایلی یافت نشد</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
                    <tr>
                      <th className="text-right py-4 px-6 font-semibold">نام فایل</th>
                      <th className="text-right py-4 px-6 font-semibold">دسته‌بندی</th>
                      <th className="text-right py-4 px-6 font-semibold">بیمار</th>
                      <th className="text-right py-4 px-6 font-semibold">پزشک</th>
                      <th className="text-right py-4 px-6 font-semibold">تاریخ</th>
                      <th className="text-right py-4 px-6 font-semibold">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => (
                      <tr key={file.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-6 text-sm font-medium text-gray-900">{file.original_name || file.file_name || '-'}</td>
                        <td className="py-4 px-6 text-sm text-gray-700">{file.category || '-'}</td>
                        <td className="py-4 px-6 text-sm text-gray-700">{file.patient_name || '-'}</td>
                        <td className="py-4 px-6 text-sm text-gray-700">{file.doctor_name || '-'}</td>
                        <td className="py-4 px-6 text-sm text-gray-600">
                          {file.created_at ? toPersianDate(new Date(file.created_at)) : '-'}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDownload(file)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="دانلود"
                            >
                              <Download size={18} />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDelete(file.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="حذف"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Upload Modal */}
          {showUploadModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">آپلود فایل تاییدیه</h2>
                <form onSubmit={handleUpload} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">فایل *</label>
                    <input
                      type="file"
                      required
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">دسته‌بندی</label>
                    <select
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      value={uploadForm.category}
                      onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                    >
                      <option value="">انتخاب دسته‌بندی</option>
                      {categories.map((cat: any) => (
                        <option key={cat.id} value={cat.name || cat.id}>{cat.name || '-'}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">نام بیمار *</label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={uploadForm.patientName}
                        onChange={(e) => setUploadForm({ ...uploadForm, patientName: e.target.value })}
                        placeholder="نام بیمار"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">نام پزشک *</label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={uploadForm.doctorName}
                        onChange={(e) => setUploadForm({ ...uploadForm, doctorName: e.target.value })}
                        placeholder="نام پزشک"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">تاریخ</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      value={uploadForm.date}
                      onChange={(e) => setUploadForm({ ...uploadForm, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">توضیحات</label>
                    <textarea
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={4}
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                      placeholder="توضیحات..."
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                    >
                      آپلود فایل
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUploadModal(false)
                        setUploadForm({
                          file: null,
                          category: '',
                          patientName: '',
                          doctorName: '',
                          description: '',
                          date: ''
                        })
                      }}
                      className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                    >
                      لغو
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </MainLayout>
    </ProtectedRoute>
  )
}

