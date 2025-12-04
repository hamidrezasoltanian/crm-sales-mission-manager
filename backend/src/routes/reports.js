import express from 'express';
import { getDB } from '../config/database.js';
import { createRequire } from 'module';
import cacheService, { CACHE_KEYS, flushReports } from '../services/cache.js';

// jalaali-js is a CommonJS module, so we use createRequire
const require = createRequire(import.meta.url);
const jalaali = require('jalaali-js');
const { toJalaali, toGregorian } = jalaali;

const router = express.Router();

// Helper function برای تبدیل تاریخ میلادی به شمسی
function toPersianDate(date) {
  const gregorianDate = new Date(date);
  const jalaali = toJalaali(
    gregorianDate.getFullYear(),
    gregorianDate.getMonth() + 1,
    gregorianDate.getDate()
  );
  
  const year = jalaali.jy.toString();
  const month = jalaali.jm.toString().padStart(2, '0');
  const day = jalaali.jd.toString().padStart(2, '0');
  
  const monthNames = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  
  return {
    full: `${year}/${month}/${day}`,
    withMonthName: `${day} ${monthNames[jalaali.jm - 1]} ${year}`,
    year: year,
    month: month,
    day: day,
    monthName: monthNames[jalaali.jm - 1]
  };
}

// گزارش کلی
router.get('/summary', async (req, res) => {
  try {
    // بررسی cache
    const cacheKey = CACHE_KEYS.REPORTS_SUMMARY;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    const db = getDB();
    
    // تعداد کل ماموریت‌ها
    const totalResult = await db.get('SELECT COUNT(*) as count FROM mission_assignments');
    const total = totalResult ? totalResult.count : 0;
    
    // تعداد بر اساس وضعیت
    const statusResult = await db.all(`
      SELECT status, COUNT(*) as count 
      FROM mission_assignments 
      GROUP BY status
    `);
    
    // مجموع هزینه‌ها
    const costResult = await db.get(`
      SELECT 
        SUM(snapCost) as totalSnapCost,
        SUM(discountAmount) as totalDiscount,
        SUM(totalCost) as totalCost,
        SUM(personalPayment) as totalPersonalPayment
      FROM mission_assignments
    `);
    
    // تعداد بر اساس کد تخفیف
    const discountResult = await db.all(`
      SELECT discountCode, COUNT(*) as count, SUM(discountAmount) as totalDiscount
      FROM mission_assignments
      WHERE discountCode IS NOT NULL
      GROUP BY discountCode
    `);
    
    const result = {
      total: total,
      byStatus: statusResult || [],
      costs: costResult ? {
        totalSnapCost: costResult.totalSnapCost || 0,
        totalDiscount: costResult.totalDiscount || 0,
        totalCost: costResult.totalCost || 0,
        totalPersonalPayment: costResult.totalPersonalPayment || 0
      } : {},
      byDiscountCode: discountResult || []
    };
    
    // ذخیره در cache برای 5 دقیقه
    cacheService.set(cacheKey, result, 300);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// گزارش بر اساس پرسنل
router.get('/by-personnel', async (req, res) => {
  try {
    const db = getDB();
    const { personnelId, startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        p.id, (p.first_name || ' ' || p.last_name) as name, p.phone,
        COUNT(a.id) as assignmentCount,
        SUM(a.snapCost) as totalSnapCost,
        SUM(a.discountAmount) as totalDiscount,
        SUM(a.totalCost) as totalCost,
        SUM(a.personalPayment) as totalPersonalPayment
      FROM personnel p
      LEFT JOIN mission_assignments a ON p.id = a.personnelId
      WHERE 1=1
    `;
    
    const params = [];
    
    if (personnelId) {
      query += ' AND p.id = ?';
      params.push(personnelId);
    }
    
    if (startDate) {
      query += ' AND a.createdAt >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND a.createdAt <= ?';
      params.push(endDate);
    }
    
    query += ' GROUP BY p.id, p.first_name, p.last_name, p.phone';
    
    const result = await db.all(query, params);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// گزارش بر اساس مرکز
router.get('/by-center', async (req, res) => {
  try {
    const db = getDB();
    
    const result = await db.all(`
      SELECT 
        c.id, c.name, c.address, c.type,
        COUNT(a.id) as assignmentCount,
        SUM(a.snapCost) as totalSnapCost,
        SUM(a.totalCost) as totalCost
      FROM centers c
      LEFT JOIN mission_assignments a ON c.id = a.centerId
      GROUP BY c.id, c.name, c.address, c.type
    `);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// گزارش بر اساس نوع مرکز
router.get('/by-center-type', async (req, res) => {
  try {
    const db = getDB();
    
    const result = await db.all(`
      SELECT 
        c.type,
        COUNT(DISTINCT c.id) as centerCount,
        COUNT(a.id) as assignmentCount,
        SUM(a.snapCost) as totalSnapCost,
        SUM(a.discountAmount) as totalDiscount,
        SUM(a.totalCost) as totalCost,
        SUM(a.personalPayment) as totalPersonalPayment
      FROM centers c
      LEFT JOIN mission_assignments a ON c.id = a.centerId
      WHERE c.type IS NOT NULL
      GROUP BY c.type
      ORDER BY 
        CASE c.type
          WHEN 'lead' THEN 1
          WHEN 'opportunity' THEN 2
          WHEN 'customer' THEN 3
          WHEN 'old_customer' THEN 4
          ELSE 5
        END
    `);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// گزارش بر اساس کد تخفیف
router.get('/by-discount', async (req, res) => {
  try {
    const db = getDB();
    
    const result = await db.all(`
      SELECT 
        a.discountCode,
        COUNT(*) as usageCount,
        SUM(a.discountAmount) as totalDiscount,
        SUM(a.snapCost) as totalSnapCost,
        SUM(a.totalCost) as totalCost
      FROM mission_assignments a
      WHERE a.discountCode IS NOT NULL
      GROUP BY a.discountCode
    `);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// گزارش ماهانه ماموریت‌ها
router.get('/monthly', async (req, res) => {
  try {
    const db = getDB();
    const { month, year, personnelId, personnelName } = req.query;
    
    // Helper function برای محاسبه تاریخ‌های شروع و پایان ماه
    const getMonthInfo = (monthNum, yearNum) => {
      let gregorianYear;
      let gregorianMonth;
      
      // بررسی اعتبار سال - اگر سال کوچکتر از 100 باشد، نامعتبر است
      if (!yearNum || isNaN(yearNum) || yearNum < 100) {
        // استفاده از سال جاری میلادی
        const now = new Date();
        gregorianYear = now.getFullYear();
        gregorianMonth = monthNum || (now.getMonth() + 1);
      } else if (yearNum >= 1000) {
        // سال شمسی است (>= 1000) - تبدیل به میلادی
        try {
          const persianMonth = monthNum || 1;
          const jalaaliDate = toGregorian(yearNum, persianMonth, 1);
          gregorianYear = jalaaliDate.gy;
          gregorianMonth = jalaaliDate.gm;
        } catch (error) {
          // اگر خطا داد (مثلاً سال معتبر نیست)، از سال جاری استفاده کن
          console.error('Error converting Jalaali year:', error);
          const now = new Date();
          gregorianYear = now.getFullYear();
          gregorianMonth = monthNum || (now.getMonth() + 1);
        }
      } else {
        // سال میلادی است (بین 100 تا 1000) - این حالت معمولاً رخ نمی‌دهد
        // اما برای امنیت، از سال جاری استفاده می‌کنیم
        const now = new Date();
        gregorianYear = now.getFullYear();
        gregorianMonth = monthNum || (now.getMonth() + 1);
      }
      
      // اطمینان از اینکه month معتبر است
      if (!gregorianMonth || gregorianMonth < 1 || gregorianMonth > 12) {
        gregorianMonth = new Date().getMonth() + 1;
      }
      
      // اطمینان از اینکه year معتبر است
      if (!gregorianYear || gregorianYear < 1900 || gregorianYear > 2100) {
        gregorianYear = new Date().getFullYear();
      }
      
      // تاریخ شروع ماه (اولین روز)
      const monthStart = new Date(gregorianYear, gregorianMonth - 1, 1);
      
      // تاریخ پایان ماه (آخرین روز)
      const monthEnd = new Date(gregorianYear, gregorianMonth, 0);
      
      return {
        monthNumber: gregorianMonth,
        year: gregorianYear,
        startDate: monthStart.toISOString().split('T')[0],
        endDate: monthEnd.toISOString().split('T')[0]
      };
    };
    
    // Parse و validate پارامترها
    let monthNum = month ? parseInt(month) : undefined;
    let yearNum = year ? parseInt(year) : undefined;
    
    // Validation: سال باید معتبر باشد
    if (yearNum && (yearNum < 1400 || yearNum > 1500)) {
      // اگر سال خارج از بازه شمسی معتبر است، از سال جاری استفاده کن
      console.warn(`Invalid year provided: ${yearNum}, using current year`);
      yearNum = undefined;
    }
    
    // Validation: ماه باید بین 1 تا 12 باشد
    if (monthNum && (monthNum < 1 || monthNum > 12)) {
      console.warn(`Invalid month provided: ${monthNum}, using current month`);
      monthNum = undefined;
    }
    
    const monthInfo = getMonthInfo(monthNum, yearNum);
    
    // تبدیل تاریخ‌ها به شمسی
    const startDatePersian = toPersianDate(monthInfo.startDate);
    const endDatePersian = toPersianDate(monthInfo.endDate);
    
    // Helper function برای escape کردن SQL
    const escapeSQL = (str) => {
      if (!str) return '';
      return String(str).replace(/'/g, "''");
    };
    
    // ساخت query
    let query = `
      SELECT a.*,
             p.id as personnelId, (p.first_name || ' ' || p.last_name) as personnelName, p.phone as personnelPhone,
             c.name as centerName, c.address as centerAddress, c.type as centerType,
             (m.first_name || ' ' || m.last_name) as managerName
      FROM mission_assignments a
      LEFT JOIN personnel p ON a.personnelId = p.id
      LEFT JOIN centers c ON a.centerId = c.id
      LEFT JOIN personnel m ON a.managerId = m.id
      WHERE DATE(a.createdAt) >= ? 
        AND DATE(a.createdAt) <= ?
    `;
    
    const params = [monthInfo.startDate, monthInfo.endDate];
    
    // فیلتر بر اساس personnelId
    if (personnelId) {
      query += ' AND a.personnelId = ?';
      params.push(parseInt(personnelId));
    }
    
    // فیلتر بر اساس نام کارمند (برای مدیران)
    if (personnelName) {
      query += ' AND (p.first_name || \' \' || p.last_name) LIKE ?';
      params.push(`%${personnelName}%`);
    }
    
    query += ' ORDER BY a.createdAt DESC, (p.first_name || \' \' || p.last_name) ASC';
    
    const result = await db.all(query);
    const assignments = result.map(row => ({
      ...row,
      _id: row.id ? row.id.toString() : null
    }));
    
    // محاسبه آمار
    const stats = {
      total: assignments.length,
      byStatus: {},
      byPersonnel: {},
      totalSnapCost: 0,
      totalDiscount: 0,
      totalCost: 0,
      totalPersonalPayment: 0
    };
    
    assignments.forEach(assignment => {
      // آمار بر اساس وضعیت
      stats.byStatus[assignment.status] = (stats.byStatus[assignment.status] || 0) + 1;
      
      // آمار بر اساس کارمند
      const personnelKey = assignment.personnelName || 'نامشخص';
      if (!stats.byPersonnel[personnelKey]) {
        stats.byPersonnel[personnelKey] = {
          name: personnelKey,
          count: 0,
          totalSnapCost: 0,
          totalCost: 0
        };
      }
      stats.byPersonnel[personnelKey].count++;
      stats.byPersonnel[personnelKey].totalSnapCost += assignment.snapCost || 0;
      stats.byPersonnel[personnelKey].totalCost += assignment.totalCost || 0;
      
      // مجموع هزینه‌ها
      stats.totalSnapCost += assignment.snapCost || 0;
      stats.totalDiscount += assignment.discountAmount || 0;
      stats.totalCost += assignment.totalCost || 0;
      stats.totalPersonalPayment += assignment.personalPayment || 0;
    });
    
    // تبدیل byPersonnel به آرایه
    const byPersonnelArray = Object.values(stats.byPersonnel);
    
    // تبدیل تاریخ‌های assignments به شمسی
    const assignmentsWithPersianDate = assignments.map(assignment => {
      const persianCreatedAt = assignment.createdAt ? toPersianDate(assignment.createdAt) : null;
      const persianApprovedAt = assignment.approvedAt ? toPersianDate(assignment.approvedAt) : null;
      const persianCompletedAt = assignment.completedAt ? toPersianDate(assignment.completedAt) : null;
      
      return {
        ...assignment,
        createdAtPersian: persianCreatedAt ? persianCreatedAt.full : null,
        createdAtPersianFormatted: persianCreatedAt ? persianCreatedAt.withMonthName : null,
        approvedAtPersian: persianApprovedAt ? persianApprovedAt.full : null,
        approvedAtPersianFormatted: persianApprovedAt ? persianApprovedAt.withMonthName : null,
        completedAtPersian: persianCompletedAt ? persianCompletedAt.full : null,
        completedAtPersianFormatted: persianCompletedAt ? persianCompletedAt.withMonthName : null
      };
    });
    
    const monthNames = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    // استفاده از ماه شمسی که از query آمده (یا ماه جاری)
    const persianMonthNum = parseInt(month) || new Date().getMonth() + 1;
    const persianYearNum = parseInt(year);
    const persianMonth = monthNames[persianMonthNum - 1] || monthNames[0];
    
    // اگر سال شمسی داده شده، از آن استفاده کن، وگرنه از سال میلادی تبدیل شده
    const displayYear = (persianYearNum && persianYearNum >= 1000) ? persianYearNum : startDatePersian.year;
    
    res.json({
      monthInfo: {
        ...monthInfo,
        monthNumber: persianMonthNum,
        year: displayYear,
        monthNamePersian: persianMonth,
        startDatePersian: startDatePersian.full,
        startDatePersianFormatted: startDatePersian.withMonthName,
        endDatePersian: endDatePersian.full,
        endDatePersianFormatted: endDatePersian.withMonthName
      },
      assignments: assignmentsWithPersianDate,
      stats: {
        ...stats,
        byPersonnel: byPersonnelArray
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// گزارش هفتگی ماموریت‌ها
router.get('/weekly', async (req, res) => {
  try {
    const db = getDB();
    const { week, year, personnelId, personnelName } = req.query;
    
    // Helper function برای محاسبه شماره هفته و تاریخ‌های شروع و پایان
    const getWeekInfo = (weekNum, yearNum) => {
      const year = yearNum || new Date().getFullYear();
      const week = weekNum || getCurrentWeek();
      
      // محاسبه تاریخ شروع هفته (شنبه)
      const jan4 = new Date(year, 0, 4);
      const jan4Day = jan4.getDay() || 7; // 1 = Monday, 7 = Sunday
      const daysToMonday = (8 - jan4Day) % 7;
      const firstMonday = new Date(year, 0, 4 + daysToMonday);
      const weekStart = new Date(firstMonday);
      weekStart.setDate(firstMonday.getDate() + (week - 1) * 7 - 1); // شنبه
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // جمعه
      
      return {
        weekNumber: week,
        year: year,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0]
      };
    };
    
    // Helper function برای محاسبه شماره هفته فعلی
    const getCurrentWeek = () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((days + start.getDay() + 1) / 7);
      return weekNumber;
    };
    
    const weekInfo = getWeekInfo(parseInt(week), parseInt(year));
    
    // تبدیل تاریخ‌ها به شمسی
    const startDatePersian = toPersianDate(weekInfo.startDate);
    const endDatePersian = toPersianDate(weekInfo.endDate);
    
    // Helper function برای escape کردن SQL
    const escapeSQL = (str) => {
      if (!str) return '';
      return String(str).replace(/'/g, "''");
    };
    
    // ساخت query
    let query = `
      SELECT a.*,
             p.id as personnelId, (p.first_name || ' ' || p.last_name) as personnelName, p.phone as personnelPhone,
             c.name as centerName, c.address as centerAddress, c.type as centerType,
             (m.first_name || ' ' || m.last_name) as managerName
      FROM mission_assignments a
      LEFT JOIN personnel p ON a.personnelId = p.id
      LEFT JOIN centers c ON a.centerId = c.id
      LEFT JOIN personnel m ON a.managerId = m.id
      WHERE DATE(a.createdAt) >= ? 
        AND DATE(a.createdAt) <= ?
    `;
    
    const params = [weekInfo.startDate, weekInfo.endDate];
    
    // فیلتر بر اساس personnelId
    if (personnelId) {
      query += ' AND a.personnelId = ?';
      params.push(parseInt(personnelId));
    }
    
    // فیلتر بر اساس نام کارمند (برای مدیران)
    if (personnelName) {
      query += ' AND (p.first_name || \' \' || p.last_name) LIKE ?';
      params.push(`%${personnelName}%`);
    }
    
    query += ' ORDER BY a.createdAt DESC, p.first_name ASC, p.last_name ASC';
    
    const result = await db.all(query, params);
    const assignments = result.map(row => ({
      ...row,
      _id: row.id ? row.id.toString() : null
    }));
    
    // محاسبه آمار
    const stats = {
      total: assignments.length,
      byStatus: {},
      byPersonnel: {},
      totalSnapCost: 0,
      totalDiscount: 0,
      totalCost: 0,
      totalPersonalPayment: 0
    };
    
    assignments.forEach(assignment => {
      // آمار بر اساس وضعیت
      stats.byStatus[assignment.status] = (stats.byStatus[assignment.status] || 0) + 1;
      
      // آمار بر اساس کارمند
      const personnelKey = assignment.personnelName || 'نامشخص';
      if (!stats.byPersonnel[personnelKey]) {
        stats.byPersonnel[personnelKey] = {
          name: personnelKey,
          count: 0,
          totalSnapCost: 0,
          totalCost: 0
        };
      }
      stats.byPersonnel[personnelKey].count++;
      stats.byPersonnel[personnelKey].totalSnapCost += assignment.snapCost || 0;
      stats.byPersonnel[personnelKey].totalCost += assignment.totalCost || 0;
      
      // مجموع هزینه‌ها
      stats.totalSnapCost += assignment.snapCost || 0;
      stats.totalDiscount += assignment.discountAmount || 0;
      stats.totalCost += assignment.totalCost || 0;
      stats.totalPersonalPayment += assignment.personalPayment || 0;
    });
    
    // تبدیل byPersonnel به آرایه
    const byPersonnelArray = Object.values(stats.byPersonnel);
    
    // تبدیل تاریخ‌های assignments به شمسی
    const assignmentsWithPersianDate = assignments.map(assignment => {
      const persianCreatedAt = assignment.createdAt ? toPersianDate(assignment.createdAt) : null;
      const persianApprovedAt = assignment.approvedAt ? toPersianDate(assignment.approvedAt) : null;
      const persianCompletedAt = assignment.completedAt ? toPersianDate(assignment.completedAt) : null;
      
      return {
        ...assignment,
        createdAtPersian: persianCreatedAt ? persianCreatedAt.full : null,
        createdAtPersianFormatted: persianCreatedAt ? persianCreatedAt.withMonthName : null,
        approvedAtPersian: persianApprovedAt ? persianApprovedAt.full : null,
        approvedAtPersianFormatted: persianApprovedAt ? persianApprovedAt.withMonthName : null,
        completedAtPersian: persianCompletedAt ? persianCompletedAt.full : null,
        completedAtPersianFormatted: persianCompletedAt ? persianCompletedAt.withMonthName : null
      };
    });
    
    res.json({
      weekInfo: {
        ...weekInfo,
        startDatePersian: startDatePersian.full,
        startDatePersianFormatted: startDatePersian.withMonthName,
        endDatePersian: endDatePersian.full,
        endDatePersianFormatted: endDatePersian.withMonthName
      },
      assignments: assignmentsWithPersianDate,
      stats: {
        ...stats,
        byPersonnel: byPersonnelArray
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// گزارش جزئیات با فیلترها
router.get('/details', async (req, res) => {
  try {
    const { personnelId, centerId, status, discountCode, startDate, endDate } = req.query;
    
    let query = `
      SELECT a.*,
             (p.first_name || ' ' || p.last_name) as personnelName, p.phone as personnelPhone,
             c.name as centerName, c.address as centerAddress,
             (m.first_name || ' ' || m.last_name) as managerName
      FROM mission_assignments a
      LEFT JOIN personnel p ON a.personnelId = p.id
      LEFT JOIN centers c ON a.centerId = c.id
      LEFT JOIN personnel m ON a.managerId = m.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (personnelId) {
      query += ' AND a.personnelId = ?';
      params.push(personnelId);
    }
    if (centerId) {
      query += ' AND a.centerId = ?';
      params.push(centerId);
    }
    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
    if (discountCode) {
      query += ' AND a.discountCode = ?';
      params.push(discountCode);
    }
    if (startDate) {
      query += ' AND a.createdAt >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND a.createdAt <= ?';
      params.push(endDate);
    }
    
    query += ' ORDER BY a.createdAt DESC';
    
    const dbInstance = getDB();
    const result = await dbInstance.all(query, params);
    
    res.json(result.map(row => ({
      ...row,
      _id: row.id ? row.id.toString() : null
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function formatGroupResults(result) {
  // sqlite3 خودش array از objects برمی‌گرداند
  if (Array.isArray(result)) {
    return result;
  }
  // اگر از sql.js آمده باشد (backward compatibility)
  if (!result.length || !result[0].values.length) {
    return [];
  }
  const columns = result[0].columns;
  const values = result[0].values;
  return values.map(row => {
    const obj = {};
    columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    return obj;
  });
}

function formatResults(result) {
  // sqlite3 خودش array از objects برمی‌گرداند
  if (Array.isArray(result)) {
    return result;
  }
  // اگر از sql.js آمده باشد (backward compatibility)
  if (!result.length || !result[0].values.length) {
    return [];
  }
  const columns = result[0].columns;
  const values = result[0].values;
  return values.map(row => {
    const obj = {};
    columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    return obj;
  });
}

function formatAssignmentResults(result) {
  // sqlite3 خودش array از objects برمی‌گرداند
  if (Array.isArray(result)) {
    return result.map(row => ({
      ...row,
      _id: row.id ? row.id.toString() : null
    }));
  }
  // اگر از sql.js آمده باشد (backward compatibility)
  if (!result.length || !result[0].values.length) {
    return [];
  }
  const columns = result[0].columns;
  const values = result[0].values;
  return values.map(row => {
    const obj = {};
    columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    return {
      ...obj,
      _id: obj.id.toString()
    };
  });
}

export default router;
