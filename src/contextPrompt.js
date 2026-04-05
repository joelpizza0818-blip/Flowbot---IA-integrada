export const CONTEXT_WINDOW_SIZE = 3;

const CONTEXT_REFERENCE_PATTERNS = [
  /\b(eso|esa|ese|esto|esta|este|ello|aquello)\b/u,
  /\b(lo anterior|mensaje anterior|respuesta anterior|de arriba)\b/u,
  /\b(en base a eso|basate en eso|sobre eso|con eso|de eso)\b/u,
  /\b(hazlo|haz eso|usa eso|tomalo|retienelo|continualo|continúalo|sigelo|síguelo|retomalo|retómalo)\b/u,
  /\b(continua|continúa|sigue|retoma|prosigue|dale)\b/u,
  /\b(explicalo|explícalo|corrigelo|corrígelo|mejoralo|mejóralo|ajustalo|ajústalo|resumelo|resúmelo)\b/u,
];

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

export function getContextWindowMessages(conversationHistory = []) {
  const normalizedHistory = normalizeConversationHistory(conversationHistory);
  const userIndexes = normalizedHistory.reduce((indexes, message, index) => {
    if (message.sender === 'user') {
      indexes.push(index);
    }
    return indexes;
  }, []);

  if (userIndexes.length === 0) {
    return [];
  }

  const firstIncludedUserIndex = userIndexes[Math.max(0, userIndexes.length - CONTEXT_WINDOW_SIZE)];
  return normalizedHistory.slice(firstIncludedUserIndex);
}

export function getContextUsage(conversationHistory = []) {
  const contextMessages = getContextWindowMessages(conversationHistory);
  const usedSlots = Math.min(
    contextMessages.filter((message) => message.sender === 'user').length,
    CONTEXT_WINDOW_SIZE,
  );

  return {
    usedSlots,
    remainingSlots: Math.max(CONTEXT_WINDOW_SIZE - usedSlots, 0),
    contextMessages,
  };
}

export function shouldUseConversationContext(userMessage, conversationHistory = []) {
  const trimmed = typeof userMessage === 'string' ? userMessage.trim() : '';
  if (!trimmed) return false;

  const normalizedHistory = getContextWindowMessages(conversationHistory);
  const previousMessages = normalizedHistory.slice(0, -1);
  if (previousMessages.length === 0) {
    return false;
  }

  const normalizedMessage = trimmed.toLowerCase();
  return CONTEXT_REFERENCE_PATTERNS.some((pattern) => pattern.test(normalizedMessage));
}

export function buildRecentContextPrompt(userMessage, conversationHistory = []) {
  const trimmed = typeof userMessage === 'string' ? userMessage.trim() : '';
  if (!trimmed) return '';

  const recentMessages = getContextWindowMessages(conversationHistory);
  const lastMessage = recentMessages[recentMessages.length - 1];

  if (!lastMessage || lastMessage.sender !== 'user') {
    return trimmed;
  }

  if (!shouldUseConversationContext(trimmed, recentMessages)) {
    return trimmed;
  }

  const previousMessages = recentMessages.slice(0, -1);
  if (previousMessages.length === 0) {
    return trimmed;
  }

  const contextBlock = previousMessages
    .map((message) => `${message.sender === 'user' ? 'Usuario' : 'FlowBot'}: ${message.text}`)
    .join('\n');

  return [
    'Prioridad maxima: responde al mensaje actual del usuario.',
    'Usa el contexto reciente solo si ayuda a interpretar referencias explicitas o una continuacion pedida por el usuario.',
    'Si el mensaje actual se entiende por si solo, ignora el contexto.',
    `Mensaje actual del usuario: ${trimmed}`,
    'Contexto reciente de apoyo:',
    contextBlock,
  ].join('\n');
}
