# FlowBot: Motor Híbrido de Intenciones y Gemini 2.x

FlowBot es un asistente conversacional inteligente desarrollado con **React 19** y **Vite**. Combina una robusta detección de intenciones local con la potencia de la familia de modelos **Gemini 2.x** de Google para proporcionar respuestas precisas y dinámicas.

## Arquitectura del Sistema

El bot opera bajo una estructura de cuatro capas de procesamiento:

1.  **Detección de Intenciones (Local):** Clasifica los mensajes del usuario en 10 grupos semánticos (Visualizar, Crear, Eliminar, Buscar, Modificar, Enviar, Seguridad, Ayuda, Informar, Automatizar).
2.  **Capa Conversacional:** Maneja saludos, cortesía y preguntas sobre la identidad del bot de forma estática para minimizar la latencia.
3.  **Capa de Decisiones:** Ejecuta acciones específicas según la intención detectada, como preparar búsquedas en Google o YouTube, o solicitar confirmaciones de seguridad.
4.  **Motor de IA (Gemini 2.x):** Actúa como fallback inteligente cuando las capas locales no encuentran una coincidencia de alta confianza. Implementa un sistema de reintentos entre modelos (`gemini-2.5-flash`, `gemini-2.0-flash`) para garantizar disponibilidad.

## Guía de Intenciones y Palabras Clave

El sistema está entrenado para reconocer y actuar sobre los siguientes grupos de intención:

| Intención | Descripción | Ejemplos de Palabras Clave (Selección) |
| :--- | :--- | :--- |
| **Visualizar** | Consultar datos, reportes o contenido multimedia. | *Pantalla, reporte, KPIs, dashboard, stream, en vivo, monitor, panel, vista.* |
| **Crear** | Generar nuevos elementos, proyectos o contenidos. | *Hazme, crear, arma, genérame, código, implementar, template, build, maquetar.* |
| **Eliminar** | Acciones destructivas o limpieza de datos. | *Borrar, quitar, remover, purgar, vaciar, reset, destructivo, wipe, aniquilar.* |
| **Modificar** | Edición, actualización o refinamiento. | *Editar, cambiar, optimizar, fixear, refactorizar, modernizar, tune-up, service.* |
| **Buscar** | Localización de información o recursos externos. | *Búscame, googlea, investiga, filtrar, localizar, hallar, crawler, mining, query.* |
| **Enviar** | Distribución de información o archivos. | *Mándame, comparte, exporta, telegram, whatsapp, email, push, deploy, sync.* |
| **Seguridad** | Protocolos de protección y autenticación. | *Proteger, cifrar, login, senha, firewall, 2fa, exploit, malware, blindar.* |
| **Ayuda** | Soporte técnico e instrucciones de uso. | *Soporte, guía, FAQ, manual, asistencia, troubleshooting, no entiendo, auxilio.* |
| **Informar** | Notificaciones y documentación técnica. | *Avisar, documentar, registrar, bitácora, reporte, info, da la lu, resumen, log.* |
| **Automatizar** | Flujos de trabajo y tareas programadas. | *Script, pipeline, workflow, bot, cron, loop, orquestación, trigger, auto.* |
| **Control Sistema** | Control directo de funciones del navegador. | *F11, pantalla completa, recargar, F5, imprimir, subir, bajar, ir arriba.* |

> [!TIP]
> **Potencia de Detección:** El motor local ha sido expandido con más de **500 variantes lingüísticas**, incluyendo tecnicismos, coloquialismos y términos en inglés, garantizando una respuesta inmediata para casi cualquier forma de solicitar una tarea.

## Estructura del Proyecto

```text
Flowbot/
|── dist/                   # Archivos de producción
├── public/                 # Archivos estáticos
│   ├── favicon.svg         # Icono interactivo
│   └── icons.svg           # Sprites SVG
├── src/                    # Código fuente principal
│   ├── assets/             # Imágenes y SVGs de la interfaz
│   ├── components/         # Componentes React (FlowLogo, ChatMessage, etc.)
│   ├── App.jsx             # Vista principal y gestión de estado
│   ├── App.css             # Estilos de la aplicación y animaciones cyber
│   ├── chatbotLogic.js     # Lógica central, intenciones y conexión Gemini
│   ├── index.css           # Estilos base
│   └── main.jsx            # Punto de entrada de React
├── .env                    # Variables de entorno (VITE_GEMINI_API_KEY)
├── eslint.config.js        # Reglas de linting
├── index.html              # Plantilla raíz
├── package.json            # Configuración de Node.js
└── vite.config.js          # Configuración del servidor/bundler
```

## Tecnologías Utilizadas

-   **Frontend:** React 19, Vite 8, Modern CSS (Variables y Animaciones).
-   **IA:** Google Generative AI (Gemini 2.5/2.0 API).
-   **Lógica:** Motor de regex y normalización de texto personalizado.

## Instalación y Ejecución

```bash
# Instalar dependencias
npm install
dentro de la carpeta Flowbot

# Iniciar servidor de desarrollo
npm run dev

# Construir para producción
npm run build

genera la una API KEY con https://aistudio.google.com/app/api-keys y coloca la en el archivo .env desde la raiz del proyecto bajo el nombre de VITE_GEMINI_API_KEY
```

> [!IMPORTANT]
> Es necesario configurar la variable `VITE_GEMINI_API_KEY` en un archivo `.env` en la raíz del proyecto para habilitar las capacidades de IA.

## Características de la Interfaz (UI/UX)

-   **Sidebar Dinámico:** Panel colapsable funcional tanto en escritorio como en móvil.
-   **Acciones Rápidas:** Botones de acceso directo para disparar flujos comunes de prueba.
-   **Indicador de Escritura:** Sincronizado dinámicamente con la latencia de las APIs externas.
-   **Diseño Neon/Dark:** Interfaz premium con efectos de cristal y gradientes fluidos.

---
*Desarrollado como un prototipo modular para sistemas de asistencia inteligente.*
