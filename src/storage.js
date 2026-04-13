import { appMode } from './appMode';

function resolveBackendBaseUrl() {
  const raw = (import.meta.env.VITE_PROXY_URL || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw, window.location.origin);
    const normalizedPath = parsed.pathname.replace(/\/api\/flowbot-proxy\/?$/, '').replace(/\/$/, '');
    return `${parsed.origin}${normalizedPath}`;
  } catch {
    return '';
  }
}

const BACKEND_URL = resolveBackendBaseUrl();
const OFFLINE_CHATS_KEY = 'flowbot.offline.chats';
const OFFLINE_MESSAGES_KEY = 'flowbot.offline.messages';
const OFFLINE_SYNC_QUEUE_KEY = 'flowbot.offline.queue';

function apiUrl(path) {
  if (!BACKEND_URL) return path;
  return `${BACKEND_URL}${path}`;
}

function readJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeOfflineChats(raw) {
  if (!Array.isArray(raw)) return [];
  const map = new Map();
  raw.forEach((item) => {
    const id = String(item?.id || '').trim();
    if (!id) return;
    map.set(id, {
      id,
      userId: item?.userId || 'guest',
      title: item?.title || 'Nuevo chat',
      createdAt: item?.createdAt || new Date().toISOString(),
      source: 'local',
    });
  });
  return [...map.values()];
}

function normalizeOfflineMessages(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const next = {};
  Object.entries(raw).forEach(([chatId, messages]) => {
    if (!Array.isArray(messages)) return;
    const seen = new Set();
    next[chatId] = messages.filter((message) => {
      const id = String(message?.id || '').trim();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).map((message) => ({
      ...message,
      id: String(message.id),
      chatId: String(message.chatId || chatId),
      sender: message?.sender || 'user',
      text: message?.text || '',
      time: message?.time || new Date().toISOString(),
    }));
  });
  return next;
}

function getOfflineChats() {
  const normalized = normalizeOfflineChats(readJson(OFFLINE_CHATS_KEY, []));
  writeJson(OFFLINE_CHATS_KEY, normalized);
  return normalized;
}

function setOfflineChats(chats) {
  writeJson(OFFLINE_CHATS_KEY, chats);
}

function getOfflineMessages() {
  const normalized = normalizeOfflineMessages(readJson(OFFLINE_MESSAGES_KEY, {}));
  writeJson(OFFLINE_MESSAGES_KEY, normalized);
  return normalized;
}

function setOfflineMessages(messagesByChatId) {
  writeJson(OFFLINE_MESSAGES_KEY, messagesByChatId);
}

function queueOfflineOperation(operation) {
  const queue = readJson(OFFLINE_SYNC_QUEUE_KEY, []);
  queue.push(operation);
  writeJson(OFFLINE_SYNC_QUEUE_KEY, queue);
}

function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function withSource(items, source) {
  return items.map((item) => ({ ...item, source }));
}

function mergeChatsById(backendChats, localChats) {
  const map = new Map();
  localChats.forEach((chat) => map.set(chat.id, chat));
  backendChats.forEach((chat) => map.set(chat.id, chat));
  return [...map.values()];
}

async function apiJson(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function saveChatOffline(userId, chat) {
  const chats = getOfflineChats();
  const next = {
    id: chat.id || newId('chat'),
    userId,
    title: chat.title || 'Nuevo chat',
    createdAt: chat.createdAt || new Date().toISOString(),
    source: 'local',
  };

  const index = chats.findIndex((item) => item.id === next.id);
  if (index >= 0) chats[index] = { ...chats[index], ...next };
  else chats.push(next);
  setOfflineChats(chats);
  queueOfflineOperation({ type: 'saveChat', payload: next });

  return next;
}

async function getChatsOffline() {
  const chats = getOfflineChats();
  return withSource(chats, 'local');
}

async function getMessagesOffline(chatId) {
  const all = getOfflineMessages();
  return all[chatId] || [];
}

async function saveMessageOffline(message) {
  const all = getOfflineMessages();
  const current = all[message.chatId] || [];

  if (!current.some((item) => item.id === message.id)) {
    current.push(message);
    all[message.chatId] = current;
    setOfflineMessages(all);
    queueOfflineOperation({ type: 'saveMessage', payload: message });
  }

  return message;
}

async function deleteChatOffline(chatId) {
  const chats = getOfflineChats().filter((item) => item.id !== chatId);
  const messages = getOfflineMessages();
  delete messages[chatId];
  setOfflineChats(chats);
  setOfflineMessages(messages);
  queueOfflineOperation({ type: 'deleteChat', payload: { chatId } });
}

async function flushOfflineQueue(userId) {
  const queue = readJson(OFFLINE_SYNC_QUEUE_KEY, []);
  if (!queue.length || !appMode.backendAvailable) return;

  for (const operation of queue) {
    if (operation.type === 'saveChat') {
      await apiJson('/api/chats', {
        method: 'POST',
        body: JSON.stringify({ ...operation.payload, userId }),
      });
    }

    if (operation.type === 'saveMessage') {
      await apiJson('/api/messages', {
        method: 'POST',
        body: JSON.stringify(operation.payload),
      });
    }

    if (operation.type === 'deleteChat') {
      await apiJson(`/api/chats/${operation.payload.chatId}`, { method: 'DELETE' });
    }
  }

  writeJson(OFFLINE_SYNC_QUEUE_KEY, []);
}

export const storage = {
  async saveChat(userId, chat) {
    if (chat?.source === 'local') {
      return saveChatOffline(userId, chat);
    }

    if (!appMode.backendAvailable) {
      return saveChatOffline(userId, chat);
    }

    try {
      const payload = await apiJson('/api/chats', {
        method: 'POST',
        body: JSON.stringify({ userId, ...chat }),
      });
      return { ...payload.chat, source: 'backend' };
    } catch {
      return saveChatOffline(userId, chat);
    }
  },

  async getChats(userId) {
    const localChats = await getChatsOffline();
    if (!appMode.backendAvailable) return localChats;

    try {
      const payload = await apiJson(`/api/chats?userId=${encodeURIComponent(userId)}`);
      const backendChats = withSource(payload.chats || [], 'backend');
      return mergeChatsById(backendChats, localChats);
    } catch {
      return localChats;
    }
  },

  async getMessages(chatId) {
    const localMessages = await getMessagesOffline(chatId);
    if (!appMode.backendAvailable) {
      return localMessages;
    }

    try {
      const payload = await apiJson(`/api/chats/${encodeURIComponent(chatId)}/messages`);
      const backendMessages = payload.messages || [];
      if (backendMessages.length > 0) return backendMessages;
      return localMessages;
    } catch {
      return localMessages;
    }
  },

  async saveMessage(message) {
    if (message?.storageSource === 'local') {
      return saveMessageOffline(message);
    }

    if (!appMode.backendAvailable) {
      return saveMessageOffline(message);
    }

    try {
      const payload = await apiJson('/api/messages', {
        method: 'POST',
        body: JSON.stringify(message),
      });
      return payload.message;
    } catch {
      return saveMessageOffline(message);
    }
  },

  async deleteChat(chatId) {
    if (!appMode.backendAvailable) {
      return deleteChatOffline(chatId);
    }

    try {
      await apiJson(`/api/chats/${encodeURIComponent(chatId)}`, { method: 'DELETE' });
      return true;
    } catch {
      await deleteChatOffline(chatId);
      return false;
    }
  },

  async syncOfflineChats(userId) {
    if (!appMode.backendAvailable) return;
    try {
      await flushOfflineQueue(userId);
    } catch {
      // Keep queue for a future retry.
    }
  },
};

