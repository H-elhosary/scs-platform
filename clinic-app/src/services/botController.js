const db = require('../db/connection');
const bookingService = require('./bookingService');

// In-memory conversation states (Simulated Redis)
const conversationStates = {};

// Helper to get day name in English from Date
const getDayNameEnglish = (dateStr) => {
  const d = new Date(dateStr);
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[d.getDay()];
};

// Generate 30-minute slots between start time and end time
const generateTimeSlots = (startStr, endStr, location) => {
  const slots = [];
  const [sH, sM] = startStr.split(':').map(Number);
  const [eH, eM] = endStr.split(':').map(Number);
  
  let currentMinutes = sH * 60 + sM;
  const endMinutes = eH * 60 + eM;
  
  while (currentMinutes + 30 <= endMinutes) {
    const h = Math.floor(currentMinutes / 60);
    const m = currentMinutes % 60;
    const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    slots.push({ time: timeString, location });
    currentMinutes += 30; // 30 minutes interval
  }
  return slots;
};

// Get available slots for doctor
const getAvailableSlotsForDoctor = async (tenantId, doctorId, dateStr) => {
  const dayName = getDayNameEnglish(dateStr);
  let workingHours = [];
  
  if (db.isMock) {
    const customHours = db.memoryDB.doctorWorkingHours && db.memoryDB.doctorWorkingHours[doctorId];
    if (customHours) {
      workingHours = customHours;
    } else {
      // Default mock working hours
      workingHours = [
        { day: "sunday", day_ar: "الأحد", is_open: true, shifts: [{ start: "09:00", end: "14:00", location: "فرع الدقي" }, { start: "17:00", end: "21:00", location: "فرع التجمع" }] },
        { day: "monday", day_ar: "الإثنين", is_open: true, shifts: [{ start: "09:00", end: "14:00", location: "فرع الدقي" }, { start: "17:00", end: "21:00", location: "فرع التجمع" }] },
        { day: "tuesday", day_ar: "الثلاثاء", is_open: true, shifts: [{ start: "09:00", end: "14:00", location: "فرع الدقي" }, { start: "17:00", end: "21:00", location: "فرع التجمع" }] },
        { day: "wednesday", day_ar: "الأربعاء", is_open: true, shifts: [{ start: "09:00", end: "14:00", location: "فرع الدقي" }, { start: "17:00", end: "21:00", location: "فرع التجمع" }] },
        { day: "thursday", day_ar: "الخميس", is_open: true, shifts: [{ start: "09:00", end: "15:00", location: "فرع مصر الجديدة" }] },
        { day: "friday", day_ar: "الجمعة", is_open: false, shifts: [] },
        { day: "saturday", day_ar: "السبت", is_open: true, shifts: [{ start: "10:00", end: "14:00", location: "فرع الدقي" }] }
      ];
    }
  } else {
    // Database query logic if needed, but mock DB is active
  }

  const dayHours = workingHours.find(h => h.day === dayName);
  if (!dayHours || !dayHours.is_open || !dayHours.shifts || dayHours.shifts.length === 0) {
    return [];
  }

  const allSlots = [];
  for (const shift of dayHours.shifts) {
    const shiftSlots = generateTimeSlots(shift.start, shift.end, shift.location);
    allSlots.push(...shiftSlots);
  }

  const availableSlots = [];
  for (const slot of allSlots) {
    const isAvail = await bookingService.checkSlotAvailability(tenantId, doctorId, dateStr, slot.time);
    if (isAvail) {
      availableSlots.push(slot);
    }
  }
  return availableSlots;
};

// Critical Triage Keywords
const TRIAGE_KEYWORDS = [
  'ألم في الصدر', 'ألم حاد بالصدر', 'ألم بالصدر', 'ضيق تنفس', 'ضيق في التنفس',
  'نزيف مستمر', 'نزيف حاد', 'نزيف', 'جلطة', 'طوارئ', 'موت', 'أزمة قلبية',
  'chest pain', 'shortness of breath', 'bleeding', 'heart attack'
];

