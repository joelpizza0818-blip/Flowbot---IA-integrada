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
  'Eres FLOWBOT, una IA de tareas basicas. Responde de forma breve, usando Markdown y negritas para enfatizar puntos clave.';

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
                maxOutputTokens: 1024,
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
    id: 'crear',
    name: 'Crear',
    iconName: 'crear',
    color: '#2ed573',
    keywords: [
        'hazme','hazme eso','créame','creame eso',
  'quiero crear','quiero hacer','quiero armar',
  'vamos a crear','vamos a hacer',
  'genérame','generame eso',
  'dame uno nuevo','haz uno nuevo',
  'crea algo','inventa algo',
  'haz un ejemplo','créame un ejemplo',
  'escríbeme','escribeme algo',
  'hazme un código','haz un código',
  'crea un proyecto','arma algo',
  'inicia algo nuevo','arranca algo',
      'crear', 'generar', 'construir', 'fabricar', 'producir', 'desarrollar',
      'diseñar', 'elaborar', 'componer', 'redactar', 'escribir', 'formular',
      'inventar', 'innovar', 'idear', 'concebir', 'planificar', 'proyectar',
      'modelar', 'prototipar', 'bosquejar', 'esbozar', 'trazar', 'dibujar',
      'ilustrar', 'graficar', 'programar', 'codificar', 'implementar',
      'instanciar', 'inicializar', 'configurar', 'establecer', 'fundar',
      'inaugurar', 'lanzar', 'publicar', 'desplegar', 'nuevo', 'nueva',
      'añadir', 'agregar', 'insertar', 'incorporar', 'incluir', 'sumar',
      'adjuntar', 'anexar', 'complementar', 'ampliar', 'extender',
      'montar', 'armar', 'fabricar', 'componer', 'estructurar', 'maquetar',
      'dibujar', 'esbozar', 'bosquejar', 'trazar', 'diseñar', 'crear desde cero',
      'hazme una vaina', 'ponte a crear', 'arranca con eso', 'inicia el proyecto',
      'haz un draft', 'crea un template', 'genera un script', 'haz un boceto',
    ],
    responses: [
      '**Modo creación activado.** Preparando el entorno para construir lo que necesitas.',
      '**Listo para crear.** Dime los detalles y comenzaré a generar tu solicitud.',
      '**Iniciando proceso de creación.** Diseñando la estructura base para tu nuevo elemento.',
    ],
    details:
      'Este grupo se activa cuando el usuario quiere **crear, generar o construir algo nuevo**. Abarca desde escribir documentos y código hasta diseñar prototipos, lanzar proyectos y agregar nuevos elementos.',
  },
  {
    id: 'modificar',
    name: 'Modificar',
    iconName: 'modificar',
    color: '#eccc68',
    keywords: [
        'cambia eso','cambia eso ahí',
  'edita eso','edita eso rápido',
  'modifica eso','ajusta eso',
  'arregla eso','arregla eso ahí',
  'eso está mal','corrige eso',
  'mejóralo','mejoralo',
  'optimiza eso','ponlo mejor',
  'hazlo mejor','hazlo más limpio',
  'reorganiza eso','ordena eso',
  'ponlo bonito','dale estilo',
  'quita eso y pon esto',
  'cámbialo por esto','sustituye eso',
      'modificar', 'editar', 'cambiar', 'actualizar', 'alterar', 'transformar',
      'convertir', 'adaptar', 'ajustar', 'calibrar', 'afinar', 'optimizar',
      'mejorar', 'perfeccionar', 'refinar', 'pulir', 'corregir', 'enmendar',
      'rectificar', 'reparar', 'arreglar', 'solucionar', 'resolver', 'fixear',
      'parchear', 'patch', 'update', 'upgrade', 'migrar', 'refactorizar',
      'reestructurar', 'reorganizar', 'reordenar', 'renombrar', 'reasignar',
      'reubicar', 'mover', 'trasladar', 'intercambiar', 'sustituir',
      'reemplazar', 'permutar', 'rotar', 'voltear', 'invertir', 'escalar',
      'redimensionar', 'ampliar', 'reducir', 'comprimir', 'expandir',
      'formatear', 'resetear', 'hard reset', 'tune up', 'limpiar código',
      'refinar', 'estilizar', 'personalizar', 'customizar', 'ajuste fino',
      'rehabilitar', 'reformar', 'remodelar', 'restaurar', 'renovar',
      'modernizar', 'actualizar versión', 'darle mantenimiento', 'service',
      'puesta a punto', 'reparación', 'arreglo', 'ponlo nítido', 'ponlo mejor',
      'hazlo más liviano', 'hazlo más rápido',
    ],
    responses: [
      '**Modo edición activado.** Identificando los elementos a modificar según tu solicitud.',
      '**Preparando modificaciones.** Analizando la estructura actual para aplicar los cambios necesarios.',
      '**Cambios en proceso.** Optimizando y adaptando según tus especificaciones.',
    ],
    details:
      'Este grupo se activa cuando el usuario quiere **editar, actualizar o mejorar algo existente**. Incluye correcciones, optimizaciones, migraciones, refactorizaciones y cualquier tipo de transformación.',
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
    id: 'enviar',
    name: 'Enviar',
    iconName: 'enviar',
    color: '#70a1ff',
    keywords: [
        'mándame','mandame eso','envíame','envíame eso',
  'quiero enviar','quiero mandar','quiero compartir',
  'vamos a enviar','vamos a mandar',
  'dame eso','pásame eso','pásalo',
  'envía eso','manda eso','comparte eso',
  'envía el reporte','manda el archivo',
  'comparte el enlace','comparte el link',
  'envíalo por correo','mándalo por mail',
  'envíalo por whatsapp','mándalo por telegram',
  'envíalo a todos','mándalo a todos',
  'distribuye eso','reparte eso',
      'enviar', 'mandar', 'remitir', 'transmitir', 'transferir', 'compartir',
      'distribuir', 'difundir', 'propagar', 'emitir', 'publicar', 'postear',
      'subir', 'upload', 'exportar', 'despachar', 'entregar', 'repartir',
      'asignar', 'delegar', 'derivar', 'reenviar', 'forward', 'redirect',
      'sync', 'sincronizar', 'push', 'deploy', 'release', 'broadcast',
      'notificar por email', 'correo', 'mail', 'mensaje', 'sms', 'chat',
      'ping', 'webhook', 'api call', 'request', 'solicitud', 'petición',
      'telegram', 'whatsapp', 'notificar a todos', 'aviso masivo',
      'mándame eso', 'envíame el link', 'comparte el archivo', 'subir a la nube',
      'pásame el dato', 'dame lu por mail', 'envía el reporte', 'notificar',
      'transferencia de datos', 'comunicación externa', 'vía remota',
    ],
    responses: [
      '**Preparando envío.** Verificando los datos y el destino antes de transmitir.',
      '**Envío en proceso.** Estableciendo conexión y transfiriendo la información solicitada.',
      '**Mensaje preparado.** Configurando los canales de distribución para tu contenido.',
    ],
    details:
      'Este grupo se activa cuando el usuario quiere **enviar, compartir o distribuir información**. Incluye desde mensajes y correos hasta deploys, sincronizaciones y llamadas a APIs externas.',
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
    triggerKeywords: ['limpiar chat', 'borrar todo', 'vaciar chat', 'borrar historial', 'vuela el chat', 'reset chat', 'comenzar de cero', 'limpia todo el chat', 'borrar la conversación', 'reiniciar chat', 'vuela el historial', 'limpieza total'],
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
      'ver', 'mostrar', 'visualizar', 'consultar', 'explorar', 'examinar',
      'abrir', 'cargar', 'desplegar', 'presentar', 'exhibir', 'enseñar',
      'previsualizar', 'renderizar', 'proyectar',
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
    intentId: 'crear',
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
    intentId: 'modificar',
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
    intentId: 'enviar',
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

const conversationalFallbackGroups = [
  {
    id: 'saludos',
    name: 'Saludos',
    keywords: [
      'hola', 'hello', 'hi', 'hey', 'buenas', 'saludos', 'buen dia',
      'buen día', 'buenos dias', 'buenos días', 'buenas tardes',
      'buenas noches', 'holi', 'holis', 'hola hola', 'ey', 'eyy',
      'qué tal', 'que tal', 'qué hay', 'que hay', 'cómo estás',
      'como estas', 'cómo va', 'como va', 'todo bien', 'cómo amaneciste',
      'como amaneciste', 'qué cuentas', 'que cuentas', 'cómo todo',
      'como todo', 'que más', 'qué más', 'buen verte', 'un gusto',
    ],
  },
  {
    id: 'cortesia',
    name: 'Cortesía',
    keywords: [
      'gracias', 'muchas gracias', 'mil gracias', 'te lo agradezco',
      'agradecido', 'agradecida', 'se agradece', 'gracias totales',
      'por favor', 'porfa', 'porfis', 'porfa plis', 'porfis plis',
      'disculpa', 'discúlpame', 'disculpame', 'perdón', 'perdon',
      'permiso', 'con permiso', 'sorry', 'lo siento', 'te agradezco',
    ],
  },
  {
    id: 'afirmacion',
    name: 'Afirmación',
    keywords: [
      'si', 'sí', 'claro', 'vale', 'ok', 'okay', 'okey', 'de acuerdo',
      'correcto', 'entendido', 'perfecto', 'genial', 'excelente',
      'listo', 'dale', 'continua', 'continúa', 'va', 'va bien',
      'está bien', 'esta bien', 'todo bien', 'exacto', 'así es',
      'asi es', 'tal cual', 'me sirve', 'me va bien', 'funciona',
    ],
  },
  {
    id: 'negacion',
    name: 'Negación',
    keywords: [
      'no', 'nop', 'nope', 'negativo', 'para nada', 'todavia no',
      'todavía no', 'aun no', 'aún no', 'no gracias', 'mejor no',
      'olvidalo', 'olvídalo', 'descarta eso',
    ],
  },
  {
    id: 'relleno',
    name: 'Relleno Conversacional',
    keywords: [
      'oye', 'mira', 'bueno', 'pues', 'entonces', 'aja', 'ajá', 'mmm',
      'mm', 'eh', 'em', 'este', 'sabes', 'dime', 'cuentame', 'cuéntame',
      'a ver', 'veamos', 'pues nada', 'en fin', 'o sea', 'osea',
      'digamos', 'basicamente', 'básicamente', 'literal', 'tipo',
      'como que', 'más o menos', 'mas o menos',
    ],
  },
  {
    id: 'preguntas_comunes',
    name: 'Preguntas Comunes',
    keywords: [
      'cómo', 'como', 'qué es', 'que es', 'por qué', 'por que', 'para qué',
      'para que', 'dónde', 'donde', 'cuándo', 'cuando', 'cuál', 'cual',
      'cuánto', 'cuanto', 'quién', 'quien', 'qué pasa', 'que pasa',
      'qué onda', 'que onda', 'cómo así', 'como asi', 'qué sucede',
      'que sucede', 'qué ocurre', 'que ocurre', 'qué significa',
      'que significa', 'me explicas', 'me explicas eso',
    ],
  },
  {
    id: 'identidad_bot',
    name: 'Identidad del Bot',
    keywords: [
      'qué eres', 'que eres', 'quién eres', 'quien eres', 'qué haces',
      'que haces', 'qué puedes hacer', 'que puedes hacer', 'para qué sirves',
      'para que sirves', 'eres un bot', 'eres una ia', 'eres inteligencia artificial',
      'cómo funcionas', 'como funcionas', 'de qué tratas', 'de que tratas',
      'cuál es tu función', 'cual es tu funcion', 'quién te hizo',
      'quien te hizo', 'qué sabes hacer', 'que sabes hacer',
    ],
  },
  {
    id: 'estado_social',
    name: 'Estado y Trato',
    keywords: [
      'cómo estás', 'como estas', 'qué tal', 'que tal', 'cómo te va',
      'como te va', 'cómo andas', 'como andas', 'todo bien', 'cómo vas',
      'como vas', 'cómo va todo', 'como va todo', 'qué hay de nuevo',
      'que hay de nuevo', 'cómo sigues', 'como sigues', 'cómo va tu día',
      'como va tu dia',
    ],
  },
  {
    id: 'presentaciones',
    name: 'Presentaciones',
    keywords: [
      'me llamo', 'mi nombre es', 'soy', 'soy yo', 'mucho gusto',
      'encantado', 'encantada', 'un placer', 'a tus ordenes', 'a tus órdenes',
    ],
  },
  {
    id: 'reacciones',
    name: 'Reacciones',
    keywords: [
      'jaja', 'jeje', 'jojo', 'jajaja', 'jejeje', 'wow', 'guau', 'ups',
      'vaya', 'ah bueno', 'oh', 'ah', 'increible', 'increíble', 'genial',
      'cool', 'brutal', 'uff',
    ],
  },
  {
    id: 'despedidas',
    name: 'Despedidas',
    keywords: [
      'adiós', 'adios', 'chao', 'chau', 'nos vemos', 'hasta luego',
      'hasta pronto', 'bye', 'goodbye', 'hasta la próxima',
      'hasta la proxima', 'cuídate', 'cuidate', 'hablamos luego',
      'hablamos', 'me voy', 'ya me voy',
    ],
  },
];

const conversationalResponseRules = [
  {
    id: 'identity',
    keywords: [
      'qué eres', 'que eres', 'quién eres', 'quien eres', 'qué haces',
      'que haces', 'qué puedes hacer', 'que puedes hacer', 'para qué sirves',
      'para que sirves', 'eres un bot', 'eres una ia', 'eres inteligencia artificial',
      'cómo funcionas', 'como funcionas', 'qué sabes hacer', 'que sabes hacer',
    ],
    text:
      '**Soy FlowBot**, un asistente conversacional enfocado en detectar intenciones dentro de tus mensajes. Puedo ayudarte a **ver**, **buscar**, **crear**, **editar**, **enviar**, **proteger** y **automatizar** tareas.',
    iconName: 'ayuda',
  },
  {
    id: 'mood',
    keywords: [
      'cómo estás', 'como estas', 'qué tal', 'que tal', 'cómo te va',
      'como te va', 'cómo andas', 'como andas', 'cómo vas', 'como vas',
      'todo bien', 'cómo va todo', 'como va todo',
    ],
    text:
      '**Estoy bien y listo para ayudarte.** Si quieres, dime una acción concreta y seguimos: **ver**, **buscar**, **crear**, **editar** o **automatizar**.',
    iconName: 'ayuda',
  },
  {
    id: 'thanks',
    keywords: [
      'gracias', 'muchas gracias', 'mil gracias', 'te lo agradezco',
      'agradecido', 'agradecida', 'se agradece',
    ],
    text:
      '**Con gusto.** Si quieres, seguimos con otra consulta o con una tarea nueva.',
    iconName: 'ayuda',
  },
  {
    id: 'farewell',
    keywords: [
      'adiós', 'adios', 'chao', 'chau', 'nos vemos', 'hasta luego',
      'hasta pronto', 'bye', 'goodbye', 'cuídate', 'cuidate',
    ],
    text:
      '**Hasta luego.** Cuando quieras volver, aquí sigo para ayudarte con otra tarea.',
    iconName: 'ayuda',
  },
  {
    id: 'affirmation',
    keywords: [
      'ok', 'okay', 'okey', 'vale', 'de acuerdo', 'entendido',
      'perfecto', 'listo', 'dale', 'exacto',
    ],
    text:
      '**Perfecto.** Cuando quieras, dime la acción concreta y seguimos.',
    iconName: 'ayuda',
  },
];

const fallbackActionHints = [
  'ver', 'revisar', 'analizar', 'crear', 'generar', 'editar', 'actualizar',
  'buscar', 'encontrar', 'informar', 'documentar', 'enviar', 'compartir',
  'proteger', 'automatizar',
];

const noIntentFallbackResponses = [
  '**¡Oops!** No estoy preparado para eso todavía. Pero si usas palabras como ${hints}, puedo activar mis superpoderes.',
  '**¡Ups!** Eso me tomó por sorpresa. Intenta con acciones como ${hints} y verás la magia.',
  '**¡Vaya!** No supe qué hacer con eso. Prueba algo como ${hints} para que pueda ayudarte.',
  '**¡Oops!** Parece que mi radar de intenciones no captó nada. Usa verbos como ${hints}.',
  '**Eso no está en mi lista** de acciones reconocidas. Pero puedo trabajar con: ${hints}.',
  '**Hmm, eso no lo tengo en mi vocabulario.** Mis palabras mágicas son: ${hints}.',
  '**No encontré esa acción en mi repertorio.** Te cuento las que sí manejo: ${hints}.',
  '**Eso se escapa de mi diccionario.** Pero conozco bien estas: ${hints}.',
  '**Me quedé pensando...** y no logré descifrar qué necesitas. ¿Qué tal si pruebas con ${hints}?',
  '**Hmm, me agarraste fuera de base.** Prueba con verbos como ${hints} y estaré listo.',
  '**¿Eso qué fue?** Jaja, no lo entendí. Mejor intenta con: ${hints}.',
  '**Mi cerebro de bot hizo cortocircuito.** Reiniciando... Prueba con: ${hints}.',
  '**Error 404: intención no encontrada.** Pero tranqui, si dices algo como ${hints}, volvemos al ruedo.',
  '**¡Casi!** No detecté una acción clara, pero estoy seguro de que si usas ${hints}, lo lograremos.',
  '**No me rindo fácil,** pero necesito una pista. Prueba con: ${hints}.',
  '**Estoy listo para ayudarte,** solo necesito que uses palabras como: ${hints}.',
  '**¡Sigo aquí!** Solo necesito que me des una acción concreta: ${hints}.',
  '**No logré identificar una acción específica.** Prueba con: ${hints}.',
  '**No capté ninguna intención en tu mensaje.** Palabras clave que entiendo: ${hints}.',
  '**Tu mensaje no activó ningún grupo.** Las acciones que manejo son: ${hints}.',
  '**Soy un bot, no un adivino.** Pero si me dices algo con ${hints}, te sorprenderé.',
  '**Eso suena interesante, pero no sé qué hacer con ello.** Mis especialidades: ${hints}.',
  '**Si fuera humano, te pediría que lo repitas.** Como soy bot, te sugiero usar: ${hints}.',
  '**No nací ayer, pero tampoco entendí eso.** Intentemos de nuevo con: ${hints}.',
  '**¡Me dejaste en blanco!** Ayúdame a ayudarte usando: ${hints}.',
  '**Mi detector de intenciones se quedó en silencio.** Dale vida con: ${hints}.',
  '**Interesante... pero no tengo una respuesta para eso.** ¿Qué tal si pruebas con ${hints}?',
  '**Parece que hablamos idiomas distintos por ahora.** Mis palabras favoritas: ${hints}.',
  '**Eso no encaja en ninguna de mis categorías.** Pero si mencionas ${hints}, conecto enseguida.',
  '**Busqué en todos mis archivos y no encontré coincidencia.** Prueba estas: ${hints}.',
];

const greetingGroup = conversationalFallbackGroups.find((group) => group.id === 'saludos');

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

function getConversationalResponse(userMessage) {
  for (const rule of conversationalResponseRules) {
    if (matchKeywords(userMessage, rule.keywords).length > 0) {
      return { text: rule.text, iconName: rule.iconName };
    }
  }
  return null;
}

function getFallbackHintText() {
  return fallbackActionHints.map((hint) => `**${hint}**`).join(', ');
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
  if (!trimmed) {
    return {
      text: 'Por favor, escribe algo para que pueda ayudarte.',
      intents: [],
      actions: [],
      isGreeting: false,
      iconName: 'ayuda',
    };
  }

  const isGreeting = matchKeywords(trimmed, greetingGroup.keywords).length > 0;
  const intents = analyzeMessage(trimmed);
  const conversationalResponse = getConversationalResponse(trimmed);

  if (conversationalResponse && intents.length === 0) {
    return {
      text: conversationalResponse.text,
      intents: [],
      actions: [],
      isGreeting: isGreeting,
      iconName: conversationalResponse.iconName,
    };
  }

  if (isGreeting && intents.length === 0) {
    return {
      text: '**¡Hola! Soy FlowBot**, tu asistente inteligente. Puedo ayudarte con múltiples tareas como **visualizar datos**, **crear contenido**, **buscar información**, **automatizar procesos** y mucho más. Cuéntame qué necesitas.',
      intents: [],
      actions: [],
      isGreeting: true,
      iconName: 'ayuda',
    };
  }

  if (intents.length === 0) {
    // Intentar con Gemini AI (fetchGeminiAI ahora sí está definida)
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

    // Fallback clásico si la IA también falla
    const hints = getFallbackHintText();
    const template = pickRandomResponse(noIntentFallbackResponses);
    const text = template.replace('${hints}', hints);

    return {
      text,
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

export {
  conversationalFallbackGroups,
  conversationalResponseRules,
  decisionRules,
  fallbackActionHints,
  intentGroups,
};
