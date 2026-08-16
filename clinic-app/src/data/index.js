// =============================================
// Smart Clinic OS — Central Mock Data Index
// Single import point for all mock data modules
// =============================================

const mockPatients = require('./mockPatients');
const mockServices = require('./mockServices');
const { mockAppointments, mockMedicalRecords, getTodayStr, getRelativeDateStr } = require('./mockAppointments');
const mockConversations = require('./mockConversations');
const mockTickets = require('./mockTickets');
const settings = require('./mockSettings');

module.exports = {
  // Data arrays
  mockPatients,
  mockServices,
  mockAppointments,
  mockMedicalRecords,
  mockConversations,
  mockTickets,

  // Tenant
  mockTenants: settings.mockTenants,
  mockWorkingHours: settings.mockWorkingHours,

  // Settings (getters/setters)
  ...settings,

  // Date helpers
  getTodayStr,
  getRelativeDateStr
};
