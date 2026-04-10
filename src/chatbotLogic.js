import { buildRecentContextPrompt } from './contextPrompt';

const AI_UNAVAILABLE_MESSAGE = 'El modelo de IA no esta disponible en este momento. Intenta de nuevo en unos minutos.';

const GEMINI_API_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY || '',
  import.meta.env.VITE_GEMINI_API_KEY_FALLBACK || '',
  import.meta.env.VITE_GEMINI_API_KEY_FALLBACK_2 || '',
].filter(Boolean);

const OPENROUTER_API_KEYS = [
  import.meta.env.VITE_OPENROUTER_API_KEY || '',
  import.meta.env.VITE_OPENROUTER_API_KEY_FALLBACK || '',
  import.meta.env.VITE_OPENROUTER_API_KEY_FALLBACK_2 || '',
].filter(Boolean);

const GROQ_API_KEYS = [
  import.meta.env.VITE_GROQ_API_KEY || '',
  import.meta.env.VITE_GROQ_API_KEY_FALLBACK || '',
  import.meta.env.VITE_GROQ_API_KEY_FALLBACK_2 || '',
].filter(Boolean);

const PROVIDER_KEYS = {
  gemini: GEMINI_API_KEYS,
  openrouter: OPENROUTER_API_KEYS,
  groq: GROQ_API_KEYS,
};

const PROXY_BASE_URL = (import.meta.env.VITE_PROXY_URL || '').replace(/\/$/, '');

const BASE_SYSTEM_PROMPT =
  import.meta.env.VITE_SYSTEM_PROMPT ||
  'Eres FLOWBOT, asistente de IA especializado en tareas y programacion. IMPORTANTE: SIEMPRE completa tus respuestas. Si generas codigo, dejalo 100% funcional y completo. Para consultas de codigo: muestra ejemplos claros y directos en bloques de codigo. Para otras tareas: se breve, usa Markdown y negritas. Nunca dejes respuestas incompletas.';

export const THINKING_MODES = {
  normal: {
    id: 'normal',
    label: 'Normal',
    desc: 'Respuestas balanceadas',
    prompt: '',
  },
  deep: {
    id: 'deep',
    label: 'Profundo',
    desc: 'Analisis detallado paso a paso',
    prompt: import.meta.env.VITE_THINKING_MODE_DEEP || 'Razona paso a paso de forma profunda antes de responder. Se detallado y estructurado.',
  },
  short: {
    id: 'short',
    label: 'Conciso',
    desc: 'Respuesta directa y breve',
    prompt: import.meta.env.VITE_THINKING_MODE_SHORT || 'Responde de forma ultra concisa. Maximo 2-3 oraciones. Solo lo esencial.',
  },
};

export function buildSystemPromptForMode(thinkingMode = 'normal') {
  const prefix = THINKING_MODES[thinkingMode]?.prompt || '';
  return prefix ? `${prefix}\n\n${BASE_SYSTEM_PROMPT}` : BASE_SYSTEM_PROMPT;
}

const GEMINI_31_MODELS = ['gemini-3.1-pro-preview', 'gemini-3.1-flash-preview', 'gemini-3.1-flash-lite-preview'];
const GEMINI_25_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const GEMINI_20_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-flash-latest'];
const OPENROUTER_MODELS = ['openai/gpt-5.2', 'anthropic/claude-sonnet-4.5', 'google/gemini-3.1-pro-preview'];
const GROQ_MODELS = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b'];

export const MODEL_GROUPS = {
  auto: { label: 'Auto', models: [...GEMINI_31_MODELS, ...GEMINI_25_MODELS, ...GEMINI_20_MODELS, ...OPENROUTER_MODELS, ...GROQ_MODELS] },
  'gemini-3.1': { label: 'Gemini 3.1', models: [...GEMINI_31_MODELS, ...GEMINI_25_MODELS, ...GEMINI_20_MODELS] },
  'gemini-2.5': { label: 'Gemini 2.5', models: [...GEMINI_25_MODELS, ...GEMINI_31_MODELS, ...GEMINI_20_MODELS] },
  openrouter: { label: 'GPT / Claude / Gemini', models: [...OPENROUTER_MODELS] },
  groq: { label: 'GPT OSS / Llama', models: [...GROQ_MODELS] },
};

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

