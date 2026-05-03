import React, { memo, useState, useEffect, useRef } from 'react';
import IntentIcon from './IntentIcon';
import FlowLogo from './FlowLogo';

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
    title: 'Búsqueda preparada',
    noQueryTitle: 'Buscador listo',
    btnLabel: 'Buscar en Google',
    noQueryDescription: 'Puedes abrir Google para completar tu búsqueda.',
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
    noQueryDescription: 'Desplazando al final de la conversación.',
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

class PyodideLoader {
  constructor() {
    this.pyodide = null;
    this.loading = false;
    this.loadPromise = null;
  }

  async load() {
    if (this.pyodide) return this.pyodide;
    if (this.loadPromise) return this.loadPromise;

    this.loading = true;
    this.loadPromise = (async () => {
      try {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
        document.head.appendChild(script);

        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });

        this.pyodide = await window.loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/',
        });

        this.loading = false;
        return this.pyodide;
      } catch (error) {
        this.loading = false;
        this.loadPromise = null;
        throw error;
      }
    })();

    return this.loadPromise;
  }

  async runPython(code) {
    const pyodide = await this.load();
    
    const captureCode = `
import sys
from io import StringIO

_stdout = StringIO()
_stderr = StringIO()
sys.stdout = _stdout
sys.stderr = _stderr

try:
${code.split('\n').map(line => '    ' + line).join('\n')}
except Exception as e:
    import traceback
    sys.stderr.write(traceback.format_exc())

_stdout_value = _stdout.getvalue()
_stderr_value = _stderr.getvalue()
`;

    await pyodide.runPythonAsync(captureCode);
    const stdout = pyodide.runPython('_stdout_value');
    const stderr = pyodide.runPython('_stderr_value');

    return { stdout, stderr };
  }
}

const pyodideLoader = new PyodideLoader();

function normalizeLanguage(language = '') {
  const normalized = language.trim().toLowerCase();
  if (['js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript'].includes(normalized)) return 'javascript';
  if (['html', 'xml', 'svg'].includes(normalized)) return 'html';
  if (['css', 'scss'].includes(normalized)) return 'css';
  if (['json'].includes(normalized)) return 'json';
  if (['bash', 'sh', 'shell'].includes(normalized)) return 'bash';
  if (['python', 'py'].includes(normalized)) return 'python';
  return normalized || 'plain';
}

function isExecutable(language) {
  return ['html', 'javascript', 'python'].includes(language);
}

function wrapJavaScriptInHTML(jsCode) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JavaScript Preview</title>
</head>
<body>
  <script>
    (function() {
      const methods = ['log', 'error', 'warn', 'info', 'debug', 'table'];
      const original = {};
      methods.forEach(method => {
        original[method] = console[method];
        console[method] = function(...args) {
          original[method].apply(console, args);
          window.parent.postMessage({
            type: 'console',
            method: method,
            args: args.map(arg => {
              try {
                return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
              } catch {
                return String(arg);
              }
            }),
            timestamp: Date.now()
          }, '*');
        };
      });

      window.onerror = function(message, source, lineno, colno, error) {
        window.parent.postMessage({
          type: 'error',
          message: message,
          timestamp: Date.now()
        }, '*');
        return false;
      };
    })();
  </script>
  <script>
${jsCode}
  </script>
