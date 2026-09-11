export function initChat(username) {
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');
  const chatPanel = document.getElementById('chat-panel');
  const chatToast = document.getElementById('chat-toast');
  const toastMessages = document.getElementById('toast-messages');

  let isVisible = false;
  let isFocused = false;
  let toastTimer = null;
  const TOAST_FADE_DELAY = 10000; // ms

  function toggleChatPanel() {
    isVisible = !isVisible;
    isActive = isVisible;
    chatPanel.classList.toggle('visible', isVisible);
    if (isVisible) {
      setChatFocus(true);
      chatInput.focus();
    } else {
      setChatFocus(false);
    }
  }

  function setChatFocus(focused) {
    isFocused = focused;
  }

  function isChatFocused() {
    return isFocused;
  }

  let isActive = false;
  function setChatActive(active) {
    isActive = active;
  }
  function isChatActive() {
    return isActive;
  }

  const MAX_DISPLAY_MESSAGES = 4;

  function addMessage(text, sender, isLocal) {
    if (!chatMessages) return;
    // Remove oldest message if at capacity
    while (chatMessages.children.length >= MAX_DISPLAY_MESSAGES) {
      chatMessages.removeChild(chatMessages.firstChild);
    }
    const msg = document.createElement('div');
    msg.className = 'chat-message' + (isLocal ? ' local' : ' remote');
    msg.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    // Also show in toast
    showToast(text, sender);
  }

  function showToast(text, sender) {
    if (!toastMessages) return;
    const msg = document.createElement('div');
    msg.className = 'toast-msg';
    msg.innerHTML = `<span class="toast-sender">${sender}:</span> ${text}`;
    toastMessages.appendChild(msg);

    // Keep only last 20 messages in toast
    while (toastMessages.children.length > 20) {
      toastMessages.removeChild(toastMessages.firstChild);
    }

    // Show toast and reset fade timer
    chatToast.classList.add('visible');
    toastMessages.scrollTop = toastMessages.scrollHeight;
    resetToastTimer();
  }

  function resetToastTimer() {
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      chatToast.classList.remove('visible');
      toastTimer = null;
    }, TOAST_FADE_DELAY);
  }

  function closeChatPanel() {
    isVisible = false;
    isActive = false;
    isFocused = false;
    chatPanel.classList.remove('visible');
    if (chatInput) chatInput.blur();
  }

  function sendMessage(text) {
    if (!text.trim()) return;
    // Post via SDK to /ww.myplace.chat
    if (window.__myplaceSdk && window.__myplaceSdk.publish) {
      window.__myplaceSdk.publish({ text: text.trim() });
    }
    addMessage(text.trim(), username || 'You', true);
    chatInput.value = '';
    closeChatPanel();
  }

  if (chatSend) {
    chatSend.addEventListener('click', () => sendMessage(chatInput.value));
  }
  if (chatInput) {
    // Track focus state properly via focus/blur events
    chatInput.addEventListener('focus', () => setChatFocus(true));
    chatInput.addEventListener('blur', () => setChatFocus(false));
    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage(chatInput.value);
      }
    });
  }

  return { sendMessage, addMessage, toggleChatPanel, closeChatPanel, isChatVisible: () => isVisible, isChatFocused, isChatActive, setChatFocus, showToast };
}
