import { buildRecentContextPrompt } from './contextPrompt';

// ── Constants ──────────────────────────────────────────────────────────────────
const AI_UNAVAILABLE_MESSAGE = 'El modelo de IA no esta disponible en este momento. Intenta de nuevo en unos minutos.';

// ── API Keys ───────────────────────────────────────────────────────────────────
const PRIMARY_API_KEY  = import.meta.env.VITE_GEMINI_API_KEY || '';
const FALLBACK_API_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY_FALLBACK  || '',
  import.meta.env.VITE_GEMINI_API_KEY_FALLBACK_2 || '',
].filter((k) => k && k.length > 0);
const API_KEYS = PRIMARY_API_KEY ? [PRIMARY_API_KEY, ...FALLBACK_API_KEYS] : FALLBACK_API_KEYS;

// ── Proxy ──────────────────────────────────────────────────────────────────────
const PROXY_BASE_URL = (import.meta.env.VITE_PROXY_URL || '').replace(/\/$/, '');

// ── System prompt (base) ───────────────────────────────────────────────────────
const BASE_SYSTEM_PROMPT =
  import.meta.env.VITE_SYSTEM_PROMPT ||
  'Eres FLOWBOT, asistente de IA especializado en tareas y programacion. IMPORTANTE: SIEMPRE completa tus respuestas. Si generas codigo, dejalo **100% funcional y completo**. Para consultas de codigo: muestra ejemplos claros y directos en bloques de codigo. Para otras tareas: se breve, usa Markdown y negritas. Nunca dejes respuestas incompletas.';

// ── Thinking mode prompts (from .env) ─────────────────────────────────────────
export const THINKING_MODES = {
  normal: {
    id:    'normal',
    label: 'Normal',
    desc:  'Respuestas balanceadas',
    prompt: '',
  },
  deep: {
    id:    'deep',
    label: 'Profundo',
    desc:  'Analisis detallado paso a paso',
    prompt: import.meta.env.VITE_THINKING_MODE_DEEP || 'Razona paso a paso de forma profunda antes de responder. Se detallado y estructurado.',
  },
  short: {
    id:    'short',
    label: 'Conciso',
    desc:  'Respuesta directa y breve',
    prompt: import.meta.env.VITE_THINKING_MODE_SHORT || 'Responde de forma ultra concisa. Maximo 2-3 oraciones. Solo lo esencial.',
  },
};

export function buildSystemPromptForMode(thinkingMode = 'normal') {
  const prefix = THINKING_MODES[thinkingMode]?.prompt || '';
  return prefix ? `${prefix}\n\n${BASE_SYSTEM_PROMPT}` : BASE_SYSTEM_PROMPT;
}

// ── Model groups ───────────────────────────────────────────────────────────────
const MODELS_31 = ['gemini-3.1-flash-lite-preview', 'gemini-3.1-flash-preview'];
const MODELS_25 = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const MODELS_20 = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-flash-latest'];

export const MODEL_GROUPS = {
  auto:        { label: 'Auto', models: [...MODELS_31, ...MODELS_25, ...MODELS_20] },
  'gemini-3.1': { label: 'Gemini 3.1', models: [...MODELS_31, ...MODELS_25, ...MODELS_20] },
  'gemini-2.5': { label: 'Gemini 2.5', models: [...MODELS_25, ...MODELS_31, ...MODELS_20] },
};

function isFromPreferredFamily(model, preferredGroup) {
  if (preferredGroup === 'auto') return true;
  if (preferredGroup === 'gemini-3.1') return MODELS_31.includes(model);
  if (preferredGroup === 'gemini-2.5') return MODELS_25.includes(model);
  return true;
}

function getModelFamilyName(model) {
  if (MODELS_31.includes(model)) return 'Gemini 3.1';
  if (MODELS_25.includes(model)) return 'Gemini 2.5';
  return 'Gemini 2.0';
}

// ── Fetch helpers ──────────────────────────────────────────────────────────────
function getProxyEndpoint() {
  if (!PROXY_BASE_URL) return '/api/flowbot-proxy';
  if (PROXY_BASE_URL.endsWith('/api/flowbot-proxy')) return PROXY_BASE_URL;
  return `${PROXY_BASE_URL}/api/flowbot-proxy`;
}

async function fetchJsonWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId  = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data     = await response.json().catch(() => ({}));
    return { response, data };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function extractGeminiText(data) {
  if (typeof data?.text === 'string' && data.text.trim()) return data.text.trim();
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim();
}

// ── Proxy fetch (passes preferredModel + thinkingMode to server) ───────────────
async function fetchGeminiViaProxy(userMessage, preferredModel = 'auto', thinkingMode = 'normal') {
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
      console.warn('[FlowBot AI] Proxy no disponible:', data?.error || response.statusText);
      return null;
    }

    const text = extractGeminiText(data);
    if (text) {
      const model        = data?.model || 'proxy';
      const fallbackNote = data?.fallbackReason || null;
      console.log(`[FlowBot AI] Proxy → ${model}${fallbackNote ? ` (fallback: ${fallbackNote})` : ''}`);
      return { text, model, fallbackReason: fallbackNote, source: 'proxy' };
    }
  } catch (err) {
    console.warn('[FlowBot AI] Proxy inaccesible:', err.message);
  }
  return null;
}

