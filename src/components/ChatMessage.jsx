import React, { memo, useState } from 'react';
import FlowLogo from './FlowLogo';
import IntentIcon from './IntentIcon';

const MODE_LABELS = { deep: 'Profundo', short: 'Rapido', normal: null };

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
  toggle_fullscreen: {
    iconName: 'automatizar',
    title: 'Pantalla completa',
    noQueryTitle: 'Pantalla completa',
    btnLabel: null,
    noQueryDescription: 'Activando o desactivando el modo de pantalla completa.',
    colorClass: 'action-system',
  },
  reload_page: {
    iconName: 'automatizar',
    title: 'Reiniciando',
    noQueryTitle: 'Reiniciando',
    btnLabel: null,
    noQueryDescription: 'La pagina se recargara en unos instantes.',
    colorClass: 'action-system',
  },
  toggle_sidebar: {
    iconName: 'automatizar',
    title: 'Interfaz',
    noQueryTitle: 'Menu ajustado',
    btnLabel: null,
    noQueryDescription: 'Minimizando o expandiendo la barra lateral.',
    colorClass: 'action-system',
  },
  print_page: {
    iconName: 'informar',
    title: 'Impresion',
    noQueryTitle: 'Preparando impresion',
    btnLabel: null,
    noQueryDescription: 'Abriendo el dialogo de impresion.',
    colorClass: 'action-system',
  },
  scroll_top: {
    iconName: 'ayuda',
    title: 'Navegacion',
    noQueryTitle: 'Hacia arriba',
    btnLabel: null,
    noQueryDescription: 'Desplazando al inicio de la pagina.',
    colorClass: 'action-system',
  },
  scroll_bottom: {
    iconName: 'ayuda',
    title: 'Navegacion',
    noQueryTitle: 'Hacia abajo',
    btnLabel: null,
    noQueryDescription: 'Desplazando al final de la conversacion.',
    colorClass: 'action-system',
  },
  set_timer: {
    iconName: 'automatizar',
    title: 'Programacion',
    noQueryTitle: 'Temporizador activo',
    btnLabel: null,
    noQueryDescription: 'Configurando alerta en el sistema.',
    colorClass: 'action-automation',
  },
};

const JS_KEYWORDS = new Set([
  'import', 'from', 'export', 'default', 'const', 'let', 'var', 'function', 'return',
  'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'async', 'await',
  'try', 'catch', 'throw', 'class', 'new', 'extends', 'true', 'false', 'null', 'undefined',
]);

const CSS_KEYWORDS = new Set([
  '@media', '@keyframes', 'display', 'position', 'background', 'color', 'border', 'padding',
  'margin', 'gap', 'grid', 'flex', 'absolute', 'relative', 'fixed', 'sticky', 'var',
]);

const BASH_KEYWORDS = new Set(['npm', 'pnpm', 'yarn', 'git', 'node', 'cd', 'ls', 'mkdir', 'echo', 'cat', 'curl']);

function normalizeLanguage(language = '') {
  const normalized = language.trim().toLowerCase();
  if (['js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript'].includes(normalized)) return 'javascript';
  if (['html', 'xml', 'svg'].includes(normalized)) return 'html';
  if (['css', 'scss'].includes(normalized)) return 'css';
  if (['json'].includes(normalized)) return 'json';
  if (['bash', 'sh', 'shell'].includes(normalized)) return 'bash';
  return normalized || 'plain';
}

