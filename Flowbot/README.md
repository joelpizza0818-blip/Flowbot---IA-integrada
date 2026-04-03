# FlowBot

FlowBot es una interfaz web construida con React + Vite para detectar intenciones a partir de palabras clave, responder con tarjetas por grupo semántico y, en el caso del grupo `Visualizar`, abrir una búsqueda real en el navegador cuando la consulta lo permite.

## Qué hace la web

- Detecta intenciones por grupos semánticos.
- Muestra tarjetas visuales con coincidencias encontradas.
- Abre Google automáticamente cuando detecta una intención de `Visualizar`.
- Tiene fallback conversacional ampliado para que palabras comunes como `hola`, `gracias`, `ok`, `qué tal`, `cómo estás` o `qué eres` no contaminen los grupos de intención y reciban una respuesta natural.
- Usa iconografía SVG propia en lugar de emojis.
- Mantiene una interfaz neon/azul con sidebar, chat principal, acciones rápidas y estados visuales.

## Stack técnico

- React 19
- Vite 8
- CSS plano en `src/App.css`
- Lógica de intenciones en `src/chatbotLogic.js`

## Comandos

```bash
npm install
npm run dev
npm run lint
npm run build
```

En PowerShell, si `npm` está bloqueado por políticas, puedes usar:

```bash
npm.cmd run dev
npm.cmd run lint
npm.cmd run build
```

## Estructura principal

```text
Flowbot/
├─ public/
│  ├─ favicon.svg
│  └─ icons.svg
├─ src/
│  ├─ components/
│  │  ├─ ChatMessage.jsx
│  │  ├─ FlowLogo.jsx
│  │  └─ IntentIcon.jsx
│  ├─ App.jsx
│  ├─ App.css
│  ├─ chatbotLogic.js
│  ├─ index.css
│  └─ main.jsx
├─ index.html
├─ package.json
└─ README.md
```

## Flujo funcional

1. El usuario escribe un mensaje en el chat.
2. `generateBotResponse()` analiza el texto.
3. `analyzeMessage()` revisa coincidencias contra los grupos de intención.
4. Si el mensaje solo contiene palabras conversacionales comunes, se activa el fallback conversacional.
5. Si existe intención `Visualizar`, `getVisualSearchAction()` intenta extraer una consulta.
6. La UI abre una pestaña nueva con Google o con la búsqueda ya armada.
7. `ChatMessage.jsx` renderiza el mensaje, las tarjetas de intención y el fallback visual del enlace de búsqueda.

## Archivos clave

- `src/App.jsx`
  Maneja el estado del chat, el envío de mensajes, la apertura del navegador y el layout principal.

- `src/chatbotLogic.js`
  Contiene los grupos de intención, el fallback conversacional, la normalización de texto y la lógica de búsqueda del grupo `Visualizar`.

- `src/components/ChatMessage.jsx`
  Renderiza mensajes, tarjetas de intención y el bloque de acción para abrir búsquedas manualmente.

- `src/components/IntentIcon.jsx`
  Centraliza todos los iconos SVG usados en la app.

- `src/App.css`
  Define la paleta, layout, animaciones y estilos del chat.

## Comportamiento del fallback conversacional

El fallback conversacional existe para evitar falsos positivos con palabras demasiado comunes en una conversación normal. Estas palabras:

- No se muestran dentro de los grupos de intención del sidebar.
- No deberían disparar tarjetas de intención por sí solas.
- Sirven para que el bot responda con una guía neutra o con una respuesta conversacional específica cuando el mensaje no expresa una acción real.

Ejemplos de mensajes que deben caer en fallback:

- `hola`
- `gracias`
- `ok`
- `qué tal`
- `cómo estás`
- `qué eres`
- `nos vemos`
- `bueno entonces`

Además, el fallback puede responder directamente a preguntas como:

- `qué eres`
- `quién eres`
- `qué puedes hacer`
- `qué tal`
- `cómo estás`
- `cómo te va`
- `gracias`
- `hasta luego`

## Grupos de intención

### 1. Visualizar

