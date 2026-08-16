const db = require('../db/connection');

/**
 * Check if the patient is eligible for a free follow-up appointment.
 * Condition: Has a paid/completed appointment within the last 14 days.
 */
const checkFollowUpEligibility = async (tenantId, phone) => {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  if (db.isMock) {
    // Mock check
    const patient = db.memoryDB.patients.find(p => p.phone === phone && p.tenant_id === tenantId);
    if (!patient) return { eligible: false };

    const lastVisit = db.memoryDB.appointments
      .filter(a => a.patient_id === patient.id && a.tenant_id === tenantId && (a.status === 'completed' || a.status === 'confirmed') && a.date >= fourteenDaysAgo)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (lastVisit) {
      return { eligible: true, last_visit_date: lastVisit.date };
    }
    return { eligible: false };
  } else {
    // Database check
    try {
      const res = await db.query(
        `SELECT a.* FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         WHERE a.tenant_id = $1 AND p.phone = $2 AND (a.status = 'completed' OR a.status = 'confirmed') AND a.date >= $3
         ORDER BY a.date DESC LIMIT 1`,
        [tenantId, phone, fourteenDaysAgo]
      );
      if (res.rows.length > 0) {
        return { eligible: true, last_visit_date: res.rows[0].date };
      }
      return { eligible: false };
    } catch (err) {
      console.error('Error checking follow-up eligibility in DB:', err);
      return { eligible: false };
    }
  }
};

/**
 * Check if a time slot is available (not booked and not locked).
 */
const checkSlotAvailability = async (tenantId, doctorId, date, time) => {
  if (db.isMock) {
    // 1. Check booked appointments
    const isBooked = db.memoryDB.appointments.some(
      a => a.tenant_id === tenantId && a.doctor_id === doctorId && a.date === date && a.time === time && a.status !== 'cancelled'
    );
    if (isBooked) return false;

    // 2. Check active slot locks
    const isLocked = db.memoryDB.slot_locks.some(
      l => l.tenant_id === tenantId && l.doctor_id === doctorId && l.date === date && l.time === time && new Date(l.expires_at) > new Date()
    );
    if (isLocked) return false;

    return true;
  } else {
    // Database check
    try {
      // Check bookings
      const bookRes = await db.query(
        `SELECT id FROM appointments 
         WHERE tenant_id = $1 AND doctor_id = $2 AND date = $3 AND time = $4 AND status != 'cancelled'`,
        [tenantId, doctorId, date, time]
      );
      if (bookRes.rows.length > 0) return false;

      // Check locks
      const lockRes = await db.query(
        `SELECT id FROM slot_locks 
         WHERE tenant_id = $1 AND doctor_id = $2 AND date = $3 AND time = $4 AND expires_at > NOW()`,
        [tenantId, doctorId, date, time]
      );
      if (lockRes.rows.length > 0) return false;

      return true;
    } catch (err) {
      console.error('Error checking slot availability in DB:', err);
      return false;
    }
  }
};

/**
 * Lock a time slot temporarily for 15 minutes.
 */
const lockSlot = async (tenantId, doctorId, date, time, patientPhone) => {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const lockId = `lock-${Math.random().toString(36).substring(7)}`;

  if (db.isMock) {
    // Remove expired locks first
    db.memoryDB.slot_locks = db.memoryDB.slot_locks.filter(l => new Date(l.expires_at) > new Date());
    
    db.memoryDB.slot_locks.push({
      id: lockId,
      tenant_id: tenantId,
      doctor_id: doctorId,
      date,
      time,
      patient_phone: patientPhone,
      expires_at: expiresAt
    });
    return lockId;
  } else {
    try {
      await db.query(
        `INSERT INTO slot_locks (id, tenant_id, doctor_id, date, time, patient_phone, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [lockId, tenantId, doctorId, date, time, patientPhone, expiresAt]
      );
      return lockId;
    } catch (err) {
      console.error('Error locking slot in DB:', err);
      return null;
    }
  }
};

module.exports = {
  checkFollowUpEligibility,
  checkSlotAvailability,
  lockSlot
};