function detectLanguage(code, hint = '') {
  const normalizedHint = normalizeLanguage(hint);
  if (normalizedHint !== 'plain') return normalizedHint;
  if (/^\s*</m.test(code) && /<\/?[a-z]/i.test(code)) return 'html';
  if (/[{;]\s*$/m.test(code) && /\b(import|const|function|return|export)\b/.test(code)) return 'javascript';
  if (/[.#][\w-]+\s*\{/.test(code) || /\b(display|background|color|padding|margin)\s*:/.test(code)) return 'css';
  if (/^\s*[{[]/.test(code)) {
    try {
      JSON.parse(code);
      return 'json';
    } catch {
      return 'plain';
    }
  }
  if (/^\s*(npm|pnpm|yarn|git|node|cd|ls)\b/m.test(code)) return 'bash';
  return 'plain';
}

function tokenizeLine(line, language) {
  if (!line) return [{ type: 'plain', value: ' ' }];

  const patterns = {
    javascript: /(\/\/.*|\/\*.*?\*\/|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b|<\/?[A-Za-z][^>]*>|[{}()[\];,.<>:=+\-/*%]+)/g,
    html: /(<!--.*?-->|<\/?[A-Za-z][A-Za-z0-9:-]*|\/?>|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b[A-Za-z-:]+(?==)|\b\d+(?:\.\d+)?\b|[{}()[\];,.<>:=+\-/*%]+)/g,
    css: /(\/\*.*?\*\/|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|fr)?\b|@?[A-Za-z-]+\b|[{}()[\];,.<>:=+\-/*%]+)/g,
    json: /("(?:\\.|[^"])*"(?=\s*:)|"(?:\\.|[^"])*"|true|false|null|\b\d+(?:\.\d+)?\b|[{}[\],:])/g,
    bash: /(#[^\n]*|\$\w+|\b[A-Za-z_-]+\b|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b\d+(?:\.\d+)?\b|[|&;<>:=+\-/*%]+)/g,
    plain: /(\S+|\s+)/g,
  };

  const regex = patterns[language] || patterns.plain;
  const parts = [];
  let lastIndex = 0;

  for (const match of line.matchAll(regex)) {
    const value = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push({ type: 'plain', value: line.slice(lastIndex, index) });
    parts.push({ type: classifyToken(value, language), value });
    lastIndex = index + value.length;
  }

  if (lastIndex < line.length) parts.push({ type: 'plain', value: line.slice(lastIndex) });
  return parts;
}

function classifyToken(value, language) {
  if (language === 'javascript') {
    if (value.startsWith('//') || value.startsWith('/*')) return 'comment';
    if (/^['"`]/.test(value)) return 'string';
    if (/^\d/.test(value)) return 'number';
    if (value.startsWith('<')) return 'tag';
    if (JS_KEYWORDS.has(value)) return 'keyword';
    if (/^[{}()[\];,.<>:=+\-/*%]+$/.test(value)) return 'punctuation';
    return 'plain';
  }

  if (language === 'html') {
    if (value.startsWith('<!--')) return 'comment';
    if (/^['"]/.test(value)) return 'string';
    if (value.startsWith('<') || value === '/>') return 'tag';
    if (/^[A-Za-z-:]+$/.test(value)) return 'attr';
    if (/^\d/.test(value)) return 'number';
    return 'punctuation';
  }

  if (language === 'css') {
    if (value.startsWith('/*')) return 'comment';
    if (/^['"]/.test(value) || value.startsWith('#')) return 'string';
    if (/^\d/.test(value)) return 'number';
    if (CSS_KEYWORDS.has(value)) return 'keyword';
    if (/^[A-Za-z-]+$/.test(value)) return 'property';
    return 'punctuation';
  }

  if (language === 'json') {
    if (/^"/.test(value)) return value.endsWith(':') ? 'property' : 'string';
    if (/^(true|false|null)$/.test(value)) return 'keyword';
    if (/^\d/.test(value)) return 'number';
    return 'punctuation';
  }

  if (language === 'bash') {
    if (value.startsWith('#')) return 'comment';
    if (/^['"]/.test(value) || value.startsWith('$')) return 'string';
    if (/^\d/.test(value)) return 'number';
    if (BASH_KEYWORDS.has(value)) return 'command';
    return 'punctuation';
  }

  return 'plain';
}

function renderHighlightedCode(code, language) {
  return code.split('\n').map((line, lineIndex) => (
    <span key={`line-${lineIndex}`} className="code-line">
      {tokenizeLine(line, language).map((token, tokenIndex) => (
        <span key={`token-${lineIndex}-${tokenIndex}`} className={`code-token code-token-${token.type}`}>
          {token.value}
        </span>
      ))}
      {lineIndex < code.split('\n').length - 1 ? '\n' : ''}
    </span>
  ));
}

function getLanguageLabel(language) {
  const labels = {
    javascript: 'JavaScript',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
    bash: 'Bash',
    plain: 'Code',
  };
  return labels[language] || language;
}

function parseCodeFence(rawContent) {
  const normalized = rawContent.replace(/^\n+|\n+$/g, '');
  const parts = normalized.split('\n');
  const firstLine = parts[0]?.trim() || '';
  const hasExplicitLanguage = /^[A-Za-z0-9#+.-]+$/.test(firstLine) && parts.length > 1;
  return {
    language: hasExplicitLanguage ? firstLine : '',
    code: hasExplicitLanguage ? parts.slice(1).join('\n') : normalized,
  };
}

function CodeBlock({ rawContent }) {
  const { language: hintedLanguage, code } = parseCodeFence(rawContent);
  const language = detectLanguage(code, hintedLanguage);
  const lineCount = code.split('\n').length;
  const [expanded, setExpanded] = useState(lineCount <= 14);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="code-block-wrapper">
      <div className="code-block-toolbar">
        <div className="code-block-meta">
          <span className="code-block-language">{getLanguageLabel(language)}</span>
          <span className="code-block-lines">{lineCount} lineas</span>
        </div>
        <div className="code-block-actions">
          <button type="button" className="code-toolbar-btn" onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Ocultar' : 'Expandir'}
          </button>
          <button type="button" className="code-copy-btn" onClick={handleCopy}>
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      {expanded && (
        <pre className="code-block">
          <code className={`code-content language-${language}`}>
            {renderHighlightedCode(code.trim(), language)}
          </code>
        </pre>
      )}
    </div>
  );
}

function parseRichText(text) {
  const blockParts = text.split(/(```[\s\S]*?```)/g).map((part, idx) => {
    if (idx % 2 === 1) return { type: 'code-block', content: part.replace(/^```|```$/g, '') };
    return { type: 'text', content: part };
  });

  return blockParts.map((block, blockIdx) => {
    if (block.type === 'code-block') return <CodeBlock key={blockIdx} rawContent={block.content} />;

    const inlineParts = block.content.split(/(`[^`]+`)/g).map((part, inlineIdx) => {
      if (inlineIdx % 2 === 1) {
        return <code key={`inline-${inlineIdx}`} className="inline-code">{part.slice(1, -1)}</code>;
      }

      return part.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((fragment, fragmentIdx) => {
        if (fragment.startsWith('**') && fragment.endsWith('**')) return <strong key={`bold-${fragmentIdx}`}>{fragment.slice(2, -2)}</strong>;
        if (fragment.startsWith('*') && fragment.endsWith('*')) return <em key={`italic-${fragmentIdx}`}>{fragment.slice(1, -1)}</em>;
        return <React.Fragment key={`text-${fragmentIdx}`}>{fragment}</React.Fragment>;
      });
    });

    return <React.Fragment key={`block-${blockIdx}`}>{inlineParts}</React.Fragment>;
  });
}

function ActionCard({ action }) {
  const config = ACTION_CONFIG[action.action];
  if (!config) return null;

  const title = action.hasQuery ? config.title : config.noQueryTitle;
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
              : config.noQueryDescription}
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

function ChatMessage({ message, isLatest }) {
  const isUser = message.sender === 'user';

  return (
    <div className={`chat-message ${isUser ? 'user-message' : 'bot-message'} ${isLatest ? 'message-enter' : ''}`}>
      {!isUser && (
        <div className="bot-avatar">
          <FlowLogo size={24} mood={message.fallbackReason ? 'error' : 'default'} reading={!message.fallbackReason} />
        </div>
      )}

      <div className={`message-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`}>
        {!isUser && (
          <div className="message-head">
            <div className="message-author">
              <span className="message-role">FlowBot</span>
            </div>
            <div className="message-header-meta">
              {!isUser && message.model && (
                <span className="message-inline-chip">
                  {message.model}
                  {message.thinkingMode && message.thinkingMode !== 'normal' && MODE_LABELS[message.thinkingMode] && (
                    <span className="message-chip-separator">{MODE_LABELS[message.thinkingMode]}</span>
                  )}
                </span>
              )}
              <span className="message-time">{message.time}</span>
            </div>
          </div>
        )}

        {message.text && (
          <div className="message-copy">
            {!isUser && message.iconName && (
              <span className="message-type-icon"><IntentIcon name={message.iconName} size={16} /></span>
            )}
            <div className="message-text">{parseRichText(message.text)}</div>
          </div>
        )}

        {message.intents?.length > 0 && (
          <div className="intents-container">
            {message.intents.map((intent) => (
              <div key={`${intent.id}-${intent.response}`} className="intent-card" style={{ '--intent-color': intent.color }}>
                <div className="intent-header">
                  <span className="intent-icon"><IntentIcon name={intent.iconName} size={18} /></span>
                  <span className="intent-name">{intent.name}</span>
                  <span className="intent-badge">{intent.matchedKeywords.length} match{intent.matchedKeywords.length > 1 ? 'es' : ''}</span>
                </div>
                <div className="intent-response">{parseRichText(intent.response)}</div>
                <div className="intent-details">{parseRichText(intent.details)}</div>
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
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {message.fallbackReason}
          </div>
        )}

        {isUser && <span className="message-time user-message-time">{message.time}</span>}
      </div>
    </div>
  );
}

export default memo(ChatMessage);