export { getModelFamilyName };

function getFriendlyProxyError(data, response) {
  const status = response?.status || 0;
  const meta = data?.meta || {};
  const provider = meta.provider || 'proxy';
  const model = meta.model || 'desconocido';
  const hint = meta.hint || data?.detail || data?.error || response?.statusText || 'Error desconocido';

  if (status === 401 || status === 403) {
    return 'La clave configurada no es valida o no tiene permisos para OpenRouter/Groq. Revisa la API key.';
  }
  if (status === 402) {
    return 'OpenRouter indica que no hay creditos suficientes en la cuenta.';
  }
  if (status === 404) {
    return `El modelo solicitado no esta disponible. Probo ${model} en ${provider}.`;
  }
  if (status === 429) {
    return 'Se excedio el limite de solicitudes. Espera unos segundos y vuelve a intentar.';
  }
  if (status >= 500) {
    return `El proveedor respondio con un error temporal (${provider}/${model}). ${hint}`;
  }

  return `No fue posible contactar la IA. ${hint}`;
}

function isFromPreferredFamily(model, preferredGroup) {
  if (preferredGroup === 'auto') return true;
  const groupModels = MODEL_GROUPS[preferredGroup]?.models;
  if (!groupModels) return true;
  return groupModels.includes(model);
}

function getProxyEndpoint() {
  if (!PROXY_BASE_URL) return '/api/flowbot-proxy';
  if (PROXY_BASE_URL.endsWith('/api/flowbot-proxy')) return PROXY_BASE_URL;
  return `${PROXY_BASE_URL}/api/flowbot-proxy`;
}

async function fetchJsonWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } finally {
    window.clearTimeout(timeoutId);
  }
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
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost:5173';
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

async function fetchProviderModel(provider, model, userMessage, systemPrompt, apiKey) {
  if (!apiKey) return null;

  if (provider === 'gemini') {
    const { response, data } = await fetchJsonWithTimeout(
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
      12000,
    );
    return { response, data, text: extractGeminiText(data) };
  }

  const endpoint = provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.groq.com/openai/v1/chat/completions';

  const { response, data } = await fetchJsonWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: buildOpenAiHeaders(apiKey),
      body: JSON.stringify(buildOpenAiBody(model, systemPrompt, userMessage)),
    },
    12000,
  );

  return { response, data, text: extractOpenAiText(data) };
}

async function fetchProxyResponse(userMessage, preferredModel = 'auto', thinkingMode = 'normal') {
  try {
    const { response, data } = await fetchJsonWithTimeout(
      getProxyEndpoint(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage, preferredModel, thinkingMode }),
      },
      5000,
    );

    if (!response.ok) {
      const friendlyError = getFriendlyProxyError(data, response);
      console.warn('[FlowBot AI] Proxy error:', friendlyError, data?.meta || data?.detail || response.statusText);
      return {
        text: friendlyError,
        model: data?.meta?.model || data?.model || 'proxy',
        fallbackReason: data?.detail || data?.meta?.hint || null,
        source: 'proxy-error',
        error: true,
        status: response.status,
      };
    }

    const text = typeof data?.text === 'string' ? data.text.trim() : extractGeminiText(data) || extractOpenAiText(data);
    if (!text) {
      return {
        text: 'La IA respondió sin contenido. Prueba de nuevo en unos segundos.',
        model: data?.model || 'proxy',
        fallbackReason: data?.detail || null,
        source: 'proxy-error',
        error: true,
        status: 502,
      };
    }

    const model = data?.model || 'proxy';
    const fallbackReason = data?.fallbackReason || null;
    console.log(`[FlowBot AI] Proxy -> ${model}${fallbackReason ? ` (fallback: ${fallbackReason})` : ''}`);
    return { text, model, fallbackReason, source: 'proxy' };
  } catch (err) {
    console.warn('[FlowBot AI] Proxy inaccesible:', err.message);
    return {
      text: 'No se pudo conectar al proxy de IA. Verifica que el servidor este encendido.',
      model: 'proxy',
      fallbackReason: err.message,
      source: 'proxy-error',
      error: true,
      status: 0,
    };
  }
}

