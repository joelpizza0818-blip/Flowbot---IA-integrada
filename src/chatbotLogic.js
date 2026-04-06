import { buildRecentContextPrompt } from './contextPrompt';

const AI_UNAVAILABLE_MESSAGE =
  'El modelo de IA no esta disponible en este momento. Intenta de nuevo en unos minutos.';

  // filtro las keys y agrupo dentro de un array parra rotar facil
const PRIMARY_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const FALLBACK_API_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY_FALLBACK || '',
  import.meta.env.VITE_GEMINI_API_KEY_FALLBACK_2 || '',
].filter(key => key && key.length > 0);
const API_KEYS = PRIMARY_API_KEY ? [PRIMARY_API_KEY, ...FALLBACK_API_KEYS] : FALLBACK_API_KEYS;

const PROXY_BASE_URL = (import.meta.env.VITE_PROXY_URL || '').replace(/\/$/, '');
const SYSTEM_PROMPT =
  import.meta.env.VITE_SYSTEM_PROMPT ||
  'Eres FLOWBOT, asistente de IA especializado en tareas y programacion. IMPORTANTE: SIEMPRE completa tus respuestas. Si generas codigo, dejalo **100% funcional y completo**. Para consultas de codigo: muestra ejemplos claros y directos en bloques de codigo, explica que hace en forma concisa. Para codigo complejo (login, formularios, etc.): completa el codigo entero sin cortarlo. Si el usuario solicita codigo complejo, realiza el codigo completo y disminuye las palabras explicativas. Para otras tareas: se breve, usa Markdown y negritas. Nunca dejes respuestas incompletas o a mitad.';

const CLIENT_MODELS = [
  'gemini-3.1-flash-lite-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-flash-latest',
];

function getProxyEndpoint() {
  if (!PROXY_BASE_URL) return '/api/flowbot-proxy';
  if (PROXY_BASE_URL.endsWith('/api/flowbot-proxy')) return PROXY_BASE_URL;
  return `${PROXY_BASE_URL}/api/flowbot-proxy`;
}

async function fetchJsonWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function extractGeminiText(data) {
  if (typeof data?.text === 'string' && data.text.trim()) {
    return data.text.trim();
  }

  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

async function fetchGeminiViaProxy(userMessage) {
  try {
    const { response, data } = await fetchJsonWithTimeout(
      getProxyEndpoint(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage }),
      },
      4500,
    );

    if (!response.ok) {
      console.warn('[FlowBot AI] Proxy no disponible:', data?.error || response.statusText);
      return null;
    }

    const text = extractGeminiText(data);
    if (text) {
      console.log(`[FlowBot AI] Respuesta servida por ${data?.model || 'proxy'}.`);
      return text;
    }
  } catch (error) {
    console.warn('[FlowBot AI] Proxy inaccesible:', error.message);
  }

  return null;
}

async function fetchGeminiDirect(userMessage) {
  if (!API_KEYS || API_KEYS.length === 0) {
    return null;
  }

  for (const model of CLIENT_MODELS) {
    for (const apiKey of API_KEYS) {
      try {
        const { response, data } = await fetchJsonWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: {
                parts: [{ text: SYSTEM_PROMPT }],
              },
              contents: [
                {
                  role: 'user',
                  parts: [{ text: userMessage }],
                },
              ],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4096,
              },
            }),
          },
          12000,
        );

        if (!response.ok) {
          const statusMsg = response.status === 429 ? '(CUOTA AGOTADA)' : `(status ${response.status})`;
          console.warn(`[FlowBot AI] ${model} clave ${API_KEYS.indexOf(apiKey) + 1} ${statusMsg} -> probando siguiente...`);
          if (response.status === 429) {
            await new Promise((r) => setTimeout(r, 1000));
          }
          continue;
        }

        const finishReason = data?.candidates?.[0]?.finishReason;
        if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
          return 'No puedo responder a esa consulta por politicas de seguridad.';
        }

        const text = extractGeminiText(data);
        if (text) {
          console.log(`[FlowBot AI] Respuesta servida por ${model} (clave ${API_KEYS.indexOf(apiKey) + 1})`);
          return text;
        }
      } catch (error) {
        console.warn(`[FlowBot AI] ${model} clave ${API_KEYS.indexOf(apiKey) + 1} error: ${error.message} -> probando siguiente...`);
      }
    }
  }

  return null;
}

