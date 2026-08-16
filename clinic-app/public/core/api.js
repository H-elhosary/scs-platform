/* =============================================
   SMART CLINIC OS — API Layer
   Centralized API calls with error handling
   ============================================= */

const ScsApi = (() => {
  const BASE = '';

  // Standardized fetch wrapper
  async function request(url, options = {}) {
    const tenantId = localStorage.getItem('tenant_id') || 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId,
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(`${BASE}${url}`, config);
      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data?.error?.message || 'حدث خطأ في الاتصال بالخادم');
        error.code = data?.error?.code || 'UNKNOWN_ERROR';
        error.status = response.status;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.code) throw err;
      console.error(`[ScsApi] Request failed: ${url}`, err);
      const error = new Error('فشل الاتصال بالخادم. تأكد من اتصالك بالإنترنت.');
      error.code = 'NETWORK_ERROR';
      throw error;
    }
  }

  return {
    // === Dashboard ===
    getDashboardStats: () => request('/v1/dashboard/stats'),

    // === Patients ===
    getPatients: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/v1/patients${query ? '?' + query : ''}`);
    },
    getPatient: (id) => request(`/v1/patients/${id}`),
    createPatient: (data) => request('/v1/patients', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

    // === Appointments ===
    getAppointments: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/v1/appointments${query ? '?' + query : ''}`);
    },
    createAppointment: (data) => request('/v1/appointments', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    checkInAppointment: (id, isUrgent = false) => request(`/v1/appointments/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'checked_in', is_urgent: isUrgent })
    }),
    cancelAppointment: (id) => request(`/v1/appointments/${id}`, {
      method: 'DELETE'
    }),
    updateAppointment: (id, data) => request(`/v1/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    startExam: (id) => request(`/v1/queue/start-exam/${id}`, {
      method: 'POST'
    }),
    completeAppointment: (id, consultationData = {}) => request(`/v1/appointments/${id}/consultation`, {
      method: 'POST',
      body: JSON.stringify(consultationData)
    }),
    saveConsultation: (id, consultationData = {}) => request(`/v1/appointments/${id}/consultation`, {
      method: 'POST',
      body: JSON.stringify(consultationData)
    }),

    // === Queue ===
    getQueueStatus: () => request('/v1/queue/today'),
    callNextPatient: () => request('/v1/queue/call-next-patient', { method: 'POST' }),

    // === Available Slots ===
    getAvailableSlots: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/v1/available-slots${query ? '?' + query : ''}`);
    },

    // === Settings ===
    getServices: () => request('/v1/settings/services'),
    createService: (data) => request('/v1/settings/services', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    updateService: (id, data) => request(`/v1/settings/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    deleteService: (id) => request(`/v1/settings/services/${id}`, {
      method: 'DELETE'
    }),

    getWorkingHours: (doctorId) => {
      const query = doctorId ? `?doctor_id=${doctorId}` : '';
      return request(`/v1/settings/working-hours${query}`);
    },
    updateWorkingHours: (data) => request('/v1/settings/working-hours', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

    getOperationalSettings: () => request('/v1/settings/operational'),
    updateOperationalSettings: (data) => request('/v1/settings/operational', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

    getNotificationSettings: () => request('/v1/settings/notifications'),
    updateNotificationSettings: (data) => request('/v1/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

    getPrescriptionSettings: () => request('/v1/settings/prescription'),
    updatePrescriptionSettings: (data) => request('/v1/settings/prescription', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

    getChannelSettings: () => request('/v1/settings/channels'),
    updateChannelSettings: (channel, data) => request(`/v1/settings/channels/${channel}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

    getInsuranceCompanies: () => request('/v1/settings/insurance'),
    updateInsurance: (data) => request('/v1/settings/insurance', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

    getRefundSettings: () => request('/v1/settings/refund'),
    updateRefundSettings: (data) => request('/v1/settings/refund', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

    getBotSettings: () => request('/v1/settings/bot-greeting'),
    updateBotSettings: (data) => request('/v1/settings/bot-greeting', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

    // === Doctors ===
    getDoctors: () => request('/v1/doctors'),

    // === Conversations ===
    getConversations: () => request('/v1/conversations'),
    getConversationMessages: (id) => request(`/v1/conversations/${id}/messages`),
    sendMessage: (id, data) => request(`/v1/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    toggleBotMode: (id) => request(`/v1/conversations/${id}/toggle-bot`, {
      method: 'PUT'
    }),

    // === Tickets ===
    getTickets: () => request('/v1/tickets'),
    createTicket: (data) => request('/v1/tickets', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

    // === Medical Records ===
    saveMedicalRecord: (data) => request('/v1/medical-records', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

    // === Auth ===
    login: (email, password) => request('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
    verifyOtp: (token, otp) => request('/v1/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ temp_token: token, otp_code: otp })
    })
  };
})();
