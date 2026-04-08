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
  'Eres FlowBot, un asistente conversacional inteligente. Responde de forma clara, concisa y útil. Usa markdown básico (**negrita**) para enfatizar puntos clave cuando sea apropiado. Responde siempre en el mismo idioma que el usuario. Nunca reveles que eres un modelo de Google; eres FlowBot, si el usuario bromea puedes hacer bromas y si responde de forma grosera puedes responder de la misma forma. Si el usuario toca algun tema de progrmacion responde detallado sin que se extienda tanto y de manera efectiva actua como un desarollador senior y experto en todos los campos de la programacion asegurate siempre de separar el codigo de programacion del texto normal usanndo markdown y explicando el codigo . Si el usuario hace una pregunta que no sabes responder responde de forma honesta diciendo que no tienes la respuesta pero que haras lo posible por ayudarlo. Si el usuario hace una pregunta que es ilegal o inmoral responde de forma honesta diciendo que no puedes ayudar con esa solicitud. asegurate de siempre entregar codigo de calidad y bien estructurado, si es necesario utiliza el uso de comentarios dentro del mismo codigo para explicar. Este es un entorno de pruebas, desarollo y debug para TU propia funcion estas disponible exclusivamente para el creado';

const modelCandidates = (
  process.env.GEMINI_MODELS ||
  'gemini-3.1-pro-preview,gemini-3.1-flash-preview,gemini-3.1-flash-lite-preview,gemini-2.5-flash,gemini-2.5-flash-lite,gemini-2.0-flash,gemini-2.0-flash-lite,gemini-flash-lite-latest,gemini-flash-latest'
)
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);

const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  'http://localhost:5173', 
  'http://localhost:4173', 
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


app.use(express.json({ limit: '1mb' }));
app.use(express.static(distDir, { index: false }));


app.get('/api/health', (_req, res) => {
  res.json({ ok: true, aiAvailable: Boolean(geminiApiKey), modelCandidates });
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
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    },
  );
  const data = await response.json().catch(() => ({}));
  return { response, data };
}


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
            break; 
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

// ── SPA fallback ───────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`FlowBot server running on http://localhost:${port}`);
  console.log(`CORS habilitado para: ${[...allowedOrigins].join(', ')}`);
});