import {
  buildRecentContextPrompt,
  CONTEXT_WINDOW_SIZE,
  getContextUsage,
  getContextWindowMessages,
  shouldUseConversationContext,
} from './src/contextPrompt.js';

const scenarios = [
  {
    name: 'Mensaje nuevo e independiente',
    message: 'Que es React?',
    history: [
      { sender: 'bot', text: 'Te mostre un ejemplo de login.' },
      { sender: 'user', text: 'Perfecto, gracias.' },
      { sender: 'user', text: 'Que es React?' },
    ],
    expectContext: false,
  },
  {
    name: 'Referencia explicita a la respuesta anterior',
    message: 'Explicalo mejor',
    history: [
      { sender: 'user', text: 'Que es React?' },
      { sender: 'bot', text: 'React es una biblioteca para interfaces.' },
      { sender: 'user', text: 'Explicalo mejor' },
    ],
    expectContext: true,
  },
  {
    name: 'Seguimiento con instruccion corta',
    message: 'Hazlo en TypeScript',
    history: [
      { sender: 'user', text: 'Crea un componente de login en React' },
      { sender: 'bot', text: 'Aqui tienes el componente en JavaScript.' },
      { sender: 'user', text: 'Hazlo en TypeScript' },
    ],
    expectContext: true,
  },
  {
    name: 'Pregunta corta pero autosuficiente',
    message: 'Dame 3 ideas de negocio',
    history: [
      { sender: 'user', text: 'Hazme un script de bash' },
      { sender: 'bot', text: 'Aqui tienes un script de bash.' },
      { sender: 'user', text: 'Dame 3 ideas de negocio' },
    ],
    expectContext: false,
  },
  {
    name: 'Dos mensajes del bot no consumen dos slots de usuario',
    message: 'Hazlo responsive',
    history: [
      { sender: 'user', text: 'Crea una card en React' },
      { sender: 'bot', text: 'Aqui tienes la estructura JSX.' },
      { sender: 'bot', text: 'Y aqui va el CSS base.' },
      { sender: 'user', text: 'Hazlo responsive' },
    ],
    expectContext: true,
    expectUsedSlots: 2,
  },
];

let failures = 0;

console.log(`Ventana de contexto configurada: ${CONTEXT_WINDOW_SIZE} mensajes\n`);

for (const scenario of scenarios) {
  const shouldUse = shouldUseConversationContext(scenario.message, scenario.history);
  const prompt = buildRecentContextPrompt(scenario.message, scenario.history);
  const { usedSlots } = getContextUsage(scenario.history);
  const windowMessages = getContextWindowMessages(scenario.history);
  const usingContext = prompt.includes('Contexto reciente de apoyo:');
  const slotsMatch = typeof scenario.expectUsedSlots === 'number' ? usedSlots === scenario.expectUsedSlots : true;
  const passed = usingContext === scenario.expectContext && shouldUse === scenario.expectContext && slotsMatch;

  if (!passed) {
    failures += 1;
  }

  console.log(`${passed ? 'PASS' : 'FAIL'} - ${scenario.name}`);
  console.log(`Mensaje: ${scenario.message}`);
  console.log(`Debe usar contexto: ${scenario.expectContext ? 'si' : 'no'}`);
  console.log(`Detectado: ${usingContext ? 'si' : 'no'}`);
  console.log(`Slots usados: ${usedSlots}/${CONTEXT_WINDOW_SIZE}`);
  console.log(`Mensajes dentro de la ventana: ${windowMessages.length}`);
  console.log(`Prompt final: ${prompt}`);
  console.log('='.repeat(72));
}

if (failures > 0) {
  console.error(`Debug fallido: ${failures} escenario(s) no pasaron.`);
  globalThis.process.exit(1);
}

console.log('Debug completado: el mensaje actual tiene prioridad y el contexto solo entra cuando se pide implicitamente.');
