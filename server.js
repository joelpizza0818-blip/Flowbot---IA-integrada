import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');

const app = express();
const port = Number(process.env.PORT) || 3000;

const primaryApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const fallbackApiKey1 = process.env.GEMINI_API_KEY_FALLBACK || process.env.VITE_GEMINI_API_KEY_FALLBACK || 'AIzaSyBPByzeKroMfdB2BPfmmxe6gfT_p-yxI6w';
const fallbackApiKey2 = process.env.GEMINI_API_KEY_FALLBACK_2 || process.env.VITE_GEMINI_API_KEY_FALLBACK_2 || 'AIzaSyBeY6mJ-Ci8O5c21YnwOHtSaPa-7MD2KKw';
const apiKeys = primaryApiKey ? [primaryApiKey, fallbackApiKey1, fallbackApiKey2] : [fallbackApiKey1, fallbackApiKey2];
const geminiApiKey = apiKeys[0] || '';

const systemPrompt =
  process.env.FLOWBOT_SYSTEM_PROMPT ||
  process.env.VITE_SYSTEM_PROMPT ||
  'Eres FLOWBOT, una IA de tareas basicas. Responde de forma breve, usando Markdown y negritas para enfatizar puntos clave.';

const modelCandidates = (
  process.env.GEMINI_MODELS ||
  'gemini-3.1-pro-preview,gemini-3.1-flash-preview,gemini-3.1-flash-lite-preview,gemini-2.5-flash,gemini-2.5-flash-lite,gemini-2.0-flash,gemini-2.0-flash-lite,gemini-flash-lite-latest,gemini-flash-latest'
)
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);

// ── CORS ─────────────────────────────────────────────────────────────────────
// Lee origenes extra desde env; siempre incluye el dev server de Vite.
const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  'http://localhost:5173',   // Vite dev server (puerto por defecto)
  'http://localhost:4173',   // Vite preview
  ...envOrigins,
]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite peticiones sin origin (curl, Postman, mismo servidor)
      if (!origin || allowedOrigins.has(origin) || envOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origen no permitido → ${origin}`));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }),
);
// ─────────────────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(express.static(distDir, { index: false }));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, aiAvailable: Boolean(geminiApiKey), modelCandidates });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractTextFromGemini(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

async function requestGemini(model, userMessage, apiKey) {
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
  const userMessage =
    typeof req.body?.userMessage === 'string' ? req.body.userMessage.trim() : '';

  if (!userMessage) {
    return res.status(400).json({ error: 'Debes enviar un mensaje para consultar el modelo.' });
  }
  if (!geminiApiKey) {
    return res.status(503).json({ error: 'La IA no esta configurada en el servidor.' });
  }

  let lastError = 'No fue posible obtener una respuesta del modelo.';

  for (const apiKey of apiKeys) {
    for (const model of modelCandidates) {
      try {
        const { response, data } = await requestGemini(model, userMessage, apiKey);

        if (!response.ok) {
          lastError = data?.error?.message || `Gemini devolvio status ${response.status}.`;

          if (response.status === 401 || response.status === 403) {
            console.warn(`[FlowBot Proxy] API key rechazada (${apiKey.slice(0, 10)}...)`);
            break; // Salta a la siguiente clave
          }
          continue; // Intenta el siguiente modelo
        }

        const finishReason = data?.candidates?.[0]?.finishReason;
        if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
          return res.json({
            text: 'No puedo responder a esa consulta por politicas de seguridad.',
            model,
            finishReason,
          });
        }

        const text = extractTextFromGemini(data);
        if (text) {
          return res.json({ text, model });
        }

        lastError = `El modelo ${model} devolvio una respuesta vacia.`;
      } catch (error) {
        lastError = error.message;
        console.error(`[FlowBot Proxy] Error con ${model}:`, error.message);
      }
    }
  }

  return res.status(502).json({
    error: 'El modelo de IA esta temporalmente no disponible.',
    detail: lastError,
  });
});

// ── SPA fallback ───────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`FlowBot server running on http://localhost:${port}`);
  console.log(`CORS habilitado para: ${[...allowedOrigins].join(', ')}`);
});