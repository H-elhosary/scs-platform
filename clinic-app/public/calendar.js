// Calendar Page Specific Logic
let calendarDate = new Date();
let calendarView = 'week';
let draggedAppointmentId = null;

document.addEventListener('sharedDataReady', () => {
  initCalendar();
});

function initCalendar() {
  // Bind change listeners for booking slots
  const dateInput = document.getElementById('apt-date');
  const serviceInput = document.getElementById('apt-service');
  const doctorInput = document.getElementById('apt-doctor');
  if (dateInput) dateInput.addEventListener('change', updateAvailableSlots);
  if (serviceInput) serviceInput.addEventListener('change', updateAvailableSlots);
  if (doctorInput) doctorInput.addEventListener('change', updateAvailableSlots);

  // Render initial view
  renderCalendar();

  // Check if routed with "?book=true" to auto-open booking modal
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('book') === 'true') {
    showNewAppointmentModal();
  }
}

async function renderCalendar() {
  const container = document.getElementById('calendar-container');
  if (!container) return;

  container.innerHTML = `
    <div style="padding: 20px; display: flex; flex-direction: column; gap: 10px;">
      <div class="skeleton" style="height: 40px; width: 100%; border-radius: 8px;"></div>
      <div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 10px; height: 400px; margin-top: 10px;">
        ${Array(8).fill(0).map(() => `<div class="skeleton" style="height: 100%; border-radius: 8px;"></div>`).join('')}
      </div>
    </div>
  `;

  try {
    const res = await ScsApi.getAppointments();
    if (res.success) {
      updateCalendarHeader();
      const appointments = res.data.filter(a => a.status !== 'cancelled' && a.status !== 'completed');
      
      const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

      if (calendarView === 'week') {
        renderWeekView(container, appointments, dayNames);
      } else if (calendarView === 'day') {
        renderDayView(container, appointments);
      } else if (calendarView === 'month') {
        renderMonthView(container, appointments, dayNames, monthNames);
      }
    }
  } catch (e) {
    console.error('Calendar render error:', e);
    container.innerHTML = '<div style="padding:40px; text-align:center; color:#ef4444;"><i class="fa-solid fa-circle-exclamation fa-2x"></i><p style="margin-top:10px;">فشل الاتصال بالسيرفر لتحميل التقويم</p></div>';
  }
}

function updateCalendarHeader() {
  const label = document.getElementById('cal-current-label');
  if (!label) return;

  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  
  if (calendarView === 'day') {
    label.textContent = `${calendarDate.getDate()} ${monthNames[calendarDate.getMonth()]} ${calendarDate.getFullYear()}`;
  } else if (calendarView === 'week') {
    const startOfWeek = new Date(calendarDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    
    if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
      label.textContent = `${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getFullYear()}`;
    } else {
      label.textContent = `${monthNames[startOfWeek.getMonth()]} / ${monthNames[endOfWeek.getMonth()]} ${startOfWeek.getFullYear()}`;
    }
  } else {
    label.textContent = `${monthNames[calendarDate.getMonth()]} ${calendarDate.getFullYear()}`;
  }
}

function adjustCalendarDate(direction) {
  if (calendarView === 'day') {
    calendarDate.setDate(calendarDate.getDate() + direction);
  } else if (calendarView === 'week') {
    calendarDate.setDate(calendarDate.getDate() + (direction * 7));
  } else {
    calendarDate.setMonth(calendarDate.getMonth() + direction);
  }
  renderCalendar();
}

function setCalendarToday() {
  calendarDate = new Date();
  renderCalendar();
}

function changeCalendarView(view) {
  calendarView = view;
  document.querySelectorAll('.calendar-view-toggle .btn-toggle').forEach(b => b.classList.remove('active'));
  document.getElementById(`toggle-view-${view}`).classList.add('active');
  renderCalendar();
}

