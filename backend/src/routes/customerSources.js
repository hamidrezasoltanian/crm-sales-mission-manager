import express from 'express';
import CustomerSource from '../models/CustomerSource.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const sources = await CustomerSource.getAll();
    res.json(sources);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, color } = req.body || {};
    if (!name?.trim()) {
      return res.status(400).json({ error: 'نام منبع الزامی است' });
    }

    const source = await CustomerSource.create({ name, description, color });
    res.status(201).json(source);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

