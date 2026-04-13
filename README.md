# FlowBot — Asistente Inteligente de IA

<div align="center">

**Un chatbot moderno e inteligente impulsado por Google Gemini, construido con React y desplegable en cualquier plataforma.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-19.2.4-61dafb.svg)](https://react.dev/)

[Demo en Vivo](#) • [Documentación](#características) • [Contribuir](#contribución)

</div>

---

## Descripción

**FlowBot** es una solución completa de chatbot conversacional con IA integrada. Ofrece una experiencia de usuario fluida con detección inteligente de intenciones, soporte para markdown en respuestas de IA y un diseño moderno con tema oscuro neon.

Diseñado para ser desplegable tanto en **GitHub Pages** como en infraestructura propia, FlowBot combina flexibilidad de despliegue con arquitectura segura.

---

## ✨ Características Principales

- **🤖 IA Inteligente** — Integración con Google Gemini API para conversaciones naturales
- **🎨 Diseño Moderno** — Interfaz elegante con tema oscuro y acentos neon
- **📱 Responsive** — Optimizado para desktop, tablet y mobile con teclado virtual
- **🔐 Seguridad Híbrida** — Soporte para proxy backend seguro o API directa restringida
- **📝 Markdown Completo** — Renderización de markdown con bloques de código resaltados
- **⚡ Rendimiento** — Stack moderno con Vite, React 19 y Express
- **🚀 Despliegue Flexible** — GitHub Pages, servidores propios o cloud providers
- **🧠 Detección de Intenciones** — Análisis contextual de mensajes con acciones automáticas

---

## 🏗️ Arquitectura

### Despliegue Híbrido

FlowBot utiliza un sistema inteligente de fallback:

```
┌─────────────────────────────────────┐
│   Frontend (React + Vite)           │
└────────────┬────────────────────────┘
             │
             ├─→ 1️⃣ Intenta Backend Proxy
             │        ↓ (Si no existe)
             │
             └─→ 2️⃣ Fallback a Gemini Directo
                     (Clave pública restringida)
```

**Ventajas:**
- Despliegue inmediato en GitHub Pages sin backend
- Migración fácil a un proxy seguro cuando sea necesario
- Sin cambios en el frontend

---

## 🚀 Quick Start

### Requisitos
- **Node.js** ≥ 20.0.0
- **npm** o **yarn**

### Instalación Local

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/flowbot.git
cd flowbot

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
```

### Desarrollo

```bash
# Terminal 1: Backend (Express)
npm run dev:server

# Terminal 2: Frontend (Vite + React)
npm run dev
```

Accede a `http://localhost:5173`

### Construcción para Producción

```bash
npm run build
npm start
```

---

## ⚙️ Configuración

### Variables de Entorno

#### Frontend (GitHub Pages / Vite)
```env
VITE_GEMINI_API_KEY=your-restricted-public-key-here
VITE_SYSTEM_PROMPT=Tu instrucción personalizada para el bot
VITE_PROXY_URL=https://api.tudominio.com  # Opcional
VITE_BASE_PATH=/flowbot/                   # URL del sitio en Pages
```

#### Backend (Opcional - Express)
```env
GEMINI_API_KEY=your-full-server-key-here
GEMINI_MODELS=gemini-2.5-flash,gemini-2.0-flash,gemini-2.0-flash-lite,gemini-flash-latest
FLOWBOT_SYSTEM_PROMPT=Instrucción del bot para operaciones del servidor
CORS_ORIGINS=https://tu-github-pages-url.io
```

> **⚠️ Seguridad:** Nunca commitees `.env` con claves reales. Usa GitHub Secrets en CI/CD.

---

## 📦 Estructura del Proyecto

```
flowbot/
├── src/
│   ├── components/
│   │   ├── ChatMessage.jsx      # Renderización de mensajes con Markdown
│   │   ├── FlowLogo.jsx         # Logo del bot
│   │   └── IntentIcon.jsx       # Iconografía de intenciones
│   ├── App.jsx                  # Componente principal
│   ├── App.css                  # Estilos globales
│   ├── chatbotLogic.js          # Lógica de IA y procesamiento
│   └── main.jsx                 # Punto de entrada
├── server.js                    # Servidor Express (backend opcional)
├── vite.config.js              # Configuración Vite
├── package.json                 # Dependencias
├── .env.example                 # Template de variables
└── Dockerfile                   # Para despliegue containerizado
```

---

## 🌐 Despliegue

### GitHub Pages (Recomendado para Inicio Rápido)

1. **Fork/Clone** el repositorio
2. **Configura secrets** en `Settings → Secrets and variables → Actions`:
   - `VITE_GEMINI_API_KEY`
   - `VITE_SYSTEM_PROMPT`
   - `VITE_PROXY_URL` (opcional)

3. **Push** a `main` — el workflow en `.github/workflows/deploy.yml` publica automáticamente

4. Tu sitio estará en: `https://tu-usuario.github.io/flowbot/`

### Servidor Propio / Cloud (Production)

#### Docker

```bash
docker build -t flowbot .
docker run -p 3000:3000 --env-file .env flowbot
```

#### Manual
```bash
npm install
npm run build
VITE_BASE_PATH=/ npm start
```

---

## 🔒 Seguridad

### Protección de Claves API

#### Para VITE_GEMINI_API_KEY (Pública)
- Restringir a HTTP referrer de tu dominio en Google Cloud Console
- Restringir a Gemini API exclusivamente
- Regenerar si se compromete

#### Para GEMINI_API_KEY (Backend)
- **Nunca** exponerla en el navegador
- Usar secrets seguros en CI/CD
- Rotar periódicamente
- Monitorear uso en Google Cloud

### CORS
El backend valida automáticamente `CORS_ORIGINS` para prevenir accesos no autorizados.

---

## 📊 API Reference

### Salud del Servicio
```
GET /api/health
```
Respuesta:
```json
{
  "status": "ok",
  "aiConfigured": true,
  "proxyAvailable": true
}
```

### Chat
```
POST /api/flowbot-proxy
Content-Type: application/json

{
  "userMessage": "Hola, ¿cómo estás?"
}
```

---

## 🛠️ Desarrollo

### Scripts Disponibles

```bash
npm run dev          # Inicia Vite dev server
npm run dev:server   # Inicia Express dev server
npm run build        # Build para producción
npm run preview      # Preview local del build
npm run lint         # ESLint
npm start            # Inicia server producción
```

### Tech Stack
- **Frontend:** React 19, Vite, CSS3
- **Backend:** Express.js, Node.js
- **IA:** Google Gemini API
- **Despliegue:** GitHub Pages, Docker, Cloud
- **Linting:** ESLint

---

## 🤝 Contribución

Las contribuciones son bienvenidas! Por favor:

1. Fork el repositorio
2. Crea una rama: `git checkout -b feature/tu-feature`
3. Commit cambios: `git commit -m 'Add: descripción'`
4. Push: `git push origin feature/tu-feature`
5. Abre un Pull Request

---

## 📞 Soporte

Para reportar bugs, sugerencias o preguntas:
- 📧 Abre un [Issue](https://github.com/tu-usuario/flowbot/issues)
- 💬 Visita las [Discussions](https://github.com/tu-usuario/flowbot/discussions)

---

<div align="center">

**Hecho con ❤️ Joel**

</div>

---

## Backend Startup Flow (CMD)

Use this flow on Windows CMD when the UI shows "Backend no disponible".

### 1) Open CMD and go to the project

```cmd
cd /d C:\dev\Flowbot---IA-integrada
```

### 2) Start SQL Server Express

```cmd
net start MSSQL$SQLEXPRESS
```

If it is already running, CMD will say so.

### 3) Verify `.env` for SQL + proxy

Make sure these values exist in `.env`:

```env
VITE_PROXY_URL=http://localhost:3000/api/flowbot-proxy
SQLSERVER_HOST=localhost
SQLSERVER_INSTANCE=JOEL\\SQLEXPRESS
SQLSERVER_PORT=49814
SQLSERVER_USER=sa
SQLSERVER_PASSWORD=123456
SQLSERVER_DATABASE=flowbot
```

### 4) Start backend (Terminal 1)

```cmd
cd /d C:\dev\Flowbot---IA-integrada
npm run dev:server
```

### 5) Start frontend (Terminal 2)

```cmd
cd /d C:\dev\Flowbot---IA-integrada
npm run dev
```

### 6) Validate backend health

```cmd
curl http://localhost:3000/api/health
```

Expected keys:

- `"ok": true`
- `"persistenceReady": true`

### 7) If UI still says backend not available

- Do `Ctrl + F5` in the browser.
- Wait up to 10 seconds (the app now rechecks backend status periodically).
- Confirm backend process is still running in Terminal 1.
- Confirm `curl http://localhost:3000/api/health` still returns `ok: true`.

### 8) Production start

```cmd
npm run build
npm start
```
