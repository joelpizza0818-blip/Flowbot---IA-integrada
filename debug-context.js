import {
  buildRecentContextPrompt,
  CONTEXT_WINDOW_SIZE,
  getContextUsage,
  getContextWindowMessages,
  shouldUseConversationContext,
} from './src/contextPrompt.js';

const scenarios = [
  {
    name: 'Pregunta nueva y autosuficiente',
    message: 'Que es React?',
    history: [
      { sender: 'user', text: 'Hazme un script de bash' },
      { sender: 'bot', text: 'Aqui tienes un script de bash.' },
      { sender: 'user', text: 'Que es React?' },
    ],
    expectPromptHasContext: true,
    expectShouldLeanOnContext: false,
    expectUsedSlots: 3,
  },
  {
    name: 'Referencia explicita a la respuesta anterior',
    message: 'Explicalo mejor',
    history: [
      { sender: 'user', text: 'Que es React?' },
      { sender: 'bot', text: 'React es una biblioteca para interfaces.' },
      { sender: 'user', text: 'Explicalo mejor' },
    ],
    expectPromptHasContext: true,
    expectShouldLeanOnContext: true,
    expectUsedSlots: 3,
  },
  {
    name: 'Seguimiento corto tipo transformacion',
    message: 'Mas corto',
    history: [
      { sender: 'user', text: 'Que es TypeScript?' },
      { sender: 'bot', text: 'TypeScript es JavaScript con tipos estaticos y mejores herramientas.' },
      { sender: 'user', text: 'Mas corto' },
    ],
    expectPromptHasContext: true,
    expectShouldLeanOnContext: true,
    expectUsedSlots: 3,
  },
  {
    name: 'Pregunta eliptica apoyada por el contexto',
    message: 'Que ts',
    history: [
      { sender: 'user', text: 'Que es React?' },
      { sender: 'bot', text: 'React es una biblioteca para interfaces.' },
      { sender: 'user', text: 'Que ts' },
    ],
    expectPromptHasContext: true,
    expectShouldLeanOnContext: true,
    expectUsedSlots: 3,
  },
  {
    name: 'La ventana se limita a 6 mensajes bot y user',
    message: 'Resume eso',
    history: [
      { sender: 'user', text: 'Mensaje 1' },
      { sender: 'bot', text: 'Respuesta 1' },
      { sender: 'user', text: 'Mensaje 2' },
      { sender: 'bot', text: 'Respuesta 2' },
      { sender: 'user', text: 'Mensaje 3' },
      { sender: 'bot', text: 'Respuesta 3' },
      { sender: 'user', text: 'Resume eso' },
    ],
    expectPromptHasContext: true,
    expectShouldLeanOnContext: true,
    expectUsedSlots: 6,
    expectWindowTexts: [
      'Respuesta 1',
      'Mensaje 2',
      'Respuesta 2',
      'Mensaje 3',
      'Respuesta 3',
      'Resume eso',
    ],
  },
];

let failures = 0;

console.log(`Ventana de contexto configurada: ${CONTEXT_WINDOW_SIZE} mensajes\n`);

for (const scenario of scenarios) {
  const shouldLeanOnContext = shouldUseConversationContext(scenario.message, scenario.history);
  const prompt = buildRecentContextPrompt(scenario.message, scenario.history);
  const { usedSlots } = getContextUsage(scenario.history);
  const windowMessages = getContextWindowMessages(scenario.history);
  const promptHasContext = prompt.includes('Contexto reciente de apoyo:');
  const slotsMatch = usedSlots === scenario.expectUsedSlots;
  const windowMatch = Array.isArray(scenario.expectWindowTexts)
    ? scenario.expectWindowTexts.every((text, index) => windowMessages[index]?.text === text)
    : true;
  const passed = (
    promptHasContext === scenario.expectPromptHasContext
    && shouldLeanOnContext === scenario.expectShouldLeanOnContext
    && slotsMatch
    && windowMatch
  );

  if (!passed) {
    failures += 1;
  }

  console.log(`${passed ? 'PASS' : 'FAIL'} - ${scenario.name}`);
  console.log(`Mensaje: ${scenario.message}`);
  console.log(`Prompt incluye contexto: ${promptHasContext ? 'si' : 'no'}`);
  console.log(`Debe apoyarse en contexto: ${scenario.expectShouldLeanOnContext ? 'si' : 'no'}`);
  console.log(`Detectado: ${shouldLeanOnContext ? 'si' : 'no'}`);
  console.log(`Mensajes en ventana: ${usedSlots}/${CONTEXT_WINDOW_SIZE}`);
  console.log(`Prompt final: ${prompt}`);
  console.log('='.repeat(72));
}

if (failures > 0) {
  console.error(`Debug fallido: ${failures} escenario(s) no pasaron.`);
  globalThis.process.exit(1);
}

console.log('Debug completado: el mensaje actual mantiene la prioridad y el historial reciente se relee como apoyo.');
