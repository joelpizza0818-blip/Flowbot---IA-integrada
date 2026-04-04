# FlowBot

FlowBot es un chatbot hecho con React, Vite y Express. Ahora soporta un despliegue hibrido:

- En GitHub Pages funciona como sitio estatico publico.
- Si existe un proxy backend, el frontend lo usa primero.
- Si no existe proxy, cae a Gemini directo desde el navegador usando una `VITE_GEMINI_API_KEY` publica y restringida por dominio.

## Como funciona el modo hibrido

1. El frontend intenta `VITE_PROXY_URL/api/flowbot-proxy` o `/api/flowbot-proxy`.
2. Si el proxy responde, la key privada vive solo en el servidor.
3. Si el proxy no existe, usa Gemini directo desde el cliente.

Esto permite:

- GitHub Pages hoy.
- Proxy externo despues, sin rehacer el frontend.

## Variables de entorno

Usa `.env.example` como referencia.

### Frontend para GitHub Pages

```bash
VITE_GEMINI_API_KEY=replace-with-restricted-public-key
VITE_SYSTEM_PROMPT=Eres FLOWBOT, una IA de tareas basicas. Responde de forma breve, usando Markdown y negritas para enfatizar puntos clave.
VITE_PROXY_URL=
VITE_BASE_PATH=/Flowbot---IA-integrada/
```

### Backend opcional

```bash
GEMINI_API_KEY=replace-with-server-key
GEMINI_MODELS=gemini-2.5-flash,gemini-2.0-flash,gemini-2.0-flash-lite,gemini-flash-latest
FLOWBOT_SYSTEM_PROMPT=Eres FLOWBOT, una IA de tareas basicas. Responde de forma breve, usando Markdown y negritas para enfatizar puntos clave.
CORS_ORIGINS=https://joelpizza0818-blip.github.io
```

## Desarrollo local

```bash
npm install
npm run dev:server
npm run dev
```

- `npm run dev:server` levanta Express en `http://localhost:3000`
- `npm run dev` levanta Vite en `http://localhost:5173`
- Vite reenvia `/api` al backend local

## GitHub Pages

El workflow de [deploy.yml](./.github/workflows/deploy.yml) publica automaticamente en Pages al hacer push a `main`.

Configura estos secretos del repositorio:

- `VITE_GEMINI_API_KEY`
- `VITE_SYSTEM_PROMPT`
- `VITE_PROXY_URL` opcional

### Recomendacion de seguridad para la key publica

La `VITE_GEMINI_API_KEY` debe estar restringida en Google:

- Restriccion por HTTP referrer al dominio `https://joelpizza0818-blip.github.io/*`
- Restriccion por API solo a Gemini Developer API si tu panel lo permite

## Backend opcional

Si luego despliegas el proxy en otro host:

```bash
VITE_BASE_PATH=/ npm run build
npm start
```

Configura `VITE_PROXY_URL` en Pages apuntando a ese backend y `CORS_ORIGINS` con el dominio de GitHub Pages.

## Verificacion rapida

- `GET /api/health` confirma si el backend esta arriba y si la IA esta configurada.
- `POST /api/flowbot-proxy` recibe `{ "userMessage": "hola" }`.
