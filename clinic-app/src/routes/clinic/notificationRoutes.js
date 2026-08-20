// =============================================
// Smart Clinic OS — Notifications API Routes
// GET  /v1/notifications
// PUT  /v1/notifications/:id/read
// PUT  /v1/notifications/read-all
// =============================================

const express = require('express');
const router = express.Router();
const notificationService = require('../../services/notificationService');

const DEFAULT_TENANT_ID = 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

// List In-App Notifications
router.get('/v1/notifications', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id || DEFAULT_TENANT_ID;
    const notifications = await notificationService.getNotifications(tenantId);
    const unreadCount = notifications.filter(n => !n.is_read).length;
    return res.json({
      success: true,
      data: {
        notifications,
        unread_count: unreadCount
      }
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء جلب الإشعارات' } });
  }
});

// Mark single notification as read
router.put('/v1/notifications/:id/read', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id || DEFAULT_TENANT_ID;
    await notificationService.markAsRead(req.params.id, tenantId);
    return res.json({ success: true, message: 'تم تحديث حالة الإشعار' });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء تحديث الإشعار' } });
  }
});

// Mark all as read
router.put('/v1/notifications/read-all', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id || DEFAULT_TENANT_ID;
    await notificationService.markAllAsRead(tenantId);
    return res.json({ success: true, message: 'تم تحديد جميع الإشعارات كمقروءة' });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء تحديث الإشعارات' } });
  }
});

module.exports = router;
