import jalaali from 'jalaali-js'

// تبدیل تاریخ میلادی به شمسی
export function toPersianDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '-'
  
  const jDate = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate())
  return `${jDate.jy}/${String(jDate.jm).padStart(2, '0')}/${String(jDate.jd).padStart(2, '0')}`
}

// تبدیل تاریخ میلادی به شمسی با نام ماه
export function toPersianDateWithMonth(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '-'
  
  const jDate = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate())
  const monthNames = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ]
  
  return `${jDate.jd} ${monthNames[jDate.jm - 1]} ${jDate.jy}`
}

// تبدیل تاریخ میلادی به شمسی فقط با نام ماه
export function toPersianMonth(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '-'
  
  const jDate = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate())
  const monthNames = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ]
  
  return monthNames[jDate.jm - 1]
}

// تبدیل تاریخ شمسی به میلادی
export function fromPersianDate(year: number, month: number, day: number): Date {
  const gDate = jalaali.toGregorian(year, month, day)
  return new Date(gDate.gy, gDate.gm - 1, gDate.gd)
}

// تبدیل تاریخ شمسی (رشته) به میلادی
export function fromPersianDateString(dateString: string): Date | null {
  try {
    const parts = dateString.split('/').map(Number)
    if (parts.length !== 3) return null
    const [year, month, day] = parts
    return fromPersianDate(year, month, day)
  } catch {
    return null
  }
}

// تاریخ امروز به شمسی
export function todayPersian(): string {
  return toPersianDate(new Date())
}

// تاریخ امروز به شمسی با نام ماه
export function todayPersianWithMonth(): string {
  return toPersianDateWithMonth(new Date())
}