- Color: `#00d4ff`
- Icono: `visualizar`
- Uso: ver, analizar, revisar o consultar información.
- Palabras clave:
  `ver`, `visualizar`, `mostrar`, `analizar`, `inspeccionar`, `observar`, `revisar`, `explorar`, `examinar`, `consultar`, `mirar`, `chequear`, `comprobar`, `verificar`, `detectar`, `descubrir`, `identificar`, `reconocer`, `escanear`, `monitorear`, `rastrear`, `supervisar`, `contemplar`, `estudiar`, `investigar`, `indagar`, `previsualizar`, `desplegar`, `presentar`, `exhibir`, `enseñar`, `abrir`, `cargar`, `renderizar`, `proyectar`, `listar`, `detallar`, `desglosar`, `panorámica`, `resumen`, `overview`, `dashboard`, `vista`, `pantalla`, `reporte`, `informe`, `gráfico`, `tabla`, `mapa`

### 2. Eliminar

- Color: `#ff4757`
- Icono: `eliminar`
- Uso: borrar, remover o revertir algo.
- Palabras clave:
  `eliminar`, `borrar`, `quitar`, `remover`, `suprimir`, `descartar`, `deshacer`, `anular`, `cancelar`, `destruir`, `purgar`, `limpiar`, `vaciar`, `depurar`, `erradicar`, `extirpar`, `extinguir`, `liquidar`, `demoler`, `desmantelar`, `desinstalar`, `desactivar`, `deshabilitar`, `revocar`, `invalidar`, `retirar`, `expulsar`, `truncar`, `podar`, `recortar`, `drop`, `delete`, `remove`, `clear`, `reset`, `wipe`, `flush`, `rollback`, `revertir`, `deshacer cambios`, `restaurar original`, `formato fábrica`

### 3. Informar

- Color: `#ffa502`
- Icono: `informar`
- Uso: documentar, explicar o reportar.
- Palabras clave:
  `informar`, `reportar`, `notificar`, `comunicar`, `avisar`, `alertar`, `advertir`, `señalar`, `indicar`, `mencionar`, `describir`, `explicar`, `detallar`, `especificar`, `documentar`, `registrar`, `anotar`, `apuntar`, `catalogar`, `clasificar`, `categorizar`, `etiquetar`, `rotular`, `marcar`, `destacar`, `subrayar`, `enfatizar`, `resaltar`, `puntualizar`, `aclarar`, `interpretar`, `traducir`, `sintetizar`, `resumir`, `condensar`, `simplificar`, `parafrasear`, `citar`, `referenciar`, `bibliografía`, `fuente`, `origen`, `nota`

### 4. Crear

- Color: `#2ed573`
- Icono: `crear`
- Uso: generar o construir algo nuevo.
- Palabras clave:
  `crear`, `generar`, `construir`, `fabricar`, `producir`, `desarrollar`, `diseñar`, `elaborar`, `componer`, `redactar`, `escribir`, `formular`, `inventar`, `innovar`, `idear`, `concebir`, `planificar`, `proyectar`, `modelar`, `prototipar`, `bosquejar`, `esbozar`, `trazar`, `dibujar`, `ilustrar`, `graficar`, `programar`, `codificar`, `implementar`, `instanciar`, `inicializar`, `configurar`, `establecer`, `fundar`, `inaugurar`, `lanzar`, `publicar`, `desplegar`, `nuevo`, `nueva`, `añadir`, `agregar`, `insertar`, `incorporar`, `incluir`, `sumar`, `adjuntar`, `anexar`, `complementar`, `ampliar`, `extender`

### 5. Modificar

- Color: `#eccc68`
- Icono: `modificar`
- Uso: editar, mejorar o transformar.
- Palabras clave:
  `modificar`, `editar`, `cambiar`, `actualizar`, `alterar`, `transformar`, `convertir`, `adaptar`, `ajustar`, `calibrar`, `afinar`, `optimizar`, `mejorar`, `perfeccionar`, `refinar`, `pulir`, `corregir`, `enmendar`, `rectificar`, `reparar`, `arreglar`, `solucionar`, `resolver`, `fixear`, `parchear`, `patch`, `update`, `upgrade`, `migrar`, `refactorizar`, `reestructurar`, `reorganizar`, `reordenar`, `renombrar`, `reasignar`, `reubicar`, `mover`, `trasladar`, `intercambiar`, `sustituir`, `reemplazar`, `permutar`, `rotar`, `voltear`, `invertir`, `escalar`, `redimensionar`, `ampliar`, `reducir`, `comprimir`, `expandir`

