import express from 'express';
import { DiscountCode } from '../models/DiscountCode.js';

const router = express.Router();

// Get all discount codes
router.get('/', async (req, res) => {
  try {
    const codes = await DiscountCode.getAll();
    res.json(codes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single discount code
router.get('/:id', async (req, res) => {
  try {
    const code = await DiscountCode.getById(req.params.id);
    if (!code) {
      return res.status(404).json({ error: 'کد تخفیف یافت نشد' });
    }
    res.json(code);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get by code
router.get('/code/:code', async (req, res) => {
  try {
    const code = await DiscountCode.getByCode(req.params.code);
    if (!code) {
      return res.status(404).json({ error: 'کد تخفیف معتبر نیست یا یافت نشد' });
    }
    res.json(code);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new discount code
router.post('/', async (req, res) => {
  try {
    const { code, discountType, discountValue } = req.body;
    
    if (!code || !discountType || discountValue === undefined || discountValue === null) {
      return res.status(400).json({ error: 'کد، نوع و مقدار تخفیف الزامی است' });
    }

    const discountCode = await DiscountCode.create(req.body);
    res.status(201).json(discountCode);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update a discount code
router.put('/:id', async (req, res) => {
  try {
    const discountCode = await DiscountCode.update(req.params.id, req.body);
    if (!discountCode) {
      return res.status(404).json({ error: 'کد تخفیف یافت نشد' });
    }
    res.json(discountCode);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a discount code
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await DiscountCode.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'کد تخفیف یافت نشد' });
    }
    res.json({ message: 'کد تخفیف با موفقیت حذف شد' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
