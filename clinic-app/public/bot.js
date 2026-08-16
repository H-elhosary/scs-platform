const API_BASE_URL = '';

let currentLang = 'en';
let currentChannel = 'whatsapp'; // 'whatsapp' or 'telegram'
let simulatedPhone = sessionStorage.getItem('sim_phone') || '+201098765432';

// Translation dictionary for Bot
const translations = {
  ar: {
    channel_wa: 'تم التحويل إلى قناة واتساب (WhatsApp Product Channel)',
    channel_tg: 'تم التحويل إلى قناة تليجرام (Telegram Bot API Channel)',
    sim_quick_actions: 'إجراءات محاكاة سريعة:',
    sim_seed_visit: 'إضافة كشف سابق للمريض (اختبار المتابعة المجانية)',
    sim_change_phone: 'تغيير رقم الهاتف (محاكاة عميل آخر)',
    sim_reset: 'تصفير حالة البوت بالكامل',
    reset_success: 'تمت إعادة تعيين حالة المحادثة بنجاح.',
    reset_failed: 'فشل إعادة ضبط حالة المحادثة.',
    seed_visit_success: '✅ تم حقن كشف سابق مكتمل بنجاح! يمكنك الآن تجربة حجز متابعة مجانية.',
    seed_visit_failed: 'فشل إضافة كشف سابق للمريض.',
    error_api_call: 'حدث خطأ أثناء محاولة الاتصال بالخادم.',
    bot_title: 'بوابة محاكاة حجز المريض الذكي',
    api_connected: 'متصل بالـ API',
    back_to_admin: 'العودة للوحة الأدمن',
    clinic_title: 'عيادة النور الذكية',
    bot_active: 'البوت نشط تلقائياً',
    sim_chat_start: 'بدء محاكاة المحادثة مع العيادة. اكتب "البداية" لإعادة ضبط الحالة في أي وقت.',
    message_placeholder: 'اكتب رسالتك للمساعد الذكي هنا...',
    send_btn: 'إرسال',
    sim_data_title: 'معطيات المحاكاة',
    sim_data_desc: 'هذه اللوحة توضح معطيات حالة المريض الحالية في ذاكرة السيرفر، لتسهيل اختبار مسارات الشات والفرز والمدفوعات.'
  },
  en: {
    channel_wa: 'Switched to WhatsApp Product Channel',
    channel_tg: 'Switched to Telegram Bot API Channel',
    sim_quick_actions: 'Quick Simulation Actions:',
    sim_seed_visit: 'Add Previous Visit (Test Free Follow-up)',
    sim_change_phone: 'Change Phone Number (Simulate Other Client)',
    sim_reset: 'Reset Bot State',
    reset_success: 'Chat state has been reset successfully.',
    reset_failed: 'Failed to reset chat state.',
    seed_visit_success: '✅ Previous visit injected successfully! You can now test free follow-up booking.',
    seed_visit_failed: 'Failed to add previous visit for this patient.',
    error_api_call: 'Error occurred while connecting to server.',
    bot_title: 'Smart Clinic Patient Booking Simulator',
    api_connected: 'Connected to API',
    back_to_admin: 'Back to Admin',
    clinic_title: 'Smart Clinic',
    bot_active: 'Bot Active',
    sim_chat_start: 'Start conversation with the clinic. Type "Start" to reset state at any time.',
    message_placeholder: 'Type your message here...',
    send_btn: 'Send',
    sim_data_title: 'Simulation Data',
    sim_data_desc: 'This panel shows the current patient state data in the server memory to facilitate testing chat flows, triage, and payments.'
  }
};

const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('chat-message-input');
const inputForm = document.getElementById('chat-input-form');
const simPhoneLabel = document.getElementById('sim-phone');
const simStateLabel = document.getElementById('sim-state');

// Initial setup
simPhoneLabel.innerText = simulatedPhone;

// Channel selection
const optWa = document.getElementById('opt-wa');
const optTg = document.getElementById('opt-tg');

optWa.addEventListener('click', () => {
  currentChannel = 'whatsapp';
  optWa.classList.add('active');
  optTg.classList.remove('active');
  appendSystemMessage(translations[currentLang].channel_wa);
});

