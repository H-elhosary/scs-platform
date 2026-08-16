// =============================================
// Smart Clinic OS — Shared Queue State
// Shared mutable state for the waiting room queue
// Used by appointmentRoutes and queueRoutes
// =============================================

const queueState = {
  current_in_exam: null,
  waiting_list: [],
  last_called_at: ""
};

module.exports = queueState;
