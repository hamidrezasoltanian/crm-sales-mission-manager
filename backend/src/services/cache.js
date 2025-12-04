import NodeCache from 'node-cache';

// ایجاد instance از cache با TTL 5 دقیقه (300 ثانیه)
const cache = new NodeCache({ 
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false // برای بهبود عملکرد
});

// کلیدهای cache
export const CACHE_KEYS = {
  CENTERS_ALL: 'centers:all',
  CENTERS_ACTIVE: 'centers:active',
  CENTERS_BY_TYPE: (type) => `centers:type:${type}`,
  CENTERS_BY_CITY: (city) => `centers:city:${city}`,
  REPORTS_SUMMARY: 'reports:summary',
  REPORTS_WEEKLY: (week) => `reports:weekly:${week}`,
  REPORTS_MONTHLY: (month) => `reports:monthly:${month}`,
  ASSIGNMENTS_COUNT: (filters) => `assignments:count:${JSON.stringify(filters)}`,
  CENTERS_COUNT: (filters) => `centers:count:${JSON.stringify(filters)}`
};

/**
 * دریافت مقدار از cache
 */
export const get = (key) => {
  return cache.get(key);
};

/**
 * ذخیره مقدار در cache
 */
export const set = (key, value, ttl = null) => {
  if (ttl) {
    return cache.set(key, value, ttl);
  }
  return cache.set(key, value);
};

/**
 * حذف یک کلید از cache
 */
export const del = (key) => {
  return cache.del(key);
};

/**
 * حذف همه کلیدهای مربوط به یک pattern
 */
export const flushPattern = (pattern) => {
  const keys = cache.keys();
  const regex = new RegExp(pattern);
  keys.forEach(key => {
    if (regex.test(key)) {
      cache.del(key);
    }
  });
};

/**
 * حذف همه cache
 */
export const flushAll = () => {
  cache.flushAll();
};

/**
 * حذف cache مربوط به centers
 */
export const flushCenters = () => {
  flushPattern('^centers:');
};

/**
 * حذف cache مربوط به reports
 */
export const flushReports = () => {
  flushPattern('^reports:');
};

/**
 * حذف cache مربوط به assignments
 */
export const flushAssignments = () => {
  flushPattern('^assignments:');
};

/**
 * دریافت آمار cache
 */
export const getStats = () => {
  return cache.getStats();
};

export default {
  get,
  set,
  del,
  flushPattern,
  flushAll,
  flushCenters,
  flushReports,
  flushAssignments,
  getStats,
  CACHE_KEYS
};

