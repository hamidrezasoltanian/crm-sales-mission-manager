import express from 'express'
import { Reminder } from '../models/Reminder.js'
import { authenticateToken } from './auth.js'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

// Get all reminders for current user
router.get('/', async (req, res) => {
  try {
    const personnelId = req.user.id

    const filters = {
      personnelId,
      isCompleted: req.query.isCompleted === 'true' ? true : req.query.isCompleted === 'false' ? false : undefined,
      entityType: req.query.entityType || undefined,
      entityId: req.query.entityId ? parseInt(req.query.entityId) : undefined,
      upcoming: req.query.upcoming === 'true',
      past: req.query.past === 'true',
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    }

    const reminders = await Reminder.getAll(filters)
    res.json({ reminders })
  } catch (error) {
    console.error('Error fetching reminders:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get upcoming reminders
router.get('/upcoming', async (req, res) => {
  try {
    const personnelId = req.user.id
    const limit = req.query.limit ? parseInt(req.query.limit) : 10
    const reminders = await Reminder.getUpcoming(personnelId, limit)
    res.json({ reminders })
  } catch (error) {
    console.error('Error fetching upcoming reminders:', error)
    res.status(500).json({ error: error.message })
  }
})

// Create reminder
router.post('/', async (req, res) => {
  try {
    const personnelId = req.user.id
    const { title, description, entityType, entityId, reminderAt } = req.body

    if (!title || !reminderAt) {
      return res.status(400).json({ error: 'title and reminderAt are required' })
    }

    const reminder = await Reminder.create({
      personnelId,
      title,
      description,
      entityType,
      entityId,
      reminderAt
    })

    res.status(201).json(reminder)
  } catch (error) {
    console.error('Error creating reminder:', error)
    res.status(500).json({ error: error.message })
  }
})

// Update reminder
router.patch('/:id', async (req, res) => {
  try {
    const personnelId = req.user.id
    const reminder = await Reminder.update(req.params.id, personnelId, req.body)
    res.json(reminder)
  } catch (error) {
    console.error('Error updating reminder:', error)
    res.status(500).json({ error: error.message })
  }
})

// Mark reminder as completed
router.patch('/:id/complete', async (req, res) => {
  try {
    const personnelId = req.user.id
    const reminder = await Reminder.markAsCompleted(req.params.id, personnelId)
    res.json(reminder)
  } catch (error) {
    console.error('Error marking reminder as completed:', error)
    res.status(500).json({ error: error.message })
  }
})

// Delete reminder
router.delete('/:id', async (req, res) => {
  try {
    const personnelId = req.user.id
    await Reminder.delete(req.params.id, personnelId)
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting reminder:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router

