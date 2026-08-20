// =============================================
// Smart Clinic OS — In-App Notifications Service
// Stores real-time in-app notifications for doctors & staff
// =============================================

const db = require('../db/connection');

async function createNotification({ tenantId, userId = null, title, message, type = 'info', link = null }) {
  const id = `notif-${Math.random().toString(36).substring(2, 9)}`;
  try {
    await db.run(`
      INSERT INTO notifications (id, tenant_id, user_id, title, message, type, link, is_read)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `, [id, tenantId, userId, title, message, type, link]);
    return { id, tenant_id: tenantId, title, message, type, link, is_read: 0 };
  } catch (err) {
    console.error('Failed to create in-app notification:', err);
    return null;
  }
}

async function getNotifications(tenantId, limit = 30) {
  try {
    const rows = await db.all(`
      SELECT * FROM notifications 
      WHERE tenant_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `, [tenantId, limit]);
    return rows;
  } catch (err) {
    console.error('Failed to fetch notifications:', err);
    return [];
  }
}

async function markAsRead(id, tenantId) {
  try {
    await db.run(`
      UPDATE notifications SET is_read = 1 
      WHERE id = ? AND tenant_id = ?
    `, [id, tenantId]);
    return true;
  } catch (err) {
    console.error('Failed to mark notification as read:', err);
    return false;
  }
}

async function markAllAsRead(tenantId) {
  try {
    await db.run(`
      UPDATE notifications SET is_read = 1 
      WHERE tenant_id = ?
    `, [tenantId]);
    return true;
  } catch (err) {
    console.error('Failed to mark all notifications as read:', err);
    return false;
  }
}

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead
};
