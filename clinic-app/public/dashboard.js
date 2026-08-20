// Dashboard Page Logic
document.addEventListener('sharedDataReady', () => {
  initDashboard();
});

async function initDashboard() {
  const today = new Date();
  const dayNames = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  
  const dateDisplay = document.getElementById('today-date-display');
  if (dateDisplay) {
    dateDisplay.textContent = `اليوم — ${dayNames[today.getDay()]} ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`;
  }

  await loadDashboardStatsAndQueue();
}

let todayAppointments = [];
let currentSortKey = 'time'; // Default sort key
let currentSortOrder = 'asc'; // Default sort order

async function loadDashboardStatsAndQueue() {
  try {
    // Load Stats
    const statsRes = await ScsApi.getDashboardStats();
    if (statsRes.success) {
      const d = statsRes.data;
      document.getElementById('kpi-patients-today').textContent = d.patients_today;
      document.getElementById('kpi-confirmed').textContent = d.confirmed_count + d.checked_in_count;
      document.getElementById('kpi-revenue').textContent = `${d.total_revenue.toLocaleString()} ج.م`;
      document.getElementById('kpi-attendance').textContent = `${d.attendance_rate}%`;
      
      const welcomeTitle = document.getElementById('welcome-doctor-title');
      if (welcomeTitle && d.tenant_name) {
        welcomeTitle.textContent = `مرحباً بك في ${d.tenant_name}`;
      }
      renderDashboardCharts(d);
    }

    // Load Today's Queue
    const todayStr = formatDate(new Date());
    const aptsRes = await ScsApi.getAppointments({ date: todayStr });
    if (aptsRes.success) {
      todayAppointments = aptsRes.data;
      renderTodayQueue();
    }

    // Load Queue Status Panel
    await refreshQueueStatus();
  } catch (e) {
    console.error('Dashboard load error:', e);
    showToast('فشل تحميل بيانات لوحة التحكم', 'error');
  }
}

// ======== Queue Status Panel ========
async function refreshQueueStatus() {
  try {
    const res = await ScsApi.getQueueStatus();
    if (res.success) {
      const data = res.data;
      
      // Current In Exam
      const examName = document.getElementById('qs-exam-name');
      const examSub = document.getElementById('qs-exam-sub');
      if (data.current_in_exam && data.current_in_exam.patient_name) {
        examName.textContent = data.current_in_exam.patient_name;
        examName.className = 'queue-value queue-value--success';
        examSub.innerHTML = `<i class="fa-solid fa-stethoscope" style="margin-left:4px;"></i> رقم ${data.current_in_exam.queue_number} — ${data.current_in_exam.doctor_name || 'د. محمد نور'}`;
      } else {
        examName.textContent = 'لا يوجد مريض';
        examName.className = 'queue-value queue-value--muted';
        examSub.textContent = 'غرفة الكشف شاغرة';
      }

      // Waiting Count
      const waitingCount = document.getElementById('qs-waiting-count');
      waitingCount.textContent = data.waiting_list.length;
      waitingCount.className = data.waiting_list.length > 0 
        ? 'queue-value queue-value--lg queue-value--warning' 
        : 'queue-value queue-value--lg queue-value--muted';

      // Next In Line
      const nextName = document.getElementById('qs-next-name');
      const nextSub = document.getElementById('qs-next-sub');
      if (data.waiting_list.length > 0) {
        const next = data.waiting_list[0];
        nextName.textContent = next.patient_name;
        nextName.className = 'queue-value queue-value--info';
        nextSub.innerHTML = `رقم ${next.queue_number}${next.is_urgent ? ' <span style="color:#ef4444; font-weight:700;"><i class="fa-solid fa-bolt"></i> عاجل</span>' : ''}`;
      } else {
        nextName.textContent = '—';
        nextName.className = 'queue-value queue-value--muted';
        nextSub.textContent = 'لا يوجد منتظرين';
      }
    }
  } catch (e) {
    console.error('Queue status load error:', e);
  }
}

