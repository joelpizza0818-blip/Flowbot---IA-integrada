export const CONTEXT_WINDOW_SIZE = 6;

const CONTEXT_REFERENCE_PATTERNS = [
  /\b(eso|esa|ese|esto|esta|este|ello|aquello|ahi|alli)\b/u,
  /\b(lo anterior|mensaje anterior|respuesta anterior|de arriba|lo de arriba|lo ultimo|lo ultimo que dijiste)\b/u,
  /\b(en base a eso|basate en eso|sobre eso|con eso|de eso|a partir de eso)\b/u,
  /\b(hazlo|haz eso|usa eso|tomalo|retenlo|continualo|siguelo|retomalo|aplicalo)\b/u,
  /\b(continua|sigue|retoma|prosigue|dale)\b/u,
  /\b(explicalo|corrigelo|mejoralo|ajustalo|resumelo|reescribelo|reformulalo|simplificalo|acortalo|abrevia)\b/u,
  /\b(mas corto|mas breve|mas simple|menos texto|en menos palabras|sin tanto texto)\b/u,
  /\b(igual pero|ahora pero|otra vez pero)\b/u,
];

const ELLIPTICAL_TOPIC_PATTERN = /^(que|y)\s+[\p{L}\p{N}#+.-]+(?:\s+[\p{L}\p{N}#+.-]+){0,2}[?!:]*$/iu;
const SELF_CONTAINED_QUESTION_PATTERN = /\b(que es|que significa|que hace|como funciona|define|explica|dime|cual es)\b/u;

function normalizeConversationHistory(conversationHistory = []) {
  return Array.isArray(conversationHistory)
    ? conversationHistory
      .filter((message) => {
        const hasText = typeof message?.text === 'string' && message.text.trim();
        const hasValidSender = message?.sender === 'user' || message?.sender === 'bot';
        return hasText && hasValidSender;
      })
      .map((message) => ({
        sender: message.sender,
        text: message.text.trim(),
      }))
    : [];
}

function normalizeForMatching(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isLikelyEllipticalFollowUp(message) {
  if (!ELLIPTICAL_TOPIC_PATTERN.test(message)) {
    return false;
  }

  return !SELF_CONTAINED_QUESTION_PATTERN.test(message);
}

export function getContextWindowMessages(conversationHistory = [], contextWindowSize = CONTEXT_WINDOW_SIZE) {
  const normalizedHistory = normalizeConversationHistory(conversationHistory);
  if (normalizedHistory.length === 0) {
    return [];
  }

  const safeWindowSize = Math.max(1, Number(contextWindowSize) || CONTEXT_WINDOW_SIZE);
  return normalizedHistory.slice(-safeWindowSize);
}

export function getContextUsage(conversationHistory = [], contextWindowSize = CONTEXT_WINDOW_SIZE) {
  const safeWindowSize = Math.max(1, Number(contextWindowSize) || CONTEXT_WINDOW_SIZE);
  const contextMessages = getContextWindowMessages(conversationHistory, safeWindowSize);
  const usedSlots = Math.min(contextMessages.length, safeWindowSize);

  return {
    usedSlots,
    remainingSlots: Math.max(safeWindowSize - usedSlots, 0),
    contextMessages,
  };
}

export function shouldUseConversationContext(userMessage, conversationHistory = [], contextWindowSize = CONTEXT_WINDOW_SIZE) {
  const trimmed = typeof userMessage === 'string' ? userMessage.trim() : '';
  if (!trimmed) return false;

  const normalizedHistory = getContextWindowMessages(conversationHistory, contextWindowSize);
  const previousMessages = normalizedHistory.slice(0, -1);
  if (previousMessages.length === 0) {
    return false;
  }

  const normalizedMessage = normalizeForMatching(trimmed);

  return (
    CONTEXT_REFERENCE_PATTERNS.some((pattern) => pattern.test(normalizedMessage))
    || isLikelyEllipticalFollowUp(normalizedMessage)
  );
}

export function buildRecentContextPrompt(userMessage, conversationHistory = [], contextWindowSize = CONTEXT_WINDOW_SIZE) {
  const trimmed = typeof userMessage === 'string' ? userMessage.trim() : '';
  if (!trimmed) return '';

  const recentMessages = getContextWindowMessages(conversationHistory, contextWindowSize);
  const lastMessage = recentMessages[recentMessages.length - 1];

  if (!lastMessage || lastMessage.sender !== 'user') {
    return trimmed;
  }

  const previousMessages = recentMessages.slice(0, -1);
  if (previousMessages.length === 0) {
    return trimmed;
  }

  const contextBlock = previousMessages
    .map((message) => `${message.sender === 'user' ? 'Usuario' : 'FlowBot'}: ${message.text}`)
    .join('\n');

  const contextHint = shouldUseConversationContext(trimmed, recentMessages, contextWindowSize)
    ? 'El mensaje actual parece una continuacion o una edicion breve. Usa el historial para completar lo implicito.'
    : 'El mensaje actual parece autosuficiente. Responde directo y usa el historial solo si agrega claridad.';

  return [
    'Prioridad maxima: responde al mensaje actual del usuario.',
    'Relee los ultimos mensajes solo como apoyo contextual.',
    'Nunca dejes que el historial contradiga una instruccion explicita del mensaje actual.',
    contextHint,
    'Si el usuario pide acortar, resumir, corregir o continuar, aplica esa instruccion sobre el tema o la respuesta reciente mas relevante.',
    `Mensaje actual del usuario: ${trimmed}`,
    'Contexto reciente de apoyo:',
    contextBlock,
  ].join('\n');
}
