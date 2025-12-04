'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  getReportsSummary, 
  getReportsByPersonnel, 
  getReportsByCenter, 
  getReportsByDiscount, 
  getReportsDetails,
  getWeeklyReport,
  getMonthlyReport
} from '../lib/api'
import { toPersianDate, toPersianDateWithMonth } from '../lib/dateUtils'
import PersianDatePicker from '../components/PersianDatePicker'
import { Download, TrendingUp, TrendingDown, BarChart3, PieChart as PieChartIcon, Calendar, Users, MapPin, FileText, FileSpreadsheet, ArrowRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { exportDetailsToExcel, exportPersonnelToExcel, exportCentersToExcel, exportToPDF, exportToExcel } from '../lib/exportUtils'
import { calculatePeriodStats, comparePeriods, filterByPeriod } from '../lib/comparisonUtils'
import { getAssignments, getPersonnel, getCenters } from '../lib/api'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#8b5cf6']

export default function ReportsPage() {
  const [summary, setSummary] = useState<any>(null)
  const [personnelReports, setPersonnelReports] = useState<any[]>([])
  const [centerReports, setCenterReports] = useState<any[]>([])
  const [discountReports, setDiscountReports] = useState<any[]>([])
  const [details, setDetails] = useState<any[]>([])
  const [weeklyReport, setWeeklyReport] = useState<any>(null)
  const [monthlyReport, setMonthlyReport] = useState<any>(null)
  const [allAssignments, setAllAssignments] = useState<any[]>([])
  const [personnelList, setPersonnelList] = useState<any[]>([])
  const [centersList, setCentersList] = useState<any[]>([])
  const [comparisonData, setComparisonData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('summary')
  const [detailModal, setDetailModal] = useState<{ type: 'personnel' | 'center' | 'discount' | null, id: string | number | null, data: any[] }>({ type: null, id: null, data: [] })
  const [filters, setFilters] = useState({ 
    startDate: null as Date | null, 
    endDate: null as Date | null,
    personnelId: '',
    centerId: '',
    status: '',
    week: undefined as number | undefined,
    month: undefined as number | undefined,
    year: undefined as number | undefined,
    centerSearch: '' as string,
    centerType: '' as string,
    centerPersonnelId: '' as string
  })

  useEffect(() => {
    fetchSummary()
    loadAllData()
  }, [])

  const loadAllData = async () => {
    try {
      const [assignmentsResponse, personnelData, centersResponse] = await Promise.all([
        getAssignments(),
        getPersonnel(),
        getCenters()
      ])
      // Handle paginated response - extract data array
      const assignmentsData: any[] = Array.isArray(assignmentsResponse) 
        ? assignmentsResponse 
        : ((assignmentsResponse as any)?.data || [])
      // Handle paginated response for centers - extract data array
      const centersData: any[] = Array.isArray(centersResponse) 
        ? centersResponse 
        : ((centersResponse as any)?.data || [])
      setAllAssignments(Array.isArray(assignmentsData) ? assignmentsData : [])
      setPersonnelList(personnelData)
      setCentersList(Array.isArray(centersData) ? centersData : [])
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  useEffect(() => {
    if (activeTab === 'details') {
      fetchDetails()
    } else if (activeTab === 'weekly') {
      // وقتی week تغییر می‌کند، گزارش را fetch کن
      if (filters.week !== undefined) {
        fetchWeeklyReport()
      }
    } else if (activeTab === 'monthly') {
      // وقتی month یا year تغییر می‌کند، گزارش را fetch کن
      if (filters.month !== undefined || filters.year !== undefined) {
        fetchMonthlyReport()
      }
    }
  }, [activeTab, filters.week, filters.month, filters.year])

  const fetchSummary = async () => {
    setLoading(true)
    // Safety timeout - force loading to false after 65 seconds
    const safetyTimeout = setTimeout(() => {
      console.warn('[Reports] Loading timeout - forcing state to false')
      setLoading(false)
    }, 65000)
    
    try {
      const [summaryData, personnelData, centerData, discountData] = await Promise.all([
        getReportsSummary().catch(err => {
          console.error('Error loading summary:', err)
          return null
        }),
        getReportsByPersonnel().catch(err => {
          console.error('Error loading personnel reports:', err)
          return []
        }),
        getReportsByCenter().catch(err => {
          console.error('Error loading center reports:', err)
          return []
        }),
        getReportsByDiscount().catch(err => {
          console.error('Error loading discount reports:', err)
          return []
        })
      ])
      setSummary(summaryData)
      setPersonnelReports(personnelData || [])
      setCenterReports(centerData || [])
      setDiscountReports(discountData || [])
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      clearTimeout(safetyTimeout)
      setLoading(false)
    }
  }

  const fetchDetails = async () => {
    try {
      let filtered = allAssignments
      
      // فیلتر بر اساس تاریخ
      if (filters.startDate || filters.endDate) {
        filtered = filtered.filter((a: any) => {
          if (!a.createdAt) return false
          const date = new Date(a.createdAt)
          if (filters.startDate && date < filters.startDate) return false
          if (filters.endDate && date > filters.endDate) return false
          return true
        })
      }
      
      // فیلتر بر اساس پرسنل
      if (filters.personnelId) {
        filtered = filtered.filter((a: any) => parseInt(a.personnelId) === parseInt(filters.personnelId))
      }
      
      // فیلتر بر اساس مرکز
      if (filters.centerId) {
        filtered = filtered.filter((a: any) => parseInt(a.centerId) === parseInt(filters.centerId))
      }
      
      // فیلتر بر اساس وضعیت
      if (filters.status) {
        filtered = filtered.filter((a: any) => a.status === filters.status)
      }
      
      setDetails(filtered)
    } catch (error) {
      console.error('Error fetching details:', error)
    }
  }

  const fetchWeeklyReport = async () => {
    try {
      const data = await getWeeklyReport(filters.week)
      setWeeklyReport(data)
    } catch (error) {
      console.error('Error fetching weekly report:', error)
    }
  }

  const fetchMonthlyReport = async () => {
    try {
      // Validation: سال باید بین 1400 تا 1500 باشد
      let year = filters.year
      if (year && (year < 1400 || year > 1500)) {
        // فقط alert بده و return نکن - اجازه بده backend خودش handle کند
        console.warn('سال باید بین 1400 تا 1500 باشد:', year)
      }
      
      // Validation: ماه باید بین 1 تا 12 باشد
      let month = filters.month
      if (month && (month < 1 || month > 12)) {
        console.warn('ماه باید بین 1 تا 12 باشد:', month)
        return
      }
      
      // اگر سال یا ماه معتبر نیست، undefined بفرست
      const validYear = (year && year >= 1400 && year <= 1500) ? year : undefined
      const validMonth = (month && month >= 1 && month <= 12) ? month : undefined
      
      const data = await getMonthlyReport(validMonth, validYear)
      setMonthlyReport(data)
    } catch (error: any) {
      console.error('Error fetching monthly report:', error)
      if (error.response?.data?.message) {
        alert(`خطا: ${error.response.data.message}`)
      } else {
        alert('خطا در دریافت گزارش ماهانه')
      }
    }
  }

  const handleExportExcel = () => {
    if (activeTab === 'details') {
      exportDetailsToExcel(details)
    } else if (activeTab === 'personnel') {
      exportPersonnelToExcel(personnelReports)
    } else if (activeTab === 'centers') {
      exportCentersToExcel(centerReports)
    } else if (activeTab === 'discounts') {
      const data = discountReports.map((r: any) => {
        const totalSnapCost = r.totalSnapCost || 0;
        const totalDiscount = r.totalDiscount || 0;
        const totalPersonalPayment = Math.max(0, totalSnapCost - totalDiscount);
        return {
          'کد تخفیف': r.discountCode || '-',
          'تعداد استفاده': r.usageCount || 0,
          'هزینه کل اسنپ': totalSnapCost,
          'هزینه شرکت (تخفیف)': totalDiscount,
          'هزینه شخصی': totalPersonalPayment
        };
      });
      exportToExcel(data, 'گزارش_کدهای_تخفیف');
    } else {
      alert('برای این تب Export به Excel در دسترس نیست')
    }
  }

  const handleExportPDF = () => {
    if (activeTab === 'details' && details.length > 0) {
      const headers = [['شناسه', 'پرسنل', 'مرکز', 'وضعیت', 'هزینه کل اسنپ', 'هزینه شرکت', 'هزینه شخصی', 'تاریخ']]
      const rows = details.map((d: any) => {
        const snapCost = d.snapCost || 0;
        const discountAmount = d.discountAmount || 0;
        const personalPayment = d.personalPayment || Math.max(0, snapCost - discountAmount);
        return [
          d.id?.toString() || '-',
          d.personnelName || '-',
          d.centerName || '-',
          d.status || '-',
          snapCost.toLocaleString('fa-IR'),
          discountAmount.toLocaleString('fa-IR'),
          personalPayment.toLocaleString('fa-IR'),
          toPersianDate(d.createdAt)
        ];
      })
      exportToPDF('گزارش جزئیات ماموریت‌ها', headers, rows, 'گزارش_جزئیات')
    } else if (activeTab === 'personnel' && personnelReports.length > 0) {
      const headers = [['نام', 'تعداد ماموریت', 'هزینه کل اسنپ', 'هزینه شرکت', 'پرداخت شخصی', 'میانگین هزینه']]
      const rows = personnelReports.map((p: any) => {
        const totalSnapCost = p.totalSnapCost || p.totalCost || 0;
        const totalDiscount = p.totalDiscount || 0;
        const totalPersonalPayment = p.totalPersonalPayment || Math.max(0, totalSnapCost - totalDiscount);
        return [
          p.name || '-',
          (p.assignmentCount || 0).toString(),
          totalSnapCost.toLocaleString('fa-IR'),
          totalDiscount.toLocaleString('fa-IR'),
          totalPersonalPayment.toLocaleString('fa-IR'),
          p.assignmentCount > 0 ? (totalSnapCost / p.assignmentCount).toLocaleString('fa-IR') : '0'
        ];
      })
      exportToPDF('گزارش پرسنل', headers, rows, 'گزارش_پرسنل')
    } else if (activeTab === 'centers' && centerReports.length > 0) {
      const headers = [['مرکز', 'تعداد ماموریت', 'هزینه کل اسنپ']]
      const rows = centerReports.map((c: any) => [
        c.name || '-',
        (c.assignmentCount || 0).toString(),
        (c.totalSnapCost || c.totalCost || 0).toLocaleString('fa-IR')
      ])
      exportToPDF('گزارش مراکز', headers, rows, 'گزارش_مراکز')
    } else if (activeTab === 'discounts' && discountReports.length > 0) {
      const headers = [['کد تخفیف', 'تعداد استفاده', 'هزینه کل اسنپ', 'هزینه شرکت', 'هزینه شخصی']]
      const rows = discountReports.map((r: any) => {
        const totalSnapCost = r.totalSnapCost || 0;
        const totalDiscount = r.totalDiscount || 0;
        const totalPersonalPayment = Math.max(0, totalSnapCost - totalDiscount);
        return [
          r.discountCode || '-',
          (r.usageCount || 0).toString(),
          totalSnapCost.toLocaleString('fa-IR'),
          totalDiscount.toLocaleString('fa-IR'),
          totalPersonalPayment.toLocaleString('fa-IR')
        ];
      })
      exportToPDF('گزارش کدهای تخفیف', headers, rows, 'گزارش_کدهای_تخفیف')
    } else {
      alert('برای این تب Export به PDF در دسترس نیست')
    }
  }

  const openDetailModal = async (type: 'personnel' | 'center' | 'discount', id: string | number) => {
    try {
      let filteredAssignments: any[] = [];
      
      if (type === 'personnel') {
        filteredAssignments = allAssignments.filter((a: any) => a.personnelId === id);
      } else if (type === 'center') {
        filteredAssignments = allAssignments.filter((a: any) => a.centerId === id);
      } else if (type === 'discount') {
        filteredAssignments = allAssignments.filter((a: any) => a.discountCode === id);
      }
      
      setDetailModal({ type, id, data: filteredAssignments });
    } catch (error) {
      console.error('Error opening detail modal:', error);
    }
  };

  const closeDetailModal = () => {
    setDetailModal({ type: null, id: null, data: [] });
  };

  const exportDetailToExcel = () => {
    if (detailModal.data.length === 0) return;
    
    const data = detailModal.data.map((d: any) => {
      const snapCost = d.snapCost || 0;
      const discountAmount = d.discountAmount || 0;
      const personalPayment = d.personalPayment || Math.max(0, snapCost - discountAmount);
      
      return {
        'شناسه': d.id,
        'پرسنل': d.personnelName || '-',
        'مرکز': d.centerName || '-',
        'وضعیت': d.status,
        'هزینه کل اسنپ': snapCost,
        'هزینه شرکت (تخفیف)': discountAmount,
        'هزینه شخصی': personalPayment,
        'کد تخفیف': d.discountCode || '-',
        'تاریخ ایجاد': toPersianDate(d.createdAt),
        'تاریخ تایید': d.approvedAt ? toPersianDate(d.approvedAt) : '-',
        'تاریخ تکمیل': d.completedAt ? toPersianDate(d.completedAt) : '-'
      };
    });
    
    let title = '';
    if (detailModal.type === 'personnel') {
      const personnel = personnelList.find((p: any) => p.id === detailModal.id);
      title = `گزارش_${personnel?.name || detailModal.id}`;
    } else if (detailModal.type === 'center') {
      const center = centersList.find((c: any) => c.id === detailModal.id);
      title = `گزارش_${center?.name || detailModal.id}`;
    } else {
      title = `گزارش_کد_تخفیف_${detailModal.id}`;
    }
    
    exportToExcel(data, title);
  };

  const exportDetailToPDF = () => {
    if (detailModal.data.length === 0) return;
    
    const headers = [['شناسه', 'پرسنل', 'مرکز', 'وضعیت', 'هزینه کل اسنپ', 'هزینه شرکت', 'هزینه شخصی', 'تاریخ']];
    const rows = detailModal.data.map((d: any) => {
      const snapCost = d.snapCost || 0;
      const discountAmount = d.discountAmount || 0;
      const personalPayment = d.personalPayment || Math.max(0, snapCost - discountAmount);
      
      return [
        d.id.toString(),
        d.personnelName || '-',
        d.centerName || '-',
        d.status || '-',
        snapCost.toLocaleString('fa-IR'),
        discountAmount.toLocaleString('fa-IR'),
        personalPayment.toLocaleString('fa-IR'),
        toPersianDate(d.createdAt)
      ];
    });
    
    let title = '';
    if (detailModal.type === 'personnel') {
      const personnel = personnelList.find((p: any) => p.id === detailModal.id);
      title = `گزارش ${personnel?.name || detailModal.id}`;
    } else if (detailModal.type === 'center') {
      const center = centersList.find((c: any) => c.id === detailModal.id);
      title = `گزارش ${center?.name || detailModal.id}`;
    } else {
      title = `گزارش کد تخفیف ${detailModal.id}`;
    }
    
    exportToPDF(title, headers, rows, title.replace(/\s/g, '_'));
  };

  const handleComparePeriods = () => {
    if (!filters.startDate || !filters.endDate) {
      alert('لطفاً تاریخ شروع و پایان را انتخاب کنید')
      return
    }

    // دوره اول: از تاریخ شروع تا وسط
    const midDate = new Date((filters.startDate.getTime() + filters.endDate.getTime()) / 2)
    const period1Assignments = filterByPeriod(allAssignments, filters.startDate, midDate)
    const period2Assignments = filterByPeriod(allAssignments, new Date(midDate.getTime() + 1), filters.endDate)

    const period1Stats = calculatePeriodStats(period1Assignments)
    const period2Stats = calculatePeriodStats(period2Assignments)
    const comparison = comparePeriods(period1Stats, period2Stats)

    setComparisonData({
      period1: period1Stats,
      period2: period2Stats,
      comparison,
      period1Date: { start: filters.startDate, end: midDate },
      period2Date: { start: new Date(midDate.getTime() + 1), end: filters.endDate }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">در حال بارگذاری...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Back Button */}
      <div className="mb-6">
        <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 transition-colors">
          <ArrowRight size={18} />
          <span>بازگشت به داشبورد</span>
        </Link>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">گزارش‌ها</h1>
          <p className="text-gray-600">تحلیل و گزارش‌گیری پیشرفته از ماموریت‌ها</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportExcel}
            className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-3 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg flex items-center gap-2"
          >
            <FileSpreadsheet size={20} />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-3 rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all shadow-lg flex items-center gap-2"
          >
            <FileText size={20} />
            PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-lg mb-6">
        <div className="flex border-b overflow-x-auto">
          {[
            { id: 'summary', label: 'خلاصه', icon: BarChart3 },
            { id: 'weekly', label: 'هفتگی', icon: Calendar },
            { id: 'monthly', label: 'ماهانه', icon: Calendar },
            { id: 'comparison', label: 'مقایسه دوره‌ای', icon: TrendingUp },
            { id: 'personnel', label: 'بر اساس پرسنل', icon: Users },
            { id: 'centers', label: 'بر اساس مرکز', icon: MapPin },
            { id: 'discounts', label: 'بر اساس کد تخفیف', icon: PieChartIcon },
            { id: 'details', label: 'جزئیات', icon: BarChart3 }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`
                flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap
                ${activeTab === id
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }
              `}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Summary Tab */}
          {activeTab === 'summary' && summary && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
                  <div className="text-3xl font-bold mb-2">{summary.total || 0}</div>
                  <div className="text-blue-100">کل ماموریت‌ها</div>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
                  <div className="text-3xl font-bold mb-2">{(summary.costs?.totalCost || 0).toLocaleString('fa-IR')}</div>
                  <div className="text-green-100">هزینه کل (تومان)</div>
                </div>
                <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-xl p-6 shadow-lg">
                  <div className="text-3xl font-bold mb-2">{(summary.costs?.totalDiscount || 0).toLocaleString('fa-IR')}</div>
                  <div className="text-yellow-100">تخفیف کل (تومان)</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
                  <div className="text-3xl font-bold mb-2">{(summary.costs?.totalPersonalPayment || 0).toLocaleString('fa-IR')}</div>
                  <div className="text-purple-100">پرداخت شخصی (تومان)</div>
                </div>
              </div>

              {/* Status Chart */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-4">وضعیت ماموریت‌ها</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={summary.byStatus || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ status, count }) => `${status}: ${count}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {(summary.byStatus || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Top Personnel */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-4">پرسنل برتر</h3>
                <div className="space-y-3">
                  {(personnelReports || []).slice(0, 5).map((p: any, index: number) => (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-blue-500'}`}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{p.name}</div>
                          <div className="text-sm text-gray-600">{p.assignmentCount || 0} ماموریت</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">{(p.totalCost || 0).toLocaleString('fa-IR')} تومان</div>
                        <div className="text-sm text-gray-600">هزینه کل</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Weekly Report Tab */}
          {activeTab === 'weekly' && (
            <div className="space-y-6">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">شماره هفته</label>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={filters.week || ''}
                    onChange={(e) => setFilters({ ...filters, week: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="مثلاً: 45"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={fetchWeeklyReport}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  دریافت گزارش
                </button>
              </div>

              {weeklyReport && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-6">
                    <div className="text-2xl font-bold mb-2">هفته {weeklyReport.weekInfo?.weekNumber || '-'}</div>
                    <div className="text-blue-100">
                      {weeklyReport.weekInfo?.startDatePersianFormatted} تا {weeklyReport.weekInfo?.endDatePersianFormatted}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                      <div className="text-2xl font-bold text-gray-900 mb-2">{weeklyReport.stats?.total || 0}</div>
                      <div className="text-gray-600">کل ماموریت‌ها</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                      <div className="text-2xl font-bold text-gray-900 mb-2">{(weeklyReport.stats?.totalSnapCost || 0).toLocaleString('fa-IR')}</div>
                      <div className="text-gray-600">هزینه کل اسنپ (تومان)</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                      <div className="text-2xl font-bold text-gray-900 mb-2">{(weeklyReport.stats?.totalCost || 0).toLocaleString('fa-IR')}</div>
                      <div className="text-gray-600">هزینه کل (تومان)</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                      <div className="text-2xl font-bold text-gray-900 mb-2">
                        {weeklyReport.stats?.total > 0 
                          ? Math.round((weeklyReport.stats?.totalCost || 0) / weeklyReport.stats.total).toLocaleString('fa-IR')
                          : 0}
                      </div>
                      <div className="text-gray-600">میانگین هزینه (تومان)</div>
                    </div>
                  </div>

                  {/* Weekly Chart - Line Chart */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">روند هفتگی</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={weeklyReport.assignments?.slice(0, 7) || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="createdAtPersianFormatted" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="totalCost" stroke="#3b82f6" strokeWidth={2} name="هزینه" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Weekly Bar Chart */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">نمودار میله‌ای هفتگی</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={weeklyReport.assignments?.slice(0, 7) || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="createdAtPersianFormatted" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="totalCost" fill="#3b82f6" name="هزینه" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Monthly Report Tab */}
          {activeTab === 'monthly' && (
            <div className="space-y-6">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">ماه</label>
                  <select
                    value={filters.month || ''}
                    onChange={(e) => setFilters({ ...filters, month: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">همه ماه‌ها</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const monthNames = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
                      return <option key={i + 1} value={i + 1}>{monthNames[i]}</option>
                    })}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">سال</label>
                  <input
                    type="number"
                    min="1400"
                    max="1500"
                    value={filters.year || ''}
                    onChange={(e) => {
                      const value = e.target.value
                      if (!value) {
                        setFilters({ ...filters, year: undefined })
                      } else {
                        const numValue = parseInt(value)
                        // اجازه بده کاربر تایپ کند، اما فقط عدد معتبر را ذخیره کن
                        if (!isNaN(numValue)) {
                          setFilters({ ...filters, year: numValue })
                        }
                      }
                    }}
                    onBlur={(e) => {
                      // وقتی فیلد focus را از دست داد، validation انجام بده
                      const value = parseInt(e.target.value)
                      if (value && (value < 1400 || value > 1450)) {
                        setFilters({ ...filters, year: undefined })
                        alert('سال باید بین 1400 تا 1450 باشد')
                      }
                    }}
                    placeholder="مثلاً: 1403"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={fetchMonthlyReport}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  دریافت گزارش
                </button>
              </div>

              {monthlyReport && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl p-6">
                    <div className="text-2xl font-bold mb-2">
                      {monthlyReport.monthInfo?.monthName || '-'} {monthlyReport.monthInfo?.year || ''}
                    </div>
                    <div className="text-purple-100">
                      {monthlyReport.monthInfo?.startDatePersianFormatted} تا {monthlyReport.monthInfo?.endDatePersianFormatted}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                      <div className="text-2xl font-bold text-gray-900 mb-2">{monthlyReport.stats?.total || 0}</div>
                      <div className="text-gray-600">کل ماموریت‌ها</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                      <div className="text-2xl font-bold text-gray-900 mb-2">{(monthlyReport.stats?.totalSnapCost || 0).toLocaleString('fa-IR')}</div>
                      <div className="text-gray-600">هزینه کل اسنپ (تومان)</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                      <div className="text-2xl font-bold text-gray-900 mb-2">{(monthlyReport.stats?.totalCost || 0).toLocaleString('fa-IR')}</div>
                      <div className="text-gray-600">هزینه کل (تومان)</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                      <div className="text-2xl font-bold text-gray-900 mb-2">
                        {monthlyReport.stats?.total > 0 
                          ? Math.round((monthlyReport.stats?.totalCost || 0) / monthlyReport.stats.total).toLocaleString('fa-IR')
                          : 0}
                      </div>
                      <div className="text-gray-600">میانگین هزینه (تومان)</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Personnel Tab */}
          {activeTab === 'personnel' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                      <tr>
                        <th className="text-right py-4 px-6 font-semibold">نام</th>
                        <th className="text-right py-4 px-6 font-semibold">تعداد ماموریت</th>
                        <th className="text-right py-4 px-6 font-semibold">هزینه کل اسنپ</th>
                        <th className="text-right py-4 px-6 font-semibold">پرداخت شخصی</th>
                        <th className="text-right py-4 px-6 font-semibold">میانگین هزینه</th>
                        <th className="text-right py-4 px-6 font-semibold">عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {personnelReports.map((r: any, index: number) => {
                        const totalSnapCost = r.totalSnapCost || r.totalCost || 0;
                        const totalDiscount = r.totalDiscount || 0;
                        const totalPersonalPayment = r.totalPersonalPayment || Math.max(0, totalSnapCost - totalDiscount);
                        return (
                          <tr key={r.id} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 cursor-pointer`} onClick={() => openDetailModal('personnel', r.id)}>
                            <td className="py-4 px-6 text-sm font-medium text-gray-900">{r.name}</td>
                            <td className="py-4 px-6 text-sm text-gray-700">{r.assignmentCount || 0}</td>
                            <td className="py-4 px-6 text-sm text-gray-700 font-medium">{totalSnapCost.toLocaleString('fa-IR')} تومان</td>
                            <td className="py-4 px-6 text-sm text-gray-700">{totalPersonalPayment.toLocaleString('fa-IR')} تومان</td>
                            <td className="py-4 px-6 text-sm text-gray-700">
                              {r.assignmentCount > 0 ? (totalSnapCost / r.assignmentCount).toLocaleString('fa-IR') : 0} تومان
                            </td>
                            <td className="py-4 px-6">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDetailModal('personnel', r.id);
                                }}
                                className="text-blue-600 hover:text-blue-800 font-medium"
                              >
                                مشاهده جزئیات
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Personnel Chart */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-4">نمودار عملکرد پرسنل</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={personnelReports.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="totalCost" fill="#3b82f6" name="هزینه کل" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Centers Tab */}
          {activeTab === 'centers' && (
            <div className="space-y-6">
              {/* Search and Filter */}
              <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                <div className="flex gap-4 items-end flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-gray-700 mb-2">جستجو در مراکز</label>
                    <input
                      type="text"
                      placeholder="جستجو بر اساس نام مرکز..."
                      value={filters.centerSearch || ''}
                      onChange={(e) => setFilters({ ...filters, centerSearch: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-gray-700 mb-2">فیلتر بر اساس نوع مرکز</label>
                    <select
                      value={filters.centerType || ''}
                      onChange={(e) => setFilters({ ...filters, centerType: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">همه انواع</option>
                      <option value="store">فروشگاه</option>
                      <option value="warehouse">انبار</option>
                      <option value="office">دفتر</option>
                      <option value="factory">کارخانه</option>
                      <option value="other">سایر</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-gray-700 mb-2">فیلتر بر اساس کارمند</label>
                    <select
                      value={filters.centerPersonnelId || ''}
                      onChange={(e) => setFilters({ ...filters, centerPersonnelId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">همه کارمندان</option>
                      {personnelList.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(filters.centerSearch || filters.centerType || filters.centerPersonnelId) && (
                    <button
                      onClick={() => setFilters({ ...filters, centerSearch: '', centerType: '', centerPersonnelId: '' })}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      پاک کردن فیلترها
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-green-600 to-green-700 text-white">
                      <tr>
                        <th className="text-right py-4 px-6 font-semibold">مرکز</th>
                        <th className="text-right py-4 px-6 font-semibold">تعداد ماموریت</th>
                        <th className="text-right py-4 px-6 font-semibold">هزینه کل</th>
                        <th className="text-right py-4 px-6 font-semibold">عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {centerReports
                        .filter((r: any) => {
                          // فیلتر بر اساس جستجو
                          if (filters.centerSearch) {
                            const searchTerm = filters.centerSearch.toLowerCase()
                            const centerName = (r.name || '').toLowerCase()
                            if (!centerName.includes(searchTerm)) {
                              return false
                            }
                          }
                          // فیلتر بر اساس نوع مرکز
                          if (filters.centerType && r.type !== filters.centerType) {
                            return false
                          }
                          // فیلتر بر اساس کارمند - باید ماموریت‌هایی که این کارمند در این مرکز داشته باشد را بررسی کنیم
                          if (filters.centerPersonnelId) {
                            // بررسی اینکه آیا این مرکز در لیست ماموریت‌های این کارمند هست یا نه
                            const hasAssignmentForPersonnel = allAssignments.some((a: any) => 
                              a.centerId === r.id && a.personnelId === parseInt(filters.centerPersonnelId)
                            )
                            if (!hasAssignmentForPersonnel) {
                              return false
                            }
                          }
                          return true
                        })
                        .map((r: any, index: number) => (
                        <tr key={r.id} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 cursor-pointer`} onClick={() => openDetailModal('center', r.id)}>
                          <td className="py-4 px-6 text-sm font-medium text-gray-900">{r.name}</td>
                          <td className="py-4 px-6 text-sm text-gray-700">{r.assignmentCount || 0}</td>
                          <td className="py-4 px-6 text-sm text-gray-700 font-medium">{(r.totalSnapCost || r.totalCost || 0).toLocaleString('fa-IR')} تومان</td>
                          <td className="py-4 px-6">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetailModal('center', r.id);
                              }}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              مشاهده جزئیات
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Discounts Tab */}
          {activeTab === 'discounts' && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
                    <tr>
                      <th className="text-right py-4 px-6 font-semibold">کد تخفیف</th>
                      <th className="text-right py-4 px-6 font-semibold">تعداد استفاده</th>
                      <th className="text-right py-4 px-6 font-semibold">هزینه کل اسنپ</th>
                      <th className="text-right py-4 px-6 font-semibold">هزینه شرکت (تخفیف)</th>
                      <th className="text-right py-4 px-6 font-semibold">هزینه شخصی</th>
                      <th className="text-right py-4 px-6 font-semibold">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discountReports.map((r: any, index: number) => {
                      const totalSnapCost = r.totalSnapCost || 0;
                      const totalDiscount = r.totalDiscount || 0;
                      const totalPersonalPayment = Math.max(0, totalSnapCost - totalDiscount);
                      return (
                        <tr key={index} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 cursor-pointer`} onClick={() => openDetailModal('discount', r.discountCode)}>
                          <td className="py-4 px-6 text-sm font-medium text-gray-900">{r.discountCode || '-'}</td>
                          <td className="py-4 px-6 text-sm text-gray-700">{r.usageCount || 0}</td>
                          <td className="py-4 px-6 text-sm text-gray-700 font-medium">{totalSnapCost.toLocaleString('fa-IR')} تومان</td>
                          <td className="py-4 px-6 text-sm text-green-600 font-medium">{totalDiscount.toLocaleString('fa-IR')} تومان</td>
                          <td className="py-4 px-6 text-sm text-blue-600 font-medium">{totalPersonalPayment.toLocaleString('fa-IR')} تومان</td>
                          <td className="py-4 px-6">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetailModal('discount', r.discountCode);
                              }}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              مشاهده جزئیات
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Comparison Tab */}
          {activeTab === 'comparison' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">انتخاب دوره برای مقایسه</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">از تاریخ</label>
                    <PersianDatePicker
                      value={filters.startDate}
                      onChange={(date) => setFilters({ ...filters, startDate: date })}
                      placeholder="انتخاب تاریخ شروع"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">تا تاریخ</label>
                    <PersianDatePicker
                      value={filters.endDate}
                      onChange={(date) => setFilters({ ...filters, endDate: date })}
                      placeholder="انتخاب تاریخ پایان"
                    />
                  </div>
                </div>
                <button
                  onClick={handleComparePeriods}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  مقایسه دوره‌ها
                </button>
              </div>

              {comparisonData && (
                <div className="space-y-6">
                  {/* Comparison Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
                      <h4 className="text-lg font-semibold mb-4">دوره اول</h4>
                      <div className="space-y-2 text-blue-100">
                        <div>{toPersianDate(comparisonData.period1Date.start)} تا {toPersianDate(comparisonData.period1Date.end)}</div>
                        <div className="text-2xl font-bold text-white mt-4">{comparisonData.period1.total} ماموریت</div>
                        <div className="text-lg">{(comparisonData.period1.totalCost || 0).toLocaleString('fa-IR')} تومان</div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
                      <h4 className="text-lg font-semibold mb-4">دوره دوم</h4>
                      <div className="space-y-2 text-green-100">
                        <div>{toPersianDate(comparisonData.period2Date.start)} تا {toPersianDate(comparisonData.period2Date.end)}</div>
                        <div className="text-2xl font-bold text-white mt-4">{comparisonData.period2.total} ماموریت</div>
                        <div className="text-lg">{(comparisonData.period2.totalCost || 0).toLocaleString('fa-IR')} تومان</div>
                      </div>
                    </div>
                  </div>

                  {/* Comparison Table */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">جدول مقایسه</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="text-right py-3 px-4 font-semibold text-gray-700">شاخص</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-700">دوره اول</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-700">دوره دوم</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-700">تغییر</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-700">درصد تغییر</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { key: 'total', label: 'تعداد ماموریت' },
                            { key: 'totalCost', label: 'هزینه کل' },
                            { key: 'totalDiscount', label: 'تخفیف کل' },
                            { key: 'averageCost', label: 'میانگین هزینه' }
                          ].map(({ key, label }) => {
                            const change = comparisonData.comparison.changes[key as keyof typeof comparisonData.comparison.changes]
                            const percent = comparisonData.comparison.percentages[key as keyof typeof comparisonData.comparison.percentages]
                            const isPositive = change > 0
                            
                            return (
                              <tr key={key} className="border-b border-gray-100">
                                <td className="py-3 px-4 text-sm font-medium text-gray-900">{label}</td>
                                <td className="py-3 px-4 text-sm text-gray-700">
                                  {key === 'totalCost' || key === 'totalDiscount' || key === 'averageCost'
                                    ? (comparisonData.period1[key as keyof typeof comparisonData.period1] || 0).toLocaleString('fa-IR')
                                    : comparisonData.period1[key as keyof typeof comparisonData.period1] || 0}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-700">
                                  {key === 'totalCost' || key === 'totalDiscount' || key === 'averageCost'
                                    ? (comparisonData.period2[key as keyof typeof comparisonData.period2] || 0).toLocaleString('fa-IR')
                                    : comparisonData.period2[key as keyof typeof comparisonData.period2] || 0}
                                </td>
                                <td className={`py-3 px-4 text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                  {isPositive ? '+' : ''}
                                  {key === 'totalCost' || key === 'totalDiscount' || key === 'averageCost'
                                    ? change.toLocaleString('fa-IR')
                                    : change}
                                </td>
                                <td className={`py-3 px-4 text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                  {isPositive ? '+' : ''}{percent}%
                                  {isPositive ? <TrendingUp className="inline mr-1" size={16} /> : <TrendingDown className="inline mr-1" size={16} />}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Comparison Line Chart */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">روند مقایسه</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={[
                        { name: 'دوره اول', value: comparisonData.period1.totalCost },
                        { name: 'دوره دوم', value: comparisonData.period2.totalCost }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} name="هزینه کل" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">فیلترهای پیشرفته</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">از تاریخ</label>
                    <PersianDatePicker
                      value={filters.startDate}
                      onChange={(date) => setFilters({ ...filters, startDate: date })}
                      placeholder="انتخاب تاریخ شروع"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">تا تاریخ</label>
                    <PersianDatePicker
                      value={filters.endDate}
                      onChange={(date) => setFilters({ ...filters, endDate: date })}
                      placeholder="انتخاب تاریخ پایان"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">پرسنل</label>
                    <select
                      value={filters.personnelId}
                      onChange={(e) => setFilters({ ...filters, personnelId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">همه پرسنل</option>
                      {personnelList.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">مرکز</label>
                    <select
                      value={filters.centerId}
                      onChange={(e) => setFilters({ ...filters, centerId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">همه مراکز</option>
                      {centersList.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">وضعیت</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">همه وضعیت‌ها</option>
                      <option value="pending">در انتظار</option>
                      <option value="approved">تایید شده</option>
                      <option value="completed">تکمیل شده</option>
                      <option value="rejected">رد شده</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={fetchDetails}
                      className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                    >
                      اعمال فیلتر
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-gray-600 to-gray-700 text-white">
                      <tr>
                        <th className="text-right py-4 px-6 font-semibold">کد</th>
                        <th className="text-right py-4 px-6 font-semibold">پرسنل</th>
                        <th className="text-right py-4 px-6 font-semibold">مرکز</th>
                        <th className="text-right py-4 px-6 font-semibold">وضعیت</th>
                        <th className="text-right py-4 px-6 font-semibold">هزینه کل</th>
                        <th className="text-right py-4 px-6 font-semibold">تاریخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.map((d: any, index: number) => (
                        <tr key={d.id || index} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="py-4 px-6 text-sm font-medium text-gray-900">#{d.id}</td>
                          <td className="py-4 px-6 text-sm text-gray-700">{d.personnelName || '-'}</td>
                          <td className="py-4 px-6 text-sm text-gray-700">{d.centerName || '-'}</td>
                          <td className="py-4 px-6">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              d.status === 'completed' ? 'bg-green-100 text-green-800' :
                              d.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                              d.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {d.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-700 font-medium">{(d.totalCost || 0).toLocaleString('fa-IR')} تومان</td>
                          <td className="py-4 px-6 text-sm text-gray-600">{toPersianDate(d.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {detailModal.type && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900">
                {detailModal.type === 'personnel' && `گزارش تفصیلی: ${personnelList.find((p: any) => p.id === detailModal.id)?.name || detailModal.id}`}
                {detailModal.type === 'center' && `گزارش تفصیلی: ${centersList.find((c: any) => c.id === detailModal.id)?.name || detailModal.id}`}
                {detailModal.type === 'discount' && `گزارش تفصیلی: کد تخفیف ${detailModal.id}`}
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={exportDetailToExcel}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <FileSpreadsheet size={18} />
                  Excel
                </button>
                <button
                  onClick={exportDetailToPDF}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <FileText size={18} />
                  PDF
                </button>
                <button
                  onClick={closeDetailModal}
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  بستن
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {detailModal.data.length === 0 ? (
                <div className="text-center text-gray-500 py-8">هیچ ماموریتی یافت نشد</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">شناسه</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">پرسنل</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">مرکز</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">وضعیت</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">هزینه کل اسنپ</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">هزینه شرکت</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">هزینه شخصی</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">کد تخفیف</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">تاریخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailModal.data.map((d: any, index: number) => {
                        const snapCost = d.snapCost || 0;
                        const discountAmount = d.discountAmount || 0;
                        const personalPayment = d.personalPayment || Math.max(0, snapCost - discountAmount);
                        return (
                          <tr key={d.id} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <td className="py-3 px-4 text-sm text-gray-900">#{d.id}</td>
                            <td className="py-3 px-4 text-sm text-gray-700">{d.personnelName || '-'}</td>
                            <td className="py-3 px-4 text-sm text-gray-700">{d.centerName || '-'}</td>
                            <td className="py-3 px-4 text-sm text-gray-700">{d.status || '-'}</td>
                            <td className="py-3 px-4 text-sm text-gray-900 font-medium">{snapCost.toLocaleString('fa-IR')} تومان</td>
                            <td className="py-3 px-4 text-sm text-green-600 font-medium">{discountAmount.toLocaleString('fa-IR')} تومان</td>
                            <td className="py-3 px-4 text-sm text-blue-600 font-medium">{personalPayment.toLocaleString('fa-IR')} تومان</td>
                            <td className="py-3 px-4 text-sm text-gray-700">{d.discountCode || '-'}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">{toPersianDate(d.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
