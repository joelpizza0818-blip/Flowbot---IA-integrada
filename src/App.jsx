import React, { useState, useRef, useEffect } from 'react';
import FlowLogo from './components/FlowLogo';
import ChatMessage from './components/ChatMessage';
import IntentIcon from './components/IntentIcon';
import { generateBotResponse, intentGroups } from './chatbotLogic';
import './App.css';

const MOBILE_BREAKPOINT = 768;
const KEYBOARD_THRESHOLD = 120;

function getTimeString() {
  return new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function getViewportMetrics() {
  const visualViewport = window.visualViewport;
  const viewportHeight = Math.round(visualViewport?.height ?? window.innerHeight);
  const viewportWidth = Math.round(visualViewport?.width ?? window.innerWidth);
  const offsetTop = Math.round(visualViewport?.offsetTop ?? 0);
  const keyboardOffset = Math.max(0, window.innerHeight - viewportHeight - offsetTop);
  const isCompact = viewportWidth <= MOBILE_BREAKPOINT;

  return {
    viewportHeight,
    isCompact,
    keyboardOffset: isCompact && keyboardOffset > KEYBOARD_THRESHOLD ? keyboardOffset : 0,
  };
}


function createWelcomeMessage() {
  return {
    id: 0,
    sender: 'bot',
    text: '**¡Bienvenido a FlowBot!** Soy tu asistente inteligente de detección de intenciones. Escríbeme lo que necesitas y detectaré automáticamente la acción a realizar. Prueba con frases como *"quiero ver mis datos"*, *"crear un nuevo proyecto"* o *"buscar información"*.',
    iconName: 'ayuda',
    intents: [],
    time: getTimeString(),
  };
}



function App() {
  const [messages, setMessages] = useState([createWelcomeMessage()]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [timerAlert, setTimerAlert] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [viewportMetrics, setViewportMetrics] = useState(() => getViewportMetrics());
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const nextId = useRef(1);
  const isKeyboardVisible = viewportMetrics.isCompact && viewportMetrics.keyboardOffset > 0;
  const appContainerClassName = [
    'app-container',
    viewportMetrics.isCompact ? 'is-mobile' : '',
    isKeyboardVisible ? 'keyboard-visible' : '',
    isComposerFocused ? 'composer-focused' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const appContainerStyle = {
    '--app-height': `${viewportMetrics.viewportHeight}px`,
    '--keyboard-offset': `${viewportMetrics.keyboardOffset}px`,
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    const inputElement = inputRef.current;
    if (!inputElement) return;

    inputElement.style.height = '0px';
    inputElement.style.height = `${Math.min(inputElement.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    const updateViewport = () => {
      setViewportMetrics(getViewportMetrics());
    };

    updateViewport();

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', updateViewport);
    visualViewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);

    return () => {
      visualViewport?.removeEventListener('resize', updateViewport);
      visualViewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!isComposerFocused || !viewportMetrics.isCompact) return;

    const scrollToLatest = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      messagesContainerRef.current?.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    };

    const frameId = window.requestAnimationFrame(scrollToLatest);
    const timeoutId = window.setTimeout(scrollToLatest, 220);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [isComposerFocused, viewportMetrics, messages.length]);

  useEffect(() => {
    if (timerAlert) {
      const handleGlobalInteraction = () => setTimerAlert(null);
      window.addEventListener('keydown', handleGlobalInteraction);
      return () => window.removeEventListener('keydown', handleGlobalInteraction);
    }
  }, [timerAlert]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMsg = {
      id: nextId.current++,
      sender: 'user',
      text: trimmed,
      intents: [],
      time: getTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    (async () => {
      const response = await generateBotResponse(trimmed);
      const botMsg = {
        id: nextId.current++,
        sender: 'bot',
        text: response.text,
        iconName: response.iconName,
        intents: response.intents,
        actions: response.actions || [],
        time: getTimeString(),
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);

      if (botMsg.actions && botMsg.actions.length > 0) {
        botMsg.actions.forEach((actionObj) => {
          const { action } = actionObj;
          
          if (action === 'toggle_fullscreen') {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch((err) => {
                console.error(`Error al activar pantalla completa: ${err.message}`);
              });
            } else {
              document.exitFullscreen();
            }
          } else if (action === 'reload_page') {
            setTimeout(() => window.location.reload(), 1500);
          } else if (action === 'print_page') {
            setTimeout(() => window.print(), 1000);
          } else if (action === 'scroll_top') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else if (action === 'scroll_bottom') {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          } else if (action === 'clear_chat') {
            setTimeout(() => handleClearChat(), 500);
          } else if (action === 'toggle_sidebar') {
            setSidebarOpen((prev) => !prev);
          } else if (action === 'system_scan') {
            setIsScanning(true);
            setTimeout(() => setIsScanning(false), 5000);
          } else if (action === 'data_encryption') {
            setIsEncrypting(true);
            setTimeout(() => setIsEncrypting(false), 5000);
          } else if (action === 'set_timer') {
            console.log("Timer action triggered!", actionObj);
            const rawQuery = actionObj.query || '';
            const numMatch = rawQuery.match(/\d+/);
            let seconds = numMatch ? parseInt(numMatch[0], 10) : 10;
            
            if (rawQuery.toLowerCase().includes('minuto')) {
              seconds *= 60;
            }
            
            const label = rawQuery || 'Tarea programada';
            console.log(`Starting timer for ${seconds} seconds with label: ${label}`);
            
            const timerId = setInterval(() => {
              setTimerAlert((prev) => {
                if (!prev || prev.remaining <= 1) {
                  clearInterval(timerId);
                  return prev ? { ...prev, remaining: 0, finished: true } : null;
                }
                return { ...prev, remaining: prev.remaining - 1 };
              });
            }, 1000);

            setTimerAlert({ label, remaining: seconds, total: seconds, finished: false });
            console.log("setTimerAlert was called with", { label, remaining: seconds });
          }
        });
      }
    })();
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function handleComposerFocus() {
    setIsComposerFocused(true);

    if (viewportMetrics.isCompact) {
      setSidebarOpen(false);
      window.setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 180);
    }
  }

  function handleComposerBlur() {
    window.setTimeout(() => {
      if (document.activeElement !== inputRef.current) {
        setIsComposerFocused(false);
      }
    }, 120);
  }

  function handleClearChat() {
    setMessages([createWelcomeMessage()]);
    nextId.current = 1;
  }

  const quickActions = [
    { label: 'Ver datos', prompt: 'Quiero ver mis datos y analizar el reporte' },
    { label: 'Crear algo', prompt: 'Necesito crear un nuevo proyecto' },
    { label: 'Buscar info', prompt: 'Buscar información sobre el sistema' },
    { label: 'Ayuda', prompt: 'Necesito ayuda con las funcionalidades' },
  ];

  return (
    <div className={appContainerClassName} style={appContainerStyle}>
      {isScanning && (
        <div className="scanning-overlay">
          <div className="scanning-grid"></div>
          <div className="scanning-laser"></div>
        </div>
      )}
      {isEncrypting && (
        <div className="encryption-overlay">
          <div className="encryption-shield"></div>
          <div className="encryption-data-particles"></div>
        </div>
      )}

      {timerAlert && (
        <div className="timer-modal-overlay" onClick={() => setTimerAlert(null)}>
          <div className="timer-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="timer-modal-header">
              <div className={`timer-status-icon ${timerAlert.finished ? 'status-finished' : 'status-running'}`}>
                <IntentIcon name={timerAlert.finished ? 'check' : 'automatizar'} size={24} />
              </div>
              <h3>{timerAlert.finished ? '¡Temporizador Finalizado!' : 'Temporizador Activo'}</h3>
            </div>
            
            <div className="timer-display">
              {!timerAlert.finished && (
                <div className="timer-countdown">
                  <span className="timer-number">{timerAlert.remaining || timerAlert.total}</span>
                  <span className="timer-unit">seg</span>
                </div>
              )}
              {timerAlert.finished && <div className="timer-complete-text">COMPLETADO</div>}
            </div>

            <div className="timer-label">{timerAlert.label}</div>
            
            <div className="timer-modal-footer">
              <button className="timer-close-btn" onClick={() => setTimerAlert(null)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <FlowLogo size={36} />
          <h2 className="sidebar-title">FlowBot</h2>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Cerrar sidebar">
            <IntentIcon name="close" size={18} />
          </button>
        </div>

        <div className="sidebar-section">
          <h3 className="section-title">Grupos de Intención</h3>
          <div className="intent-groups-list">
            {intentGroups.map((group) => (
              <div key={group.id} className="sidebar-group" style={{ '--group-color': group.color }}>
                <div className="group-header">
                  <span className="group-icon">
                    <IntentIcon name={group.iconName} size={18} />
                  </span>
                  <span className="group-name">{group.name}</span>
                  <span className="group-count">{group.keywords.length}</span>
                </div>
                <div className="group-keywords-preview">
                  {group.keywords.slice(0, 6).map((keyword) => (
                    <span key={`${group.id}-${keyword}`} className="mini-tag">
                      {keyword}
                    </span>
                  ))}
                  {group.keywords.length > 6 && (
                    <span className="mini-tag more-tag">+{group.keywords.length - 6} más</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <button className="clear-chat-btn" onClick={handleClearChat}>
            <span className="btn-icon">
              <IntentIcon name="clear" size={16} />
            </span>
            <span>Limpiar chat</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="chat-main">
        <header className="chat-header">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Alternar menú">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="header-logo">
            <FlowLogo size={32} />
            <div className="header-info">
              <h1 className="header-title">FlowBot</h1>
              <span className="header-status">
                <span className="status-dot"></span>
                En línea
              </span>
            </div>
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={handleClearChat} title="Limpiar chat" aria-label="Limpiar chat">
              <IntentIcon name="clear" size={18} />
            </button>
          </div>
        </header>

        <div className="messages-container" id="messages-container" ref={messagesContainerRef}>
          <div className="messages-inner">
            {messages.map((message, index) => (
              <ChatMessage key={message.id} message={message} isLatest={index === messages.length - 1} />
            ))}

            {isTyping && (
              <div className="chat-message bot-message message-enter">
                <div className="bot-avatar">
                  <svg width="24" height="24" viewBox="0 0 100 100" fill="none">
                    <path d="M 50 15 C 30 15, 20 35, 25 55 C 20 70, 30 85, 50 85 C 70 85, 80 70, 75 55 C 80 35, 70 15, 50 15 Z" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
                    <path d="M 23 45 C 5 35, 10 65, 26 65 M 77 45 C 95 35, 90 65, 74 65" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
                    <path d="M 35 20 C 30 5, 20 10, 25 25 M 65 20 C 70 5, 80 10, 75 25" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="42" cy="40" r="3" fill="#00ff00" />
                    <circle cx="58" cy="40" r="3" fill="#00ff00" />
                  </svg>
                </div>
                <div className="message-bubble bot-bubble typing-bubble">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className={`composer-dock ${isKeyboardVisible ? 'composer-dock-keyboard' : ''}`}>
          <div className={`quick-actions ${isComposerFocused && viewportMetrics.isCompact ? 'quick-actions-hidden' : ''}`}>
          {quickActions.map((action) => (
            <button
              key={action.label}
              className="quick-action-btn"
              onClick={() => {
                setInput(action.prompt);
                inputRef.current?.focus();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>

          <div className="input-area">
            <div className="input-wrapper">
              <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Escribe tu mensaje aquí..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleComposerFocus}
              onBlur={handleComposerBlur}
              rows={1}
              id="chat-input"
              enterKeyHint="send"
              autoComplete="off"
              aria-label="Escribe tu mensaje"
            />
              <button
              className={`send-btn ${input.trim() ? 'send-btn-active' : ''}`}
              onClick={handleSend}
              disabled={!input.trim()}
              aria-label="Enviar mensaje"
              id="send-button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22,2 15,22 11,13 2,9" />
              </svg>
            </button>
          </div>
          <p className="input-hint">
            FlowBot detecta intenciones como: <em>visualizar, crear, eliminar, buscar, modificar, enviar, seguridad, ayuda, informar, automatizar</em>
          </p>
          </div>
        </div>
      </main>

      <div className="bg-particles" aria-hidden="true">
        <div className="particle p1"></div>
        <div className="particle p2"></div>
        <div className="particle p3"></div>
        <div className="particle p4"></div>
        <div className="particle p5"></div>
      </div>
    </div>
  );
}

export default App;
