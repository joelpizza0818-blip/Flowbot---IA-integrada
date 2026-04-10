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

const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY || '',
  process.env.VITE_GEMINI_API_KEY || '',
  process.env.GEMINI_API_KEY_FALLBACK || '',
  process.env.VITE_GEMINI_API_KEY_FALLBACK || '',
  process.env.GEMINI_API_KEY_FALLBACK_2 || '',
  process.env.VITE_GEMINI_API_KEY_FALLBACK_2 || '',
].filter(Boolean);

const OPENROUTER_API_KEYS = [
  process.env.OPENROUTER_API_KEY || '',
  process.env.VITE_OPENROUTER_API_KEY || '',
  process.env.OPENROUTER_API_KEY_FALLBACK || '',
  process.env.VITE_OPENROUTER_API_KEY_FALLBACK || '',
  process.env.OPENROUTER_API_KEY_FALLBACK_2 || '',
  process.env.VITE_OPENROUTER_API_KEY_FALLBACK_2 || '',
].filter(Boolean);

const GROQ_API_KEYS = [
  process.env.GROQ_API_KEY || '',
  process.env.VITE_GROQ_API_KEY || '',
  process.env.GROQ_API_KEY_FALLBACK || '',
  process.env.VITE_GROQ_API_KEY_FALLBACK || '',
  process.env.GROQ_API_KEY_FALLBACK_2 || '',
  process.env.VITE_GROQ_API_KEY_FALLBACK_2 || '',
].filter(Boolean);

const PROVIDER_KEYS = {
  gemini: GEMINI_API_KEYS,
  openrouter: OPENROUTER_API_KEYS,
  groq: GROQ_API_KEYS,
};

const THINKING_PROMPTS = {
  deep: process.env.FLOWBOT_THINKING_MODE_DEEP || process.env.VITE_THINKING_MODE_DEEP || 'Razona paso a paso de forma profunda antes de responder. Se detallado y estructurado.',
  short: process.env.FLOWBOT_THINKING_MODE_SHORT || process.env.VITE_THINKING_MODE_SHORT || 'Responde de forma ultra concisa. Maximo 2-3 oraciones. Solo lo esencial.',
  normal: '',
};

const BASE_SYSTEM_PROMPT =
  process.env.FLOWBOT_SYSTEM_PROMPT ||
  process.env.VITE_SYSTEM_PROMPT ||
  'Eres FlowBot, un asistente conversacional inteligente. Responde de forma clara, concisa y util.';

const GEMINI_31_MODELS = ['gemini-3.1-pro-preview', 'gemini-3.1-flash-preview', 'gemini-3.1-flash-lite-preview'];
const GEMINI_25_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const GEMINI_20_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-flash-latest'];
const OPENROUTER_MODELS = ['openai/gpt-5.2', 'anthropic/claude-sonnet-4.5', 'google/gemini-3.1-pro-preview'];
const GROQ_MODELS = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b'];

const MODEL_GROUPS = {
  auto: [...GEMINI_31_MODELS, ...GEMINI_25_MODELS, ...GEMINI_20_MODELS, ...OPENROUTER_MODELS, ...GROQ_MODELS],
  'gemini-3.1': [...GEMINI_31_MODELS, ...GEMINI_25_MODELS, ...GEMINI_20_MODELS],
  'gemini-2.5': [...GEMINI_25_MODELS, ...GEMINI_31_MODELS, ...GEMINI_20_MODELS],
  openrouter: [...OPENROUTER_MODELS],
  groq: [...GROQ_MODELS],
};

