import express from 'express'
import { Notification } from '../models/Notification.js'
import { authenticateToken } from './auth.js'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

// Get all notifications for current user
router.get('/', async (req, res) => {
  try {
    const personnelId = req.user.id

    const filters = {
      personnelId,
      isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
      type: req.query.type || undefined,
      entityType: req.query.entityType || undefined,
      entityId: req.query.entityId ? parseInt(req.query.entityId) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    }

    const notifications = await Notification.getAll(filters)
    const unreadCount = await Notification.getUnreadCount(personnelId)

    res.json({
      notifications,
      unreadCount
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get unread count
router.get('/unread-count', async (req, res) => {
  try {
    const personnelId = req.user.id
    const count = await Notification.getUnreadCount(personnelId)
    res.json({ count })
  } catch (error) {
    console.error('Error fetching unread count:', error)
    res.status(500).json({ error: error.message })
  }
})

// Mark notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    const personnelId = req.user.id
    const notification = await Notification.markAsRead(req.params.id, personnelId)
    res.json(notification)
  } catch (error) {
    console.error('Error marking notification as read:', error)
    res.status(500).json({ error: error.message })
  }
})

// Mark all notifications as read
router.patch('/read-all', async (req, res) => {
  try {
    const personnelId = req.user.id
    await Notification.markAllAsRead(personnelId)
    res.json({ success: true })
  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    res.status(500).json({ error: error.message })
  }
})

// Delete notification
router.delete('/:id', async (req, res) => {
  try {
    const personnelId = req.user.id
    await Notification.delete(req.params.id, personnelId)
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting notification:', error)
    res.status(500).json({ error: error.message })
  }
})

// Create notification (for internal use, can be called by other services)
router.post('/', async (req, res) => {
  try {
    const { personnelId, title, message, type, entityType, entityId, actionUrl } = req.body

    if (!personnelId || !title || !message) {
      return res.status(400).json({ error: 'personnelId, title, and message are required' })
    }

    const notification = await Notification.create({
      personnelId,
      title,
      message,
      type: type || 'info',
      entityType,
      entityId,
      actionUrl
    })

    res.status(201).json(notification)
  } catch (error) {
    console.error('Error creating notification:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router