function renderTodayQueue() {
  const tbody = document.getElementById('today-queue-body');
  if (!tbody) return;

  if (!todayAppointments || !todayAppointments.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="loading-cell">لا توجد مواعيد لهذا اليوم</td></tr>';
    return;
  }

  // Sort the array
  const sorted = [...todayAppointments];
  sorted.sort((a, b) => {
    let valA = a[currentSortKey] || '';
    let valB = b[currentSortKey] || '';

    // Handle numeric sorting for queue number
    if (currentSortKey === 'queue_number') {
      valA = Number(valA);
      valB = Number(valB);
      return currentSortOrder === 'asc' ? valA - valB : valB - valA;
    }

    // Default string comparison
    valA = valA.toString().toLowerCase();
    valB = valB.toString().toLowerCase();
    
    if (valA < valB) return currentSortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  tbody.innerHTML = sorted.map(apt => {
    const statusLabels = { confirmed: 'مؤكد', checked_in: 'حضر', completed: 'مكتمل', no_show: 'لم يحضر', cancelled: 'ملغي' };
    const statusIcons = { confirmed: 'fa-clock', checked_in: 'fa-user-check', completed: 'fa-check-double', no_show: 'fa-user-xmark', cancelled: 'fa-ban' };
    const payIcons = { cash: 'نقدي', online: 'إلكتروني', insurance: 'تأمين', none: '—' };
    const visitLabels = { exam: 'كشف', followup: 'متابعة' };

    let actions = '';
    if (apt.status === 'confirmed') {
      actions = `
        <button class="btn-action btn-success" onclick="checkInPatient('${apt.id}')"><i class="fa-solid fa-right-to-bracket"></i> تسجيل حضور</button>
        <button class="btn-action btn-danger btn-action-spacer" onclick="cancelAppointment('${apt.id}','${apt.patient_name}')"><i class="fa-solid fa-trash"></i></button>
      `;
    } else if (apt.status === 'checked_in') {
      actions = `
        <button class="btn-action btn-info" onclick="startExam('${apt.id}')"><i class="fa-solid fa-stethoscope"></i> بدء الكشف</button>
        <button class="btn-action btn-danger btn-action-spacer" onclick="cancelAppointment('${apt.id}','${apt.patient_name}')"><i class="fa-solid fa-trash"></i></button>
      `;
    } else if (apt.status === 'completed') {
      actions = `<span class="status-text status-text--success"><i class="fa-solid fa-check-double"></i> تم كشفه</span>`;
    } else if (apt.status === 'no_show') {
      actions = `<span class="status-text status-text--danger"><i class="fa-solid fa-user-xmark"></i> لم يحضر</span>`;
    } else if (apt.status === 'cancelled') {
      actions = `<span class="status-text status-text--muted"><i class="fa-solid fa-ban"></i> ملغي</span>`;
    }

    return `
      <tr class="${apt.status === 'cancelled' ? 'row-cancelled' : ''}">
        <td><strong class="queue-num-val">${apt.queue_number}</strong></td>
        <td>
          <div class="patient-info-col">
            <strong onclick="location.href='patients.html?id=${apt.patient_id || ''}'">${escapeHtml(apt.patient_name)}</strong>
            <span>${apt.patient_phone}</span>
          </div>
        </td>
        <td><span class="queue-time-val">${apt.time}</span></td>
        <td>${apt.service_name}</td>
        <td><span class="location-badge"><i class="fa-solid fa-location-dot"></i>${apt.location || 'العيادة الرئيسية'}</span></td>
        <td><span class="visit-badge ${apt.visit_type}">${visitLabels[apt.visit_type] || apt.visit_type}</span></td>
        <td><span class="payment-badge ${apt.payment_method}">${payIcons[apt.payment_method] || apt.payment_method}</span></td>
        <td><span class="status-pill status-${apt.status}"><i class="fa-solid ${statusIcons[apt.status] || 'fa-circle'}"></i> ${statusLabels[apt.status] || apt.status}</span></td>
        <td>${actions}</td>
      </tr>
    `;
  }).join('');

  updateHeaderSortIndicators();
}

function sortByColumn(key) {
  if (currentSortKey === key) {
    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortKey = key;
    currentSortOrder = 'asc';
  }
  renderTodayQueue();
}

function updateHeaderSortIndicators() {
  const headers = {
    'queue_number': 'th-queue',
    'patient_name': 'th-patient',
    'time': 'th-time',
    'service_name': 'th-service',
    'location': 'th-location',
    'visit_type': 'th-visit',
    'payment_method': 'th-payment',
    'status': 'th-status'
  };

  // Reset all indicators
  Object.values(headers).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const indicator = el.querySelector('.sort-indicator');
      if (indicator) indicator.remove();
    }
  });

  // Set active indicator
  const activeHeaderId = headers[currentSortKey];
  const activeEl = document.getElementById(activeHeaderId);
  if (activeEl) {
    const arrowSvg = currentSortOrder === 'asc' 
      ? `<svg class="sort-indicator" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px; display:inline-block; vertical-align:middle; color:var(--primary);"><polyline points="18 15 12 9 6 15"></polyline></svg>`
      : `<svg class="sort-indicator" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px; display:inline-block; vertical-align:middle; color:var(--primary);"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
    activeEl.insertAdjacentHTML('beforeend', arrowSvg);
  }
}

// ======== Call Next Patient (REAL - from queue) ========
async function callNextPatient() {
  try {
    const res = await ScsApi.callNextPatient();
    if (res.success) {
      if (res.data.called_patient) {
        showToast(`تم استدعاء المريض: ${res.data.called_patient.patient_name} (رقم ${res.data.called_patient.queue_number}) — المتبقي: ${res.data.remaining}`, 'success');
        await refreshQueueStatus();
        await loadDashboardStatsAndQueue();
      } else {
        showToast(res.data.message || 'لا يوجد مرضى في قائمة الانتظار', 'info');
      }
    }
  } catch (e) { showToast('فشل الاستدعاء', 'error'); }
}

// ======== Check In Patient (Modal-based) ========
let pendingCheckInAppointmentId = null;

async function checkInPatient(appointmentId) {
  // Find patient name from todayAppointments
  const apt = todayAppointments.find(a => a.id === appointmentId);
  const patientName = apt ? apt.patient_name : 'المريض';
  
  // Check if priority checkin is allowed in settings
  try {
    const settingsRes = await ScsApi.getOperationalSettings();
    if (settingsRes.success && settingsRes.data.allow_priority_checkin) {
      // Show modal with both options
      pendingCheckInAppointmentId = appointmentId;
      document.getElementById('checkin-modal-patient').textContent = patientName;
      document.getElementById('checkin-modal-priority').style.display = 'flex';
      const modal = document.getElementById('checkin-modal');
      modal.style.display = 'flex';
      return;
    }
  } catch (e) {
    console.error('Settings fetch error:', e);
  }
  
  // If priority not allowed, just check in normally
  await doCheckIn(appointmentId, false);
}

function closeCheckInModal() {
  document.getElementById('checkin-modal').style.display = 'none';
  pendingCheckInAppointmentId = null;
}

async function confirmCheckIn(isUrgent) {
  const appointmentId = pendingCheckInAppointmentId;
  closeCheckInModal();
  if (!appointmentId) return;
  await doCheckIn(appointmentId, isUrgent);
}

async function doCheckIn(appointmentId, isUrgent) {
  try {
    const res = await ScsApi.checkInAppointment(appointmentId, isUrgent);
    if (res.success) {
      if (isUrgent) {
        showToast('تم تسجيل حضور المريض كحالة عاجلة في أول قائمة الانتظار', 'success');
      } else {
        showToast('تم تسجيل حضور المريض وهو الآن في غرفة الانتظار', 'success');
      }
      await loadDashboardStatsAndQueue();
    }
  } catch (e) { showToast('فشل تسجيل الحضور', 'error'); }
}

// ======== Cancel Appointment ========
async function cancelAppointment(appointmentId, patientName) {
  if (!confirm(`هل تريد إلغاء موعد ${patientName}؟\nلا يمكن التراجع عن هذه العملية.`)) return;
  try {
    const res = await ScsApi.cancelAppointment(appointmentId);
    if (res.success) {
      showToast('تم إلغاء الموعد بنجاح', 'info');
      await loadDashboardStatsAndQueue();
    }
  } catch (e) { showToast('فشل إلغاء الموعد', 'error'); }
}

// ======== Start Exam (moves patient to exam room on TV then opens exam page) ========
async function startExam(appointmentId) {
  try {
    // 1. Move patient to exam room on the queue/TV
    const res = await ScsApi.startExam(appointmentId);
    if (res.success) {
      showToast('تم نقل المريض لغرفة الكشف — يظهر الآن على شاشة الانتظار', 'success');
    }
    // 2. Redirect to exam page
    location.href = `exam.html?appointment_id=${appointmentId}`;
  } catch (e) {
    // Even if the queue update fails, still allow going to exam
    location.href = `exam.html?appointment_id=${appointmentId}`;
  }
}

// ======== Render Dashboard Charts ========
// ======== Render Dashboard Charts ========
let chartDataPoints = [];
let chartHoverIndex = -1;

function renderDashboardCharts(stats) {
  const canvas = document.getElementById('revenue-chart');
  const tooltip = document.getElementById('revenue-chart-tooltip');
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;

  // Daily revenue for the last 7 days (last day matches today's total revenue)
  const data = [3200, 4500, 2100, 6000, 4200, 7200, stats.total_revenue || 5000];
  const labels = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت (اليوم)'];

  const maxVal = Math.max(...data, 1000) * 1.2;
  const minVal = 0;

  // Calculate points
  const points = [];
  const stepX = (width - 70) / (data.length - 1);
  for (let i = 0; i < data.length; i++) {
    const x = 50 + i * stepX;
    const y = height - 35 - ((data[i] - minVal) / (maxVal - minVal) * (height - 65));
    points.push({ x, y, value: data[i], label: labels[i], index: i });
  }
  chartDataPoints = points;

  function drawChart(hoverIdx = -1) {
    ctx.clearRect(0, 0, width, height);

    // 1. Grid lines & Y Axis labels
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = height - 35 - (i * (height - 65) / 4);
      ctx.beginPath();
      ctx.moveTo(45, y);
      ctx.lineTo(width - 15, y);
      ctx.stroke();

      // Y Axis label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 10px Cairo';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(maxVal * i / 4).toLocaleString()} ج.م`, 40, y + 3);
    }

    // 2. Vertical guide line on hover
    if (hoverIdx >= 0 && points[hoverIdx]) {
      const hp = points[hoverIdx];
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hp.x, 15);
      ctx.lineTo(hp.x, height - 35);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Draw Area Gradient
    const fillGrad = ctx.createLinearGradient(0, 15, 0, height - 35);
    fillGrad.addColorStop(0, 'rgba(37, 99, 235, 0.22)');
    fillGrad.addColorStop(1, 'rgba(37, 99, 235, 0.00)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, height - 35);
    for (let i = 0; i < points.length; i++) {
      if (i === 0) {
        ctx.lineTo(points[i].x, points[i].y);
      } else {
        const cpX1 = points[i-1].x + stepX / 2;
        const cpY1 = points[i-1].y;
        const cpX2 = points[i].x - stepX / 2;
        const cpY2 = points[i].y;
        ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, points[i].x, points[i].y);
      }
    }
    ctx.lineTo(points[points.length - 1].x, height - 35);
    ctx.closePath();
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // 4. Draw Smooth Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const cpX1 = points[i-1].x + stepX / 2;
      const cpY1 = points[i-1].y;
      const cpX2 = points[i].x - stepX / 2;
      const cpY2 = points[i].y;
      ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, points[i].x, points[i].y);
    }
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 5. Draw X labels and dots
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const isHovered = (i === hoverIdx);

      if (isHovered) {
        // Outer glowing halo
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(37, 99, 235, 0.25)';
        ctx.fill();

        // Main hovered dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#2563eb';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      } else {
        // Normal dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#2563eb';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }

      // X Axis Label
      ctx.fillStyle = isHovered ? '#1e40af' : '#64748b';
      ctx.font = isHovered ? '700 11px Cairo' : '600 10px Cairo';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], p.x, height - 12);
    }
  }

  // Initial draw
  drawChart(-1);

  // Mouse Move Event Listener for Hover
  if (!canvas.dataset.hoverBound) {
    canvas.dataset.hoverBound = 'true';

    canvas.addEventListener('mousemove', (e) => {
      const cRect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - cRect.left;
      const mouseY = e.clientY - cRect.top;

      let closestIdx = -1;
      let minDistance = 35; // Threshold radius

      for (let i = 0; i < chartDataPoints.length; i++) {
        const p = chartDataPoints[i];
        const dist = Math.hypot(mouseX - p.x, mouseY - p.y);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      }

      if (closestIdx !== chartHoverIndex) {
        chartHoverIndex = closestIdx;
        drawChart(closestIdx);

        if (closestIdx >= 0 && tooltip) {
          const pt = chartDataPoints[closestIdx];
          canvas.style.cursor = 'pointer';
          tooltip.style.display = 'block';
          tooltip.style.left = `${pt.x + 16}px`;
          tooltip.style.top = `${pt.y + 12}px`;
          tooltip.innerHTML = `
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 2px; font-weight: 600;">
              <i class="fa-solid fa-calendar-day" style="margin-left: 4px; color: #60a5fa;"></i> يوم ${pt.label}
            </div>
            <div style="font-size: 15px; font-weight: 800; color: #38bdf8; display: flex; align-items: baseline; gap: 4px;">
              <span>${pt.value.toLocaleString()}</span>
              <span style="font-size: 10px; font-weight: 700; color: #94a3b8;">ج.م</span>
            </div>
          `;
        } else if (tooltip) {
          canvas.style.cursor = 'default';
          tooltip.style.display = 'none';
        }
      }
    });

    canvas.addEventListener('mouseleave', () => {
      chartHoverIndex = -1;
      drawChart(-1);
      canvas.style.cursor = 'default';
      if (tooltip) tooltip.style.display = 'none';
    });
  }

  // Draw Service Distribution
  renderServiceDistribution();
}

