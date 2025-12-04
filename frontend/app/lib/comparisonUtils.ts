import jalaali from 'jalaali-js'

// محاسبه آمار برای یک دوره
export function calculatePeriodStats(assignments: any[]) {
  const total = assignments.length
  const totalCost = assignments.reduce((sum, a) => sum + (a.totalCost || 0), 0)
  const totalDiscount = assignments.reduce((sum, a) => sum + (a.discountAmount || 0), 0)
  const totalPersonalPayment = assignments.reduce((sum, a) => sum + (a.personalPayment || 0), 0)
  const averageCost = total > 0 ? totalCost / total : 0
  
  const byStatus = {
    pending: assignments.filter(a => a.status === 'pending').length,
    approved: assignments.filter(a => a.status === 'approved').length,
    completed: assignments.filter(a => a.status === 'completed').length,
    rejected: assignments.filter(a => a.status === 'rejected').length
  }
  
  return {
    total,
    totalCost,
    totalDiscount,
    totalPersonalPayment,
    averageCost,
    byStatus
  }
}

// فیلتر ماموریت‌ها بر اساس دوره
export function filterByPeriod(assignments: any[], startDate: Date, endDate: Date) {
  return assignments.filter(a => {
    if (!a.createdAt) return false
    const assignDate = new Date(a.createdAt)
    return assignDate >= startDate && assignDate <= endDate
  })
}

// فیلتر بر اساس ماه شمسی
export function filterByPersianMonth(assignments: any[], month: number, year: number) {
  return assignments.filter(a => {
    if (!a.createdAt) return false
    const assignDate = new Date(a.createdAt)
    const jDate = jalaali.toJalaali(assignDate.getFullYear(), assignDate.getMonth() + 1, assignDate.getDate())
    return jDate.jm === month && jDate.jy === year
  })
}

// مقایسه دو دوره
export function comparePeriods(period1: any, period2: any) {
  const changes = {
    total: period2.total - period1.total,
    totalCost: period2.totalCost - period1.totalCost,
    totalDiscount: period2.totalDiscount - period1.totalDiscount,
    totalPersonalPayment: period2.totalPersonalPayment - period1.totalPersonalPayment,
    averageCost: period2.averageCost - period1.averageCost
  }
  
  const percentages = {
    total: period1.total > 0 ? ((changes.total / period1.total) * 100).toFixed(1) : '0',
    totalCost: period1.totalCost > 0 ? ((changes.totalCost / period1.totalCost) * 100).toFixed(1) : '0',
    totalDiscount: period1.totalDiscount > 0 ? ((changes.totalDiscount / period1.totalDiscount) * 100).toFixed(1) : '0',
    totalPersonalPayment: period1.totalPersonalPayment > 0 ? ((changes.totalPersonalPayment / period1.totalPersonalPayment) * 100).toFixed(1) : '0',
    averageCost: period1.averageCost > 0 ? ((changes.averageCost / period1.averageCost) * 100).toFixed(1) : '0'
  }
  
  return {
    changes,
    percentages,
    isPositive: (key: string) => changes[key as keyof typeof changes] > 0
  }
}