### 6. Buscar

- Color: `#7bed9f`
- Icono: `buscar`
- Uso: localizar información específica.
- Palabras clave:
  `buscar`, `encontrar`, `localizar`, `ubicar`, `hallar`, `rastrear`, `seguir`, `perseguir`, `cazar`, `filtrar`, `seleccionar`, `elegir`, `escoger`, `optar`, `preferir`, `comparar`, `contrastar`, `diferenciar`, `distinguir`, `separar`, `aislar`, `extraer`, `obtener`, `recuperar`, `rescatar`, `descargar`, `importar`, `traer`, `fetch`, `query`, `search`, `find`, `lookup`, `scan`, `crawl`, `indexar`, `navegar`, `explorar datos`, `minería`, `scraping`, `parsing`, `regex`, `coincidencia`, `match`, `patrón`, `criterio`, `condición`

### 7. Enviar

- Color: `#70a1ff`
- Icono: `enviar`
- Uso: compartir o transmitir contenido.
- Palabras clave:
  `enviar`, `mandar`, `remitir`, `transmitir`, `transferir`, `compartir`, `distribuir`, `difundir`, `propagar`, `emitir`, `publicar`, `postear`, `subir`, `upload`, `exportar`, `despachar`, `entregar`, `repartir`, `asignar`, `delegar`, `derivar`, `reenviar`, `forward`, `redirect`, `sync`, `sincronizar`, `push`, `deploy`, `release`, `broadcast`, `notificar por email`, `correo`, `mail`, `mensaje`, `sms`, `chat`, `ping`, `webhook`, `api call`, `request`, `solicitud`, `petición`

### 8. Seguridad

- Color: `#ff6b81`
- Icono: `seguridad`
- Uso: protección, acceso, autenticación o defensa.
- Palabras clave:
  `proteger`, `asegurar`, `blindar`, `cifrar`, `encriptar`, `autenticar`, `autorizar`, `validar`, `verificar identidad`, `contraseña`, `password`, `token`, `sesión`, `login`, `logout`, `cerrar sesión`, `firewall`, `antivirus`, `malware`, `virus`, `amenaza`, `vulnerabilidad`, `exploit`, `brecha`, `ataque`, `hackeo`, `intrusión`, `phishing`, `spam`, `bloquear`, `banear`, `restringir`, `limitar`, `permisos`, `roles`, `acceso`, `privilegios`, `auditoría`, `log seguridad`, `backup`, `respaldo`, `copia seguridad`, `recuperación`, `contingencia`, `2fa`, `mfa`, `ssl`, `https`, `certificado`, `oauth`

### 9. Ayuda

- Color: `#a29bfe`
- Icono: `ayuda`
- Uso: asistencia guiada, tutoriales, documentación o soporte.
- Palabras clave:
  `ayuda`, `ayudar`, `soporte`, `asistencia`, `guía`, `tutorial`, `manual`, `instrucciones`, `pasos`, `explicame`, `explícame`, `guiame`, `guíame`, `enseñame`, `enséñame`, `orientame`, `oriéntame`, `paso a paso`, `preguntas frecuentes`, `faq`, `documentación`, `docs`, `wiki`, `referencia`, `recurso`, `herramienta`, `utilidad`, `funcionalidad`, `característica`, `capacidad`, `opción`, `alternativa`, `solución`, `cómo usar`, `como usar`, `cómo funciona`, `como funciona`, `cómo se hace`, `como se hace`, `centro de ayuda`

### 10. Automatizar

- Color: `#1e90ff`
- Icono: `automatizar`
- Uso: programar flujos, procesos o integraciones repetibles.
- Palabras clave:
  `automatizar`, `programar tarea`, `scheduler`, `cron`, `bot`, `macro`, `script`, `pipeline`, `workflow`, `flujo trabajo`, `proceso`, `batch`, `lote`, `masivo`, `bulk`, `repetir`, `iterar`, `loop`, `ciclo`, `recurrente`, `periódico`, `programado`, `agendado`, `temporizador`, `timer`, `trigger`, `disparador`, `evento`, `hook`, `callback`, `listener`, `watcher`, `monitor automático`, `integración`, `API`, `endpoint`, `servicio`, `microservicio`, `orquestación`, `cadena`, `secuencia`, `rutina`, `procedimiento`