// ── Direct fetch (client-side, respects preferredModel order) ─────────────────
async function fetchGeminiDirect(userMessage, preferredModel = 'auto', thinkingMode = 'normal') {
  if (!API_KEYS.length) return null;

  const systemPrompt = buildSystemPromptForMode(thinkingMode);
  const modelList    = MODEL_GROUPS[preferredModel]?.models || MODEL_GROUPS.auto.models;

  for (const model of modelList) {
    for (const apiKey of API_KEYS) {
      try {
        const { response, data } = await fetchJsonWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemPrompt }] },
              contents:           [{ role: 'user', parts: [{ text: userMessage }] }],
              generationConfig:   { temperature: 0.7, maxOutputTokens: 4096 },
            }),
          },
          12000,
        );

        if (!response.ok) {
          const tag = response.status === 429 ? '(CUOTA AGOTADA)' : `(status ${response.status})`;
          console.warn(`[FlowBot AI] ${model} key ${API_KEYS.indexOf(apiKey) + 1} ${tag} → probando siguiente...`);
          if (response.status === 429) await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        const finishReason = data?.candidates?.[0]?.finishReason;
        if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
          return { text: 'No puedo responder a esa consulta por politicas de seguridad.', model, fallbackReason: null, source: 'direct' };
        }

        const parts = data?.candidates?.[0]?.content?.parts;
        const text  = Array.isArray(parts) ? parts.map((p) => p?.text || '').join('').trim() : '';
        if (text) {
          const notPreferred  = !isFromPreferredFamily(model, preferredModel);
          const fallbackReason = notPreferred
            ? `${MODEL_GROUPS[preferredModel]?.label || preferredModel} sin disponibilidad. Respondio ${getModelFamilyName(model)} (${model}).`
            : null;
          console.log(`[FlowBot AI] Direct → ${model}${fallbackReason ? ` | fallback: ${fallbackReason}` : ''}`);
          return { text, model, fallbackReason, source: 'direct' };
        }
      } catch (err) {
        console.warn(`[FlowBot AI] ${model} key ${API_KEYS.indexOf(apiKey) + 1} error:`, err.message);
      }
    }
  }
  return null;
}

// ── Public AI fetch (proxy first, then direct) ─────────────────────────────────
export async function fetchGeminiAI(userMessage, preferredModel = 'auto', thinkingMode = 'normal') {
  const proxyResult = await fetchGeminiViaProxy(userMessage, preferredModel, thinkingMode);
  if (proxyResult) return proxyResult;

  const directResult = await fetchGeminiDirect(userMessage, preferredModel, thinkingMode);
  if (directResult) return directResult;

  return { text: AI_UNAVAILABLE_MESSAGE, model: null, fallbackReason: null, source: null };
}

export async function getBotResponse(prompt, preferredModel = 'auto', thinkingMode = 'normal') {
  const result = await fetchGeminiAI(prompt, preferredModel, thinkingMode);
  return result?.text ?? AI_UNAVAILABLE_MESSAGE;
}

// ── Intent groups ──────────────────────────────────────────────────────────────
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
  { intentId: 'acciones_sistema', triggerKeywords: ['pantalla completa','fullscreen','f11','maximizar','ponlo grande','hazlo grande','poner pantalla completa','activar pantalla completa','entrar a pantalla completa','modo cine'], action: 'toggle_fullscreen', priority: 100 },
  { intentId: 'acciones_sistema', triggerKeywords: ['minimizar','colapsar','cerrar menu','abrir menu','sidebar','menu','saca el menu','quita el lateral','abre el lateral','esconder menu','ocultar lateral','mostrar lateral','barra lateral'], action: 'toggle_sidebar', priority: 100 },
  { intentId: 'acciones_sistema', triggerKeywords: ['recargar','refresh','refrescar','f5','reiniciar','da la lu de nuevo','actualiza','actualizar pagina','recargar sistema','f5 f5','resetear vista'], action: 'reload_page', priority: 100 },
  { intentId: 'acciones_sistema', triggerKeywords: ['imprimir','print','imprime esa vaina','sacar papel','pdf de esto','guardar como pdf','exportar a papel','imprimir chat','generar pdf','impresora','mandar a imprimir'], action: 'print_page', priority: 100 },
  { intentId: 'acciones_sistema', triggerKeywords: ['subir','ir arriba','ir al inicio','vete al tope','vete al inicio','vuela al comienzo','arranca arriba','volver al principio','arriba de todo','scroll up'], action: 'scroll_top', priority: 100 },
  { intentId: 'acciones_sistema', triggerKeywords: ['bajar','ir al final','bajar todo'], action: 'scroll_bottom', priority: 100 },
  { intentId: 'visualizar', triggerKeywords: ['reproducir video'], action: 'open_youtube', queryExtraction: true, urlTemplate: 'https://www.youtube.com/results?search_query={query}', fallbackUrl: 'https://www.youtube.com/', label: 'Abrir en YouTube', description: 'Se encontro contenido de video. Puedes verlo en YouTube.', priority: 30 },
  { intentId: 'visualizar', triggerKeywords: ['navegar en la web'], action: 'open_search', queryExtraction: true, urlTemplate: 'https://www.google.com/search?q={query}', fallbackUrl: 'https://www.google.com/', label: 'Buscar en Google', description: 'Busqueda preparada. Puedes continuar en Google.', priority: 30 },
  { intentId: 'automatizar', triggerKeywords: ['timer', 'temporizador', 'cronometro', 'cuenta regresiva'], action: 'set_timer', priority: 80 },
  { intentId: 'automatizar', triggerKeywords: null, action: 'respond_only', priority: 1 },
];