function renderServiceDistribution() {
  const container = document.getElementById('service-dist-bars');
  if (!container) return;

  const dist = {};
  let total = 0;
  todayAppointments.forEach(apt => {
    const name = apt.service_name || 'كشف عام';
    dist[name] = (dist[name] || 0) + 1;
    total++;
  });

  const finalDist = total > 0 ? dist : {
    'كشف عام': 5,
    'حشو عصب': 3,
    'تنظيف أسنان': 2,
    'متابعة مجانية': 4
  };
  const finalTotal = total > 0 ? total : 14;

  let html = '';
  const colors = ['#7c3aed', '#10b981', '#f59e0b', '#06b6d4'];
  let idx = 0;
  for (const [name, count] of Object.entries(finalDist)) {
    const percentage = Math.round((count / finalTotal) * 100);
    const color = colors[idx % colors.length];
    html += `
      <div style="width: 100%;">
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; font-weight: 700;">
          <span style="color: #0f172a;">${name}</span>
          <span style="color: #64748b; font-weight: 600;">${count} حجز (${percentage}%)</span>
        </div>
        <div style="width: 100%; height: 7px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
          <div style="width: ${percentage}%; height: 100%; background: ${color}; border-radius: 4px;"></div>
        </div>
      </div>
    `;
    idx++;
  }
  container.innerHTML = html;
}