function getModelCandidates(preferredGroup = 'auto') {
  if (preferredGroup === 'auto') {
    return [
      ...GEMINI_31_MODELS.map((model) => ({ provider: 'gemini', model })),
      ...GEMINI_25_MODELS.map((model) => ({ provider: 'gemini', model })),
      ...GEMINI_20_MODELS.map((model) => ({ provider: 'gemini', model })),
      ...OPENROUTER_MODELS.map((model) => ({ provider: 'openrouter', model })),
      ...GROQ_MODELS.map((model) => ({ provider: 'groq', model })),
    ];
  }

  const groupModels = MODEL_GROUPS[preferredGroup]?.models || MODEL_GROUPS.auto.models;
  const provider = preferredGroup === 'openrouter' || preferredGroup === 'groq' ? preferredGroup : 'gemini';
  return groupModels.map((model) => ({ provider, model }));
}

async function fetchDirectResponse(userMessage, preferredModel = 'auto', thinkingMode = 'normal') {
  const systemPrompt = buildSystemPromptForMode(thinkingMode);
  const candidates = getModelCandidates(preferredModel);

  for (const { provider, model } of candidates) {
    const apiKeys = PROVIDER_KEYS[provider] || [];
    for (let index = 0; index < apiKeys.length; index += 1) {
      const apiKey = apiKeys[index];
      try {
        const { response, data, text } = await fetchProviderModel(provider, model, userMessage, systemPrompt, apiKey);

        if (!response.ok) {
          const tag = response.status === 429 ? '(cuota agotada)' : `(status ${response.status})`;
          console.warn(`[FlowBot AI] ${provider}/${model} key ${index + 1} ${tag} -> probando siguiente...`);
          if (response.status === 429) await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        if (provider === 'gemini') {
          const finishReason = data?.candidates?.[0]?.finishReason;
          if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
            return { text: 'No puedo responder a esa consulta por politicas de seguridad.', model, fallbackReason: null, source: 'direct' };
          }
        }

        if (text) {
          const fallbackReason = isFromPreferredFamily(model, preferredModel)
            ? null
            : `${MODEL_GROUPS[preferredModel]?.label || preferredModel} sin disponibilidad. Respondio ${getModelFamilyName(model)} (${model}).`;
          console.log(`[FlowBot AI] Direct -> ${getModelFamilyName(model)}${fallbackReason ? ` | fallback: ${fallbackReason}` : ''}`);
          return { text, model, fallbackReason, source: 'direct' };
        }
      } catch (err) {
        console.warn(`[FlowBot AI] ${provider}/${model} key ${index + 1} error:`, err.message);
      }
    }
  }

  return null;
}

export async function fetchGeminiAI(userMessage, preferredModel = 'auto', thinkingMode = 'normal') {
  const proxyResult = await fetchProxyResponse(userMessage, preferredModel, thinkingMode);
  if (proxyResult && !proxyResult.error) return proxyResult;

  const directResult = await fetchDirectResponse(userMessage, preferredModel, thinkingMode);
  if (directResult) return directResult;

  if (proxyResult) return proxyResult;

  return { text: AI_UNAVAILABLE_MESSAGE, model: null, fallbackReason: null, source: null };
}

export async function getBotResponse(prompt, preferredModel = 'auto', thinkingMode = 'normal') {
  const result = await fetchGeminiAI(prompt, preferredModel, thinkingMode);
  return result?.text ?? AI_UNAVAILABLE_MESSAGE;
}

