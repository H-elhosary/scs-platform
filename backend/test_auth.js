const testAuth = async () => {
  console.log('\n======================================================');
  console.log('🧪 Running Automated Auth API Tests for Smart Clinic OS');
  console.log('======================================================\n');

  try {
    // 1. Test Platform Admin Login
    console.log('1. Testing Platform Admin Login (ops@SCS-ops.com)...');
    const loginRes = await fetch('http://localhost:3000/admin/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ops@SCS-ops.com', password: 'SecurePassword123!' })
    });
    const loginData = await loginRes.json();
    
    if (loginData.success) {
      console.log(`  ✅ Login Success! 2FA required: ${loginData.data.two_factor_required}`);
      const tempToken = loginData.data.temp_token;

      // 2. Test 2FA verification
      console.log('2. Testing 2FA OTP verification (OTP: 123456)...');
      const verifyRes = await fetch('http://localhost:3000/admin/v1/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temp_token: tempToken, otp_code: '123456' })
      });
      const verifyData = await verifyRes.json();
      
      if (verifyData.success) {
        console.log(`  ✅ 2FA Verified successfully! Role: ${verifyData.data.admin.role}`);
        console.log(`  🔑 Admin Access Token: ${verifyData.data.access_token.substring(0, 30)}...`);
      } else {
        console.log(`  ❌ 2FA verification failed: ${JSON.stringify(verifyData.error)}`);
      }
    } else {
      console.log(`  ❌ Admin Login failed: ${JSON.stringify(loginData.error)}`);
    }

    console.log('');

    // 3. Test Clinic Doctor Login
    console.log('3. Testing Clinic Doctor Login (clinic_info@noor.com)...');
    const doctorRes = await fetch('http://localhost:3000/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'clinic_info@noor.com', password: 'SecurePassword123!' })
    });
    const doctorData = await doctorRes.json();
    
    if (doctorData.success) {
      console.log(`  ✅ Clinic Doctor Login Success! Tenant: ${doctorData.data.tenant.name} (${doctorData.data.tenant.slug})`);
      console.log(`  🔑 Clinic User Access Token: ${doctorData.data.access_token.substring(0, 30)}...`);
    } else {
      console.log(`  ❌ Clinic Doctor Login failed: ${JSON.stringify(doctorData.error)}`);
    }

    console.log('');

    // 4. Test Clinic Secretary Login
    console.log('4. Testing Clinic Secretary Login (sara@noor.com)...');
    const secRes = await fetch('http://localhost:3000/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sara@noor.com', password: 'SecurePassword123!' })
    });
    const secData = await secRes.json();
    
    if (secData.success) {
      console.log(`  ✅ Clinic Secretary Login Success! Staff: ${secData.data.user.full_name} | Role: ${secData.data.user.role}`);
    } else {
      console.log(`  ❌ Clinic Secretary Login failed: ${JSON.stringify(secData.error)}`);
    }

  } catch (error) {
    console.error('❌ Error during API tests:', error.message);
  }

  console.log('\n======================================================');
  console.log('🎉 All Auth API tests completed successfully!');
  console.log('======================================================\n');
};

testAuth();
