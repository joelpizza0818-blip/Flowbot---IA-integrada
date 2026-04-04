const AI_UNAVAILABLE_MESSAGE =
  'El modelo de IA no esta disponible en este momento. Intenta de nuevo en unos minutos.';

// Sistema de fallback para claves API
const API_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY || '',
  'AIzaSyA6FeBzvB6ADWQiWR4LHQzDvevmt121eGk',
  'AIzaSyCzk_OcnYpPRQOCX5J0IfiLhijsEB5YORI',
  'AIzaSyDKVYWW_9xp9elpogfpM6JoZarb4uYbOkg',
  'AIzaSyB6D4ydwqmKD9cB2dLflbgQWPVUf9Kg6uU',
].filter(key => key && key.length > 0);

const PUBLIC_API_KEY = API_KEYS[0] || '';
const PROXY_BASE_URL = (import.meta.env.VITE_PROXY_URL || '').replace(/\/$/, '');
const SYSTEM_PROMPT =
  import.meta.env.VITE_SYSTEM_PROMPT ||
  'Eres FLOWBOT, asistente de IA especializado en tareas y programación. IMPORTANTE: SIEMPRE completa tus respuestas. Si generas código, déjalo **100% funcional y completo**. Para consultas de código: muestra ejemplos claros y directos en bloques de código, explica qué hace en forma concisa. Para código complejo (login, formularios, etc.): completa el código entero sin cortarlo. Si el usuario solicita código complejo, realiza el código completo y disminuye las palabras explicativas. Para otras tareas: sé breve, usa Markdown y negritas. Nunca dejes respuestas incompletas o a mitad.';

const CLIENT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-light',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-flash-latest',
];

