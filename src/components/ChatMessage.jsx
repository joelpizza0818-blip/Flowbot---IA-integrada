import React, { useState } from 'react';
import IntentIcon from './IntentIcon';

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-wrapper">
      <button className="code-copy-btn" onClick={handleCopy} title={copied ? 'Copiado!' : 'Copiar código'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {copied ? (
            <>
              <polyline points="20 6 9 17 4 12"></polyline>
            </>
          ) : (
            <>
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </>
          )}
        </svg>
        {copied ? '✓' : 'Copiar'}
      </button>
      <pre className="code-block">
        <code className="code-content">{code.trim()}</code>
      </pre>
    </div>
  );
}

function parseRichText(text) {
  const blockCodeRegex = /```([\s\S]*?)```/g;
  const inlineCodeRegex = /`([^`]+)`/g;
  
  const blockParts = text.split(blockCodeRegex).map((part, idx) => {
    if (idx % 2 === 1) {
      return { type: 'code-block', content: part };
    }
    return { type: 'text', content: part };
  });

  return blockParts.map((block, blockIdx) => {
    if (block.type === 'code-block') {
      return <CodeBlock key={blockIdx} code={block.content} />;
    }

    const inlineParts = block.content.split(inlineCodeRegex).map((part, inlineIdx) => {
      if (inlineIdx % 2 === 1) {
        return (
          <code key={`inline-${inlineIdx}`} className="inline-code">
            {part}
          </code>
        );
      }

      const boldItalicParts = part.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
      return boldItalicParts.map((bprt, bIdx) => {
        if (bprt.startsWith('**') && bprt.endsWith('**')) {
          return <strong key={`bold-${bIdx}`}>{bprt.slice(2, -2)}</strong>;
        }
        if (bprt.startsWith('*') && bprt.endsWith('*')) {
          return <em key={`italic-${bIdx}`}>{bprt.slice(1, -1)}</em>;
        }
        return <React.Fragment key={`text-${bIdx}`}>{bprt}</React.Fragment>;
      });
    });

    return <React.Fragment key={`text-block-${blockIdx}`}>{inlineParts}</React.Fragment>;
  });
}
const ACTION_CONFIG = {
  open_youtube: {
    iconName: 'visualizar',
    title: 'Video encontrado',
    noQueryTitle: 'YouTube listo',
    btnLabel: 'Abrir en YouTube',
    noQueryDescription: 'Puedes abrir YouTube para buscar el video que necesitas.',
    colorClass: 'action-youtube',
  },
  open_search: {
    iconName: 'buscar',
    title: 'Busqueda preparada',
    noQueryTitle: 'Buscador listo',
    btnLabel: 'Buscar en Google',
    noQueryDescription: 'Puedes abrir Google para completar tu busqueda.',
    colorClass: 'action-google',
  },
  background_search: {
    iconName: 'informar',
    title: 'Analisis interno',
    noQueryTitle: 'Procesamiento completado',
    btnLabel: null,
    noQueryDescription: 'Consulta procesada internamente sin necesidad de abrir el navegador.',
    colorClass: 'action-background',
  },
  confirm_action: {
    iconName: 'seguridad',
    title: 'Confirmacion requerida',
    noQueryTitle: 'Confirmacion requerida',
    btnLabel: null,
    noQueryDescription: 'Esta accion requiere tu confirmacion antes de proceder.',
    colorClass: 'action-confirm',
  },
  toggle_fullscreen: {
    iconName: 'automatizar',
    title: 'Pantalla completa',
    noQueryTitle: 'Pantalla completa',
    btnLabel: null,
    noQueryDescription: 'Activando/desactivando el modo de pantalla completa...',
    colorClass: 'action-system',
  },
  reload_page: {
    iconName: 'automatizar',
    title: 'Reiniciando',
    noQueryTitle: 'Reiniciando',
    btnLabel: null,
    noQueryDescription: 'La página se recargará en unos instantes...',
    colorClass: 'action-system',
  },
  toggle_sidebar: {
    iconName: 'automatizar',
    title: 'Interfaz',
    noQueryTitle: 'Menú ajustado',
    btnLabel: null,
    noQueryDescription: 'Minimizando/expandiendo la barra lateral...',
    colorClass: 'action-system',
  },
  print_page: {
    iconName: 'informar',
    title: 'Impresión',
    noQueryTitle: 'Preparando impresión',
    btnLabel: null,
    noQueryDescription: 'Abriendo el cuadro de diálogo de impresión...',
    colorClass: 'action-system',
  },
  scroll_top: {
    iconName: 'ayuda',
    title: 'Navegación',
    noQueryTitle: 'Hacia arriba',
    btnLabel: null,
    noQueryDescription: 'Desplazando al inicio de la página...',
    colorClass: 'action-system',
  },
  scroll_bottom: {
    iconName: 'ayuda',
    title: 'Navegación',
    noQueryTitle: 'Hacia abajo',
    btnLabel: null,
    noQueryDescription: 'Desplazando al final de la conversación...',
    colorClass: 'action-system',
  },
  clear_chat: {
    iconName: 'eliminar',
    title: 'Limpieza',
    noQueryTitle: 'Borrando historial',
    btnLabel: null,
    noQueryDescription: 'Vaciando la conversación y reiniciando el id de mensajes...',
    colorClass: 'action-system',
  },
  system_scan: {
    iconName: 'seguridad',
    title: 'Análisis de Red',
    noQueryTitle: 'Escaneo de Seguridad',
    btnLabel: null,
    noQueryDescription: 'Realizando búsqueda de amenazas y vulnerabilidades...',
    colorClass: 'action-security',
  },
  data_encryption: {
    iconName: 'seguridad',
    title: 'Encriptado',
    noQueryTitle: 'Cifrado de Datos',
    btnLabel: null,
    noQueryDescription: 'Protegiendo información sensible con algoritmos avanzados...',
    colorClass: 'action-security',
  },
  create_routine: {
    iconName: 'automatizar',
    title: 'Nuevo Flujo',
    noQueryTitle: 'Diseño de Rutina',
    btnLabel: null,
    noQueryDescription: 'Creando secuencia de tareas automatizadas...',
    colorClass: 'action-automation',
  },
  set_timer: {
    iconName: 'automatizar',
    title: 'Programación',
    noQueryTitle: 'Temporizador Activo',
    btnLabel: null,
    noQueryDescription: 'Configurando alerta y recordatorio en el sistema...',
    colorClass: 'action-automation',
  },
  generate_report: {
    iconName: 'informar',
    title: 'Reporte Sistema',
    noQueryTitle: 'Generando Informe',
    btnLabel: null,
    noQueryDescription: 'Recopilando métricas y estadísticas de uso...',
    colorClass: 'action-report',
  },
};

function ActionCard({ action }) {
  const config = ACTION_CONFIG[action.action];
  if (!config) {
    return null;
  }

  const title = action.hasQuery ? config.title : config.noQueryTitle;
  const description = action.hasQuery
    ? action.description
    : config.noQueryDescription;
  const btnLabel = action.label || config.btnLabel;

  return (
    <div className={`search-action-card ${config.colorClass}`}>
      <div className="search-action-header">
        <span className="search-action-icon">
          <IntentIcon name={config.iconName} size={18} />
        </span>
        <div>
          <p className="search-action-title">{title}</p>
          <p className="search-action-description">
            {action.hasQuery ? (
              <>
                Consulta detectada: <span className="search-query">{action.query}</span>
              </>
            ) : (
              description
            )}
          </p>
        </div>
      </div>

      {btnLabel && action.url && (
        <a className="search-action-btn" href={action.url} target="_blank" rel="noreferrer">
          <IntentIcon name="external" size={16} />
          {btnLabel}
        </a>
      )}

      {action.action === 'confirm_action' && (
        <p className="search-action-helper">Esta accion es potencialmente destructiva. Confirma antes de proceder.</p>
      )}

      {action.action === 'background_search' && (
        <p className="search-action-helper">Procesado internamente. No se abrio ninguna pestaña externa.</p>
      )}
    </div>
  );
}

export default function ChatMessage({ message, isLatest }) {
  const isUser = message.sender === 'user';

  return (
    <div className={`chat-message ${isUser ? 'user-message' : 'bot-message'} ${isLatest ? 'message-enter' : ''}`}>
      {!isUser && (
        <div className="bot-avatar">
          <svg width="24" height="24" viewBox="0 0 100 100" fill="none">
            <path d="M 50 15 C 30 15, 20 35, 25 55 C 20 70, 30 85, 50 85 C 70 85, 80 70, 75 55 C 80 35, 70 15, 50 15 Z" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
            <path d="M 23 45 C 5 35, 10 65, 26 65 M 77 45 C 95 35, 90 65, 74 65" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
            <path d="M 35 20 C 30 5, 20 10, 25 25 M 65 20 C 70 5, 80 10, 75 25" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
            <circle cx="42" cy="40" r="3" fill="#00ff00" />
            <circle cx="58" cy="40" r="3" fill="#00ff00" />
          </svg>
        </div>
      )}

      <div className={`message-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`}>
        {message.text && (
          <div className="message-copy">
            {!isUser && message.iconName && (
              <span className="message-type-icon">
                <IntentIcon name={message.iconName} size={16} />
              </span>
            )}
            <p className="message-text">{parseRichText(message.text)}</p>
          </div>
        )}

        {message.intents && message.intents.length > 0 && (
          <div className="intents-container">
            {message.intents.map((intent) => (
              <div key={`${intent.id}-${intent.response}`} className="intent-card" style={{ '--intent-color': intent.color }}>
                <div className="intent-header">
                  <span className="intent-icon">
                    <IntentIcon name={intent.iconName} size={18} />
                  </span>
                  <span className="intent-name">{intent.name}</span>
                  <span className="intent-badge">
                    {intent.matchedKeywords.length} coincidencia{intent.matchedKeywords.length > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="intent-response">{parseRichText(intent.response)}</p>
                <p className="intent-details">{parseRichText(intent.details)}</p>
                <div className="intent-keywords">
                  <span className="keywords-label">Palabras detectadas:</span>
                  <div className="keywords-list">
                    {intent.matchedKeywords.map((keyword) => (
                      <span key={`${intent.id}-${keyword}`} className="keyword-tag">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {message.actions && message.actions.length > 0 && (
          <div className="actions-container">
            {message.actions.map((action, index) => (
              <ActionCard key={`${action.intentId}-${action.action}-${index}`} action={action} />
            ))}
          </div>
        )}

        <span className="message-time">{message.time}</span>
      </div>
    </div>
  );
}