const envOrigins = (process.env.CORS_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
const allowedOrigins = new Set(['http://localhost:5173', 'http://localhost:4173', ...envOrigins]);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.has(origin) || envOrigins.includes('*')) cb(null, true);
    else cb(new Error(`CORS: origen no permitido -> ${origin}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.static(distDir, { index: false }));

function buildSystemPrompt(thinkingMode = 'normal') {
  const prefix = THINKING_PROMPTS[thinkingMode] || '';
  return prefix ? `${prefix}\n\n${BASE_SYSTEM_PROMPT}` : BASE_SYSTEM_PROMPT;
}

function extractGeminiText(data) {
  if (typeof data?.text === 'string' && data.text.trim()) return data.text.trim();
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('').trim();
}

function extractOpenAiText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        return '';
      })
      .join('')
      .trim();
  }
  return '';
}

function buildOpenAiHeaders(apiKey) {
  const origin =
    process.env.OPENROUTER_HTTP_REFERER ||
    process.env.CORS_ORIGINS?.split(',').map((value) => value.trim()).find(Boolean) ||
    'http://localhost:5173';

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': origin,
    'X-Title': 'FlowBot',
    'X-OpenRouter-Title': 'FlowBot',
  };
}

function buildOpenAiBody(model, systemPrompt, userMessage) {
  return {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  };
}

async function requestProvider(provider, model, userMessage, apiKey, systemPrompt) {
  if (provider === 'gemini') {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
      },
    );
    const data = await response.json().catch(() => ({}));
    return { response, data, text: extractGeminiText(data) };
  }

  const endpoint = provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.groq.com/openai/v1/chat/completions';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildOpenAiHeaders(apiKey),
    body: JSON.stringify(buildOpenAiBody(model, systemPrompt, userMessage)),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data, text: extractOpenAiText(data) };
}

function getCandidates(preferredModel = 'auto') {
  return MODEL_GROUPS[preferredModel] || MODEL_GROUPS.auto;
}

function getProviderForModel(model) {
  if (GEMINI_31_MODELS.includes(model) || GEMINI_25_MODELS.includes(model) || GEMINI_20_MODELS.includes(model)) return 'gemini';
  if (OPENROUTER_MODELS.includes(model)) return 'openrouter';
  if (GROQ_MODELS.includes(model)) return 'groq';
  return 'unknown';
}

function getModelFamilyName(model) {
  if (GEMINI_31_MODELS.includes(model)) return 'Gemini 3.1';
  if (GEMINI_25_MODELS.includes(model)) return 'Gemini 2.5';
  if (GEMINI_20_MODELS.includes(model)) return 'Gemini 2.0';
  if (model === 'openai/gpt-5.2') return 'GPT 5.2';
  if (model === 'anthropic/claude-sonnet-4.5') return 'Claude Sonnet 4.5';
  if (model === 'google/gemini-3.1-pro-preview') return 'Gemini 3.1 Pro';
  if (model === 'openai/gpt-oss-120b') return 'GPT OSS 120B';
  if (model === 'llama-3.3-70b-versatile') return 'Llama 3.3 70B';
  if (model === 'openai/gpt-oss-20b') return 'GPT OSS 20B';
  return 'Modelo desconocido';
}

function getProviderErrorHint(provider, status, data) {
  const apiError = data?.error;
  const message = typeof apiError === 'string'
    ? apiError
    : typeof apiError?.message === 'string'
      ? apiError.message
      : '';

  if (provider === 'openrouter') {
    if (status === 401 || status === 403) {
      return 'La clave de OpenRouter parece invalida, revocada o sin permiso para este modelo.';
    }
    if (status === 402) {
      return 'La cuenta de OpenRouter no tiene creditos suficientes.';
    }
    if (status === 404) {
      return 'El modelo solicitado no existe o ya no esta disponible en OpenRouter.';
    }
    if (status === 429) {
      return 'OpenRouter esta limitando la tasa de peticiones. Espera un momento y prueba otra vez.';
    }
    if (status >= 500) {
      return 'OpenRouter tuvo un problema temporal con el proveedor de este modelo.';
    }
  }

  if (provider === 'groq') {
    if (status === 401 || status === 403) return 'La clave de Groq parece invalida o sin permisos.';
    if (status === 429) return 'Groq esta limitando la tasa de peticiones. Espera un momento y prueba otra vez.';
    if (status >= 500) return 'Groq tuvo un problema temporal con el proveedor de este modelo.';
  }

  if (message) return message;
  return `Status ${status}`;
}

function isPreferredModel(model, preferredModel) {
  if (preferredModel === 'auto') return true;
  const list = MODEL_GROUPS[preferredModel];
  if (!list) return true;
  return list.includes(model);
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    providers: {
      gemini: Boolean(GEMINI_API_KEYS.length),
      openrouter: Boolean(OPENROUTER_API_KEYS.length),
      groq: Boolean(GROQ_API_KEYS.length),
    },
  });
});

app.post('/api/flowbot-proxy', async (req, res) => {
  const userMessage = typeof req.body?.userMessage === 'string' ? req.body.userMessage.trim() : '';
  const preferredModel = typeof req.body?.preferredModel === 'string' ? req.body.preferredModel : 'auto';
  const thinkingMode = typeof req.body?.thinkingMode === 'string' ? req.body.thinkingMode : 'normal';

  if (!userMessage) return res.status(400).json({ error: 'Debes enviar un mensaje.' });

  const systemPrompt = buildSystemPrompt(thinkingMode);
  const candidates = getCandidates(preferredModel);
  let lastError = 'No fue posible obtener respuesta.';
  let lastErrorMeta = null;

  for (const model of candidates) {
    const provider = getProviderForModel(model);
    const apiKeys = PROVIDER_KEYS[provider] || [];

    for (let index = 0; index < apiKeys.length; index += 1) {
      const apiKey = apiKeys[index];
      try {
        const { response, data, text } = await requestProvider(provider, model, userMessage, apiKey, systemPrompt);

        if (!response.ok) {
          const hint = getProviderErrorHint(provider, response.status, data);
          lastError = hint;
          lastErrorMeta = {
            provider,
            model,
            apiKeyIndex: index + 1,
            status: response.status,
            error: data?.error || null,
            raw: data || null,
            hint,
          };
          console.warn(`[FlowBot Proxy] ${provider}/${model} key ${index + 1} -> ${response.status}: ${hint}`);
          if (response.status === 401 || response.status === 403) break;
          if (response.status === 429) await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        if (provider === 'gemini') {
          const finishReason = data?.candidates?.[0]?.finishReason;
          if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
            return res.json({ text: 'No puedo responder a esa consulta por politicas de seguridad.', model, finishReason });
          }
        }

        if (text) {
          const fallbackReason = isPreferredModel(model, preferredModel)
            ? null
            : `${preferredModel === 'auto' ? 'Auto' : preferredModel} sin disponibilidad. Respondio ${getModelFamilyName(model)} (${model}).`;
          return res.json({ text, model, fallbackReason, thinkingMode });
        }

        lastError = `${model} devolvio respuesta vacia.`;
      } catch (err) {
        lastError = err.message;
        lastErrorMeta = {
          provider,
          model,
          apiKeyIndex: index + 1,
          status: 0,
          error: err.message,
          hint: 'Error de red o de ejecucion en el servidor proxy.',
        };
        console.error(`[FlowBot Proxy] Error con ${provider}/${model}:`, err.message);
      }
    }
  }

  return res.status(502).json({
    error: 'IA temporalmente no disponible.',
    detail: lastError,
    meta: lastErrorMeta,
  });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`FlowBot server -> http://localhost:${port}`);
  console.log(`CORS: ${[...allowedOrigins].join(', ')}`);
});