const searchIntroFillers = new Set([
  'en','de','el','la','los','las','un','una','sobre','para','por','con','a','e','o','u',
  'buscar','busca','busco','encuentra','muestra','quiero','ver','necesito','dame','dime',
]);

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/gu, ' ').trim();
}

function tokenizeWithPositions(text) {
  const tokens     = [];
  const normalized = normalize(text);
  for (const match of normalized.matchAll(/\S+/g)) {
    tokens.push({ normalized: match[0], start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

function matchKeywords(userMessage, keywords) {
  const normalizedMsg = normalize(userMessage);
  const words         = normalizedMsg.split(/\s+/).filter(Boolean);
  const matches       = [];
  const seen          = new Set();

  for (const keyword of keywords) {
    const normalizedKeyword = normalize(keyword);
    if (seen.has(normalizedKeyword)) continue;

    const isMatch = normalizedKeyword.includes(' ')
      ? normalizedMsg.includes(normalizedKeyword)
      : words.includes(normalizedKeyword);

    if (isMatch) { matches.push(keyword); seen.add(normalizedKeyword); }
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
  const tokens    = tokenizeWithPositions(text);
  let bestMatch   = null;

  for (let i = 0; i < tokens.length; i++) {
    for (const pattern of keywordPatterns) {
      const ok = pattern.normalizedWords.every((w, off) => tokens[i + off]?.normalized === w);
      if (!ok) continue;
      const last    = tokens[i + pattern.normalizedWords.length - 1];
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
  const bounds      = findFirstKeywordBounds(userMessage, patterns);
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

  const intents               = analyzeMessage(trimmed);
  if (!intents.length) return [];

  const actions               = [];
  const handledActions        = new Set();
  const intentsWithSpecific   = new Set();

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

    if (rule.action === 'respond_only') { intentsWithSpecific.add(rule.intentId); continue; }

    const actionResult = { action: rule.action, intentId: rule.intentId, label: rule.label, description: rule.description, query: '', hasQuery: false, url: rule.fallbackUrl || null };

    if (rule.queryExtraction) {
      const query        = extractQueryForIntent(trimmed, rule.intentId);
      actionResult.query    = query;
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
    const result            = await fetchGeminiAI(promptWithContext, preferredModel, thinkingMode);
    if (result?.text) {
      return {
        text:          result.text,
        intents:       [],
        actions:       [],
        isGreeting:    false,
        iconName:      'ayuda',
        model:         result.model,
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
  { id: 'toggle_fullscreen', label: 'Pantalla Completa', keywords: ['fullscreen','pantalla completa','modo cine'], icon: '🖥️' },
  { id: 'toggle_sidebar',    label: 'Minimizar',         keywords: ['minimizar','cerrar menú','sidebar'],         icon: '≡'  },
  { id: 'open_console',      label: '<console>',         keywords: ['console','<console>'],                       icon: '💻' },
  { id: 'reload_page',       label: 'Recargar',          keywords: ['recargar','refresh','actualizar'],            icon: '🔄' },
  { id: 'print_page',        label: 'Imprimir',          keywords: ['imprimir','print','pdf'],                     icon: '🖨️' },
  { id: 'scroll_top',        label: 'Ir Arriba',         keywords: ['subir','ir arriba','inicio'],                 icon: '⬆️' },
  { id: 'scroll_bottom',     label: 'Ir Abajo',          keywords: ['bajar','ir al final'],                        icon: '⬇️' },
  { id: 'open_search',       label: 'Buscar',            keywords: ['navegar'],                                    icon: '🔍' },
  { id: 'open_youtube',      label: 'Ver Video',         keywords: ['reproducir video'],                           icon: '📺' },
  { id: 'set_timer',         label: 'Timer',             keywords: ['timer','temporizador'],                       icon: '⏱️' },
];

export { availableActions, decisionRules, intentGroups };