export async function fetchGeminiAI(userMessage) {
  const proxyText = await fetchGeminiViaProxy(userMessage);
  if (proxyText) return proxyText;

  const directText = await fetchGeminiDirect(userMessage);
  if (directText) return directText;

  return AI_UNAVAILABLE_MESSAGE;
}

export async function getBotResponse(prompt) {
  const result = await fetchGeminiAI(prompt);
  return result ?? "No puedo responder ahora mismo, intenta más tarde.";
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
    details:
      'Este grupo se activa unicamente para **navegar en la web** y **reproducir video**.',
  },
  {
    id: 'automatizar',
    name: 'Automatizar',
    iconName: 'automatizar',
    color: '#1e90ff',
    keywords: [
      'timer', 'automatizar', 'script', 'workflow',
    ],
    responses: [
      '**Modo automatizacion activado.** Ejecutando tarea programada.',
      '**Automatizacion en proceso.** Iniciando secuencia.',
      '**Operacion automatica ejecutada.** Completado.',
    ],
    details:
      'Este grupo se activa cuando el usuario quiere **ejecutar automaticas**. Cubre tareas programadas como timers y scripts.',
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
    details:
      'Este grupo se activa para controlar **funciones nativas del navegador** como abrir consola, pantalla completa, recargar o imprimir.',
  },
];

const decisionRules = [
  {
    intentId: 'acciones_sistema',
    triggerKeywords: ['pantalla completa', 'fullscreen', 'f11', 'maximizar', 'ponlo grande', 'hazlo grande', 'poner pantalla completa', 'activar pantalla completa', 'entrar a pantalla completa', 'modo cine'],
    action: 'toggle_fullscreen',
    priority: 100,
  },
  {
    intentId: 'acciones_sistema',
    triggerKeywords: ['minimizar', 'colapsar', 'cerrar menu', 'abrir menu', 'sidebar', 'menu', 'saca el menu', 'quita el lateral', 'abre el lateral', 'esconder menu', 'ocultar lateral', 'mostrar lateral', 'barra lateral'],
    action: 'toggle_sidebar',
    priority: 100,
  },
  {
    intentId: 'acciones_sistema',
    triggerKeywords: ['recargar', 'refresh', 'refrescar', 'f5', 'reiniciar', 'da la lu de nuevo', 'actualiza', 'actualizar pagina', 'recargar sistema', 'f5 f5', 'resetear vista'],
    action: 'reload_page',
    priority: 100,
  },
  {
    intentId: 'acciones_sistema',
    triggerKeywords: ['imprimir', 'print', 'imprime esa vaina', 'sacar papel', 'pdf de esto', 'guardar como pdf', 'exportar a papel', 'imprimir chat', 'generar pdf', 'impresora', 'mandar a imprimir'],
    action: 'print_page',
    priority: 100,
  },
  {
    intentId: 'acciones_sistema',
    triggerKeywords: ['subir', 'ir arriba', 'ir al inicio', 'vete al tope', 'vete al inicio', 'vuela al comienzo', 'arranca arriba', 'volver al principio', 'arriba de todo', 'scroll up'],
    action: 'scroll_top',
    priority: 100,
  },
  {
    intentId: 'acciones_sistema',
    triggerKeywords: ['bajar', 'ir al final', 'bajar todo'],
    action: 'scroll_bottom',
    priority: 100,
  },
  {
    intentId: 'visualizar',
    triggerKeywords: ['reproducir video'],
    action: 'open_youtube',
    queryExtraction: true,
    urlTemplate: 'https://www.youtube.com/results?search_query={query}',
    fallbackUrl: 'https://www.youtube.com/',
    label: 'Abrir en YouTube',
    description: 'Se encontro contenido de video. Puedes verlo en YouTube.',
    priority: 30,
  },
  {
    intentId: 'visualizar',
    triggerKeywords: ['navegar'],
    action: 'open_search',
    queryExtraction: true,
    urlTemplate: 'https://www.google.com/search?q={query}',
    fallbackUrl: 'https://www.google.com/',
    label: 'Buscar en Google',
    description: 'Busqueda preparada. Puedes abrirla en el navegador.',
    priority: 20,
  },
  {
    intentId: 'automatizar',
    triggerKeywords: ['timer', 'temporizador'],
    action: 'set_timer',
    queryExtraction: true,
    urlTemplate: null,
    fallbackUrl: null,
    label: null,
    description: 'Configurando temporizador.',
    priority: 50,
  },
  {
    intentId: 'automatizar',
    triggerKeywords: ['script', 'workflow', 'automatizar'],
    action: 'execute_automation',
    queryExtraction: true,
    urlTemplate: null,
    fallbackUrl: null,
    label: null,
    description: 'Ejecutando automatizacion.',
    priority: 50,
  },
  {
    intentId: 'automatizar',
    triggerKeywords: null,
    action: 'respond_only',
    queryExtraction: false,
    urlTemplate: null,
    fallbackUrl: null,
    label: null,
    description: null,
    priority: 0,
  },
  {
    intentId: 'acciones_sistema',
    triggerKeywords: ['console', '<console>'],
    action: 'open_console',
    queryExtraction: false,
    urlTemplate: null,
    fallbackUrl: null,
    label: null,
    description: 'Abriendo consola del navegador...',
    priority: 100,
  },
];