</body>
</html>`;
}

function injectConsoleInterceptor(htmlCode) {
  const interceptorScript = `<script>
    (function() {
      const methods = ['log', 'error', 'warn', 'info', 'debug', 'table'];
      const original = {};
      methods.forEach(method => {
        original[method] = console[method];
        console[method] = function(...args) {
          original[method].apply(console, args);
          window.parent.postMessage({
            type: 'console',
            method: method,
            args: args.map(arg => {
              try {
                return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
              } catch {
                return String(arg);
              }
            }),
            timestamp: Date.now()
          }, '*');
        };
      });

      window.onerror = function(message, source, lineno, colno, error) {
        window.parent.postMessage({
          type: 'error',
          message: message,
          timestamp: Date.now()
        }, '*');
        return false;
      };
    })();
  </script>`;

  if (/<\/head>/i.test(htmlCode)) {
    return htmlCode.replace(/<\/head>/i, `${interceptorScript}</head>`);
  }
  if (/<body[^>]*>/i.test(htmlCode)) {
    return htmlCode.replace(/<body[^>]*>/i, (match) => `${match}${interceptorScript}`);
  }
  return interceptorScript + htmlCode;
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
    python: 'Python',
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

function ConsolePanel({ messages }) {
  const consoleRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    if (consoleRef.current && isAtBottom) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [messages, isAtBottom]);

  const handleScroll = () => {
    if (consoleRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = consoleRef.current;
      setIsAtBottom(scrollHeight - scrollTop - clientHeight < 10);
    }
  };

  return (
    <div className="console-panel" ref={consoleRef} onScroll={handleScroll}>
      {messages.length === 0 ? (
        <div className="console-empty">Consola vacía</div>
      ) : (
        messages.map((msg) => (
          <div key={msg.id} className={`console-message console-${msg.method}`}>
            <span className="console-method">{msg.method}</span>
            <span className="console-content">{msg.content}</span>
          </div>
        ))
      )}
    </div>
  );
}

function CodeBlock({ rawContent, enableHtmlPreview = true }) {
  const { language: hintedLanguage, code } = parseCodeFence(rawContent);
  const language = detectLanguage(code, hintedLanguage);
  const executable = isExecutable(language) && enableHtmlPreview;
  const lineCount = code.split('\n').length;
  const [expanded, setExpanded] = useState(lineCount <= 14);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('preview');
  const [fullscreen, setFullscreen] = useState(false);
  const [consoleMessages, setConsoleMessages] = useState([]);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState(null);
  const [executionKey, setExecutionKey] = useState(0);
  const isHtmlPreview = enableHtmlPreview && (hintedLanguage.trim().toLowerCase() === 'html' || language === 'html' || language === 'javascript');

  const executePython = React.useCallback(async () => {
    setExecuting(true);
    setConsoleMessages([]);
    setError(null);

    try {
      const { stdout, stderr } = await pyodideLoader.runPython(code.trim());

      if (stdout) {
        setConsoleMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-stdout`,
            method: 'log',
            content: stdout,
            timestamp: Date.now(),
          },
        ]);
      }

      if (stderr) {
        setError(stderr);
        setConsoleMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-stderr`,
            method: 'error',
            content: stderr,
            timestamp: Date.now(),
          },
        ]);
      }
    } catch (err) {
      const errorMsg = err?.message || String(err) || 'Error ejecutando Python';
      setError(errorMsg);
      setConsoleMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          method: 'error',
          content: errorMsg,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setExecuting(false);
    }
  }, [code]);

  useEffect(() => {
    if (!executable || !expanded) return;

    const handleMessage = (event) => {
      if (event.data?.type === 'console') {
        const { method, args, timestamp } = event.data;
        setConsoleMessages((prev) => [
          ...prev,
          {
            id: `${timestamp}-${Math.random()}`,
            method,
            content: args.join(' '),
            timestamp,
          },
        ]);
      } else if (event.data?.type === 'error') {
        setError(event.data.message);
        setConsoleMessages((prev) => [
          ...prev,
          {
            id: `${event.data.timestamp}-${Math.random()}`,
            method: 'error',
            content: event.data.message,
            timestamp: event.data.timestamp,
          },
        ]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [executable, expanded, executionKey]);

  useEffect(() => {
    if (language === 'python' && expanded && executionKey === 0) {
      executePython();
    }
  }, [language, expanded, executionKey, executePython]);

  function handleCopy() {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleRerun() {
    setConsoleMessages([]);
    setError(null);
    setExecutionKey((k) => k + 1);
    
    if (language === 'python') {
      executePython();
    }
  }

  return (
    <div className="code-block-wrapper">
      <div className="code-block-toolbar">
        <div className="code-block-meta">
          <span className="code-block-language">{getLanguageLabel(language)}</span>
          <span className="code-block-lines">{lineCount} lineas</span>
          {!executable && expanded && (
            <span className="code-block-fallback-badge">Preview no disponible</span>
          )}
        </div>
        <div className="code-block-actions">
          {executable && expanded ? (
            <div className="code-view-toggle" aria-label="Alternar vista">
              <button
                type="button"
                className={`code-toolbar-btn ${activeTab === 'preview' ? 'code-toolbar-btn-active' : ''}`}
                onClick={() => setActiveTab('preview')}
              >
                Preview
              </button>
              <button
                type="button"
                className={`code-toolbar-btn ${activeTab === 'code' ? 'code-toolbar-btn-active' : ''}`}
                onClick={() => setActiveTab('code')}
              >
                Código
              </button>
              <button
                type="button"
                className={`code-toolbar-btn ${activeTab === 'console' ? 'code-toolbar-btn-active' : ''}`}
                onClick={() => setActiveTab('console')}
              >
                Consola
              </button>
            </div>
          ) : isHtmlPreview && expanded ? (
            <div className="code-view-toggle" aria-label="Alternar vista HTML">
              <button
                type="button"
                className={`code-toolbar-btn ${activeTab === 'preview' ? 'code-toolbar-btn-active' : ''}`}
                onClick={() => setActiveTab('preview')}
              >
                Preview
              </button>
              <button
                type="button"
                className={`code-toolbar-btn ${activeTab === 'code' ? 'code-toolbar-btn-active' : ''}`}
                onClick={() => setActiveTab('code')}
              >
                Código
              </button>
            </div>
          ) : null}
          {isHtmlPreview && expanded && (
            <button type="button" className="code-toolbar-btn" onClick={() => setFullscreen((value) => !value)}>
              {fullscreen ? 'Cerrar' : 'Pantalla'}
            </button>
          )}
          {executable && expanded && (
            <button type="button" className="code-toolbar-btn" onClick={handleRerun} disabled={executing}>
              {executing ? '...' : 'Correr'}
            </button>
          )}
          <button type="button" className="code-toolbar-btn" onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Ocultar' : 'Ver'}
          </button>
          <button type="button" className="code-copy-btn" onClick={handleCopy}>
            {copied ? 'Listo' : 'Copiar'}
          </button>
        </div>
      </div>

      {expanded && error && (
        <div className="code-error-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {expanded && (
        <>
          {executable && activeTab === 'preview' ? (
            language === 'python' ? (
              <div className="python-preview-shell">
                {executing ? (
                  <div className="python-loading">
                    <div className="python-loading-spinner"></div>
                    <span>Ejecutando Python...</span>
                  </div>
                ) : (
                  <div className="python-output">
                    <div className="python-output-hint">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="4 17 10 11 4 5" />
                        <line x1="12" y1="19" x2="20" y2="19" />
                      </svg>
                      <span>Salida en la pestaña Consola</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={`html-preview-shell ${fullscreen ? 'html-preview-shell-fullscreen' : ''}`}>
                {fullscreen && (
                  <div className="html-preview-fullscreen-toolbar">
                    <div className="fullscreen-mascot-container">
                      <FlowLogo size={48} mood="excited" trackCursor={true} />
                    </div>
                    <span>Preview Interactiva</span>
                    <button type="button" className="code-toolbar-btn" onClick={() => setFullscreen(false)}>
                      Cerrar Vista
                    </button>
                  </div>
                )}
                <iframe
                  key={executionKey}
                  className="html-preview-frame"
                  title="Vista previa"
                  sandbox="allow-scripts allow-modals"
                  srcDoc={language === 'javascript' ? wrapJavaScriptInHTML(code.trim()) : injectConsoleInterceptor(code.trim())}
                />
              </div>
            )
          ) : executable && activeTab === 'console' ? (
            <ConsolePanel messages={consoleMessages} />
          ) : isHtmlPreview && activeTab === 'preview' ? (
            <div className={`html-preview-shell ${fullscreen ? 'html-preview-shell-fullscreen' : ''}`}>
              {fullscreen && (
                <div className="html-preview-fullscreen-toolbar">
                  <div className="fullscreen-mascot-container">
                    <FlowLogo size={48} mood="celebrating" trackCursor={true} />
                  </div>
                  <span>Vista Previa HTML</span>
                  <button type="button" className="code-toolbar-btn" onClick={() => setFullscreen(false)}>
                    Cerrar Vista
                  </button>
                </div>
              )}
              <iframe
                className="html-preview-frame"
                title="Vista previa HTML"
                sandbox="allow-scripts"
                srcDoc={code.trim()}
              />
            </div>
          ) : (
            <pre className="code-block">
              <code className={`code-content language-${language}`}>
                {renderHighlightedCode(code.trim(), language)}
              </code>
            </pre>
          )}
        </>
      )}
    </div>
  );
}

function normalizeMarkdownText(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|h[1-6]|li)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/?(?:p|div|section|article|span|strong|b|em|i|ul|ol)[^>]*>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function renderInlineMarkdown(text, keyPrefix) {
  const parts = String(text || '').split(/(\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^)]+\)|`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g);

  return parts.filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    const linkMatch = part.match(/^\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={key} className="message-link" href={linkMatch[2]} target="_blank" rel="noreferrer">
          {linkMatch[1]}
        </a>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key} className="inline-code">{part.slice(1, -1)}</code>;
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

