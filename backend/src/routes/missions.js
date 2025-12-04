import express from 'express';
import { Mission } from '../models/Mission.js';

const router = express.Router();

// Get all missions
router.get('/', (req, res) => {
  try {
    const missions = Mission.getAll();
    res.json(missions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single mission
router.get('/:id', (req, res) => {
  try {
    const mission = Mission.getById(req.params.id);
    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }
    res.json(mission);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new mission
router.post('/', (req, res) => {
  try {
    // اعتبارسنجی
    if (!req.body.title || req.body.title.trim() === '') {
      return res.status(400).json({ error: 'Title is required' });
    }

    const mission = Mission.create(req.body);
    res.status(201).json(mission);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update a mission
router.put('/:id', (req, res) => {
  try {
    const mission = Mission.update(req.params.id, req.body);
    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }
    res.json(mission);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a mission
router.delete('/:id', (req, res) => {
  try {
    const deleted = Mission.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Mission not found' });
    }
    res.json({ message: 'Mission deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;