optTg.addEventListener('click', () => {
  currentChannel = 'telegram';
  optTg.classList.add('active');
  optWa.classList.remove('active');
  appendSystemMessage(translations[currentLang].channel_tg);
});

// Append system log
function appendSystemMessage(msg) {
  const el = document.createElement('div');
  el.className = 'text-center text-muted';
  el.style.fontSize = '11px';
  el.style.margin = '8px 0';
  el.innerText = msg;
  chatBox.appendChild(el);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Append chat message bubble
function appendMessage(text, sender = 'bot') {
  const el = document.createElement('div');
  
  let isTriage = text.includes('🔴 تنبيه حالة طارئة');
  el.className = `msg-bubble ${sender} ${isTriage ? 'triage' : ''}`;
  
  // Format line breaks
  const formattedText = text.replace(/\n/g, '<br>');
  el.innerHTML = `<div>${formattedText}</div>`;
  
  // Parse options for interactive buttons (like WhatsApp buttons)
  if (sender === 'bot') {
    const lines = text.split('\n');
    const options = [];
    
    lines.forEach(line => {
      // Matches "1. Text" or "1- Text" or "1. Text Option"
      const match = line.match(/^(\d+)[\.\-]\s*(.+)$/);
      if (match) {
        options.push({
          num: match[1],
          text: match[2].trim()
        });
      }
    });

    if (options.length > 0) {
      const btnGroup = document.createElement('div');
      btnGroup.className = 'interactive-btn-group';
      
      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'interactive-btn';
        btn.innerText = opt.num + '. ' + opt.text;
        btn.addEventListener('click', () => {
          sendMessage(opt.num);
        });
        btnGroup.appendChild(btn);
      });
      
      el.appendChild(btnGroup);
    }
  }

  chatBox.appendChild(el);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Form submit message
inputForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  
  messageInput.value = '';
  sendMessage(text);
});

// Send message to backend webhook
async function sendMessage(text) {
  appendMessage(text, 'user');

  let url = `${API_BASE_URL}/webhooks/whatsapp`;
  let payload = {};

  if (currentChannel === 'whatsapp') {
    url = `${API_BASE_URL}/webhooks/whatsapp`;
    payload = {
      object: "whatsapp_business_account",
      entry: [{
        id: "whatsapp_business_id",
        changes: [{
          value: {
            messaging_product: "whatsapp",
            contacts: [{
              profile: { name: "أحمد المريض" },
              wa_id: simulatedPhone.replace('+', '')
            }],
            messages: [{
              from: simulatedPhone.replace('+', ''),
              id: `wamid.sim_${Math.random().toString(36).substring(7)}`,
              timestamp: Math.floor(Date.now() / 1000).toString(),
              text: { body: text },
              type: "text"
            }]
          },
          field: "messages"
        }]
      }]
    };
  } else {
    // Telegram
    url = `${API_BASE_URL}/webhooks/telegram`;
    payload = {
      update_id: Math.floor(Math.random() * 90000 + 10000),
      message: {
        message_id: Math.floor(Math.random() * 9000 + 1000),
        from: {
          id: simulatedPhone.replace('+', ''),
          first_name: "أحمد",
          last_name: "المريض"
        },
        chat: {
          id: simulatedPhone.replace('+', ''),
          type: "private"
        },
        date: Math.floor(Date.now() / 1000),
        text: text
      }
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success && data.reply) {
      appendMessage(data.reply, 'bot');
      
      // Update state in info sidebar
      fetchSimState();
    } else {
      appendMessage("حدث خطأ في استجابة البوت.", 'bot');
    }
  } catch (error) {
    appendMessage("خطأ في الاتصال بالخادم الرئيسي.", 'bot');
  }
}