const intentGroups = [
  {
    id: 'visualizar',
    name: 'Visualizar',
    iconName: 'visualizar',
    color: '#00d4ff',
    keywords: ['navegar en la web', 'reproducir video'],
    responses: [
      '**Visualizacion activada.** Listo para navegar en la web o reproducir video.',
      '**Entendido.** Preparando la accion visual solicitada.',
      '**Modo visual activo.** Ejecutando tu comando.',
    ],
    details: 'Este grupo se activa unicamente para **navegar en la web** y **reproducir video**.',
  },
  {
    id: 'automatizar',
    name: 'Automatizar',
    iconName: 'automatizar',
    color: '#1e90ff',
    keywords: ['timer', 'automatizar', 'script', 'workflow'],
    responses: [
      '**Modo automatizacion activado.** Ejecutando tarea programada.',
      '**Automatizacion en proceso.** Iniciando secuencia.',
      '**Operacion automatica ejecutada.** Completado.',
    ],
    details: 'Este grupo se activa cuando el usuario quiere **ejecutar tareas automaticas**. Cubre timers y scripts.',
  },
  {
    id: 'acciones_sistema',
    name: 'Acciones de Sistema',
    iconName: 'automatizar',
    color: '#7b00ff',
    keywords: [
      'console', '<console>', 'pantalla completa', 'fullscreen', 'recargar', 'refresh',
      'imprimir', 'print', 'scroll up', 'scroll down',
    ],
    responses: [
      '**Accion ejecutada.** Comando procesado',
      '**Control del sistema activado.** Procesando instruccion.',
      '**Operacion completada.**',
    ],
    details: 'Este grupo controla **funciones nativas del navegador** como pantalla completa, recargar o imprimir.',
  },
];

const decisionRules = [
  { intentId: 'acciones_sistema', triggerKeywords: ['pantalla completa', 'fullscreen', 'f11', 'maximizar', 'ponlo grande', 'hazlo grande', 'poner pantalla completa', 'activar pantalla completa', 'entrar a pantalla completa', 'modo cine'], action: 'toggle_fullscreen', priority: 100 },
  { intentId: 'acciones_sistema', triggerKeywords: ['minimizar', 'colapsar', 'cerrar menu', 'abrir menu', 'sidebar', 'menu', 'saca el menu', 'quita el lateral', 'abre el lateral', 'esconder menu', 'ocultar lateral', 'mostrar lateral', 'barra lateral'], action: 'toggle_sidebar', priority: 100 },
  { intentId: 'acciones_sistema', triggerKeywords: ['recargar', 'refresh', 'refrescar', 'f5', 'reiniciar', 'da la lu de nuevo', 'actualiza', 'actualizar pagina', 'recargar sistema', 'f5 f5', 'resetear vista'], action: 'reload_page', priority: 100 },
  { intentId: 'acciones_sistema', triggerKeywords: ['imprimir', 'print', 'imprime esa vaina', 'sacar papel', 'pdf de esto', 'guardar como pdf', 'exportar a papel', 'imprimir chat', 'generar pdf', 'impresora', 'mandar a imprimir'], action: 'print_page', priority: 100 },
  { intentId: 'acciones_sistema', triggerKeywords: ['subir', 'ir arriba', 'ir al inicio', 'vete al tope', 'vete al inicio', 'vuela al comienzo', 'arranca arriba', 'volver al principio', 'arriba de todo', 'scroll up'], action: 'scroll_top', priority: 100 },
  { intentId: 'acciones_sistema', triggerKeywords: ['bajar', 'ir al final', 'bajar todo'], action: 'scroll_bottom', priority: 100 },
  { intentId: 'visualizar', triggerKeywords: ['reproducir video'], action: 'open_youtube', queryExtraction: true, urlTemplate: 'https://www.youtube.com/results?search_query={query}', fallbackUrl: 'https://www.youtube.com/', label: 'Abrir en YouTube', description: 'Se encontro contenido de video. Puedes verlo en YouTube.', priority: 30 },
  { intentId: 'visualizar', triggerKeywords: ['navegar en la web'], action: 'open_search', queryExtraction: true, urlTemplate: 'https://www.google.com/search?q={query}', fallbackUrl: 'https://www.google.com/', label: 'Buscar en Google', description: 'Busqueda preparada. Puedes continuar en Google.', priority: 30 },
  { intentId: 'automatizar', triggerKeywords: ['timer', 'temporizador', 'cronometro', 'cuenta regresiva'], action: 'set_timer', priority: 80 },
  { intentId: 'automatizar', triggerKeywords: null, action: 'respond_only', priority: 1 },
];

