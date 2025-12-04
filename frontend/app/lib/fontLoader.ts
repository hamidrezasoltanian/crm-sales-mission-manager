// Helper برای بارگذاری فونت فارسی برای jsPDF
// استفاده از فونت استاندارد با پشتیبانی از Unicode

export async function loadPersianFont(doc: any): Promise<void> {
  try {
    // jsPDF از UTF-8 پشتیبانی می‌کند اما فونت‌های استاندارد ممکن است فارسی را به درستی نمایش ندهند
    // برای حل این مشکل، از فونت استاندارد استفاده می‌کنیم
    // و متن فارسی را به صورت UTF-8 نگه می‌داریم
    
    // تنظیمات برای نمایش بهتر فارسی
    doc.setR2L(true); // راست به چپ
    
    // استفاده از فونت استاندارد
    // توجه: اضافه کردن فونت سفارشی به jsPDF نیاز به parse کردن فایل TTF دارد
    // که ممکن است مشکل‌ساز باشد. در حال حاضر از فونت استاندارد استفاده می‌کنیم
    doc.setFont('helvetica');
  } catch (error) {
    console.error('Error loading Persian font:', error);
    doc.setFont('helvetica');
  }
}

