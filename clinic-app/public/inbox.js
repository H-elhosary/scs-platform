// =============================================
// Smart Clinic OS — Modern Medical Inbox Controller
// Real-time conversation polling, WhatsApp/Telegram
// =============================================

let allConversations = [];
let activeChat = null;
let chatInterval = null;
let currentChannelFilter = 'all';

document.addEventListener('sharedDataReady', () => {
  initInbox();
});

function initInbox() {
  loadConversations();
  
  // Poll conversations list every 4 seconds
  chatInterval = setInterval(() => {
    loadConversations(true);
  }, 4000);
}

async function loadConversations(isPolling = false) {
  try {
    const tenantId = localStorage.getItem('tenant_id') || 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const res = await authFetch(`${API_BASE}/v1/inbox/conversations`, {
      headers: { 'x-tenant-id': tenantId }
    }).then(r => r.json());

    if (res.success) {
      allConversations = res.data || [];
      renderConversationsList(isPolling);

      if (activeChat) {
        const current = allConversations.find(c => c.id === activeChat.id);
        if (current) {
          activeChat = current;
          renderActiveChatMessages();
        }
      }
    }
  } catch (e) {
    console.error('Failed to load conversations:', e);
  }
}

function setChannelFilter(filter) {
  currentChannelFilter = filter;
  document.querySelectorAll('.chat-filter-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderConversationsList();
}

function filterConversations() {
  renderConversationsList();
}

function getFilteredConversations() {
  const search = (document.getElementById('chat-search')?.value || '').trim().toLowerCase();

  return allConversations.filter(c => {
    // Channel filter
    if (currentChannelFilter === 'unread' && (!c.unread_count || c.unread_count <= 0)) return false;
    if (currentChannelFilter === 'whatsapp' && c.channel !== 'whatsapp') return false;
    if (currentChannelFilter === 'telegram' && c.channel !== 'telegram') return false;

    // Search filter
    if (search) {
      const matchName = (c.patient_name || '').toLowerCase().includes(search);
      const matchPhone = (c.patient_phone || '').includes(search);
      const matchMsg = (c.last_message || '').toLowerCase().includes(search);
      return matchName || matchPhone || matchMsg;
    }
    return true;
  });
}

function renderConversationsList(isPolling = false) {
  const list = document.getElementById('chat-conversations-list');
  const countBadge = document.getElementById('chat-total-count');
  if (!list) return;

  const filtered = getFilteredConversations();
  if (countBadge) countBadge.textContent = `${filtered.length} محادثة`;

  if (!filtered.length) {
    list.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: #94a3b8;">
        <i class="fa-solid fa-inbox" style="font-size: 28px; margin-bottom: 8px; color: #cbd5e1; display: block;"></i>
        <span style="font-size: 13px; font-weight: 600;">لا توجد محادثات مطابقة</span>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map(c => {
    const isActive = activeChat && activeChat.id === c.id;
    const lastMsg = c.messages && c.messages.length ? c.messages[c.messages.length - 1] : { body: c.last_message || '', timestamp: c.last_message_at || '' };
    
    // Format timestamp
    let timeStr = '';
    if (lastMsg.timestamp) {
      const d = new Date(lastMsg.timestamp);
      timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    // Avatar initials
    const initials = (c.patient_name || 'م').split(' ').map(n => n[0]).slice(0, 2).join('');

    return `
      <div class="chat-conv-item ${isActive ? 'active' : ''} ${c.unread_count > 0 ? 'unread' : ''}" onclick="openChat('${c.id}')">
        <div class="chat-conv-avatar-wrap">
          <div class="chat-conv-avatar">${initials}</div>
          <span class="chat-channel-badge ${c.channel}">
            <i class="fa-brands ${c.channel === 'whatsapp' ? 'fa-whatsapp' : 'fa-telegram'}"></i>
          </span>
        </div>
        <div class="chat-conv-info">
          <div class="chat-conv-top-row">
            <h4 class="chat-conv-name">${c.patient_name}</h4>
            <span class="chat-conv-time">${timeStr}</span>
          </div>
          <div class="chat-conv-bottom-row">
            <p class="chat-conv-preview">
              ${lastMsg.sender === 'patient' ? '' : '<strong>أنت: </strong>'}${lastMsg.body || 'لا توجد رسائل'}
            </p>
            <div style="display: flex; align-items: center; gap: 6px;">
              ${c.bot_active ? `<span class="chat-bot-tag"><i class="fa-solid fa-robot"></i> آلي</span>` : ''}
              ${c.unread_count > 0 ? `<span class="chat-conv-badge">${c.unread_count}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function openChat(convId) {
  try {
    const tenantId = localStorage.getItem('tenant_id') || 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const res = await authFetch(`${API_BASE}/v1/inbox/conversations/${convId}/read`, {
      method: 'POST',
      headers: { 'x-tenant-id': tenantId }
    }).then(r => r.json());

    if (res.success) {
      activeChat = res.data;
      renderChatWindow();
      renderConversationsList();
      loadBaseLayoutData();
    }
  } catch (e) {
    showToast('فشل فتح المحادثة', 'error');
  }
}

function renderChatWindow() {
  const win = document.getElementById('chat-window');
  if (!win || !activeChat) return;

  const initials = (activeChat.patient_name || 'م').split(' ').map(n => n[0]).slice(0, 2).join('');
  const channelName = activeChat.channel === 'whatsapp' ? 'واتساب' : 'تليجرام';
  const channelIcon = activeChat.channel === 'whatsapp' ? 'fa-whatsapp' : 'fa-telegram';
  const channelColor = activeChat.channel === 'whatsapp' ? '#16a34a' : '#0284c7';

  win.innerHTML = `
    <!-- 1. Header -->
    <div class="chat-header">
      <div class="chat-header-user">
        <div class="chat-header-avatar">${initials}</div>
        <div class="chat-header-details">
          <h3>
            ${activeChat.patient_name}
            <span style="font-size: 11px; font-weight: 700; color: ${channelColor};">
              <i class="fa-brands ${channelIcon}"></i> ${channelName}
            </span>
          </h3>
          <div class="chat-header-sub">
            <span><i class="fa-solid fa-phone"></i> ${activeChat.patient_phone || 'رقم غير مسجل'}</span>
            <span>•</span>
            <span style="color: #10b981; font-weight: 700;">● متصل الآن</span>
          </div>
        </div>
      </div>

      <div class="chat-header-actions">
        <!-- AI Bot Toggle -->
        <div class="chat-bot-toggle-card">
          <span class="chat-bot-toggle-label">
            <i class="fa-solid fa-robot"></i>
            الرد الآلي الذكي
          </span>
          <label class="switch-toggle" title="تفعيل / تعطيل الرد الآلي">
            <input type="checkbox" id="bot-toggle-${activeChat.id}" ${activeChat.bot_active ? 'checked' : ''} onchange="toggleBot('${activeChat.id}', this.checked)">
            <span class="slider"></span>
          </label>
        </div>

        <button type="button" class="btn-chat-action" onclick="viewPatientProfile('${activeChat.patient_id}')" title="فتح ملف المريض">
          <i class="fa-solid fa-folder-open" style="color: #2563eb;"></i> الملف الطبي
        </button>
      </div>
    </div>

    <!-- 2. Messages Feed -->
    <div class="chat-messages-container" id="chat-messages-container">
      <!-- Rendered by renderActiveChatMessages -->
    </div>

    <!-- 3. Quick Reply Templates -->
    <div class="chat-templates-bar">
      <button type="button" class="chat-template-chip" onclick="insertTemplate('مرحباً بك في العيادة! يسعدنا الرد على استفسارك.')">
        👋 ترحيب
      </button>
      <button type="button" class="chat-template-chip" onclick="insertTemplate('مواعيد العمل الرسمية يومياً من الساعة 9 صباحاً حتى 10 مساءً.')">
        ⏰ مواعيد العمل
      </button>
      <button type="button" class="chat-template-chip" onclick="insertTemplate('تم تأكيد موعد كشفك بنجاح! في انتظار تشريفك.')">
        ✅ تأكيد الحجز
      </button>
      <button type="button" class="chat-template-chip" onclick="insertTemplate('عنوان العيادة: برج الأطباء، الدور الرابع، شارع التحرير.')">
        📍 موقع العيادة
      </button>
    </div>

    <!-- 4. Input Area -->
    <div class="chat-input-area">
      <form class="chat-input-form" onsubmit="event.preventDefault(); sendMessage('${activeChat.id}');">
        <input type="text" class="chat-input-field" id="chat-message-input" placeholder="اكتب رسالتك هنا... (اضغط Enter للإرسال)" required autocomplete="off">
        <button type="submit" class="chat-send-btn" title="إرسال الرسالة">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </form>
    </div>
  `;

  renderActiveChatMessages();
}

function renderActiveChatMessages() {
  const container = document.getElementById('chat-messages-container');
  if (!container || !activeChat) return;

  const isAtBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 60;
  const messages = activeChat.messages || [];

  if (!messages.length) {
    container.innerHTML = `
      <div style="text-align: center; color: #94a3b8; padding: 40px 0;">
        <span style="font-size: 13px;">لا توجد رسائل سابقة في هذه المحادثة. اكتب رسالة للبدء.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="chat-date-separator">سجل المحادثة المباشرة</div>
    ${messages.map(m => {
      const isPatient = m.sender === 'patient';
      const isBot = m.sender === 'bot';
      const d = new Date(m.timestamp || Date.now());
      const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      let rowClass = 'chat-message-row ';
      if (isPatient) rowClass += 'incoming';
      else if (isBot) rowClass += 'outgoing is-bot';
      else rowClass += 'outgoing';

      return `
        <div class="${rowClass}">
          <div class="chat-message-bubble">
            ${isBot ? `<div class="chat-bot-bubble-tag"><i class="fa-solid fa-robot"></i> رد آلي ذكي</div>` : ''}
            <p>${escapeHtml(m.body || m.text || '')}</p>
            <div class="chat-message-meta">
              <span>${timeStr}</span>
              ${!isPatient ? `<i class="fa-solid fa-check-double" style="font-size: 10px;"></i>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('')}
  `;

  if (isAtBottom || container.children.length <= 4) {
    container.scrollTop = container.scrollHeight;
  }
}

function insertTemplate(text) {
  const input = document.getElementById('chat-message-input');
  if (input) {
    input.value = text;
    input.focus();
  }
}

async function sendMessage(convId) {
  const input = document.getElementById('chat-message-input');
  if (!input) return;
  const body = input.value.trim();
  if (!body) return;

  try {
    const tenantId = localStorage.getItem('tenant_id') || 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const res = await authFetch(`${API_BASE}/v1/inbox/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId
      },
      body: JSON.stringify({ body })
    }).then(r => r.json());

    if (res.success) {
      input.value = '';
      activeChat = res.data;
      renderActiveChatMessages();
      loadConversations(true);
    }
  } catch (e) {
    showToast('فشل إرسال الرسالة', 'error');
  }
}

async function toggleBot(convId, status) {
  try {
    const tenantId = localStorage.getItem('tenant_id') || 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const res = await authFetch(`${API_BASE}/v1/inbox/conversations/${convId}/bot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId
      },
      body: JSON.stringify({ active: status })
    }).then(r => r.json());

    if (res.success) {
      if (activeChat) activeChat.bot_active = status;
      showToast(status ? 'تم تفعيل الرد الآلي بالذكاء الاصطناعي 🤖' : 'تم تعطيل الرد الآلي وتحويل المحادثة للوضع اليدوي 👤', 'info');
      renderConversationsList(true);
    }
  } catch (e) {
    showToast('فشل تعديل حالة البوت', 'error');
  }
}

function viewPatientProfile(patientId) {
  if (!patientId) {
    showToast('لم يتم ربط المحادثة بملف مريض بعد', 'info');
    return;
  }
  window.location.href = `patients.html?patient_id=${patientId}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
