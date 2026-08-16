const app = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Smart Clinic OS Backend is listening on port ${PORT}`);
  console.log(`📡 Endpoints available:`);
  console.log(`   🔑 Platform Ops Login: POST http://localhost:${PORT}/admin/v1/auth/login`);
  console.log(`   🔐 Platform Ops 2FA Check: POST http://localhost:${PORT}/admin/v1/auth/verify-2fa`);
  console.log(`   🏥 Clinic Dashboard Login: POST http://localhost:${PORT}/v1/auth/login`);
  console.log(`======================================================\n`);
});

module.exports = server;