const checkTriage = (text) => {
  const normalized = text.toLowerCase();
  return TRIAGE_KEYWORDS.some(keyword => normalized.includes(keyword));
};

const handleIncomingMessage = async (tenantId, channel, fromNumber, text, profileName = 'مريض') => {
  const textClean = text.trim();
  
  // 0. Fetch Tenant details
  let tenant = null;
  if (db.isMock) {
    tenant = db.memoryDB.tenants.find(t => t.id === tenantId);
  } else {
    try {
      const res = await db.query('SELECT * FROM tenants WHERE id = ?', [tenantId]);
      if (res.rows.length > 0) tenant = res.rows[0];
    } catch (e) {
      console.error(e);
    }
  }

  if (!tenant) {
    return {
      reply: "عذراً، لم يتم العثور على العيادة المطلوبة.",
      state: 'IDLE'
    };
  }

  // 1. Triage Check
  if (checkTriage(textClean)) {
    // Reset state to IDLE after warning
    conversationStates[fromNumber] = { step: 'IDLE', data: {} };
    return {
      reply: "🔴 تنبيه حالة طارئة: الأعراض التي قمت بإدخالها قد تشير إلى وجود خطر حاد على صحتك. يرجى التوجه فوراً لأقرب مستشفى أو الاتصال بالطوارئ (123) فوراً. تم إلغاء مسار الحجز لحمايتك.",
      state: 'TRIAGE_ALERT'
    };
  }

  // 2. Subscription/maintenance check — after triage (a medical safety
  // message must never be withheld over a billing status) but before any
  // booking flow. Suspended or expired tenants get a maintenance reply
  // instead of continuing.
  const tenantExpired = tenant.expires_at && new Date(tenant.expires_at) < new Date();
  if (tenant.status === 'suspended' || tenantExpired) {
    conversationStates[fromNumber] = { step: 'IDLE', data: {} };
    return {
      reply: "⚠️ عذراً، خدمة الحجز عبر البوت متوقفة مؤقتاً لهذه العيادة بسبب حالة الاشتراك. يرجى التواصل مباشرة مع العيادة، أو المحاولة لاحقاً.",
      state: 'MAINTENANCE'
    };
  }

  // Get or Initialize State
  let state = conversationStates[fromNumber];
  if (!state || textClean === 'إعادة' || textClean.toLowerCase() === 'reset' || textClean === 'البداية') {
    state = { step: 'IDLE', data: {} };
    conversationStates[fromNumber] = state;
  }

  let reply = '';
  
  // 2. State Machine Loop
  switch (state.step) {
    
    case 'IDLE':
      // Look up patient
      let patient = null;
      if (db.isMock) {
        patient = db.memoryDB.patients.find(p => p.phone === fromNumber && p.tenant_id === tenantId);
      } else {
        try {
          const res = await db.query('SELECT * FROM patients WHERE phone = ? AND tenant_id = ?', [fromNumber, tenantId]);
          if (res.rows.length > 0) patient = res.rows[0];
        } catch (e) {
          console.error(e);
        }
      }

      if (patient) {
        state.data.patient_id = patient.id;
        state.data.patient_name = patient.name;
        reply = `مرحباً بك يا أستاذ ${patient.name} في عيادتنا الذكية 🏥\nكيف يمكننا مساعدتك اليوم؟\n\n1. حجز موعد كشف جديد 🗓️\n2. حجز موعد متابعة مجانية 🆓\n3. التحدث مع السكرتارية 💬`;
        state.step = 'MENU';
      } else {
        reply = `مرحباً بك في نظام عيادتنا الذكي. لم نجد ملفاً طبياً مرتبطاً برقمك الحالي. يرجى إدخال اسمك بالكامل ثنائياً لإنشاء ملف طبي لك:`;
        state.step = 'ONBOARDING_NAME';
      }
      break;

    case 'ONBOARDING_NAME':
      if (textClean.length < 3) {
        reply = "يرجى كتابة الاسم بشكل صحيح (3 أحرف على الأقل):";
      } else {
        state.data.patient_name = textClean;
        reply = `أهلاً بك. يرجى إدخال عمرك بالسنوات:`;
        state.step = 'ONBOARDING_AGE';
      }
      break;

    case 'ONBOARDING_AGE':
      const age = parseInt(textClean);
      if (isNaN(age) || age < 1 || age > 120) {
        reply = "يرجى إدخال عمر صحيح بالسنوات (مثال: 28):";
      } else {
        state.data.patient_age = age;
        reply = `يرجى تحديد الجنس:\n1. ذكر 🧔\n2. أنثى 👩`;
        state.step = 'ONBOARDING_GENDER';
      }
      break;

    case 'ONBOARDING_GENDER':
      let gender = '';
      if (textClean === '1' || textClean.includes('ذكر') || textClean.toLowerCase() === 'male') {
        gender = 'male';
      } else if (textClean === '2' || textClean.includes('أنثى') || textClean.toLowerCase() === 'female') {
        gender = 'female';
      }

      if (!gender) {
        reply = "اختيار غير صحيح. يرجى كتابة الرقم المناسب:\n1. ذكر\n2. أنثى";
      } else {
        state.data.patient_gender = gender;
        
        // Save Patient
        const patientId = `pat-${Math.random().toString(36).substring(7)}`;
        if (db.isMock) {
          db.memoryDB.patients.push({
            id: patientId,
            tenant_id: tenantId,
            name: state.data.patient_name,
            age: state.data.patient_age,
            gender: state.data.patient_gender,
            phone: fromNumber,
            created_at: new Date().toISOString()
          });
          state.data.patient_id = patientId;
        } else {
          try {
            await db.query(
              `INSERT INTO patients (id, full_name, age, gender, phone, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [patientId, state.data.patient_name, state.data.patient_age, state.data.patient_gender, fromNumber, tenantId]
            );
            state.data.patient_id = patientId;
          } catch (e) {
            console.error(e);
          }
        }

        reply = `تم إنشاء ملفك الطبي بنجاح! 🎉\n\nكيف يمكننا مساعدتك اليوم؟\n1. حجز موعد كشف جديد 🗓️\n2. حجز موعد متابعة مجانية 🆓\n3. التحدث مع السكرتارية 💬`;
        state.step = 'MENU';
      }
      break;

    case 'MENU':
      if (textClean === '1') {
        state.data.visit_type = 'exam';
        
        // Multi doctor check
        if (tenant.allow_multi_doctor) {
          reply = `يرجى اختيار الطبيب المطلوب:\n1. د. محمد نور (أسنان عام)\n2. د. ليلى أحمد (تقويم أسنان)`;
          state.step = 'SELECT_DOCTOR';
        } else {
          state.data.doctor_id = 'doc-1';
          state.data.doctor_name = 'د. محمد نور';
          reply = `يرجى اختيار اليوم المطلوب للحجز:\n1. اليوم\n2. غداً\n3. بعد غد`;
          state.step = 'SELECT_DAY';
        }
      } else if (textClean === '2') {
        // Follow-up eligibility check
        const eligibility = await bookingService.checkFollowUpEligibility(tenantId, fromNumber);
        if (eligibility.eligible) {
          state.data.visit_type = 'followup';
          
          if (tenant.allow_multi_doctor) {
            reply = `لقد وجدنا كشفاً سابقاً لك بتاريخ ${new Date(eligibility.last_visit_date).toLocaleDateString()}. يرجى اختيار الطبيب للمتابعة المجانية:\n1. د. محمد نور\n2. د. ليلى أحمد`;
            state.step = 'SELECT_DOCTOR';
          } else {
            state.data.doctor_id = 'doc-1';
            state.data.doctor_name = 'د. محمد نور';
            reply = `لقد وجدنا كشفاً سابقاً لك بتاريخ ${new Date(eligibility.last_visit_date).toLocaleDateString()}. يرجى اختيار اليوم للمتابعة المجانية:\n1. اليوم\n2. غداً\n3. بعد غد`;
            state.step = 'SELECT_DAY';
          }
        } else {
          reply = `عذراً، لم يتم العثور على أي كشف سابق لك خلال الـ 14 يوماً الماضية لتأهيلك للمتابعة المجانية. هل ترغب بحجز كشف جديد؟\n\n1. نعم، حجز كشف جديد\n2. التحدث مع السكرتارية`;
          state.step = 'MENU';
        }
      } else if (textClean === '3') {
        reply = `💬 تم تحويلك للمحادثة المباشرة مع السكرتارية. سيقوم أحد موظفينا بالرد عليك فوراً. للعودة للبوت في أي وقت اكتب "البداية".`;
        state.step = 'SECRETARY_MODE';
      } else {
        reply = `اختيار غير صحيح. يرجى تحديد الخيار المناسب:\n1. حجز موعد كشف جديد\n2. حجز موعد متابعة مجانية\n3. التحدث مع السكرتارية`;
      }
      break;

    case 'SELECT_DOCTOR':
      if (textClean === '1') {
        state.data.doctor_id = 'doc-1';
        state.data.doctor_name = 'د. محمد نور';
      } else if (textClean === '2') {
        state.data.doctor_id = 'doc-2';
        state.data.doctor_name = 'د. ليلى أحمد';
      }

      if (!state.data.doctor_id) {
        reply = "اختيار غير صحيح. يرجى اختيار الطبيب:\n1. د. محمد نور\n2. د. ليلى أحمد";
      } else {
        reply = `لقد اخترت ${state.data.doctor_name}.\nيرجى اختيار اليوم المطلوب:\n1. اليوم\n2. غداً\n3. بعد غد`;
        state.step = 'SELECT_DAY';
      }
      break;

    case 'SELECT_DAY': {
      const targetDate = new Date();
      if (textClean === '2') {
        targetDate.setDate(targetDate.getDate() + 1);
      } else if (textClean === '3') {
        targetDate.setDate(targetDate.getDate() + 2);
      } else if (textClean !== '1') {
        reply = "اختيار غير صحيح. يرجى تحديد اليوم:\n1. اليوم\n2. غداً\n3. بعد غد";
        break;
      }

      state.data.date = targetDate.toISOString().split('T')[0];
      
      // Fetch slots dynamically
      const slots = await getAvailableSlotsForDoctor(tenantId, state.data.doctor_id, state.data.date);
      if (slots.length === 0) {
        reply = `عذراً، الطبيب غير متواجد أو لا توجد مواعيد متاحة ليوم ${state.data.date}.\nيرجى اختيار يوم آخر:\n1. اليوم\n2. غداً\n3. بعد غد`;
        state.step = 'SELECT_DAY';
      } else {
        state.data.available_slots = slots;
        let slotsText = slots.map((s, idx) => {
          const hours = parseInt(s.time.split(':')[0]);
          const mins = s.time.split(':')[1];
          const ampm = hours >= 12 ? 'مساءً' : 'صباحاً';
          const displayHour = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
          const timeAr = `${String(displayHour).padStart(2, '0')}:${mins} ${ampm}`;
          return `${idx + 1}. ${timeAr} (في ${s.location}) ⏰`;
        }).join('\n');
        
        reply = `المواعيد المتاحة ليوم ${state.data.date}:\n\n${slotsText}\n\nيرجى كتابة رقم الموعد المناسب للتأكيد:`;
        state.step = 'SELECT_TIME';
      }
      break;
    }

    case 'SELECT_TIME': {
      const selectedIndex = parseInt(textClean) - 1;
      const availableSlots = state.data.available_slots || [];
      
      if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= availableSlots.length) {
        reply = "اختيار غير صحيح. يرجى كتابة رقم الموعد المتاح من القائمة بدقة.";
      } else {
        const chosenSlot = availableSlots[selectedIndex];
        state.data.time = chosenSlot.time;
        state.data.location = chosenSlot.location;
        
        const available = await bookingService.checkSlotAvailability(tenantId, state.data.doctor_id, state.data.date, state.data.time);
        
        if (available) {
          const lockId = await bookingService.lockSlot(tenantId, state.data.doctor_id, state.data.date, state.data.time, fromNumber);
          state.data.lock_id = lockId;

          if (state.data.visit_type === 'followup') {
            const apptId = `appt-${Math.random().toString(36).substring(7)}`;
            const appointment = {
              id: apptId,
              tenant_id: tenantId,
              doctor_id: state.data.doctor_id,
              doctor_name: state.data.doctor_name,
              patient_id: state.data.patient_id,
              patient_name: state.data.patient_name,
              date: state.data.date,
              time: state.data.time,
              location: state.data.location,
              status: 'confirmed',
              visit_type: 'followup',
              price: 0,
              created_at: new Date().toISOString()
            };

            if (db.isMock) {
              db.memoryDB.appointments.push(appointment);
            } else {
              try {
                await db.query(
                  `INSERT INTO appointments (id, tenant_id, doctor_id, patient_id, date, time, status, visit_type, amount)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [apptId, tenantId, state.data.doctor_id, state.data.patient_id, state.data.date, state.data.time, 'confirmed', 'followup', 0]
                );
              } catch (e) {
                console.error(e);
              }
            }

            reply = `✅ تم تأكيد موعد المتابعة المجانية بنجاح!\n\n📋 تفاصيل الحجز:\n- الطبيب: ${state.data.doctor_name}\n- التاريخ: ${state.data.date}\n- الوقت: ${state.data.time}\n\nنتمنى لك دوام الصحة والعافية! ❤️`;
            state.step = 'IDLE';
            state.data = {};
          } else {
            // Paid Exam
            reply = `الموعد متاح! يرجى اختيار طريقة السداد المفضلة لتأكيد الحجز:\n\n1. الدفع الإلكتروني (فيزا / محافظ - بخصم 10% 💳)\n2. الدفع كاش في العيادة بالاستقبال 💵`;
            state.step = 'SELECT_PAYMENT';
          }
        } else {
          reply = `عذراً، هذا الموعد تم حجزه أو قفله منذ قليل. يرجى اختيار وقت آخر:\n1. 10:00 صباحاً\n2. 11:30 صباحاً\n3. 02:00 مساءً\n4. 04:30 مساءً`;
        }
      }
      break;
    }

    case 'SELECT_PAYMENT':
      if (textClean === '1') {
        // Electronic Payment
        const apptId = `appt-${Math.random().toString(36).substring(7)}`;
        const invoiceId = `inv-${Math.random().toString(36).substring(7)}`;
        
        const price = 200; // EGP Standard exam price
        const finalPrice = price * 0.9; // 10% discount
        
        const appointment = {
          id: apptId,
          tenant_id: tenantId,
          doctor_id: state.data.doctor_id,
          doctor_name: state.data.doctor_name,
          patient_id: state.data.patient_id,
          patient_name: state.data.patient_name,
          date: state.data.date,
          time: state.data.time,
          location: state.data.location || 'العيادة الرئيسية',
          status: 'pending_payment',
          visit_type: 'exam',
          price: finalPrice,
          created_at: new Date().toISOString()
        };

        const invoice = {
          id: invoiceId,
          tenant_id: tenantId,
          appointment_id: apptId,
          patient_id: state.data.patient_id,
          amount: finalPrice,
          status: 'pending',
          payment_link: `http://localhost:3000/webhooks/payments/paymob/simulate?invoice_id=${invoiceId}&tenant_id=${tenantId}&appointment_id=${apptId}`,
          created_at: new Date().toISOString()
        };

        if (db.isMock) {
          db.memoryDB.appointments.push(appointment);
          db.memoryDB.invoices.push(invoice);
        } else {
          try {
            await db.query(
              `INSERT INTO appointments (id, tenant_id, doctor_id, patient_id, date, time, status, visit_type, amount, location)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [apptId, tenantId, state.data.doctor_id, state.data.patient_id, state.data.date, state.data.time, 'pending_payment', 'exam', finalPrice, appointment.location]
            );
            await db.query(
              `INSERT INTO invoices (id, tenant_id, appointment_id, patient_id, amount, status)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [invoiceId, tenantId, apptId, state.data.patient_id, finalPrice, 'pending']
            );
          } catch (e) {
            console.error(e);
          }
        }

        reply = `💳 لقد اخترت الدفع الإلكتروني (تم تطبيق خصم 10%). يرجى إتمام السداد عبر الرابط التالي:\n${invoice.payment_link}\n\n⚠️ يرجى العلم أنه سيتم إلغاء الحجز تلقائياً إذا لم يتم السداد خلال 15 دقيقة.`;
        state.step = 'IDLE';
        state.data = {};
      } else if (textClean === '2') {
        // Cash Payment
        const apptId = `appt-${Math.random().toString(36).substring(7)}`;
        const invoiceId = `inv-${Math.random().toString(36).substring(7)}`;
        
        const appointment = {
          id: apptId,
          tenant_id: tenantId,
          doctor_id: state.data.doctor_id,
          doctor_name: state.data.doctor_name,
          patient_id: state.data.patient_id,
          patient_name: state.data.patient_name,
          date: state.data.date,
          time: state.data.time,
          location: state.data.location || 'العيادة الرئيسية',
          status: 'confirmed',
          visit_type: 'exam',
          price: 200,
          created_at: new Date().toISOString()
        };

        const invoice = {
          id: invoiceId,
          tenant_id: tenantId,
          appointment_id: apptId,
          patient_id: state.data.patient_id,
          amount: 200,
          status: 'unpaid',
          created_at: new Date().toISOString()
        };

        if (db.isMock) {
          db.memoryDB.appointments.push(appointment);
          db.memoryDB.invoices.push(invoice);
        } else {
          try {
            await db.query(
              `INSERT INTO appointments (id, tenant_id, doctor_id, patient_id, date, time, status, visit_type, amount, location)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [apptId, tenantId, state.data.doctor_id, state.data.patient_id, state.data.date, state.data.time, 'confirmed', 'exam', 200, appointment.location]
            );
            await db.query(
              `INSERT INTO invoices (id, tenant_id, appointment_id, patient_id, amount, status)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [invoiceId, tenantId, apptId, state.data.patient_id, 200, 'unpaid']
            );
          } catch (e) {
            console.error(e);
          }
        }

        reply = `✅ تم حجز الموعد بنجاح وتأكيده كدفع بالاستقبال!\n\n📋 تفاصيل الحجز:\n- الطبيب: ${state.data.doctor_name}\n- التاريخ: ${state.data.date}\n- الوقت: ${state.data.time}\n- الفرع: ${appointment.location}\n- السعر: 200 جنيه بالاستقبال.\n\nنتمنى لك دوام الصحة والعافية! ❤️`;
        state.step = 'IDLE';
        state.data = {};
      } else {
        reply = "طريقة دفع غير صالحة. يرجى الاختيار:\n1. الدفع الإلكتروني (فيزا / محافظ)\n2. كاش بالاستقبال";
      }
      break;

    case 'SECRETARY_MODE':
      // Do nothing, let the secretary answer.
      // Reset only if patient writes "البداية" or "reset"
      break;
  }

  return {
    reply,
    state: state.step
  };
};

module.exports = {
  handleIncomingMessage,
  conversationStates
};