function renderParagraph(lines, key) {
  return (
    <p key={key}>
      {lines.map((line, index) => (
        <React.Fragment key={`${key}-line-${index}`}>
          {index > 0 && <br />}
          {renderInlineMarkdown(line.trim(), `${key}-inline-${index}`)}
        </React.Fragment>
      ))}
    </p>
  );
}

function renderList(items, ordered, key) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag key={key}>
      {items.map((item, index) => (
        <li key={`${key}-item-${index}`}>{renderInlineMarkdown(item, `${key}-inline-${index}`)}</li>
      ))}
    </Tag>
  );
}

function renderMarkdownBlock(content, keyPrefix) {
  const normalized = normalizeMarkdownText(content);
  if (!normalized) return null;

  const elements = [];
  const lines = normalized.split('\n');
  let paragraphLines = [];
  let listItems = [];
  let listOrdered = false;

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    elements.push(renderParagraph(paragraphLines, `${keyPrefix}-p-${elements.length}`));
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    elements.push(renderList(listItems, listOrdered, `${keyPrefix}-list-${elements.length}`));
    listItems = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length + 2;
      const Tag = `h${level}`;
      elements.push(<Tag key={`${keyPrefix}-heading-${elements.length}`}>{renderInlineMarkdown(headingMatch[2], `${keyPrefix}-heading-inline-${elements.length}`)}</Tag>);
      return;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      flushList();
      elements.push(<hr key={`${keyPrefix}-hr-${elements.length}`} />);
      return;
    }

    const quoteMatch = trimmed.match(/^>\s?(.+)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      elements.push(<blockquote key={`${keyPrefix}-quote-${elements.length}`}>{renderInlineMarkdown(quoteMatch[1], `${keyPrefix}-quote-inline-${elements.length}`)}</blockquote>);
      return;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      flushParagraph();
      const nextOrdered = Boolean(orderedMatch);
      if (listItems.length && listOrdered !== nextOrdered) flushList();
      listOrdered = nextOrdered;
      listItems.push((orderedMatch || unorderedMatch)[1]);
      return;
    }

    flushList();
    paragraphLines.push(trimmed);
  });

  flushParagraph();
  flushList();

  return elements;
}

