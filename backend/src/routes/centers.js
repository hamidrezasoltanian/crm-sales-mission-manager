import express from 'express';
import { Center } from '../models/Center.js';
import cacheService, { CACHE_KEYS, flushCenters } from '../services/cache.js';

const router = express.Router();

// Get all centers with pagination
router.get('/', async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Default: 50 items per page
    const offset = (page - 1) * limit;
    
    const filters = {
      type: req.query.type,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      search: req.query.search,
      responsiblePersonnelId: req.query.responsiblePersonnelId ? parseInt(req.query.responsiblePersonnelId) : undefined,
      city: req.query.city,
      province: req.query.province,
      limit: limit,
      offset: offset
    };
    
    // ساخت cache key بر اساس فیلترها
    const cacheKey = filters.search || filters.type || filters.city 
      ? `centers:filtered:${JSON.stringify(filters)}:page:${page}:limit:${limit}`
      : `centers:all:page:${page}:limit:${limit}`;
    
    // بررسی cache (فقط برای صفحه اول و بدون جستجو)
    if (page === 1 && !filters.search) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }
    
    // Get total count for pagination metadata
    const countCacheKey = `centers:count:${JSON.stringify({
      type: filters.type,
      isActive: filters.isActive,
      search: filters.search,
      responsiblePersonnelId: filters.responsiblePersonnelId,
      city: filters.city
    })}`;
    
    let totalCount = cacheService.get(countCacheKey);
    if (totalCount === undefined) {
      totalCount = await Center.count({
        type: filters.type,
        isActive: filters.isActive,
        search: filters.search,
        responsiblePersonnelId: filters.responsiblePersonnelId,
        city: filters.city
      });
      // Cache count برای 10 دقیقه
      cacheService.set(countCacheKey, totalCount, 600);
    }
    
    const centers = await Center.getAll(filters);
    
    // Return paginated response
    const response = {
      data: centers,
      pagination: {
        page: page,
        limit: limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    };
    
    // ذخیره در cache (فقط برای صفحه اول و بدون جستجو)
    if (page === 1 && !filters.search) {
      cacheService.set(cacheKey, response, 300); // 5 minutes
    }
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single center
router.get('/:id', async (req, res) => {
  try {
    const center = await Center.getById(req.params.id);
    if (!center) {
      return res.status(404).json({ error: 'مرکز یافت نشد' });
    }
    res.json(center);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new center
router.post('/', async (req, res) => {
  try {
    const hasAddress =
      (Array.isArray(req.body.addresses) && req.body.addresses.some((addr) => addr && addr.addressLine)) ||
      !!req.body.address;

    if (!req.body.name || !hasAddress) {
      return res.status(400).json({ error: 'نام و حداقل یک آدرس معتبر الزامی است' });
    }

    const center = await Center.create(req.body);
    flushCenters();
    res.status(201).json(center);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update a center
router.put('/:id', async (req, res) => {
  try {
    const center = await Center.update(req.params.id, req.body);
    if (!center) {
      return res.status(404).json({ error: 'مرکز یافت نشد' });
    }
    
    // حذف cache مربوط به centers
    flushCenters();
    
    res.json(center);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a center
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Center.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'مرکز یافت نشد' });
    }
    
    // حذف cache مربوط به centers
    flushCenters();
    
    res.json({ message: 'مرکز با موفقیت حذف شد' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
