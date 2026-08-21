// =============================================
// Smart Clinic OS (Ops Console) — In-App Notification Service
// Writes into the shared `notifications` table (bootstrapped by clinic-app
// on the same physical SQLite file) so clinic-app's own UI picks these up.
// =============================================

const db = require('../db/connection');

async function createNotification({ tenantId, userId = null, title, message, type = 'info', link = null }) {
  const id = `notif-${Math.random().toString(36).substring(2, 9)}`;
  try {
    await db.run(
      `INSERT INTO notifications (id, tenant_id, user_id, title, message, type, link, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, tenantId, userId, title, message, type, link]
    );
    return { id };
  } catch (err) {
    console.error('Failed to create in-app notification:', err);
    return null;
  }
}

module.exports = { createNotification };
