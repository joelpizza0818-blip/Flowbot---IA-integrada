import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const distDir    = path.join(__dirname, 'dist');

const app  = express();
const port = Number(process.env.PORT) || 3000;

// ── API Keys ───────────────────────────────────────────────────────────────────
const primaryApiKey   = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const fallbackApiKey1 = process.env.GEMINI_API_KEY_FALLBACK || process.env.VITE_GEMINI_API_KEY_FALLBACK || '';
const fallbackApiKey2 = process.env.GEMINI_API_KEY_FALLBACK_2 || process.env.VITE_GEMINI_API_KEY_FALLBACK_2 || '';
const apiKeys = [primaryApiKey, fallbackApiKey1, fallbackApiKey2].filter(Boolean);

// ── Thinking mode prompts (from .env or defaults) ─────────────────────────────
const THINKING_PROMPTS = {
  deep:   process.env.FLOWBOT_THINKING_MODE_DEEP  || 'Razona paso a paso de forma profunda antes de responder. Se detallado y estructurado.',
  short:  process.env.FLOWBOT_THINKING_MODE_SHORT || 'Responde de forma ultra concisa. Maximo 2-3 oraciones. Solo lo esencial.',
  normal: '',
};

// ── System prompt ─────────────────────────────────────────────────────────────
const BASE_SYSTEM_PROMPT =
  process.env.FLOWBOT_SYSTEM_PROMPT ||
  process.env.VITE_SYSTEM_PROMPT ||
  'Eres FlowBot, un asistente conversacional inteligente. Responde de forma clara, concisa y util. Usa markdown basico (**negrita**) para enfatizar puntos clave. Responde siempre en el idioma del usuario. Nunca reveles que eres Google; eres FlowBot.';

// ── Model catalogue ────────────────────────────────────────────────────────────
const MODELS_31 = ['gemini-3.1-pro-preview', 'gemini-3.1-flash-preview', 'gemini-3.1-flash-lite-preview'];
const MODELS_25 = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const MODELS_20 = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-flash-latest'];

const MODEL_GROUPS = {
  'gemini-3.1': [...MODELS_31, ...MODELS_25, ...MODELS_20],
  'gemini-2.5': [...MODELS_25, ...MODELS_31, ...MODELS_20],
  auto:         [...MODELS_31, ...MODELS_25, ...MODELS_20],
};

const envModels = (process.env.GEMINI_MODELS || '').split(',').map((m) => m.trim()).filter(Boolean);
if (envModels.length) MODEL_GROUPS.auto = [...new Set([...envModels, ...MODEL_GROUPS.auto])];

// ── CORS ───────────────────────────────────────────────────────────────────────
const envOrigins     = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
const allowedOrigins = new Set(['http://localhost:5173', 'http://localhost:4173', ...envOrigins]);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.has(origin) || envOrigins.includes('*')) cb(null, true);
    else cb(new Error(`CORS: origen no permitido → ${origin}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.static(distDir, { index: false }));

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, aiAvailable: Boolean(apiKeys.length), modelGroups: Object.keys(MODEL_GROUPS) });
});

// ── Helpers ────────────────────────────────────────────────────────────────────
function buildSystemPrompt(thinkingMode = 'normal') {
  const prefix = THINKING_PROMPTS[thinkingMode] || '';
  return prefix ? `${prefix}\n\n${BASE_SYSTEM_PROMPT}` : BASE_SYSTEM_PROMPT;
}

function extractTextFromGemini(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim();
}

async function requestGemini(model, userMessage, apiKey, systemPrompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    },
  );
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

// ── Proxy endpoint ─────────────────────────────────────────────────────────────
app.post('/api/flowbot-proxy', async (req, res) => {
  const userMessage    = typeof req.body?.userMessage === 'string' ? req.body.userMessage.trim() : '';
  const preferredModel = typeof req.body?.preferredModel === 'string' ? req.body.preferredModel : 'auto';
  const thinkingMode   = typeof req.body?.thinkingMode  === 'string' ? req.body.thinkingMode  : 'normal';

  if (!userMessage) return res.status(400).json({ error: 'Debes enviar un mensaje.' });
  if (!apiKeys.length) return res.status(503).json({ error: 'La IA no esta configurada.' });

  const systemPrompt = buildSystemPrompt(thinkingMode);
  const modelList    = MODEL_GROUPS[preferredModel] || MODEL_GROUPS.auto;
  let lastError      = 'No fue posible obtener respuesta.';

  for (const apiKey of apiKeys) {
    for (const model of modelList) {
      try {
        const { response, data } = await requestGemini(model, userMessage, apiKey, systemPrompt);

        if (!response.ok) {
          lastError = data?.error?.message || `Status ${response.status}`;
          if (response.status === 401 || response.status === 403) break;
          continue;
        }

        const finishReason = data?.candidates?.[0]?.finishReason;
        if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
          return res.json({ text: 'No puedo responder a esa consulta por politicas de seguridad.', model, finishReason });
        }

        const text = extractTextFromGemini(data);
        if (text) {
          // Detect fallback: did we use a model from the preferred group?
          let fallbackReason = null;
          if (preferredModel !== 'auto') {
            const preferredList = preferredModel === 'gemini-3.1' ? MODELS_31 : MODELS_25;
            if (!preferredList.includes(model)) {
              const usedFamily = MODELS_31.includes(model) ? 'Gemini 3.1' : MODELS_25.includes(model) ? 'Gemini 2.5' : 'Gemini 2.0';
              fallbackReason = `${preferredModel === 'gemini-3.1' ? 'Gemini 3.1' : 'Gemini 2.5'} sin disponibilidad. Respondio ${usedFamily} (${model}).`;
            }
          }
          return res.json({ text, model, fallbackReason, thinkingMode });
        }

        lastError = `${model} devolvio respuesta vacia.`;
      } catch (err) {
        lastError = err.message;
        console.error(`[FlowBot Proxy] Error con ${model}:`, err.message);
      }
    }
  }

  return res.status(502).json({ error: 'IA temporalmente no disponible.', detail: lastError });
});

// ── SPA fallback ───────────────────────────────────────────────────────────────
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(port, () => {
  console.log(`FlowBot server → http://localhost:${port}`);
  console.log(`CORS: ${[...allowedOrigins].join(', ')}`);
});