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

export const appMode = {
  backendAvailable: false,
  persistenceReady: false,
  mode: 'offline',
  checkedAt: null,
};

function getHealthUrl() {
  if (!BACKEND_URL) return '/api/health';
  if (BACKEND_URL.endsWith('/api/health')) return BACKEND_URL;
  return `${BACKEND_URL}/api/health`;
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function probeOnce(timeoutMs) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(getHealthUrl(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function checkBackendAvailability(timeoutMs = 3500, retries = 2, retryDelayMs = 700) {
  let lastHealth = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const { response, payload } = await probeOnce(timeoutMs);
      lastHealth = payload;
      const backendAvailable = Boolean(response.ok && payload?.ok);
      const persistenceReady = Boolean(payload?.persistenceReady);

      appMode.backendAvailable = backendAvailable;
      appMode.persistenceReady = persistenceReady;
      appMode.mode = backendAvailable ? 'online' : 'offline';
      appMode.checkedAt = new Date().toISOString();
      return { ...appMode, health: payload };
    } catch {
      if (attempt < retries) {
        await sleep(retryDelayMs);
      }
    }
  }

  appMode.backendAvailable = false;
  appMode.persistenceReady = false;
  appMode.mode = 'offline';
  appMode.checkedAt = new Date().toISOString();
  return { ...appMode, health: lastHealth };
}