decisionRules.sort((a, b) => b.priority - a.priority);

const searchIntroFillers = new Set(
  [
    'quiero', 'quisiera', 'necesito', 'deseo', 'puedes', 'podria', 'podrias',
    'ayudame', 'ayudarme', 'me', 'mi', 'mis', 'esto', 'este', 'esta',
    'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'lo', 'la', 'las',
    'el', 'los', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'sobre',
    'acerca', 'favor', 'por',
  ].map(normalize),
);

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenizeWithPositions(text) {
  return [...text.matchAll(/[\p{L}\p{N}]+/gu)].map((match) => ({
    original: match[0],
    normalized: normalize(match[0]),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function matchKeywords(text, keywords) {
  const normalizedMsg = normalize(text);
  const words = normalizedMsg.split(/\s+/);
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
    .map((keyword) => ({
      keyword,
      normalizedWords: normalize(keyword).split(/\s+/).filter(Boolean),
    }))
    .sort((a, b) => b.normalizedWords.length - a.normalizedWords.length);
}

function findFirstKeywordBounds(text, keywordPatterns) {
  const tokens = tokenizeWithPositions(text);
  let bestMatch = null;

  for (let index = 0; index < tokens.length; index += 1) {
    for (const pattern of keywordPatterns) {
      const matchesPattern = pattern.normalizedWords.every(
        (word, offset) => tokens[index + offset]?.normalized === word,
      );
      if (!matchesPattern) continue;

      const lastToken = tokens[index + pattern.normalizedWords.length - 1];
      const currentMatch = { start: tokens[index].start, end: lastToken.end };

      if (
        !bestMatch ||
        currentMatch.start < bestMatch.start ||
        (currentMatch.start === bestMatch.start && currentMatch.end > bestMatch.end)
      ) {
        bestMatch = currentMatch;
      }
    }
  }

  return bestMatch;
}

function trimSearchQuery(query) {
  let cleanedQuery = query.trim().replace(/^[\s,.;:!?'"()]+/u, '');

  while (cleanedQuery) {
    const [firstToken] = tokenizeWithPositions(cleanedQuery);
    if (!firstToken || !searchIntroFillers.has(firstToken.normalized)) break;
    cleanedQuery = cleanedQuery.slice(firstToken.end).trim().replace(/^[\s,.;:!?'"()]+/u, '');
  }

  return cleanedQuery.replace(/[.,;:!?'"()]+$/u, '').trim();
}

function extractQueryForIntent(userMessage, intentId) {
  const patterns = keywordPatternsCache[intentId];
  if (!patterns) return '';

  const keywordBounds = findFirstKeywordBounds(userMessage, patterns);
  const rawCandidate = keywordBounds ? userMessage.slice(keywordBounds.end) : userMessage;
  const query = trimSearchQuery(rawCandidate);

  return query ? query : '';
}



export function analyzeMessage(userMessage) {
  return intentGroups
    .map((group) => {
      const matchedKeywords = matchKeywords(userMessage, group.keywords);
      if (matchedKeywords.length === 0) return null;
      return { ...group, matchedKeywords, response: pickRandomResponse(group.responses) };
    })
    .filter(Boolean);
}

export function resolveActions(userMessage) {
  const trimmed = userMessage.trim();
  if (!trimmed) return [];

  const intents = analyzeMessage(trimmed);
  if (intents.length === 0) return [];

  const actions = [];
  const handledActions = new Set();
  const intentsWithSpecificAction = new Set();

  for (const rule of decisionRules) {
    // Evitar duplicar la misma acción exacta en un mensaje
    if (handledActions.has(rule.action)) continue;

    const matchedIntent = intents.find((intent) => intent.id === rule.intentId);
    if (!matchedIntent) continue;

    let triggered = false;
    if (rule.triggerKeywords === null) {
      // Si es un fallback (trigKeywords null) y la intención ya activó algo específico, ignorar
      if (intentsWithSpecificAction.has(rule.intentId)) continue;
      triggered = true;
    } else {
      triggered = matchKeywords(trimmed, rule.triggerKeywords).length > 0;
    }

    if (!triggered) continue;

    if (rule.action === 'respond_only') {
      intentsWithSpecificAction.add(rule.intentId);
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
      if (query && rule.urlTemplate) {
        actionResult.url = rule.urlTemplate.replace('{query}', encodeURIComponent(query));
      }
    }

    actions.push(actionResult);
    handledActions.add(rule.action);
    intentsWithSpecificAction.add(rule.intentId);
  }

  return actions;
}

export async function generateBotResponse(userMessage, conversationHistory = []) {
  const trimmed = userMessage.trim();
  const intents = analyzeMessage(trimmed);

  if (intents.length === 0) {
    const promptWithContext = buildRecentContextPrompt(trimmed, conversationHistory);
    const geminiText = await fetchGeminiAI(promptWithContext);
    if (geminiText) {
      return {
        text: geminiText,
        intents: [],
        actions: [],
        isGreeting: false,
        iconName: 'ayuda',
      };
    }
  }

  if (intents.length === 0) {
    return {
      text: null,
      intents: [],
      actions: [],
      isGreeting: false,
      iconName: 'buscar',
    };
  }

  const actions = resolveActions(trimmed);

  return {
    text: null,
    intents,
    actions,
    isGreeting: false,
    iconName: null,
  };
}

const availableActions = [
  {
    id: 'toggle_fullscreen',
    label: 'Pantalla Completa',
    keywords: ['fullscreen', 'pantalla completa', 'modo cine'],
    icon: '🖥️',
  },
  {
    id: 'toggle_sidebar',
    label: 'Minimizar',
    keywords: ['minimizar', 'cerrar menú', 'sidebar'],
    icon: '≡',
  },
  {
    id: 'open_console',
    label: '<console>',
    keywords: ['console', '<console>'],
    icon: '💻',
  },
  {
    id: 'reload_page',
    label: 'Recargar',
    keywords: ['recargar', 'refresh', 'actualizar'],
    icon: '🔄',
  },
  {
    id: 'print_page',
    label: 'Imprimir',
    keywords: ['imprimir', 'print', 'pdf'],
    icon: '🖨️',
  },
  {
    id: 'scroll_top',
    label: 'Ir Arriba',
    keywords: ['subir', 'ir arriba', 'inicio'],
    icon: '⬆️',
  },
  {
    id: 'scroll_bottom',
    label: 'Ir Abajo',
    keywords: ['bajar', 'ir al final'],
    icon: '⬇️',
  },
  {
    id: 'open_search',
    label: 'Buscar',
    keywords: ['navegar'],
    icon: '🔍',
  },
  {
    id: 'open_youtube',
    label: 'Ver Video',
    keywords: ['reproducir video'],
    icon: '📺',
  },
  {
    id: 'set_timer',
    label: 'Timer',
    keywords: ['timer', 'temporizador'],
    icon: '⏱️',
  },
];

export {
  availableActions,
  decisionRules,
  intentGroups,
};
