import express from 'express';
import { Contact } from '../models/Contact.js';

const router = express.Router();

// Get all contacts with filters and pagination
router.get('/', async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Default: 50 items per page
    const offset = (page - 1) * limit;
    
    const filters = {
      personnelId: req.query.personnelId ? parseInt(req.query.personnelId) : undefined,
      centerId: req.query.centerId ? parseInt(req.query.centerId) : undefined,
      contactType: req.query.contactType,
      search: req.query.search,
      limit: limit,
      offset: offset
    };
    
    // Get total count for pagination metadata
    const totalCount = await Contact.count({
      personnelId: filters.personnelId,
      centerId: filters.centerId,
      contactType: filters.contactType,
      search: filters.search
    });
    
    const contacts = await Contact.getAll(filters);
    
    // Return paginated response
    res.json({
      data: contacts,
      pagination: {
        page: page,
        limit: limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single contact
router.get('/:id', async (req, res) => {
  try {
    const contact = await Contact.getById(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'تماس یافت نشد' });
    }
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new contact
router.post('/', async (req, res) => {
  try {
    if (!req.body.personnelId || !req.body.centerId) {
      return res.status(400).json({ error: 'پرسنل و مرکز الزامی است' });
    }

    const contact = await Contact.create(req.body);
    
    res.status(201).json(contact);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update a contact
router.put('/:id', async (req, res) => {
  try {
    const contact = await Contact.update(req.params.id, req.body);
    if (!contact) {
      return res.status(404).json({ error: 'تماس یافت نشد' });
    }
    res.json(contact);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a contact
router.delete('/:id', async (req, res) => {
  try {
    const contact = await Contact.delete(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'تماس یافت نشد' });
    }
    res.json({ message: 'تماس با موفقیت حذف شد', contact });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
