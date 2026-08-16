// Inbox Page Specific Logic
let activeChat = null;
let chatInterval = null;

document.addEventListener('sharedDataReady', () => {
  initInbox();
});

function initInbox() {
  loadConversations();
  
  // Poll conversations list and active chat details every 4 seconds
  chatInterval = setInterval(() => {
    loadConversations(true);
  }, 4000);
}

async function loadConversations(isPolling = false) {
  try {
    const res = await fetch(`${API_BASE}/v1/inbox/conversations`).then(r => r.json());
    if (res.success) {
      renderConversations(res.data, isPolling);
      if (activeChat) {
        // Refresh active chat data
        const current = res.data.find(c => c.id === activeChat.id);
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

function renderConversations(conversations, isPolling) {
  const list = document.getElementById('chat-conversations-list');
  if (!list) return;

  if (!conversations.length) {
    list.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b; font-size:12px;">لا توجد محادثات واردة</div>';
    return;
  }

  const channelIcons = { whatsapp: 'fa-whatsapp', telegram: 'fa-telegram' };

  list.innerHTML = conversations.map(c => {
    const isActive = activeChat && activeChat.id === c.id;
    const lastMsg = c.messages.length ? c.messages[c.messages.length - 1] : { body: '', timestamp: '' };
    
    // Format timestamp
    let timeStr = '';
    if (lastMsg.timestamp) {
      const d = new Date(lastMsg.timestamp);
      timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    return `
      <div class="chat-conv-item ${isActive ? 'active' : ''} ${c.unread_count > 0 ? 'unread' : ''}" onclick="openChat('${c.id}')">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <strong style="font-size:12px; color:#f1f5f9;">${c.patient_name}</strong>
          <span style="font-size:10px; color:#475569;">${timeStr}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <p style="margin:0; font-size:11px; color:#94a3b8; max-width:80%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${lastMsg.sender === 'patient' ? '' : 'أنت: '}${lastMsg.body}
          </p>
          <div style="display:flex; gap:6px; align-items:center;">
            <i class="fa-brands ${channelIcons[c.channel]} channel-icon" style="color: ${c.channel === 'whatsapp' ? '#25d366' : '#0088cc'}; font-size:12px;"></i>
            ${c.unread_count > 0 ? `<span class="chat-conv-badge">${c.unread_count}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function openChat(convId) {
  try {
    const res = await fetch(`${API_BASE}/v1/inbox/conversations/${convId}/read`, { method: 'POST' }).then(r => r.json());
    if (res.success) {
      activeChat = res.data;
      renderChatWindow();
      loadConversations();
      
      // Update shared layout notifications badge
      loadBaseLayoutData();
    }
  } catch (e) {
    showToast('فشل فتح المحادثة', 'error');
  }
}

function renderChatWindow() {
  const win = document.getElementById('chat-window');
  if (!win || !activeChat) return;

  const channelNames = { whatsapp: 'واتساب', telegram: 'تليجرام' };

  win.className = "chat-window active";
  win.innerHTML = `
    <div class="chat-header">
      <div style="display:flex; align-items:center; gap:10px;">
        <div class="chat-header-avatar"><i class="fa-solid fa-user"></i></div>
        <div>
          <strong style="color:#f8fafc; font-size:13px; display:block;">${activeChat.patient_name}</strong>
          <span style="font-size:10px; color:#94a3b8;"><i class="fa-solid fa-phone" style="margin-left:4px;"></i>${activeChat.patient_phone} — عبر ${channelNames[activeChat.channel]}</span>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <!-- AI Bot Toggle -->
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:11px; color:#94a3b8;">الرد الآلي الذكي</span>
          <label class="switch-toggle" style="position:relative; display:inline-block; width:34px; height:20px;">
            <input type="checkbox" id="bot-toggle-${activeChat.id}" ${activeChat.bot_active ? 'checked' : ''} onchange="toggleBot('${activeChat.id}', this.checked)" style="opacity:0; width:0; height:0;">
            <span class="slider" style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:#334155; border-radius:20px; transition:.3s;"></span>
          </label>
        </div>
      </div>
    </div>

    <div class="chat-messages-container" id="chat-messages-container">
      <!-- Messages list -->
    </div>

    <div class="chat-input-area">
      <form id="chat-send-form" onsubmit="event.preventDefault(); sendMessage('${activeChat.id}');" style="display:flex; width:100%; gap:8px;">
        <input type="text" id="chat-message-input" placeholder="اكتب رسالتك هنا..." required autocomplete="off" style="flex:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08); border-radius:6px; color:#f1f5f9; padding:8px 12px; font-family:Cairo; font-size:12px;">
        <button type="submit" class="btn-primary-cta" style="padding: 0 16px;"><i class="fa-solid fa-paper-plane"></i></button>
      </form>
    </div>
  `;

  renderActiveChatMessages();
}

function renderActiveChatMessages() {
  const container = document.getElementById('chat-messages-container');
  if (!container || !activeChat) return;

  // Keep track of scroll position to stay at bottom if already there
  const isAtBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 50;

  container.innerHTML = activeChat.messages.map(m => {
    const isPatient = m.sender === 'patient';
    const d = new Date(m.timestamp);
    const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    
    return `
      <div class="chat-message-row ${isPatient ? 'incoming' : 'outgoing'}">
        <div class="chat-message-bubble">
          <p style="margin:0; font-size:12px; line-height:1.5; color:${isPatient ? '#f1f5f9' : '#ffffff'};">${m.body}</p>
          <span style="font-size:9px; color:rgba(255,255,255,0.5); display:block; text-align:left; margin-top:4px;">${timeStr}</span>
        </div>
      </div>
    `;
  }).join('');

  if (isAtBottom || container.innerHTML.length < 500) {
    container.scrollTop = container.scrollHeight;
  }
}

async function sendMessage(convId) {
  const input = document.getElementById('chat-message-input');
  if (!input) return;
  const body = input.value.trim();
  if (!body) return;

  try {
    const res = await fetch(`${API_BASE}/v1/inbox/conversations/${convId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body })
    }).then(r => r.json());

    if (res.success) {
      input.value = '';
      activeChat = res.data;
      renderActiveChatMessages();
      loadConversations();
    }
  } catch (e) {
    showToast('فشل إرسال الرسالة', 'error');
  }
}

async function toggleBot(convId, status) {
  try {
    const res = await fetch(`${API_BASE}/v1/inbox/conversations/${convId}/bot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: status })
    }).then(r => r.json());
    if (res.success) {
      activeChat.bot_active = status;
      showToast(status ? 'تم تفعيل الرد الآلي بالذكاء الاصطناعي لهذه المحادثة' : 'تم تعطيل الرد الآلي وتحويل المحادثة لوضع يدوي', 'info');
    }
  } catch (e) {
    showToast('فشل تعديل حالة البوت', 'error');
  }
}
