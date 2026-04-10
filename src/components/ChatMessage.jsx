import React, { useState } from 'react';
import FlowLogo from './FlowLogo';
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
          {copied ? <polyline points="20 6 9 17 4 12"/> : <>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
          </>}
        </svg>
        {copied ? '✓' : 'Copiar'}
      </button>
      <pre className="code-block"><code className="code-content">{code.trim()}</code></pre>
    </div>
  );
}

function parseRichText(text) {
  const blockParts = text.split(/(```[\s\S]*?```)/g).map((part, idx) => {
    if (idx % 2 === 1) return { type: 'code-block', content: part.replace(/^```|```$/g, '') };
    return { type: 'text', content: part };
  });

  return blockParts.map((block, blockIdx) => {
    if (block.type === 'code-block') return <CodeBlock key={blockIdx} code={block.content} />;

    const inlineParts = block.content.split(/(`[^`]+`)/g).map((part, inlineIdx) => {
      if (inlineIdx % 2 === 1) return <code key={`ic-${inlineIdx}`} className="inline-code">{part.slice(1, -1)}</code>;

      return part.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((bp, bIdx) => {
        if (bp.startsWith('**') && bp.endsWith('**')) return <strong key={`b-${bIdx}`}>{bp.slice(2, -2)}</strong>;
        if (bp.startsWith('*')  && bp.endsWith('*'))  return <em key={`i-${bIdx}`}>{bp.slice(1, -1)}</em>;
        return <React.Fragment key={`t-${bIdx}`}>{bp}</React.Fragment>;
      });
    });

    return <React.Fragment key={`tb-${blockIdx}`}>{inlineParts}</React.Fragment>;
  });
}

const ACTION_CONFIG = {
  open_youtube:     { iconName: 'visualizar', title: 'Video encontrado',   noQueryTitle: 'YouTube listo',  btnLabel: 'Abrir en YouTube', noQueryDescription: 'Puedes abrir YouTube para buscar el video que necesitas.', colorClass: 'action-youtube' },
  open_search:      { iconName: 'buscar',     title: 'Búsqueda preparada', noQueryTitle: 'Buscador listo', btnLabel: 'Buscar en Google', noQueryDescription: 'Puedes abrir Google para completar tu búsqueda.',            colorClass: 'action-google'  },
  toggle_fullscreen:{ iconName: 'automatizar',title: 'Pantalla completa',  noQueryTitle: 'Pantalla completa', btnLabel: null, noQueryDescription: 'Activando/desactivando el modo de pantalla completa...', colorClass: 'action-system' },
  reload_page:      { iconName: 'automatizar',title: 'Reiniciando',        noQueryTitle: 'Reiniciando',    btnLabel: null, noQueryDescription: 'La página se recargará en unos instantes...',                   colorClass: 'action-system' },
  toggle_sidebar:   { iconName: 'automatizar',title: 'Interfaz',           noQueryTitle: 'Menú ajustado',  btnLabel: null, noQueryDescription: 'Minimizando/expandiendo la barra lateral...',                  colorClass: 'action-system' },
  print_page:       { iconName: 'informar',   title: 'Impresión',          noQueryTitle: 'Preparando impresión', btnLabel: null, noQueryDescription: 'Abriendo el cuadro de diálogo de impresión...',          colorClass: 'action-system' },
  scroll_top:       { iconName: 'ayuda',      title: 'Navegación',         noQueryTitle: 'Hacia arriba',   btnLabel: null, noQueryDescription: 'Desplazando al inicio de la página...',                       colorClass: 'action-system' },
  scroll_bottom:    { iconName: 'ayuda',      title: 'Navegación',         noQueryTitle: 'Hacia abajo',    btnLabel: null, noQueryDescription: 'Desplazando al final de la conversación...',                  colorClass: 'action-system' },
  set_timer:        { iconName: 'automatizar',title: 'Programación',       noQueryTitle: 'Temporizador activo', btnLabel: null, noQueryDescription: 'Configurando alerta en el sistema...',                   colorClass: 'action-automation' },
};

function ActionCard({ action }) {
  const config = ACTION_CONFIG[action.action];
  if (!config) return null;
  const title    = action.hasQuery ? config.title : config.noQueryTitle;
  const btnLabel = action.label || config.btnLabel;
  return (
    <div className={`search-action-card ${config.colorClass}`}>
      <div className="search-action-header">
        <span className="search-action-icon"><IntentIcon name={config.iconName} size={18} /></span>
        <div>
          <p className="search-action-title">{title}</p>
          <p className="search-action-description">
            {action.hasQuery
              ? <>Consulta detectada: <span className="search-query">{action.query}</span></>
              : (action.hasQuery ? action.description : config.noQueryDescription)}
          </p>
        </div>
      </div>
      {btnLabel && action.url && (
        <a className="search-action-btn" href={action.url} target="_blank" rel="noreferrer">
          <IntentIcon name="external" size={16} />
          {btnLabel}
        </a>
      )}
    </div>
  );
}

const MODE_LABELS = { deep: 'Profundo', short: 'Conciso', normal: null };

export default function ChatMessage({ message, isLatest }) {
  const isUser = message.sender === 'user';

  return (
    <div className={`chat-message ${isUser ? 'user-message' : 'bot-message'} ${isLatest ? 'message-enter' : ''}`}>
      {!isUser && (
        <div className="bot-avatar">
          <FlowLogo size={24} />
        </div>
      )}

      <div className={`message-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`}>
        {message.text && (
          <div className="message-copy">
            {!isUser && message.iconName && (
              <span className="message-type-icon"><IntentIcon name={message.iconName} size={16} /></span>
            )}
            <p className="message-text">{parseRichText(message.text)}</p>
          </div>
        )}

        {message.intents?.length > 0 && (
          <div className="intents-container">
            {message.intents.map((intent) => (
              <div key={`${intent.id}-${intent.response}`} className="intent-card" style={{ '--intent-color': intent.color }}>
                <div className="intent-header">
                  <span className="intent-icon"><IntentIcon name={intent.iconName} size={18} /></span>
                  <span className="intent-name">{intent.name}</span>
                  <span className="intent-badge">{intent.matchedKeywords.length} coincidencia{intent.matchedKeywords.length > 1 ? 's' : ''}</span>
                </div>
                <p className="intent-response">{parseRichText(intent.response)}</p>
                <p className="intent-details">{parseRichText(intent.details)}</p>
              </div>
            ))}
          </div>
        )}

        {message.actions?.length > 0 && (
          <div className="actions-container">
            {message.actions.map((action, index) => (
              <ActionCard key={`${action.intentId}-${action.action}-${index}`} action={action} />
            ))}
          </div>
        )}

        
        {!isUser && message.fallbackReason && (
          <div className="message-fallback-notice">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            {message.fallbackReason}
          </div>
        )}

        
        {!isUser && message.model && (
          <div className="message-model-info">
            <span className="model-dot"></span>
            <span>{message.model}</span>
            {message.thinkingMode && message.thinkingMode !== 'normal' && MODE_LABELS[message.thinkingMode] && (
              <><span style={{ opacity: 0.4, margin: '0 2px' }}>·</span><span>{MODE_LABELS[message.thinkingMode]}</span></>
            )}
          </div>
        )}

        <span className="message-time">{message.time}</span>
      </div>
    </div>
  );
}