## Fallback conversacional

Estas palabras se analizan por separado y no aparecen en los grupos visibles del sidebar.

### 1. Saludos

`hola`, `hello`, `hi`, `hey`, `buenas`, `saludos`, `buen dia`, `buen día`, `buenos dias`, `buenos días`, `buenas tardes`, `buenas noches`, `qué tal`, `que tal`, `qué hay`, `que hay`, `cómo estás`, `como estas`, `cómo va`, `como va`, `todo bien`

### 2. Cortesía

`gracias`, `muchas gracias`, `mil gracias`, `te lo agradezco`, `por favor`, `porfa`, `porfis`, `disculpa`, `discúlpame`, `disculpame`, `perdón`, `perdon`, `permiso`

### 3. Afirmación

`si`, `sí`, `claro`, `vale`, `ok`, `okay`, `okey`, `de acuerdo`, `correcto`, `entendido`, `perfecto`, `genial`, `excelente`, `listo`, `dale`, `continua`, `continúa`

### 4. Relleno Conversacional

`oye`, `mira`, `bueno`, `pues`, `entonces`, `aja`, `ajá`, `mmm`, `mm`, `eh`, `em`, `este`, `sabes`, `dime`, `cuentame`, `cuéntame`, `a ver`, `veamos`, `pues nada`, `en fin`, `o sea`, `osea`, `digamos`, `basicamente`, `básicamente`, `literal`, `tipo`, `como que`, `más o menos`, `mas o menos`

### 5. Preguntas Comunes

`cómo`, `como`, `qué es`, `que es`, `por qué`, `por que`, `para qué`, `para que`, `dónde`, `donde`, `cuándo`, `cuando`, `cuál`, `cual`, `cuánto`, `cuanto`, `quién`, `quien`, `qué pasa`, `que pasa`, `qué onda`, `que onda`, `cómo así`, `como asi`, `qué sucede`, `que sucede`, `qué ocurre`, `que ocurre`, `qué significa`, `que significa`, `me explicas`, `me explicas eso`

### 6. Identidad del Bot

`qué eres`, `que eres`, `quién eres`, `quien eres`, `qué haces`, `que haces`, `qué puedes hacer`, `que puedes hacer`, `para qué sirves`, `para que sirves`, `eres un bot`, `eres una ia`, `eres inteligencia artificial`, `cómo funcionas`, `como funcionas`, `de qué tratas`, `de que tratas`, `cuál es tu función`, `cual es tu funcion`, `quién te hizo`, `quien te hizo`, `qué sabes hacer`, `que sabes hacer`

### 7. Estado y Trato

`cómo estás`, `como estas`, `qué tal`, `que tal`, `cómo te va`, `como te va`, `cómo andas`, `como andas`, `todo bien`, `cómo vas`, `como vas`, `cómo va todo`, `como va todo`, `qué hay de nuevo`, `que hay de nuevo`, `cómo sigues`, `como sigues`, `cómo va tu día`, `como va tu dia`

### 8. Presentaciones

`me llamo`, `mi nombre es`, `soy`, `soy yo`, `mucho gusto`, `encantado`, `encantada`, `un placer`, `a tus ordenes`, `a tus órdenes`

### 9. Reacciones

`jaja`, `jeje`, `jojo`, `jajaja`, `jejeje`, `wow`, `guau`, `ups`, `vaya`, `ah bueno`, `oh`, `ah`, `increible`, `increíble`, `genial`, `cool`, `brutal`, `uff`

### 10. Despedidas

`adiós`, `adios`, `chao`, `chau`, `nos vemos`, `hasta luego`, `hasta pronto`, `bye`, `goodbye`, `hasta la próxima`, `hasta la proxima`, `cuídate`, `cuidate`, `hablamos luego`, `hablamos`, `me voy`, `ya me voy`

## Respuestas conversacionales especiales

Además del fallback genérico, FlowBot responde de forma específica cuando detecta ciertos patrones conversacionales:

- Identidad: responde a preguntas como `qué eres`, `quién eres`, `qué haces` y `qué puedes hacer`.
- Estado: responde a frases como `qué tal`, `cómo estás`, `cómo te va` o `todo bien`.
- Cortesía: responde a `gracias`, `mil gracias` o `te lo agradezco`.
- Despedida: responde a `adiós`, `hasta luego`, `nos vemos` o `bye`.
- Confirmación: responde a `ok`, `vale`, `perfecto`, `listo` o `de acuerdo`.

## Lista de verbos sugeridos en el fallback

Cuando el bot no encuentra una intención clara, sugiere verbos orientativos como:

`ver`, `revisar`, `analizar`, `crear`, `generar`, `editar`, `actualizar`, `buscar`, `encontrar`, `informar`, `documentar`, `enviar`, `compartir`, `proteger`, `automatizar`

## Búsqueda automática del grupo Visualizar

Cuando el mensaje activa `Visualizar`, la app intenta:

1. Detectar la palabra o frase que disparó el grupo.
2. Extraer el resto del mensaje como consulta.
3. Limpiar relleno como `quiero`, `necesito`, `por favor`, `me`, `la`, `el`.
4. Abrir una nueva pestaña con:
   - Google con query completa si encontró consulta.
   - Google vacío si no encontró una consulta suficientemente clara.
5. Mostrar un botón manual dentro del chat por si el navegador bloquea la pestaña emergente.

Ejemplos:

- `quiero ver restaurantes italianos en santo domingo`
- `necesito revisar laptops gamer`
- `abrir información sobre paneles solares`

## UI y experiencia

### Sidebar

- Lista de grupos de intención.
- Cada tarjeta muestra:
  - icono SVG
  - nombre del grupo
  - total de palabras clave reales
  - vista previa de palabras

### Chat principal

- Muestra mensajes del usuario y del bot.
- Tiene avatar visual del bot.
- Puede renderizar:
  - texto enriquecido con `**negritas**`
  - tarjetas de intención
  - acción de apertura de búsqueda

### Input

- `Enter` envía.
- `Shift + Enter` permite salto de línea.
- Incluye acciones rápidas.

## Sistema de iconos

Todos los emojis fueron reemplazados por SVGs. Los iconos están definidos en `src/components/IntentIcon.jsx`.

Iconos disponibles:

- `visualizar`
- `eliminar`
- `informar`
- `crear`
- `modificar`
- `buscar`
- `enviar`
- `seguridad`
- `ayuda`
- `automatizar`
- `external`
- `clear`
- `close`

## Paleta visual

Variables principales definidas en `src/App.css`:

- `--bg-primary: #080c18`
- `--bg-secondary: #0d1326`
- `--bg-tertiary: #111a36`
- `--bg-surface: #141d3a`
- `--bg-surface-hover: #1a2548`
- `--neon-blue: #00d4ff`
- `--neon-blue-dim: #0088cc`
- `--neon-blue-bright: #33e0ff`
- `--neon-accent: #0057ff`
- `--text-primary: #e8ecf4`
- `--text-secondary: #8b99b8`
- `--text-muted: #5a6a8a`

Colores por grupo:

- Visualizar: `#00d4ff`
- Eliminar: `#ff4757`
- Informar: `#ffa502`
- Crear: `#2ed573`
- Modificar: `#eccc68`
- Buscar: `#7bed9f`
- Enviar: `#70a1ff`
- Seguridad: `#ff6b81`
- Ayuda: `#a29bfe`
- Automatizar: `#1e90ff`

## Mantenimiento recomendado

- Si agregas nuevas palabras demasiado genéricas, evalúa si pertenecen a un grupo de intención o al fallback conversacional.
- Si agregas un grupo nuevo, define:
  - `id`
  - `name`
  - `iconName`
  - `color`
  - `keywords`
  - `responses`
  - `details`
- Si agregas un icono nuevo, incorpóralo en `IntentIcon.jsx`.
- Después de cualquier cambio, valida con:

```bash
npm.cmd run lint
npm.cmd run build
```

## Estado actual

La app ya incluye:

- detección por grupos
- fallback conversacional ampliado
- respuestas específicas para conversación casual
- exclusión de palabras conversacionales comunes del sidebar de intenciones
- búsqueda automática para `Visualizar`
- fallback manual de enlace
- iconos SVG
- documentación completa en este `README.md`