// Fetch current conversation state
async function fetchSimState() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/v1/tenants/a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ` + sessionStorage.getItem('ops_token') // Optional bypass admin check if public
      }
    });
    // We can also retrieve the state via a dedicated debug endpoint if needed, but we'll simulate state display locally or fetch state
    // Let's call a quick debug endpoint on backend
    const debugRes = await fetch(`${API_BASE_URL}/webhooks/payments/bot-state?phone=${simulatedPhone.replace('+', '')}`);
    const debugData = await debugRes.json();
    if (debugData.success) {
      simStateLabel.innerText = debugData.state || 'IDLE';
    }
  } catch (e) {
    // Ignore
  }
}

// Quick Actions
window.changeSimPhoneNumber = () => {
  const newPhone = prompt("يرجى إدخال رقم الهاتف الجديد للمحاكاة (مثال: +201200001111):", simulatedPhone);
  if (newPhone && newPhone.trim()) {
    simulatedPhone = newPhone.trim();
    sessionStorage.setItem('sim_phone', simulatedPhone);
    simPhoneLabel.innerText = simulatedPhone;
    appendSystemMessage(`تم تغيير رقم محاكاة العميل إلى: ${simulatedPhone}`);
    resetSimState();
  }
};

window.resetSimState = async () => {
  try {
    await fetch(`${API_BASE_URL}/webhooks/payments/reset-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: simulatedPhone.replace('+', '') })
    });
    chatBox.innerHTML = `<div class="text-center text-muted" style="font-size: 12px; margin-bottom: 20px;">${translations[currentLang].reset_success}</div>`;
    simStateLabel.innerText = 'IDLE';
    sendMessage('البداية');
  } catch (e) {
    appendSystemMessage(translations[currentLang].reset_failed);
  }
};

window.simulateSeedVisit = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/webhooks/payments/seed-visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: simulatedPhone,
        tenant_id: 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d'
      })
    });
    const data = await res.json();
    if (data.success) {
      appendSystemMessage(translations[currentLang].seed_visit_success);
    } else {
      alert(translations[currentLang].seed_visit_failed);
    }
  } catch (e) {
    alert(translations[currentLang].error_api_call);
  }
};

// Initial welcome trigger
function applyTranslation() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.dataset.i18n;
    if (translations[currentLang][key]) {
      el.innerText = translations[currentLang][key];
    }
  });

  // Handle data-i18n-placeholder
  const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
  placeholderElements.forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (translations[currentLang][key]) {
      el.placeholder = translations[currentLang][key];
    }
  });
}

// Apply initial translation
applyTranslation();

sendMessage('البداية');

// ─── Inbox polling: receive incoming messages (prescriptions etc.) from server ───
let lastInboxMessageCount = 0;

async function pollInbox() {
  try {
    const phone = encodeURIComponent(simulatedPhone);
    const res = await fetch(`${API_BASE_URL}/bot/inbox/${phone}`).then(r => r.json());
    if (res.success && res.messages) {
      const newMsgs = res.messages.slice(lastInboxMessageCount);
      if (newMsgs.length > 0) {
        newMsgs.forEach(msg => {
          if (msg.sender === 'bot') {
            // Highlight prescription messages
            const isPrescription = msg.text.includes('📄') || msg.text.includes('روشتة');
            const bubble = document.createElement('div');
            bubble.className = `msg-bubble bot ${isPrescription ? 'triage' : ''}`;
            const formattedText = msg.text
              .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
              .replace(/\n/g, '<br>');
            bubble.innerHTML = `<div>${formattedText}</div>`;
            if (isPrescription) {
              // Add PDF download button
              const pdfMatch = msg.text.match(/https?:\/\/[^\s\n]+\.pdf/);
              if (pdfMatch) {
                const pdfBtn = document.createElement('a');
                pdfBtn.href = pdfMatch[0];
                pdfBtn.target = '_blank';
                pdfBtn.style.cssText = 'display:inline-block;margin-top:10px;padding:8px 16px;background:#10b981;color:white;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700;';
                pdfBtn.innerHTML = '📥 تحميل الروشتة PDF';
                bubble.appendChild(pdfBtn);
              }
            }
            chatBox.appendChild(bubble);
            chatBox.scrollTop = chatBox.scrollHeight;
          }
        });
        lastInboxMessageCount = res.messages.length;
      }
    }
  } catch (e) { /* silent fail */ }
}

// Start polling after 2 seconds delay, every 4 seconds
setTimeout(() => {
  setInterval(pollInbox, 4000);
}, 2000);