function parseRichText(text, options = {}) {
  const enableHtmlPreview = options.enableHtmlPreview !== false;
  const blocks = [];
  const fenceRegex = /```([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = fenceRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    blocks.push({ type: 'code-block', content: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) blocks.push({ type: 'text', content: text.slice(lastIndex) });

  return blocks.map((block, index) => (
    block.type === 'code-block'
      ? <CodeBlock key={`code-${index}`} rawContent={block.content} enableHtmlPreview={enableHtmlPreview} />
      : <React.Fragment key={`text-${index}`}>{renderMarkdownBlock(block.content, `block-${index}`)}</React.Fragment>
  ));
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

function ChatMessage({ message, isLatest, onStatusChange }) {
  const isUser = message.sender === 'user';
  const [ephemeralStatus, setEphemeralStatus] = useState('hidden'); // hidden, revealed, consumed
  const bubbleRef = useRef(null);

  useEffect(() => {
    if (message.ephemeral && ephemeralStatus === 'revealed') {
      const handleClickOutside = (e) => {
        if (bubbleRef.current && !bubbleRef.current.contains(e.target)) {
          setEphemeralStatus('consumed');
          if (onStatusChange) onStatusChange('consumed');
        }
      };
      
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [message.ephemeral, ephemeralStatus, onStatusChange]);

  const handleReveal = () => {
    if (ephemeralStatus === 'hidden') {
      setEphemeralStatus('revealed');
      if (onStatusChange) onStatusChange('revealed');
    }
  };

  const handleConsume = (e) => {
    e.stopPropagation();
    if (ephemeralStatus !== 'consumed') {
      setEphemeralStatus('consumed');
      if (onStatusChange) onStatusChange('consumed');
    }
  };

  return (
    <div className={`chat-message ${isUser ? 'user-message' : 'bot-message'} ${isLatest ? 'message-enter' : ''}`}>
      <div 
        ref={bubbleRef}
        className={`message-bubble ${isUser ? 'user-bubble' : 'bot-bubble'} ${message.ephemeral && ephemeralStatus === 'hidden' ? 'ephemeral-hidden' : ''} ${message.ephemeral && ephemeralStatus === 'consumed' ? 'ephemeral-consumed' : ''}`}
      >
        {message.ephemeral && ephemeralStatus === 'hidden' ? (
          <div className="ephemeral-placeholder" onClick={handleReveal}>
            <div className="ephemeral-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2s-8 11-8 16c0 4.4 3.6 8 8 8s8-3.6 8-8c0-5-8-16-8-16z"/>
                <path d="m9 15.2 2 2 4-4"/>
              </svg>
            </div>
            <div className="ephemeral-text">
              <span className="ephemeral-title">Mensaje Efímero</span>
              <span className="ephemeral-desc">Toca para ver una sola vez</span>
            </div>
          </div>
        ) : message.ephemeral && ephemeralStatus === 'consumed' ? (
          <div className="ephemeral-consumed-placeholder">
            <div className="ephemeral-consumed-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <span className="ephemeral-consumed-text">Mensaje Visto y Bloqueado</span>
          </div>
        ) : (
          <>
            {message.ephemeral && (
              <div className="ephemeral-banner">
                <span className="ephemeral-status-badge">Revelado</span>
                <button type="button" className="ephemeral-close-btn" onClick={handleConsume} title="Cerrar y bloquear">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}
            {message.text && (
              <div className="message-copy">
                <div className="message-text">{parseRichText(message.text, { enableHtmlPreview: !isUser })}</div>
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
          </>
        )}
      </div>
    </div>
  );
}

export default memo(ChatMessage);