function renderWeekView(container, appointments, dayNames) {
  const startOfWeek = new Date(calendarDate);
  const day = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - day);

  const hours = [];
  for (let h = 8; h <= 21; h++) hours.push(h);

  let html = '<div class="cal-week-grid">';
  
  // Time label column
  html += '<div class="cal-time-col"><div class="cal-day-header" style="visibility:hidden;"><span class="cal-day-name">.</span><span class="cal-day-num">.</span></div>';
  hours.forEach(h => {
    html += `<div class="cal-time-label">${String(h).padStart(2, '0')}:00</div>`;
  });
  html += '</div>';

  // Render 7 columns for days
  const todayStr = formatDate(new Date());
  for (let i = 0; i < 7; i++) {
    const colDate = new Date(startOfWeek);
    colDate.setDate(colDate.getDate() + i);
    const colDateStr = formatDate(colDate);
    const isToday = colDateStr === todayStr;

    html += `<div class="cal-day-col"><div class="cal-day-header ${isToday ? 'today' : ''}"><span class="cal-day-name">${dayNames[i]}</span><span class="cal-day-num">${colDate.getDate()}</span></div>`;
    
    hours.forEach(h => {
      const hourAppts = appointments.filter(a => a.date === colDateStr && parseInt(a.time.split(':')[0]) === h);
      html += `<div class="cal-hour-slot" data-date="${colDateStr}" data-time="${String(h).padStart(2,'0')}:00" ondragover="handleSlotDragOver(event)" ondragleave="handleSlotDragLeave(event)" ondrop="handleSlotDrop(event)" onclick="showNewAppointmentModal('${colDateStr}', '${String(h).padStart(2,'0')}:00')"`;
      if (isToday) html += ' style="background: rgba(14, 165, 233, 0.015);"';
      html += '>';
      
      hourAppts.forEach((a, index) => {
        const [startH, startM] = a.time.split(':').map(Number);
        const [endH, endM] = (a.end_time || a.time).split(':').map(Number);
        const startPx = (startM / 60) * 60;
        const durationMin = (endH * 60 + endM) - (startH * 60 + startM);
        const heightPx = Math.max((durationMin / 60) * 60, 24);
        
        const widthPct = 100 / hourAppts.length;
        const leftPct = index * widthPct;
        
        html += `<div class="cal-event status-${a.status}" draggable="true" ondragstart="handleEventDragStart(event, '${a.id}')" ondragend="handleEventDragEnd(event)" onclick="event.stopPropagation(); showAppointmentDetails('${a.id}')" style="top:${startPx}px; height:${heightPx}px; left: calc(${leftPct}% + 3px); width: calc(${widthPct}% - 6px); right: auto;" title="${a.patient_name} - ${a.service_name} (${a.location || 'الرئيسية'})">
          <span class="cal-event-name">${a.patient_name}</span>
          <span class="cal-event-time">${a.time} - ${a.service_name} (${a.location || 'الرئيسية'})</span>
        </div>`;
      });
      html += '</div>';
    });

    html += '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function renderDayView(container, appointments) {
  const dayStr = formatDate(calendarDate);
  const todayStr = formatDate(new Date());
  const hours = [];
  for (let h = 8; h <= 21; h++) hours.push(h);

  let html = '<div class="cal-week-grid" style="grid-template-columns: 60px 1fr;">';
  html += '<div class="cal-time-col"><div class="cal-day-header" style="visibility:hidden;"><span class="cal-day-name">.</span><span class="cal-day-num">.</span></div>';
  hours.forEach(h => { html += `<div class="cal-time-label">${String(h).padStart(2,'0')}:00</div>`; });
  html += '</div>';

  html += `<div class="cal-day-col"><div class="cal-day-header ${dayStr === todayStr ? 'today' : ''}"><span class="cal-day-name">اليوم</span><span class="cal-day-num">${calendarDate.getDate()}</span></div>`;
    hours.forEach(h => {
      const hourAppts = appointments.filter(a => a.date === dayStr && parseInt(a.time.split(':')[0]) === h);
      html += `<div class="cal-hour-slot" data-date="${dayStr}" data-time="${String(h).padStart(2,'0')}:00" ondragover="handleSlotDragOver(event)" ondragleave="handleSlotDragLeave(event)" ondrop="handleSlotDrop(event)" onclick="showNewAppointmentModal('${dayStr}', '${String(h).padStart(2,'0')}:00')">`;
      hourAppts.forEach((a, index) => {
        const [startH, startM] = a.time.split(':').map(Number);
        const [endH, endM] = (a.end_time || a.time).split(':').map(Number);
        const startPx = (startM / 60) * 60;
        const durationMin = (endH * 60 + endM) - (startH * 60 + startM);
        const heightPx = Math.max((durationMin / 60) * 60, 24);
        
        const widthPct = 100 / hourAppts.length;
        const leftPct = index * widthPct;
        
        html += `<div class="cal-event status-${a.status}" draggable="true" ondragstart="handleEventDragStart(event, '${a.id}')" ondragend="handleEventDragEnd(event)" onclick="event.stopPropagation(); showAppointmentDetails('${a.id}')" style="top:${startPx}px; height:${heightPx}px; left: calc(${leftPct}% + 3px); width: calc(${widthPct}% - 6px); right: auto;" title="${a.patient_name} - ${a.service_name} (${a.location || 'الرئيسية'})">
          <span class="cal-event-name">${a.patient_name}</span>
          <span class="cal-event-time">${a.time} - ${a.service_name} (${a.location || 'الرئيسية'})</span>
        </div>`;
      });
      html += '</div>';
    });
  html += '</div></div>';
  container.innerHTML = html;
}

