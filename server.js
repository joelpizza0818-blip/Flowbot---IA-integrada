import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

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
const modelCandidates = (process.env.GEMINI_MODELS ||
  'gemini-3.1-pro-preview,gemini-3.1-flash-preview,gemini-3.1-flash-lite-preview,gemini-2.5-flash,gemini-2.5-flash-lite,gemini-2.0-flash,gemini-2.0-flash-lite,gemini-flash-lite-latest,gemini-flash-latest')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function applyCorsHeaders(req, res) {
  const requestOrigin = req.headers.origin;
  if (!requestOrigin) return;

  if (corsOrigins.includes('*') || corsOrigins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', corsOrigins.includes('*') ? '*' : requestOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});
app.use(express.static(distDir, { index: false }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    aiAvailable: Boolean(geminiApiKey),
    modelCandidates,
  });
});

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
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    },
  );

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

app.post('/api/flowbot-proxy', async (req, res) => {
  const userMessage = typeof req.body?.userMessage === 'string' ? req.body.userMessage.trim() : '';

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
            break; // Salta a la siguiente clave API
          }

          if ([400, 429, 500, 503].includes(response.status)) {
            continue; // Intenta el siguiente modelo
          }

          continue;
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

app.get('*', (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`FlowBot server running on http://localhost:${port}`);
});
