import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import crypto from 'crypto';
import { getDbPool, getDbInfo, sql } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');

const app = express();
const port = Number(process.env.PORT) || 3000;

const memoryUsers = new Map();
const memoryChats = new Map();
const memoryMessages = new Map();

const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY || '',
  process.env.VITE_GEMINI_API_KEY || '',
  process.env.GEMINI_API_KEY_FALLBACK || '',
  process.env.VITE_GEMINI_API_KEY_FALLBACK || '',
  process.env.GEMINI_API_KEY_FALLBACK_2 || '',
  process.env.VITE_GEMINI_API_KEY_FALLBACK_2 || '',
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
const GROQ_MODELS = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b'];

const MODEL_GROUPS = {
  auto: [...GEMINI_31_MODELS, ...GEMINI_25_MODELS, ...GEMINI_20_MODELS, ...GROQ_MODELS],
  'gemini-3.1': [...GEMINI_31_MODELS, ...GEMINI_25_MODELS, ...GEMINI_20_MODELS],
  'gemini-2.5': [...GEMINI_25_MODELS, ...GEMINI_31_MODELS, ...GEMINI_20_MODELS],
  groq: [...GROQ_MODELS],
};

const envOrigins = (process.env.CORS_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
const allowedOrigins = new Set(['http://localhost:5173', 'http://localhost:4173','http://localhost:3000', ...envOrigins]);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.has(origin) || envOrigins.includes('*')) cb(null, true);
    else cb(new Error(`CORS: origen no permitido -> ${origin}`));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.static(distDir, { index: false }));

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  const left = Buffer.from(hash, 'hex');
  const right = Buffer.from(candidate, 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

async function isPersistenceReady() {
  const pool = await getDbPool();
  if (pool) return true;
  return false;
}

async function registerUser({ name, email, password }) {
  const pool = await getDbPool();
  if (!pool) {
    const id = `local-${crypto.randomUUID()}`;
    const user = {
      id,
      name,
      email,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    memoryUsers.set(email, user);
    return user;
  }

  const request = pool.request();
  request.input('Id', sql.NVarChar(128), `usr-${crypto.randomUUID()}`);
  request.input('Name', sql.NVarChar(150), name);
  request.input('Email', sql.NVarChar(200), email);
  request.input('PasswordHash', sql.NVarChar(256), hashPassword(password));
  const existing = await pool.request()
    .input('Email', sql.NVarChar(200), email)
    .query('SELECT TOP 1 Id FROM Users WHERE Email = @Email;');
  if (existing.recordset?.length) {
    throw new Error('El correo ya está registrado.');
  }
  const result = await request.query(`
    INSERT INTO Users (Id, Name, Email, PasswordHash, CreatedAt)
    VALUES (@Id, @Name, @Email, @PasswordHash, SYSUTCDATETIME());
    SELECT Id, Name, Email, CreatedAt FROM Users WHERE Id = @Id;
  `);
  return result.recordset?.[0] || null;
}

async function loginUser({ email, password }) {
  const pool = await getDbPool();
  if (!pool) {
    const localUser = memoryUsers.get(email);
    if (!localUser || !verifyPassword(password, localUser.passwordHash)) return null;
    return localUser;
  }

  const result = await pool.request()
    .input('Email', sql.NVarChar(200), email)
    .query('SELECT TOP 1 Id, Name, Email, PasswordHash, CreatedAt FROM Users WHERE Email = @Email;');
  const user = result.recordset?.[0];
  if (!user) return null;
  if (!verifyPassword(password, user.PasswordHash)) return null;
  return user;
}

async function listChats(userId) {
  const pool = await getDbPool();
  if (!pool) {
    return [...memoryChats.values()].filter((chat) => chat.userId === userId);
  }

  const request = pool.request();
  request.input('UserId', sql.NVarChar(128), userId);
  const result = await request.query(`
    SELECT Id, UserId, Title, CreatedAt
    FROM Chats
    WHERE UserId = @UserId
    ORDER BY CreatedAt ASC;
  `);
  return result.recordset || [];
}

async function saveChat({ id, userId, title }) {
  const pool = await getDbPool();
  if (!pool) {
    const chatId = id || `chat-${Date.now()}`;
    const next = {
      id: chatId,
      userId,
      title: title || 'Nuevo chat',
      createdAt: new Date().toISOString(),
    };
    memoryChats.set(chatId, next);
    return next;
  }

  const request = pool.request();
  request.input('Id', sql.NVarChar(128), id || null);
  request.input('UserId', sql.NVarChar(128), userId);
  request.input('Title', sql.NVarChar(200), title || 'Nuevo chat');
  const result = await request.query(`
    SET NOCOUNT ON;
    DECLARE @ChatId NVARCHAR(128) = COALESCE(@Id, CONVERT(NVARCHAR(128), NEWID()));
    IF EXISTS (SELECT 1 FROM Chats WHERE Id = @ChatId)
    BEGIN
      UPDATE Chats SET Title = @Title WHERE Id = @ChatId;
    END
    ELSE
    BEGIN
      INSERT INTO Chats (Id, UserId, Title, CreatedAt)
      VALUES (@ChatId, @UserId, @Title, SYSUTCDATETIME());
    END
    SELECT Id, UserId, Title, CreatedAt FROM Chats WHERE Id = @ChatId;
  `);
  return result.recordset?.[0] || null;
}

async function listMessages(chatId) {
  const pool = await getDbPool();
  if (!pool) {
    return memoryMessages.get(chatId) || [];
  }

  const request = pool.request();
  request.input('ChatId', sql.NVarChar(128), chatId);
  const result = await request.query(`
    SELECT Id, ChatId, Role, Content, [Timestamp]
    FROM Messages
    WHERE ChatId = @ChatId
    ORDER BY [Timestamp] ASC;
  `);
  return result.recordset || [];
}

async function saveMessage({ id, chatId, sender, text }) {
  const role = sender === 'assistant' ? 'assistant' : (sender || 'user');
  const content = text || '';
  const pool = await getDbPool();
  if (!pool) {
    const messageId = id || `${Date.now()}`;
    const next = { id: messageId, chatId, sender: role, text: content, time: new Date().toISOString() };
    const current = memoryMessages.get(chatId) || [];
    if (!current.some((item) => item.id === messageId)) {
      current.push(next);
      memoryMessages.set(chatId, current);
    }
    return next;
  }

  const request = pool.request();
  request.input('Id', sql.NVarChar(128), id || null);
  request.input('ChatId', sql.NVarChar(128), chatId);
  request.input('Role', sql.NVarChar(20), role);
  request.input('Content', sql.NVarChar(sql.MAX), content);
  const result = await request.query(`
    SET NOCOUNT ON;
    DECLARE @MessageId NVARCHAR(128) = COALESCE(@Id, CONVERT(NVARCHAR(128), NEWID()));
    IF NOT EXISTS (SELECT 1 FROM Messages WHERE Id = @MessageId)
    BEGIN
      INSERT INTO Messages (Id, ChatId, Role, Content, [Timestamp])
      VALUES (@MessageId, @ChatId, @Role, @Content, SYSUTCDATETIME());
    END
    SELECT Id, ChatId, Role, Content, [Timestamp] FROM Messages WHERE Id = @MessageId;
  `);
  const row = result.recordset?.[0] || null;
  if (!row) return null;
  return {
    id: row.Id,
    chatId: row.ChatId,
    sender: row.Role,
    text: row.Content,
    time: row.Timestamp,
  };
}

async function deleteChat(chatId) {
  const pool = await getDbPool();
  if (!pool) {
    memoryChats.delete(chatId);
    memoryMessages.delete(chatId);
    return true;
  }

  const request = pool.request();
  request.input('ChatId', sql.NVarChar(128), chatId);
  await request.query(`
    DELETE FROM Messages WHERE ChatId = @ChatId;
    DELETE FROM Chats WHERE Id = @ChatId;
  `);
  return true;
}

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

function getOpenAiEmbeddedError(data) {
  if (typeof data?.error?.message === 'string' && data.error.message.trim()) {
    return data.error.message.trim();
  }

  const choice = data?.choices?.[0];
  if (!choice) return '';

  if (choice.finish_reason === 'error') {
    return (
      choice?.message?.content ||
      choice?.delta?.content ||
      choice?.error?.message ||
      choice?.native_finish_reason ||
      'El proveedor devolvio un error durante la generacion.'
    ).toString().trim();
  }

  return '';
}

function buildOpenAiHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
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

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: buildOpenAiHeaders(apiKey),
    body: JSON.stringify(buildOpenAiBody(model, systemPrompt, userMessage)),
  });
  const data = await response.json().catch(() => ({}));
  return {
    response,
    data,
    text: extractOpenAiText(data),
    embeddedError: getOpenAiEmbeddedError(data),
  };
}

