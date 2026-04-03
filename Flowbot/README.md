# FlowBot: Motor Híbrido de Intenciones y Gemini 2.x

FlowBot es un asistente conversacional inteligente desarrollado con **React 19** y **Vite**. Combina una robusta detección de intenciones local con la potencia de la familia de modelos **Gemini 2.x** de Google para proporcionar respuestas precisas y dinámicas.

## Arquitectura del Sistema

El bot opera bajo una estructura de cuatro capas de procesamiento:

1.  **Detección de Intenciones (Local):** Clasifica los mensajes del usuario en 10 grupos semánticos (Visualizar, Crear, Eliminar, Buscar, Modificar, Enviar, Seguridad, Ayuda, Informar, Automatizar).
2.  **Capa Conversacional:** Maneja saludos, cortesía y preguntas sobre la identidad del bot de forma estática para minimizar la latencia.
3.  **Capa de Decisiones:** Ejecuta acciones específicas según la intención detectada, como preparar búsquedas en Google o YouTube, o solicitar confirmaciones de seguridad.
4.  **Motor de IA (Gemini 2.x):** Actúa como fallback inteligente cuando las capas locales no encuentran una coincidencia de alta confianza. Implementa un sistema de reintentos entre modelos (`gemini-2.5-flash`, `gemini-2.0-flash`) para garantizar disponibilidad.

## Tecnologías Utilizadas

-   **Frontend:** React 19, Vite 8, Modern CSS (Variables y Animaciones).
-   **IA:** Google Generative AI (Gemini 2.5/2.0 API).
-   **Lógica:** Motor de regex y normalización de texto personalizado.

## Instalación y Ejecución

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Construir para producción
npm run build
```

> [!IMPORTANT]
> Es necesario configurar la variable `VITE_GEMINI_API_KEY` en un archivo `.env` en la raíz del proyecto para habilitar las capacidades de IA.

## Limpieza y Estándares de Código

El código de FlowBot ha sido purificado siguiendo criterios de legibilidad y minimalismo:
- **Sin Comentarios:** El código se considera autodocumentado mediante el uso de nombres descriptivos para variables y funciones.
- **Sin Ruido Visual:** Se han eliminado emojis del código fuente (logs y lógica interna) para un entorno de mantenimiento profesional.
- **Manejo de Errores:** Implementa un sistema granular que informa fallos de API, límites de cuota y bloqueos de seguridad de forma privada en la consola del desarrollador.

## Características de la Interfaz (UI/UX)

-   **Sidebar Dinámico:** Panel colapsable funcional tanto en escritorio como en móvil.
-   **Acciones Rápidas:** Botones de acceso directo para disparar flujos comunes de prueba.
-   **Indicador de Escritura:** Sincronizado dinámicamente con la latencia de las APIs externas.
-   **Diseño Neon/Dark:** Interfaz premium con efectos de cristal y gradientes fluidos.

---
*Desarrollado como un prototipo modular para sistemas de asistencia inteligente.*