function renderMonthView(container, appointments, dayNames, monthNames) {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  let html = '<div class="cal-month-grid">';
  dayNames.forEach(d => { html += `<div class="cal-month-header">${d}</div>`; });

  // Render prefix days from prev month
  for (let i = firstDayIndex; i > 0; i--) {
    const dNum = prevMonthTotalDays - i + 1;
    html += `<div class="cal-month-cell other-month"><span class="cal-month-day-num">${dNum}</span></div>`;
  }

  const todayStr = formatDate(new Date());
  for (let d = 1; d <= totalDays; d++) {
    const curDateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayAppts = appointments.filter(a => a.date === curDateStr);
    const isToday = curDateStr === todayStr;

    html += `<div class="cal-month-cell ${isToday ? 'today' : ''}" onclick="showNewAppointmentModal('${curDateStr}')">
      <div class="cal-month-day-num">${d}</div>
      <div class="cal-month-cell-events">
        ${dayAppts.slice(0, 3).map(a => `<div class="cal-month-event status-${a.status}" onclick="event.stopPropagation(); showAppointmentDetails('${a.id}')" title="${a.time} ${a.patient_name}">${a.time} ${a.patient_name}</div>`).join('')}
        ${dayAppts.length > 3 ? `<div class="cal-month-more">+ ${dayAppts.length - 3} مواعيد</div>` : ''}
      </div>
    </div>`;
  }

  // Render suffix days from next month
  const totalCells = firstDayIndex + totalDays;
  const remainingCells = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remainingCells; i++) {
    html += `<div class="cal-month-cell other-month"><span class="cal-month-day-num">${i}</span></div>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

// --- BOOKING MODAL FUNCTIONS ---

function showNewAppointmentModal(date, time) {
  const todayStr = formatDate(new Date());

  const dateInput = document.getElementById('apt-date');
  if (dateInput) {
    dateInput.min = todayStr;
  }

  const patSelect = document.getElementById('apt-patient');
  patSelect.innerHTML = '<option value="">— اختر المريض —</option>' +
    allPatients.map(p => `<option value="${p.id}">${p.full_name} (${p.phone})</option>`).join('');

  const docSelect = document.getElementById('apt-doctor');
  const docGroup = document.getElementById('apt-doctor-group');
  if (allowMultiDoctor) {
    if (docGroup) docGroup.style.display = 'block';
    docSelect.innerHTML = '<option value="">— اختر الطبيب —</option>' +
      allDoctors.map(d => `<option value="${d.id}">${d.full_name}</option>`).join('');
    docSelect.required = true;
  } else {
    if (docGroup) docGroup.style.display = 'none';
    docSelect.innerHTML = '<option value="doc-uuid-noor-1">د. محمد نور</option>';
    docSelect.value = 'doc-uuid-noor-1';
    docSelect.required = false;
  }

  const svcSelect = document.getElementById('apt-service');
  svcSelect.innerHTML = '<option value="">— اختر الخدمة —</option>' +
    allServices.map(s => `<option value="${s.id}">${s.name} — ${s.price} ج.م</option>`).join('');

  if (date && date < todayStr) {
    showToast('⚠️ تم تحديد تاريخ اليوم لأن التاريخ المختار قد مضى', 'info');
    document.getElementById('apt-date').value = todayStr;
  } else if (date) {
    document.getElementById('apt-date').value = date;
  } else {
    document.getElementById('apt-date').value = todayStr;
  }
  
  document.getElementById('apt-time').value = time || "";
  aptSelectedLocation = "";

  const warningBox = document.getElementById('apt-time-warning');
  if (warningBox) warningBox.style.display = 'none';

  openModal('modal-new-appointment');
  updateAvailableSlots();
}

async function submitNewAppointment(e) {
  e.preventDefault();
  const todayStr = formatDate(new Date());
  const selectedDate = document.getElementById('apt-date').value;

  if (selectedDate < todayStr) {
    showToast('⚠️ لا يمكن حجز موعد في تاريخ قد مضى!', 'error');
    return;
  }

  const selectedTime = document.getElementById('apt-time').value;
  if (!selectedTime) {
    showToast('يرجى اختيار فترة زمنية (سلوت) متاحة للحجز.', 'error');
    return;
  }
  
  try {
    const res = await ScsApi.createAppointment({
      patient_id: document.getElementById('apt-patient').value,
      doctor_id: document.getElementById('apt-doctor').value,
      service_id: document.getElementById('apt-service').value,
      date: selectedDate,
      time: selectedTime,
      location: aptSelectedLocation,
      visit_type: document.getElementById('apt-visit-type').value,
      payment_method: document.getElementById('apt-payment').value,
      notes: document.getElementById('apt-notes').value
    });

    if (res.success) {
      showToast(`تم حجز الموعد بنجاح — كود: ${res.data.booking_code}`, 'success');
      closeModal('modal-new-appointment');
      renderCalendar();
    } else {
      showToast(res.error?.message || 'فشل حجز الموعد', 'error');
    }
  } catch (e) { showToast('فشل حجز الموعد', 'error'); }
}

async function updateAvailableSlots() {
  const dateInput = document.getElementById('apt-date').value;
  const doctorSelect = document.getElementById('apt-doctor');
  const serviceSelect = document.getElementById('apt-service');
  const container = document.getElementById('apt-slots-container');
  if (!container) return;

  const todayStr = formatDate(new Date());
  if (dateInput < todayStr) {
    container.innerHTML = `<span style="color:#ef4444; font-size:12px; font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> لا يمكن الحجز في تاريخ قد مضى! يرجى اختيار تاريخ اليوم أو تاريخ قادم.</span>`;
    return;
  }
  const doctorId = doctorSelect.value || (allowMultiDoctor ? "" : "doc-uuid-noor-1");
  const serviceId = document.getElementById('apt-service').value;
  const warningBox = document.getElementById('apt-time-warning');
  
  if (warningBox) warningBox.style.display = 'none';
  
  if (!dateInput || !doctorId || !serviceId) {
    if (container) {
      container.innerHTML = `<span class="no-slots-placeholder" style="color: #64748b; font-size: 11px; font-style: italic;">يرجى اختيار التاريخ والخدمة والطبيب أولاً لعرض الفترات الزمنية المتاحة.</span>`;
    }
    return;
  }
  
  if (container) {
    container.innerHTML = `<span style="font-size:11px; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> جاري توليد الفترات المتاحة...</span>`;
  }
  
  try {
    const whRes = await ScsApi.getWorkingHours(doctorId);
    if (!whRes.success || !whRes.data) {
      container.innerHTML = `<span style="color:#ef4444; font-size:11px;">فشل تحميل مواعيد العمل للطبيب</span>`;
      return;
    }
    
    const dateObj = new Date(dateInput);
    const daysEng = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const selectedDayName = daysEng[dateObj.getDay()];
    const daySettings = whRes.data.find(d => d.day === selectedDayName);
    
    if (!daySettings || !daySettings.is_open || !daySettings.shifts || !daySettings.shifts.length) {
      container.innerHTML = `<span style="color:#ef4444; font-size:11px; font-weight:700;"><i class="fa-solid fa-circle-xmark"></i> الطبيب لا يعمل في هذا اليوم (${daySettings ? daySettings.day_ar : selectedDayName})</span>`;
      return;
    }
    
    const aptsRes = await ScsApi.getAppointments({ doctor_id: doctorId, date: dateInput });
    const bookedAppts = aptsRes.success ? aptsRes.data.filter(a => a.status !== 'cancelled') : [];
    
    const service = allServices.find(s => s.id === serviceId);
    const duration = service ? service.duration_minutes : 20;
    
    const locationSlots = {};
    
    daySettings.shifts.forEach(shift => {
      const loc = shift.location || "العيادة الرئيسية";
      if (!locationSlots[loc]) locationSlots[loc] = [];
      
      const [startH, startM] = shift.start.split(':').map(Number);
      const [endH, endM] = shift.end.split(':').map(Number);
      
      let startTotal = startH * 60 + startM;
      const endTotal = endH * 60 + endM;
      
      while (startTotal + duration <= endTotal) {
        const slotH = Math.floor(startTotal / 60);
        const slotM = startTotal % 60;
        const slotStartStr = `${String(slotH).padStart(2,'0')}:${String(slotM).padStart(2,'0')}`;
        
        const endTotalSlot = startTotal + duration;
        const slotEndH = Math.floor(endTotalSlot / 60);
        const slotEndM = endTotalSlot % 60;
        const slotEndStr = `${String(slotEndH).padStart(2,'0')}:${String(slotEndM).padStart(2,'0')}`;
        
        let isBooked = false;
        bookedAppts.forEach(apt => {
          const [aptStartH, aptStartM] = apt.time.split(':').map(Number);
          const aptStartTotal = aptStartH * 60 + aptStartM;
          const [aptEndH, aptEndM] = (apt.end_time || apt.time).split(':').map(Number);
          const aptEndTotal = aptEndH * 60 + aptEndM;
          
          if (startTotal < aptEndTotal && endTotalSlot > aptStartTotal) {
            isBooked = true;
          }
        });
        
        locationSlots[loc].push({
          time: slotStartStr,
          end_time: slotEndStr,
          isBooked: isBooked
        });
        
        startTotal += duration;
      }
    });
    
    let html = "";
    const locations = Object.keys(locationSlots);
    
    if (locations.length === 0) {
      container.innerHTML = `<span style="color:#ef4444; font-size:11px;">لا توجد فترات عمل مدخلة لهذا اليوم</span>`;
      return;
    }
    
    locations.forEach(loc => {
      const slots = locationSlots[loc];
      if (slots.length === 0) return;
      
      html += `
        <div class="slots-branch-group">
          <div class="slots-branch-title">
            <i class="fa-solid fa-location-dot"></i> ${loc}:
          </div>
          <div class="slots-grid">
            ${slots.map(s => {
              const displayTime = formatTimeArabic(s.time);
              const isSelected = document.getElementById('apt-time').value === s.time && aptSelectedLocation === loc;
              return `
                <div class="slot-pill ${s.isBooked ? 'booked' : ''} ${isSelected ? 'active' : ''}" 
                     data-time="${s.time}" 
                     data-location="${loc}"
                     onclick="selectBookingSlot(this)">
                  ${displayTime}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html || `<span style="color:#ef4444; font-size:11px;">لا توجد سلوتات زمنية تناسب مدة الخدمة</span>`;
    
  } catch (e) {
    console.error('Error generating slots:', e);
    container.innerHTML = `<span style="color:#ef4444; font-size:11px;">خطأ في توليد فترات الحجز</span>`;
  }
}

function formatTimeArabic(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'م' : 'ص';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2,'0')} ${period}`;
}

function selectBookingSlot(element) {
  if (element.classList.contains('booked')) return;
  
  const container = document.getElementById('apt-slots-container');
  container.querySelectorAll('.slot-pill').forEach(pill => pill.classList.remove('active'));
  
  element.classList.add('active');
  
  document.getElementById('apt-time').value = element.getAttribute('data-time');
  aptSelectedLocation = element.getAttribute('data-location');
}

// === Drag and Drop Handlers ===
function handleEventDragStart(e, appointmentId) {
  draggedAppointmentId = appointmentId;
  e.dataTransfer.setData('text/plain', appointmentId);
  e.dataTransfer.effectAllowed = 'move';
  
  // Find closest cal-event parent and mark it as dragging
  const dragEl = e.target.closest('.cal-event');
  if (dragEl) dragEl.classList.add('dragging');
  
  const container = document.getElementById('calendar-container');
  if (container) container.classList.add('calendar-dragging');
}

function handleSlotDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const slot = e.currentTarget;
  if (slot) slot.classList.add('drag-over');
}

function handleSlotDragLeave(e) {
  const slot = e.currentTarget;
  if (slot) slot.classList.remove('drag-over');
}

async function handleSlotDrop(e) {
  e.preventDefault();
  const slot = e.currentTarget;
  if (slot) slot.classList.remove('drag-over');
  
  const appointmentId = draggedAppointmentId || e.dataTransfer.getData('text/plain');
  if (!appointmentId) return;
  
  const newDate = slot.getAttribute('data-date');
  const newTime = slot.getAttribute('data-time');
  
  if (!newDate || !newTime) return;
  
  try {
    const res = await ScsApi.getAppointments();
    if (res.success) {
      const apt = res.data.find(a => a.id === appointmentId);
      if (!apt) return;
      
      // Do nothing if dropped on the exact same slot
      if (apt.date === newDate && apt.time === newTime) return;
      
      const confirmMsg = `هل تريد تعديل موعد المريض "${apt.patient_name}"؟\n\n- الموعد الحالي: ${apt.date} الساعة ${apt.time}\n- الموعد الجديد: ${newDate} الساعة ${newTime}`;
      
      if (confirm(confirmMsg)) {
        const updateRes = await ScsApi.updateAppointment(appointmentId, {
          date: newDate,
          time: newTime
        });
        
        if (updateRes.success) {
          showToast('تم تعديل الموعد بنجاح', 'success');
          renderCalendar();
        } else {
          showToast('فشل تعديل الموعد', 'error');
        }
      }
    }
  } catch (err) {
    console.error('Error in drop handler:', err);
    showToast('فشل تعديل الموعد', 'error');
  }
}

function handleEventDragEnd(e) {
  draggedAppointmentId = null;
  const dragEl = e.target.closest('.cal-event');
  if (dragEl) dragEl.classList.remove('dragging');
  
  const container = document.getElementById('calendar-container');
  if (container) container.classList.remove('calendar-dragging');
}

// --- APPOINTMENT DETAILS MODAL ---
async function showAppointmentDetails(appointmentId) {
  try {
    const res = await ScsApi.getAppointments();
    if (res.success) {
      const apt = res.data.find(a => a.id === appointmentId);
      if (!apt) {
        showToast('لم يتم العثور على تفاصيل الموعد', 'error');
        return;
      }

      document.getElementById('detail-apt-id').value = apt.id;
      document.getElementById('detail-patient-name').innerText = apt.patient_name || 'مريض';

      // Find doctor name safely
      const doctorsList = window.allDoctors || [];
      const doctor = doctorsList.find(d => d.id === apt.doctor_id);
      document.getElementById('detail-doctor-name').innerText = apt.doctor_name || (doctor ? doctor.full_name : 'د. محمد نور');

      document.getElementById('detail-service-name').innerText = `${apt.service_name || 'كشف عام'} ${apt.amount ? '— (' + apt.amount + ' ج.م)' : ''}`;
      document.getElementById('detail-location').innerText = apt.location || 'العيادة الرئيسية';

      // Date and Time formatted
      const displayTime = apt.time ? formatTimeArabic(apt.time) : '—';
      document.getElementById('detail-date-time').innerText = `${apt.date || ''} الساعة ${displayTime}`;

      // Visit type translation
      const visitTypeStr = apt.visit_type === 'followup' ? 'متابعة مجانية' : 'كشف جديد';
      document.getElementById('detail-visit-type').innerText = visitTypeStr;

      // Payment method translation
      let payStr = 'كاش بالعيادة';
      if (apt.payment_method === 'online') payStr = 'دفع إلكتروني (Paymob)';
      else if (apt.payment_method === 'insurance') payStr = 'تأمين طبي';
      document.getElementById('detail-payment-method').innerText = payStr;

      // Notes
      document.getElementById('detail-notes').innerText = apt.notes && apt.notes.trim() ? apt.notes : 'لا توجد ملاحظات إضافية.';

      openModal('modal-appointment-details');
    }
  } catch (err) {
    console.error('Error loading appointment details:', err);
    showToast('فشل تحميل تفاصيل الموعد', 'error');
  }
}

async function cancelAppointmentFromCalendar() {
  const appointmentId = document.getElementById('detail-apt-id').value;
  if (!appointmentId) return;
  
  if (confirm('هل أنت متأكد من رغبتك في إلغاء وحذف هذا الحجز نهائياً؟')) {
    try {
      const res = await ScsApi.cancelAppointment(appointmentId);
      if (res.success) {
        showToast('تم إلغاء الحجز بنجاح', 'success');
        closeModal('modal-appointment-details');
        renderCalendar();
      } else {
        showToast('فشل إلغاء الحجز', 'error');
      }
    } catch (err) {
      console.error('Error cancelling appointment:', err);
      showToast('حدث خطأ أثناء إلغاء الحجز', 'error');
    }
  }
}
