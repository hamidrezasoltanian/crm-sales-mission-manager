// @ts-ignore
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { generatePDF } from './api'
import { toPersianDate } from './dateUtils'

// Export به Excel
export function exportToExcel(data: any[], filename: string = 'گزارش') {
  // تبدیل داده‌ها به فرمت مناسب برای Excel
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'گزارش')
  
  // ایجاد فایل Excel
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  
  saveAs(blob, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`)
}

// Helper function برای تبدیل اعداد فارسی به انگلیسی (فقط اعداد)
function convertPersianNumbers(text: string): string {
  if (!text) return '';
  
  // تبدیل اعداد فارسی به انگلیسی
  const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  let converted = String(text);
  
  // تبدیل اعداد
  persianNumbers.forEach((persian, index) => {
    converted = converted.replace(new RegExp(persian, 'g'), index.toString());
  });
  
  return converted;
}

// Export به PDF با استفاده از backend (پشتیبانی کامل از فونت فارسی)
export async function exportToPDF(
  title: string,
  headers: string[][],
  rows: any[][],
  filename: string = 'گزارش'
) {
  try {
    await generatePDF(title, headers, rows, filename)
  } catch (error: any) {
    console.error('Error generating PDF:', error)
    alert('خطا در تولید PDF: ' + (error.response?.data?.error || error.message))
  }
}

// Export گزارش جزئیات
export function exportDetailsToExcel(details: any[]) {
  const data = details.map(d => {
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
      'تاریخ ایجاد': d.createdAt ? toPersianDate(new Date(d.createdAt)) : '-',
      'تاریخ تایید': d.approvedAt ? toPersianDate(new Date(d.approvedAt)) : '-',
      'تاریخ تکمیل': d.completedAt ? toPersianDate(new Date(d.completedAt)) : '-'
    };
  });
  
  exportToExcel(data, 'گزارش_جزئیات');
}

// Export گزارش پرسنل
export function exportPersonnelToExcel(personnelReports: any[]) {
  const data = personnelReports.map(p => {
    const totalSnapCost = p.totalSnapCost || p.totalCost || 0;
    const totalDiscount = p.totalDiscount || 0;
    const totalPersonalPayment = p.totalPersonalPayment || Math.max(0, totalSnapCost - totalDiscount);
    
    return {
      'نام': p.name,
      'تعداد ماموریت': p.assignmentCount || 0,
      'هزینه کل اسنپ': totalSnapCost,
      'هزینه شرکت (تخفیف)': totalDiscount,
      'پرداخت شخصی': totalPersonalPayment,
      'میانگین هزینه': p.assignmentCount > 0 ? (totalSnapCost / p.assignmentCount).toFixed(0) : 0
    };
  });
  
  exportToExcel(data, 'گزارش_پرسنل');
}

// Export گزارش مراکز
export function exportCentersToExcel(centerReports: any[]) {
  const data = centerReports.map(c => ({
    'مرکز': c.name,
    'تعداد ماموریت': c.assignmentCount || 0,
    'هزینه کل اسنپ': c.totalSnapCost || c.totalCost || 0
  }));
  
  exportToExcel(data, 'گزارش_مراکز');
}

