import express from 'express';
import { Personnel } from '../models/Personnel.js';

const router = express.Router();

// Get all personnel
router.get('/', async (req, res) => {
  try {
    const personnel = await Personnel.getAll();
    res.json(personnel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single personnel
router.get('/:id', async (req, res) => {
  try {
    const personnel = await Personnel.getById(req.params.id);
    if (!personnel) {
      return res.status(404).json({ error: 'پرسنل یافت نشد' });
    }
    res.json(personnel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get by phone
router.get('/phone/:phone', async (req, res) => {
  try {
    const personnel = await Personnel.getByPhone(req.params.phone);
    if (!personnel) {
      return res.status(404).json({ error: 'پرسنل یافت نشد' });
    }
    res.json(personnel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get by Telegram ID
router.get('/telegram/:telegramId', async (req, res) => {
  try {
    const personnel = await Personnel.getByTelegramId(req.params.telegramId);
    if (!personnel) {
      return res.status(404).json({ error: 'پرسنل یافت نشد' });
    }
    res.json(personnel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new personnel
router.post('/', async (req, res) => {
  try {
    if (!req.body.name || !req.body.phone) {
      return res.status(400).json({ error: 'نام و شماره تماس الزامی است' });
    }

    const personnel = await Personnel.create(req.body);
    res.status(201).json(personnel);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update a personnel
router.put('/:id', async (req, res) => {
  try {
    const personnel = await Personnel.update(req.params.id, req.body);
    if (!personnel) {
      return res.status(404).json({ error: 'پرسنل یافت نشد' });
    }
    res.json(personnel);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a personnel
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Personnel.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'پرسنل یافت نشد' });
    }
    res.json({ message: 'پرسنل با موفقیت حذف شد' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Activate a personnel
router.post('/:id/activate', async (req, res) => {
  try {
    const personnel = await Personnel.update(req.params.id, { isActive: true });
    if (!personnel) {
      return res.status(404).json({ error: 'پرسنل یافت نشد' });
    }
    res.json({ message: 'پرسنل فعال شد', personnel });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Deactivate a personnel
router.post('/:id/deactivate', async (req, res) => {
  try {
    const personnel = await Personnel.update(req.params.id, { isActive: false });
    if (!personnel) {
      return res.status(404).json({ error: 'پرسنل یافت نشد' });
    }
    res.json({ message: 'پرسنل غیرفعال شد', personnel });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