const searchIntroFillers = new Set([
  'en', 'de', 'el', 'la', 'los', 'las', 'un', 'una', 'sobre', 'para', 'por', 'con', 'a', 'e', 'o', 'u',
  'buscar', 'busca', 'busco', 'encuentra', 'muestra', 'quiero', 'ver', 'necesito', 'dame', 'dime',
]);

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/gu, ' ').trim();
}

function tokenizeWithPositions(text) {
  const tokens = [];
  const normalized = normalize(text);
  for (const match of normalized.matchAll(/\S+/g)) {
    tokens.push({ normalized: match[0], start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

function matchKeywords(userMessage, keywords) {
  const normalizedMsg = normalize(userMessage);
  const words = normalizedMsg.split(/\s+/).filter(Boolean);
  const matches = [];
  const seen = new Set();

  for (const keyword of keywords) {
    const normalizedKeyword = normalize(keyword);
    if (seen.has(normalizedKeyword)) continue;

    const isMatch = normalizedKeyword.includes(' ')
      ? normalizedMsg.includes(normalizedKeyword)
      : words.includes(normalizedKeyword);

    if (isMatch) {
      matches.push(keyword);
      seen.add(normalizedKeyword);
    }
  }
  return matches;
}

function pickRandomResponse(responses) {
  return responses[Math.floor(Math.random() * responses.length)];
}

const keywordPatternsCache = {};
for (const group of intentGroups) {
  keywordPatternsCache[group.id] = group.keywords
    .map((kw) => ({ keyword: kw, normalizedWords: normalize(kw).split(/\s+/).filter(Boolean) }))
    .sort((a, b) => b.normalizedWords.length - a.normalizedWords.length);
}

function findFirstKeywordBounds(text, keywordPatterns) {
  const tokens = tokenizeWithPositions(text);
  let bestMatch = null;

  for (let i = 0; i < tokens.length; i += 1) {
    for (const pattern of keywordPatterns) {
      const ok = pattern.normalizedWords.every((w, off) => tokens[i + off]?.normalized === w);
      if (!ok) continue;
      const last = tokens[i + pattern.normalizedWords.length - 1];
      const current = { start: tokens[i].start, end: last.end };
      if (!bestMatch || current.start < bestMatch.start || (current.start === bestMatch.start && current.end > bestMatch.end)) bestMatch = current;
    }
  }
  return bestMatch;
}

function trimSearchQuery(query) {
  let q = query.trim().replace(/^[\s,.;:!?'"()]+/u, '');
  while (q) {
    const [first] = tokenizeWithPositions(q);
    if (!first || !searchIntroFillers.has(first.normalized)) break;
    q = q.slice(first.end).trim().replace(/^[\s,.;:!?'"()]+/u, '');
  }
  return q.replace(/[.,;:!?'"()]+$/u, '').trim();
}

function extractQueryForIntent(userMessage, intentId) {
  const patterns = keywordPatternsCache[intentId];
  if (!patterns) return '';
  const bounds = findFirstKeywordBounds(userMessage, patterns);
  const rawCandidate = bounds ? userMessage.slice(bounds.end) : userMessage;
  return trimSearchQuery(rawCandidate);
}

export function analyzeMessage(userMessage) {
  return intentGroups
    .map((group) => {
      const matched = matchKeywords(userMessage, group.keywords);
      if (!matched.length) return null;
      return { ...group, matchedKeywords: matched, response: pickRandomResponse(group.responses) };
    })
    .filter(Boolean);
}

export function resolveActions(userMessage) {
  const trimmed = userMessage.trim();
  if (!trimmed) return [];

  const intents = analyzeMessage(trimmed);
  if (!intents.length) return [];

  const actions = [];
  const handledActions = new Set();
  const intentsWithSpecific = new Set();

  for (const rule of decisionRules) {
    if (handledActions.has(rule.action)) continue;
    const intent = intents.find((i) => i.id === rule.intentId);
    if (!intent) continue;

    let triggered = false;
    if (rule.triggerKeywords === null) {
      if (intentsWithSpecific.has(rule.intentId)) continue;
      triggered = true;
    } else {
      triggered = matchKeywords(trimmed, rule.triggerKeywords).length > 0;
    }
    if (!triggered) continue;

    if (rule.action === 'respond_only') {
      intentsWithSpecific.add(rule.intentId);
      continue;
    }

    const actionResult = {
      action: rule.action,
      intentId: rule.intentId,
      label: rule.label,
      description: rule.description,
      query: '',
      hasQuery: false,
      url: rule.fallbackUrl || null,
    };

    if (rule.queryExtraction) {
      const query = extractQueryForIntent(trimmed, rule.intentId);
      actionResult.query = query;
      actionResult.hasQuery = Boolean(query);
      if (query && rule.urlTemplate) actionResult.url = rule.urlTemplate.replace('{query}', encodeURIComponent(query));
    }

    actions.push(actionResult);
    handledActions.add(rule.action);
    intentsWithSpecific.add(rule.intentId);
  }
  return actions;
}

export async function generateBotResponse(userMessage, conversationHistory = [], preferredModel = 'auto', thinkingMode = 'normal') {
  const trimmed = userMessage.trim();
  const intents = analyzeMessage(trimmed);

  if (intents.length === 0) {
    const promptWithContext = buildRecentContextPrompt(trimmed, conversationHistory);
    const result = await fetchGeminiAI(promptWithContext, preferredModel, thinkingMode);
    if (result?.text) {
      return {
        text: result.text,
        intents: [],
        actions: [],
        isGreeting: false,
        iconName: 'ayuda',
        model: result.model,
        fallbackReason: result.fallbackReason,
        thinkingMode,
      };
    }
  }

  if (intents.length === 0) {
    return { text: null, intents: [], actions: [], isGreeting: false, iconName: 'buscar', model: null, fallbackReason: null, thinkingMode };
  }

  const actions = resolveActions(trimmed);
  return { text: null, intents, actions, isGreeting: false, iconName: null, model: null, fallbackReason: null, thinkingMode };
}

const availableActions = [
  { id: 'toggle_fullscreen', label: 'Pantalla Completa', keywords: ['fullscreen', 'pantalla completa', 'modo cine'], icon: '🖥️' },
  { id: 'toggle_sidebar', label: 'Minimizar', keywords: ['minimizar', 'cerrar menu', 'sidebar'], icon: '≡' },
  { id: 'open_console', label: '<console>', keywords: ['console', '<console>'], icon: '💻' },
  { id: 'reload_page', label: 'Recargar', keywords: ['recargar', 'refresh', 'actualizar'], icon: '🔄' },
  { id: 'print_page', label: 'Imprimir', keywords: ['imprimir', 'print', 'pdf'], icon: '🖨️' },
  { id: 'scroll_top', label: 'Ir Arriba', keywords: ['subir', 'ir arriba', 'inicio'], icon: '⬆️' },
  { id: 'scroll_bottom', label: 'Ir Abajo', keywords: ['bajar', 'ir al final'], icon: '⬇️' },
  { id: 'open_search', label: 'Buscar', keywords: ['navegar'], icon: '🔍' },
  { id: 'open_youtube', label: 'Ver Video', keywords: ['reproducir video'], icon: '📺' },
  { id: 'set_timer', label: 'Timer', keywords: ['timer', 'temporizador'], icon: '⏱️' },
];

export { availableActions, decisionRules, intentGroups };