function getCandidates(preferredModel = 'auto') {
  return MODEL_GROUPS[preferredModel] || MODEL_GROUPS.auto;
}

function getProviderForModel(model) {
  if (GEMINI_31_MODELS.includes(model) || GEMINI_25_MODELS.includes(model) || GEMINI_20_MODELS.includes(model)) return 'gemini';
  if (GROQ_MODELS.includes(model)) return 'groq';
  return 'unknown';
}

function getModelFamilyName(model) {
  if (GEMINI_31_MODELS.includes(model)) return 'Gemini 3.1';
  if (GEMINI_25_MODELS.includes(model)) return 'Gemini 2.5';
  if (GEMINI_20_MODELS.includes(model)) return 'Gemini 2.0';
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

app.get('/api/health', async (_req, res) => {
  try {
    const pool = await getDbPool();
    const db = getDbInfo();
    const persistenceReady = Boolean(pool && db.connected);
    return res.json({
      ok: true,
      persistenceReady,
      db,
      providers: {
        gemini: Boolean(GEMINI_API_KEYS.length),
        groq: Boolean(GROQ_API_KEYS.length),
      },
      pid: process.pid,
      healthRevision: '2026-04-12-r3',
    });
  } catch (_error) {
    return res.json({
      ok: true,
      persistenceReady: false,
      db: getDbInfo(),
      providers: {
        gemini: Boolean(GEMINI_API_KEYS.length),
        groq: Boolean(GROQ_API_KEYS.length),
      },
      pid: process.pid,
      healthRevision: '2026-04-12-r3',
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!name) return res.status(400).json({ error: 'Nombre requerido.' });
    if (!email) return res.status(400).json({ error: 'Email requerido.' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

    const user = await registerUser({ name, email, password });
    return res.json({
      ok: true,
      user: {
        id: user.id || user.Id,
        name: user.name || user.Name,
        email: user.email || user.Email,
        createdAt: user.createdAt || user.CreatedAt,
      },
    });
  } catch (error) {
    const message = String(error.message || '');
    if (message.includes('ya está registrado') || message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Este correo ya existe.' });
    }
    return res.status(500).json({ error: message || 'No se pudo registrar.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email) return res.status(400).json({ error: 'Email requerido.' });
    if (!password) return res.status(400).json({ error: 'Contraseña requerida.' });

    const user = await loginUser({ email, password });
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas.' });
    return res.json({
      ok: true,
      user: {
        id: user.id || user.Id,
        name: user.name || user.Name,
        email: user.email || user.Email,
        createdAt: user.createdAt || user.CreatedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error de autenticacion.' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  return res.json({ ok: true });
});

app.get('/api/chats', async (req, res) => {
  try {
    const userId = typeof req.query?.userId === 'string' ? req.query.userId.trim() : '';
    if (!userId) return res.status(400).json({ error: 'userId requerido.' });
    const chats = await listChats(userId);
    return res.json({ ok: true, chats });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'No se pudieron listar chats.' });
  }
});

app.post('/api/chats', async (req, res) => {
  try {
    const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
    if (!userId) return res.status(400).json({ error: 'userId requerido.' });
    const id = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : 'Nuevo chat';
    const chat = await saveChat({ id, userId, title });
    return res.json({ ok: true, chat });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'No se pudo guardar chat.' });
  }
});

app.delete('/api/chats/:chatId', async (req, res) => {
  try {
    const chatId = String(req.params.chatId || '').trim();
    if (!chatId) return res.status(400).json({ error: 'chatId requerido.' });
    await deleteChat(chatId);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'No se pudo eliminar chat.' });
  }
});

app.get('/api/chats/:chatId/messages', async (req, res) => {
  try {
    const chatId = String(req.params.chatId || '').trim();
    if (!chatId) return res.status(400).json({ error: 'chatId requerido.' });
    const messages = await listMessages(chatId);
    const normalized = messages.map((row) => ({
      id: row.id || row.Id,
      chatId: row.chatId || row.ChatId,
      sender: row.sender || row.Role,
      text: row.text || row.Content,
      time: row.time || row.Timestamp,
    }));
    return res.json({ ok: true, messages: normalized });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'No se pudieron listar mensajes.' });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const message = await saveMessage(req.body || {});
    return res.json({ ok: true, message });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'No se pudo guardar el mensaje.' });
  }
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
        const { response, data, text, embeddedError } = await requestProvider(provider, model, userMessage, apiKey, systemPrompt);

        if (!response.ok || embeddedError) {
          const status = response.ok ? (data?.error?.code || 502) : response.status;
          const hint = embeddedError || getProviderErrorHint(provider, status, data);
          lastError = hint;
          lastErrorMeta = {
            provider,
            model,
            apiKeyIndex: index + 1,
            status,
            error: data?.error || null,
            raw: data || null,
            hint,
          };
          console.warn(`[FlowBot Proxy] ${provider}/${model} key ${index + 1} -> ${status}: ${hint}`);
          if (status === 401 || status === 403) break;
          if (status === 429) await new Promise((resolve) => setTimeout(resolve, 1000));
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