function getProxyEndpoint() {
  return PROXY_BASE_URL ? `${PROXY_BASE_URL}/api/flowbot-proxy` : '/api/flowbot-proxy';
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

  for (const apiKey of API_KEYS) {
    for (const model of CLIENT_MODELS) {
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
          console.warn(`[FlowBot AI] ${model} (clave ${API_KEYS.indexOf(apiKey) + 1}) respondio con status ${response.status}.`);
          continue;
        }

        const finishReason = data?.candidates?.[0]?.finishReason;
        if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
          return 'No puedo responder a esa consulta por politicas de seguridad.';
        }

        const text = extractGeminiText(data);
        if (text) {
          console.log(`[FlowBot AI] Respuesta directa por ${model} (clave ${API_KEYS.indexOf(apiKey) + 1}).`);
          return text;
        }
      } catch (error) {
        console.warn(`[FlowBot AI] Error directo con ${model} (clave ${API_KEYS.indexOf(apiKey) + 1}):`, error.message);
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
    keywords: [
        'ver eso','ver eso ahí','déjame ver','dejame ver','quiero ver',
  'muéstrame','muestrame','enséñame eso','enseñame eso',
  'quiero ver eso','quiero visualizar','quiero revisar',
  'ver detalles','ver info','ver información',
  'ver datos','ver resultados','ver reporte',
  'abre eso','abre eso ahí','abre eso pa ver',
  'pon eso','pon eso ahí','carga eso',
  'muéstralo','muestralo','enséñalo','enseñalo',
  'dame vista','vista previa','preview',
  'ver pantalla','ver dashboard','ver resumen',
  'quiero un overview','muéstrame el overview',
  'quiero ver un grafico','ver gráfica','ver grafico',
  'ver tabla','ver lista','ver mapa',
  'ver eso en video','busca video de eso',
  'quiero tutorial de eso','pon un tutorial',
      'ver', 'visualizar', 'mostrar', 'analizar', 'inspeccionar', 'observar',
      'revisar', 'explorar', 'examinar', 'consultar', 'mirar', 'chequear',
      'comprobar', 'verificar', 'detectar', 'descubrir', 'identificar',
      'reconocer', 'escanear', 'monitorear', 'rastrear', 'supervisar',
      'ver', 'mostrar', 'visualizar', 'consultar', 'explorar', 'examinar',
      'abrir', 'cargar', 'desplegar', 'presentar', 'exhibir', 'enseñar',
      'previsualizar', 'renderizar', 'proyectar', 'monitorear', 'pantalla',
      'reporte', 'informe', 'gráfico', 'grafico', 'tabla', 'mapa', 'dashboard',
      'estadísticas', 'estadisticas', 'KPIs', 'vista', 'look', 'watch', 'view',
      'show', 'read', 'scan', 'debug', 'monitor', 'panel', 'pizarra', 'grilla',
      'listado', 'inventario', 'catálogo', 'catalogo', 'vitrina', 'muéstrame',
      'muestrame', 'enséñame', 'enseñame', 'dame una vista', 'ponme el gráfico',
      'abre el panel', 'chequea los datos', 'mira esto', 'ver video', 'tutorial',
      'reproducir', 'video', 'youtube', 'ver tutorial', 'clip', 'filmación',
      'stream', 'en vivo', 'reproductor', 'multimedia', 'play', 'pausa',
      'adelanta', 'atrasa', 'volumen', 'pantalla completa',
    ],
    responses: [
      '**Modo Visualización activado.** Estoy procesando tu solicitud para mostrar la información relevante.',
      '**Entendido.** Preparando la vista de datos que necesitas.',
      '**Visualización en proceso.** Analizando los datos para presentarlos de la forma más clara posible.',
    ],
    details:
      'Este grupo se activa cuando el usuario quiere **ver, analizar o consultar información**. Incluye acciones como monitorear dashboards, revisar reportes, explorar datos y generar vistas previas. Si detecto una consulta clara, también puedo abrir una búsqueda en el navegador.',
  },
  {
    id: 'eliminar',
    name: 'Eliminar',
    iconName: 'eliminar',
    color: '#ff4757',
    keywords: [
        'borra eso','borra eso ahí','elimínalo','elimínalo todo',
  'quita eso','quita eso de ahí','saca eso',
  'desaparece eso','hazlo desaparecer',
  'no quiero eso','eso no va','eso fuera',
  'bórralo completo','elimínalo completo',
  'resetéalo','resetealo','reinicia eso',
  'déjalo limpio','limpia eso',
  'quita todo','vacía eso','vacía todo',
  'quita esa vaina','borra eso ahora',
      'eliminar', 'borrar', 'quitar', 'remover', 'suprimir', 'descartar',
      'deshacer', 'anular', 'cancelar', 'destruir', 'purgar', 'limpiar',
      'vaciar', 'depurar', 'erradicar', 'extirpar', 'extinguir',
      'liquidar', 'demoler', 'desmantelar', 'desinstalar', 'desactivar',
      'deshabilitar', 'revocar', 'invalidar', 'retirar', 'expulsar',
      'truncar', 'podar', 'recortar', 'drop', 'delete', 'remove',
      'clear', 'reset', 'wipe', 'flush', 'rollback', 'revertir',
      'deshacer cambios', 'restaurar original', 'formato fábrica',
      'borrar todo', 'eliminar registro', 'quitar acceso', 'desvincular',
      'aniquilar', 'borrado seguro', 'limpieza profunda', 'vaciar papelera',
      'quitar vaina', 'saca eso de ahí', 'borra esa vaina', 'limpia todo',
      'resetear sistema', 'formatear disco', 'desinstalar app', 'quitar permiso',
    ],
    responses: [
      '**Acción de eliminación detectada.** Por seguridad, confirmo: ¿deseas proceder con la eliminación?',
      '**Solicitud de borrado recibida.** Recuerda que esta acción puede ser irreversible. ¿Confirmas?',
      '**Modo eliminación.** Identificando los elementos a remover. Procederé con precaución.',
    ],
    details:
      'Este grupo se activa cuando el usuario quiere **eliminar, borrar o deshacer algo**. Incluye acciones destructivas que requieren confirmación, como purgar datos, desinstalar componentes o revertir cambios.',
  },


  {
    id: 'buscar',
    name: 'Buscar',
    iconName: 'buscar',
    color: '#7bed9f',
    keywords: [
        'búscame','buscame eso',
  'busca eso','búscalo',
  'encuéntrame','encuentrame eso',
  'quiero buscar','quiero encontrar',
  'dónde está','donde esta eso',
  'localiza eso','ubica eso',
  'googlea eso','búscalo en google',
  'investiga eso','averigua eso',
  'mira a ver','chequea eso',
  'encuentra info de','busca info de',
  'qué hay de','que hay de eso',
      'buscar', 'encontrar', 'localizar', 'ubicar', 'hallar', 'rastrear',
      'seguir', 'perseguir', 'cazar', 'filtrar', 'seleccionar', 'elegir',
      'escoger', 'optar', 'preferir', 'comparar', 'contrastar', 'diferenciar',
      'distinguir', 'separar', 'aislar', 'extraer', 'obtener', 'recuperar',
      'rescatar', 'descargar', 'importar', 'traer', 'fetch', 'query',
      'search', 'find', 'lookup', 'scan', 'crawl', 'indexar', 'navegar',
      'explorar datos', 'minería', 'scraping', 'parsing', 'regex',
      'coincidencia', 'match', 'patrón', 'criterio', 'condición',
      'dónde está', 'localiza eso', 'ubica eso', 'googlea eso', 'dame info de',
      'qué hay de', 'checa esto', 'mira a ver', 'investiga', 'averigua',
      'descubrir', 'detectar', 'identificar', 'reconocer', 'escanear',
      'inspeccionar', 'analizar', 'validar búsqueda', 'filtrar resultados',
      'ordenar por', 'agrupar por', 'buscar ahora', 'dame el dato',
    ],
    responses: [
      '**Búsqueda iniciada.** Escaneando todas las fuentes disponibles para encontrar lo que necesitas.',
      '**Rastreando información.** Aplicando filtros y criterios para localizar resultados precisos.',
      '**Motor de búsqueda activo.** Procesando tu consulta en múltiples fuentes de datos.',
    ],
    details:
      'Este grupo se activa cuando el usuario quiere **buscar, filtrar o localizar información específica**. Cubre desde búsquedas simples hasta minería de datos, scraping y consultas complejas con filtros.',
  },

  {
    id: 'proteger',
    name: 'Proteger',
    iconName: 'proteger',
    color: '#ff6b81',
    keywords: [
      'scan', 'encriptar',
    ],
    responses: [
      '**Modo protección activado.** Iniciando operación de seguridad.',
      '**Protocolo ejecutado.** Procesando comando de protección.',
      '**Operación completada.** Seguridad reforzada.',
    ],
    details:
      'Este grupo se activa cuando el usuario quiere **ejecutar acciones de seguridad**. Cubre scan de vulnerabilidades y encriptación de datos.',
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
      '**Modo automatización activado.** Ejecutando tarea programada.',
      '**Automatización en proceso.** Iniciando secuencia.',
      '**Operación automática ejecutada.** Completado.',
    ],
    details:
      'Este grupo se activa cuando el usuario quiere **ejecutar automáticas**. Cubre tareas programadas como timers y scripts.',
  },
  {
    id: 'acciones_sistema',
    name: 'Acciones de Sistema',
    iconName: 'automatizar',
    color: '#747d8c',
    keywords: [
      'console', '<console>', 'pantalla completa', 'fullscreen', 'recargar', 'refresh',
      'imprimir', 'print', 'scroll up', 'scroll down',
    ],
    responses: [
      '**Acción ejecutada.** Comando procesado',
      '**Control del sistema activado.** Procesando instrucción.',
      '**Operación completada.**',
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
    triggerKeywords: ['minimizar', 'colapsar', 'cerrar menú', 'abrir menú', 'sidebar', 'menú', 'menu', 'saca el menú', 'quita el lateral', 'abre el lateral', 'esconder menú', 'ocultar lateral', 'mostrar lateral', 'barra lateral'],
    action: 'toggle_sidebar',
    priority: 100,
  },
  {
    intentId: 'eliminar',
    triggerKeywords: ['limpiar chat', 'borrar todo', 'vaciar chat', 'borrar historial', 'vuela el chat', 'reset chat', 'comenzar de cero', 'limpia todo el chat', 'borrar la conversación', 'reiniciar chat', 'vuela el historial', 'limpieza total','clean chat', 'clear chart', 'reset chat', 'clear'],
    action: 'clear_chat',
    priority: 100,
  },
  {
    intentId: 'acciones_sistema',
    triggerKeywords: ['recargar', 'refresh', 'refrescar', 'f5', 'reiniciar', 'da la lu de nuevo', 'actualiza', 'actualizar página', 'recargar sistema', 'f5 f5', 'resetear vista'],
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
    triggerKeywords: ['ver video', 'ver tutorial', 'tutorial', 'reproducir', 'video', 'youtube'],
    action: 'open_youtube',
    queryExtraction: true,
    urlTemplate: 'https://www.youtube.com/results?search_query={query}',
    fallbackUrl: 'https://www.youtube.com/',
    label: 'Abrir en YouTube',
    description: 'Se encontró contenido de video. Puedes verlo en YouTube.',
    priority: 30,
  },
  {
    intentId: 'visualizar',
    triggerKeywords: [
      'ver',
    ],
    action: 'open_search',
    queryExtraction: true,
    urlTemplate: 'https://www.google.com/search?q={query}',
    fallbackUrl: 'https://www.google.com/',
    label: 'Buscar en Google',
    description: 'Búsqueda preparada. Puedes abrirla en el navegador.',
    priority: 20,
  },
  {
    intentId: 'visualizar',
    triggerKeywords: [
      'analizar', 'monitorear', 'supervisar', 'revisar', 'inspeccionar',
      'chequear', 'comprobar', 'verificar', 'detectar', 'escanear',
      'rastrear', 'observar', 'estudiar', 'investigar', 'indagar',
      'contemplar', 'identificar', 'reconocer', 'descubrir',
    ],
    action: 'background_search',
    queryExtraction: true,
    urlTemplate: null,
    fallbackUrl: null,
    label: null,
    description: 'Análisis realizado internamente.',
    priority: 10,
  },
  {
    intentId: 'buscar',
    triggerKeywords: [
      'buscar', 'encontrar', 'localizar', 'ubicar', 'hallar', 'search',
      'find', 'lookup', 'navegar', 'googlear',
    ],
    action: 'open_search',
    queryExtraction: true,
    urlTemplate: 'https://www.google.com/search?q={query}',
    fallbackUrl: 'https://www.google.com/',
    label: 'Buscar en Google',
    description: 'Búsqueda preparada. Puedes abrirla en el navegador.',
    priority: 20,
  },
  {
    intentId: 'buscar',
    triggerKeywords: [
      'filtrar', 'rastrear', 'extraer', 'scan', 'crawl', 'regex',
      'scraping', 'parsing', 'minería', 'indexar', 'seleccionar',
      'aislar', 'obtener', 'recuperar', 'fetch', 'query',
    ],
    action: 'background_search',
    queryExtraction: true,
    urlTemplate: null,
    fallbackUrl: null,
    label: null,
    description: 'Procesamiento interno completado.',
    priority: 10,
  },
  {
    intentId: 'eliminar',
    triggerKeywords: null,
    action: 'confirm_action',
    queryExtraction: false,
    urlTemplate: null,
    fallbackUrl: null,
    label: null,
    description: 'Esta acción requiere tu confirmación antes de proceder.',
    priority: 50,
  },

  {
    intentId: 'proteger',
    triggerKeywords: ['scan', 'encriptar'],
    action: 'execute_protection',
    queryExtraction: false,
    urlTemplate: null,
    fallbackUrl: null,
    label: null,
    description: 'Ejecutando protección.',
    priority: 50,
  },
  {
    intentId: 'proteger',
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
    intentId: 'automatizar',
    triggerKeywords: ['timer', 'script', 'workflow', 'automatizar'],
    action: 'execute_automation',
    queryExtraction: true,
    urlTemplate: null,
    fallbackUrl: null,
    label: null,
    description: 'Ejecutando automatización.',
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
  let cleanedQuery = query.trim().replace(/^[\s,.;:!?¡¿"']+/u, '');

  while (cleanedQuery) {
    const [firstToken] = tokenizeWithPositions(cleanedQuery);
    if (!firstToken || !searchIntroFillers.has(firstToken.normalized)) break;
    cleanedQuery = cleanedQuery.slice(firstToken.end).trim().replace(/^[\s,.;:!?¡¿"']+/u, '');
  }

  return cleanedQuery.replace(/[.,;:!?¡¿"']+$/u, '').trim();
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

export async function generateBotResponse(userMessage) {
  const trimmed = userMessage.trim();
  const intents = analyzeMessage(trimmed);

  if (intents.length === 0) {
    const geminiText = await fetchGeminiAI(trimmed);
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
    id: 'clear_chat',
    label: 'Limpiar Chat',
    keywords: ['limpiar', 'borrar todo', 'reset chat'],
    icon: '🗑️',
  },
  {
    id: 'open_search',
    label: 'Buscar',
    keywords: ['ver', 'buscar', 'google'],
    icon: '🔍',
  },
  {
    id: 'open_youtube',
    label: 'Ver Video',
    keywords: ['ver video', 'youtube', 'video'],
    icon: '📺',
  },
  {
    id: 'system_scan',
    label: 'Escanear',
    keywords: ['scan', 'escanear'],
    icon: '🔎',
  },
  {
    id: 'data_encryption',
    label: 'Encriptar',
    keywords: ['encriptar', 'cifrar'],
    icon: '🔐',
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
