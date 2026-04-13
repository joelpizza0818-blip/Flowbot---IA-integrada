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
const AUTH_STORAGE_KEY = 'flowbot.auth.user';
const GUEST_STORAGE_KEY = 'flowbot.guest.id';

function apiUrl(path) {
  if (!BACKEND_URL) return path;
  return `${BACKEND_URL}${path}`;
}

function getOrCreateGuestId() {
  const existing = localStorage.getItem(GUEST_STORAGE_KEY);
  if (existing) return existing;
  const generated = `guest-${crypto.randomUUID()}`;
  localStorage.setItem(GUEST_STORAGE_KEY, generated);
  return generated;
}

export function buildGuestProfile() {
  const guestId = getOrCreateGuestId();
  return {
    id: guestId,
    name: 'Guest User',
    email: `${guestId}@guest.local`,
    isGuest: true,
  };
}

export function getStoredAuthUser() {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredAuthUser(user) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredAuthUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

async function postAuth(path, body) {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Error de autenticación.');
  }
  const user = {
    id: payload?.user?.id,
    name: payload?.user?.name,
    email: payload?.user?.email,
    createdAt: payload?.user?.createdAt,
    isGuest: false,
  };
  setStoredAuthUser(user);
  return user;
}

export async function registerUser(credentials) {
  return postAuth('/api/auth/register', credentials);
}

export async function loginUser(credentials) {
  return postAuth('/api/auth/login', credentials);
}

export async function logoutUser() {
  clearStoredAuthUser();
  if (!appMode.backendAvailable) return true;

  try {
    await fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // Best effort: user session is local and already cleared.
  }

  return true;
}

export async function getCurrentUser() {
  if (!appMode.backendAvailable) {
    return buildGuestProfile();
  }
  return getStoredAuthUser();
}

