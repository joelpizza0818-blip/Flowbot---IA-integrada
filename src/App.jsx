import React, { useState, useRef, useEffect } from 'react';
import FlowLogo from './components/FlowLogo';
import BackgroundLogo from './components/BackgroundLogo';
import ChatMessage from './components/ChatMessage';
import IntentIcon from './components/IntentIcon';
import {
  generateBotResponse,
  intentGroups,
  availableActions,
  THINKING_MODES,
  MODEL_GROUPS,
  getModelFamilyName,
} from './chatbotLogic';
import { CONTEXT_WINDOW_SIZE, getContextUsage } from './contextPrompt';
import './App.css';

const MOBILE_BREAKPOINT        = 768;
const LARGE_DESKTOP_BREAKPOINT = 1280;
const KEYBOARD_THRESHOLD       = 120;

function getTimeString() {
  return new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function getViewportMetrics() {
  const vv             = window.visualViewport;
  const viewportHeight = Math.round(vv?.height ?? window.innerHeight);
  const viewportWidth  = Math.round(vv?.width  ?? window.innerWidth);
  const offsetTop      = Math.round(vv?.offsetTop ?? 0);
  const keyboardOffset = Math.max(0, window.innerHeight - viewportHeight - offsetTop);
  const isCompact      = viewportWidth <= MOBILE_BREAKPOINT;
  return {
    viewportHeight,
    isCompact,
    keyboardOffset: isCompact && keyboardOffset > KEYBOARD_THRESHOLD ? keyboardOffset : 0,
  };
}

function createWelcomeMessage() {
  return {
    id: 0, sender: 'bot',
    text: '**¡Bienvenido a FlowBot!** Soy tu asistente de IA inteligente. Escríbeme cualquier cosa. Usa los selectores de abajo para cambiar el **modo de pensamiento** y el **modelo** de IA.',
    iconName: 'ayuda', intents: [], time: getTimeString(),
  };
}

// ── Mode selector icons ────────────────────────────────────────────────────────
function ThinkingModeIcon({ mode, size = 16 }) {
  const svgProps = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (mode === 'deep') return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 6v6l4 2"/>
      <path d="M7 3.34A9 9 0 0 0 3.34 7"/>
    </svg>
  );
  if (mode === 'short') return (
    <svg {...svgProps}>
      <path d="M8 6h8M8 10h5M8 14h3"/>
      <path d="M18 14l2 2-2 2"/>
    </svg>
  );
  // normal
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9"/>
      <path d="M8 12h8M12 8v8"/>
    </svg>
  );
}

function ModelIcon({ group, size = 16 }) {
  const svgProps = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (group === 'openrouter') return (
    <svg {...svgProps}>
      <path d="M12 2 20 7v10l-8 5-8-5V7l8-5z" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
  if (group === 'groq') return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16" />
      <path d="M4 12h16" />
    </svg>
  );
  if (group === 'gemini-3.1') return (
    <svg {...svgProps}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
  if (group === 'gemini-2.5') return (
    <svg {...svgProps}>
      <path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2z"/>
      <path d="M12 12v10M8 16l4 4 4-4"/>
    </svg>
  );
  return (
    <svg {...svgProps}>
      <path d="M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3z"/>
      <path d="M3 12h18"/>
      <path d="M12 3a9 9 0 0 1 0 18"/>
    </svg>
  );
}

function getModelOptionLabel(key, val) {
  if (key === 'auto') return val.label;
  if (key === 'gemini-3.1' || key === 'gemini-2.5') return val.label;
  return val.models.map((model) => getModelFamilyName(model)).join(' / ');
}

// ── App ────────────────────────────────────────────────────────────────────────
function App() {
  const [messages, setMessages]         = useState([createWelcomeMessage()]);
  const [input, setInput]               = useState('');
  const [isTyping, setIsTyping]         = useState(false);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [timerAlert, setTimerAlert]     = useState(null);
  const [sidebarOpen, setSidebarOpen]   = useState(() => (
    window.innerWidth > MOBILE_BREAKPOINT && window.innerWidth < LARGE_DESKTOP_BREAKPOINT
  ));
  const [viewportMetrics, setViewportMetrics] = useState(() => getViewportMetrics());
  const [navigationUrl, setNavigationUrl]     = useState(null);
  const [isAIOnline, setIsAIOnline]           = useState(true);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchModalType, setSearchModalType] = useState(null);
  const [searchModalInput, setSearchModalInput] = useState('');
  const [timerModalOpen, setTimerModalOpen]   = useState(false);
  const [timerModalValue, setTimerModalValue] = useState('');

  const [thinkingMode, setThinkingMode]       = useState('normal');
  const [preferredModel, setPreferredModel]   = useState('auto');
  const [modeDropdownOpen, setModeDropdownOpen]   = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const messagesEndRef        = useRef(null);
  const messagesContainerRef  = useRef(null);
  const inputRef              = useRef(null);
  const nextId                = useRef(1);

  const isKeyboardVisible   = viewportMetrics.isCompact && viewportMetrics.keyboardOffset > 0;
  const visibleMessages     = messages.filter((m) => m.id !== 0);
  const isEmptyState        = visibleMessages.length === 0;
  const { usedSlots: usedContextSlots } = getContextUsage(visibleMessages);
  const contextProgress     = (usedContextSlots / CONTEXT_WINDOW_SIZE) * 100;

  const appContainerClassName = ['app-container', viewportMetrics.isCompact ? 'is-mobile' : '', isComposerFocused && isKeyboardVisible ? 'keyboard-visible' : '', isComposerFocused ? 'composer-focused' : '', sidebarOpen ? 'sidebar-open-state' : ''].filter(Boolean).join(' ');
  const appContainerStyle     = { '--app-height': `${viewportMetrics.viewportHeight}px`, '--keyboard-offset': `${viewportMetrics.keyboardOffset}px` };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);
  useEffect(() => { if (navigationUrl) window.location.href = navigationUrl; }, [navigationUrl]);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    const update = () => setViewportMetrics(getViewportMetrics());
    update();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  useEffect(() => {
    if (!isComposerFocused || !viewportMetrics.isCompact) return;
    const scroll = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      messagesContainerRef.current?.scrollTo({ top: messagesContainerRef.current.scrollHeight, behavior: 'smooth' });
    };
    const fid = window.requestAnimationFrame(scroll);
    const tid = window.setTimeout(scroll, 220);
    return () => { window.cancelAnimationFrame(fid); window.clearTimeout(tid); };
  }, [isComposerFocused, viewportMetrics, messages.length]);

  useEffect(() => {
    if (!timerAlert) return;
    const handler = () => setTimerAlert(null);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [timerAlert]);

  useEffect(() => {
    const handler = () => { setModeDropdownOpen(false); setModelDropdownOpen(false); };
    if (modeDropdownOpen || modelDropdownOpen) document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [modeDropdownOpen, modelDropdownOpen]);

  // ── Send message ─────────────────────────────────────────────────────────────
  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMsg = { id: nextId.current++, sender: 'user', text: trimmed, intents: [], time: getTimeString() };
    const recentConversation = [...visibleMessages, userMsg];

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    (async () => {
      const response    = await generateBotResponse(trimmed, recentConversation, preferredModel, thinkingMode);
      const isOffline   = Boolean(response.error) || response.source === 'proxy-error' || response.text?.includes('no esta disponible') || response.text?.includes('intenta más tarde');
      setIsAIOnline(!isOffline);

      const botMsg = {
        id:            nextId.current++,
        sender:        'bot',
        text:          response.text,
        iconName:      response.iconName,
        intents:       response.intents,
        actions:       response.actions || [],
        time:          getTimeString(),
        model:         response.model,
        fallbackReason: response.fallbackReason,
        thinkingMode:  response.thinkingMode,
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);

      if (botMsg.actions?.length) {
        botMsg.actions.forEach(({ action }) => {
          if      (action === 'toggle_fullscreen') { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(console.error); else document.exitFullscreen(); }
          else if (action === 'reload_page')   setTimeout(() => window.location.reload(), 1500);
          else if (action === 'print_page')    setTimeout(() => window.print(), 1000);
          else if (action === 'scroll_top')    window.scrollTo({ top: 0, behavior: 'smooth' });
          else if (action === 'scroll_bottom') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          else if (action === 'toggle_sidebar') setSidebarOpen((p) => !p);
          else if (action === 'set_timer')     { setTimerModalOpen(true); setTimerModalValue(''); }
        });
      }
    })();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleComposerFocus() {
    setIsComposerFocused(true);
    if (viewportMetrics.isCompact) { setSidebarOpen(false); window.setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 180); }
  }

  function handleComposerBlur() {
    window.setTimeout(() => { if (document.activeElement !== inputRef.current) setIsComposerFocused(false); }, 120);
  }

  function handleClearChat() { setMessages([createWelcomeMessage()]); nextId.current = 1; }

  function startTimer(timeInput) {
    const trimmed = timeInput.trim();
    if (!trimmed) return;
    let seconds = 0;
    const m = trimmed.match(/(\d+(?:[.,]\d+)?)\s*(s|seg|segundo|minuto|min|m|h|hora)?/i);
    if (m) {
      const val = parseFloat(m[1].replace(',', '.'));
      const unit = (m[2] || 's').toLowerCase();
      if      (unit.startsWith('m') && unit.length > 1) seconds = Math.floor(val * 60);
      else if (unit.startsWith('h'))                    seconds = Math.floor(val * 3600);
      else                                              seconds = Math.floor(val);
    } else { seconds = parseInt(trimmed, 10); }
    if (!seconds || seconds <= 0) { alert('Por favor ingresa un tiempo válido mayor a 0'); return; }
    const timerId = setInterval(() => {
      setTimerAlert((prev) => {
        if (!prev || prev.remaining <= 1) { clearInterval(timerId); return prev ? { ...prev, remaining: 0, finished: true } : null; }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
    setTimerAlert({ label: `Temporizador: ${timeInput}`, remaining: seconds, total: seconds, finished: false });
  }

  function handleActionClick(actionId) {
    if      (actionId === 'toggle_fullscreen') { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(console.error); else document.exitFullscreen(); }
    else if (actionId === 'toggle_sidebar')    { setSidebarOpen((p) => !p); }
    else if (actionId === 'open_console')      {
      console.log('%c FLOWBOT CONSOLE', 'color:#00ff00;font-size:18px;font-weight:bold');
      console.log('%cAcciones: fullscreen, sidebar, reload, print, scroll_top, scroll_bottom, search, youtube, timer', 'color:#00d4ff;font-size:12px');
    }
    else if (actionId === 'reload_page')  setTimeout(() => window.location.reload(), 1500);
    else if (actionId === 'print_page')   setTimeout(() => window.print(), 1000);
    else if (actionId === 'scroll_top')   window.scrollTo({ top: 0, behavior: 'smooth' });
    else if (actionId === 'scroll_bottom') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    else if (actionId === 'set_timer')    { setTimerModalOpen(true); setTimerModalValue(''); }
    else if (actionId === 'open_search')  { setSearchModalType('search');  setSearchModalOpen(true); setSearchModalInput(''); }
    else if (actionId === 'open_youtube') { setSearchModalType('youtube'); setSearchModalOpen(true); setSearchModalInput(''); }
    if (viewportMetrics.isCompact) setSidebarOpen(false);
  }

  function getActionSvg(actionId) {
    const p = { width:'24', height:'24', viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:'2', strokeLinecap:'round', strokeLinejoin:'round' };
    switch (actionId) {
      case 'toggle_fullscreen': return <svg {...p}><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>;
      case 'toggle_sidebar':    return <svg {...p}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
      case 'open_console':      return <svg {...p}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>;
      case 'reload_page':       return <svg {...p}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2-8.83"/></svg>;
      case 'print_page':        return <svg {...p}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>;
      case 'scroll_top':        return <svg {...p}><polyline points="18 15 12 9 6 15"/><line x1="12" y1="21" x2="12" y2="9"/></svg>;
      case 'scroll_bottom':     return <svg {...p}><polyline points="6 9 12 15 18 9"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
      case 'open_search':       return <svg {...p}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
      case 'open_youtube':      return <svg {...p}><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>;
      case 'set_timer':         return <svg {...p}><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 2h6"/></svg>;
      default: return null;
    }
  }

  const quickActions = [
    { label: 'Codigo',   prompt: 'crea un componente login en react' },
    { label: 'Aprender', prompt: 'explicame de forma simple como mejorar mi prompt' },
    { label: 'Navegar',  prompt: 'navegar noticias de tecnologia de hoy' },
    { label: 'Timer',    prompt: 'timer 10 minutos' },
  ];

  return (
    <div className={appContainerClassName} style={appContainerStyle}>
      {/* ── Timer alert ─────────────────────────────────────────────────────── */}
      {timerAlert && (
        <div className="timer-modal-overlay" onClick={() => setTimerAlert(null)}>
          <div className="timer-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="timer-modal-header">
              <div className={`timer-status-icon ${timerAlert.finished ? 'status-finished' : 'status-running'}`}>
                <IntentIcon name="automatizar" size={24} />
              </div>
              <h3>{timerAlert.finished ? '¡Temporizador Finalizado!' : 'Temporizador Activo'}</h3>
            </div>
            <div className="timer-display">
              {!timerAlert.finished && <div className="timer-countdown"><span className="timer-number">{timerAlert.remaining || timerAlert.total}</span><span className="timer-unit">seg</span></div>}
              {timerAlert.finished && <div className="timer-complete-text">COMPLETADO</div>}
            </div>
            <div className="timer-label">{timerAlert.label}</div>
            <div className="timer-modal-footer">
              <button className="timer-close-btn" onClick={() => setTimerAlert(null)}>Entendido</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Search modal ─────────────────────────────────────────────────────── */}
      {searchModalOpen && (
        <div className="search-modal-overlay" onClick={() => { setSearchModalOpen(false); setSearchModalInput(''); }}>
          <div className="search-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="search-modal-header">
              <h3>{searchModalType === 'youtube' ? 'Buscar en YouTube' : 'Buscar en Google'}</h3>
              <button className="search-modal-close" onClick={() => { setSearchModalOpen(false); setSearchModalInput(''); }}>✕</button>
            </div>
            <div className="search-modal-body">
              <input type="text" className="search-modal-input" placeholder={searchModalType === 'youtube' ? '¿Qué deseas ver?' : '¿Qué deseas buscar?'} value={searchModalInput} onChange={(e) => setSearchModalInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && searchModalInput.trim()) { const url = searchModalType === 'youtube' ? `https://www.youtube.com/results?search_query=${encodeURIComponent(searchModalInput)}` : `https://www.google.com/search?q=${encodeURIComponent(searchModalInput)}`; setNavigationUrl(url); setSearchModalOpen(false); setSearchModalInput(''); } }} autoFocus />
            </div>
            <div className="search-modal-footer">
              <button className="search-modal-cancel" onClick={() => { setSearchModalOpen(false); setSearchModalInput(''); }}>Cancelar</button>
              <button className="search-modal-submit" onClick={() => { if (searchModalInput.trim()) { const url = searchModalType === 'youtube' ? `https://www.youtube.com/results?search_query=${encodeURIComponent(searchModalInput)}` : `https://www.google.com/search?q=${encodeURIComponent(searchModalInput)}`; setNavigationUrl(url); setSearchModalOpen(false); setSearchModalInput(''); } }} disabled={!searchModalInput.trim()}>
                {searchModalType === 'youtube' ? 'Ver en YouTube' : 'Buscar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Timer modal ──────────────────────────────────────────────────────── */}
      {timerModalOpen && (
        <div className="timer-modal-overlay" onClick={() => { setTimerModalOpen(false); setTimerModalValue(''); }}>
          <div className="timer-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="timer-modal-header">
              <h3>⏱️ Configurar Temporizador</h3>
              <button className="timer-modal-close" onClick={() => { setTimerModalOpen(false); setTimerModalValue(''); }}>✕</button>
            </div>
            <div className="timer-modal-body">
              <input type="text" className="timer-modal-input" placeholder="Ej: 5, 30 segundos, 2 minutos, 1 hora" value={timerModalValue} onChange={(e) => setTimerModalValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && timerModalValue.trim()) { startTimer(timerModalValue); setTimerModalOpen(false); setTimerModalValue(''); } }} autoFocus />
              <div className="timer-modal-examples"><p>Ejemplos: <code>5</code>, <code>30s</code>, <code>2 minutos</code>, <code>1 hora</code></p></div>
            </div>
            <div className="timer-modal-footer">
              <button className="timer-modal-cancel" onClick={() => { setTimerModalOpen(false); setTimerModalValue(''); }}>Cancelar</button>
              <button className="timer-modal-submit" onClick={() => { if (timerModalValue.trim()) { startTimer(timerModalValue); setTimerModalOpen(false); setTimerModalValue(''); } }} disabled={!timerModalValue.trim()}>Iniciar Timer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <FlowLogo size={36} />
          <h2 className="sidebar-title">FlowBot</h2>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Cerrar sidebar">
            <IntentIcon name="close" size={18} />
          </button>
        </div>

        <details className="sidebar-section" name="sidebar-menu" open>
          <summary className="sidebar-section-summary">
            <span>Modos de IA</span>
            <svg className="sidebar-section-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </summary>
          <div className="sidebar-section-body">
            <div className="sidebar-mode-list">
              {Object.values(THINKING_MODES).map((mode) => (
                <button key={mode.id} className={`sidebar-mode-btn ${thinkingMode === mode.id ? 'sidebar-mode-active' : ''}`} onClick={() => { setThinkingMode(mode.id); if (viewportMetrics.isCompact) setSidebarOpen(false); }}>
                  <ThinkingModeIcon mode={mode.id} size={18} />
                  <div className="sidebar-mode-info">
                    <span className="sidebar-mode-label">{mode.label}</span>
                    <span className="sidebar-mode-desc">{mode.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </details>

        <details className="sidebar-section" name="sidebar-menu">
          <summary className="sidebar-section-summary">
            <span>Modelo preferido</span>
            <svg className="sidebar-section-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </summary>
          <div className="sidebar-section-body">
            <div className="sidebar-mode-list">
              {Object.entries(MODEL_GROUPS).map(([key, val]) => (
                <button key={key} className={`sidebar-mode-btn ${preferredModel === key ? 'sidebar-mode-active' : ''}`} onClick={() => { setPreferredModel(key); if (viewportMetrics.isCompact) setSidebarOpen(false); }}>
                  <ModelIcon group={key} size={18} />
                  <div className="sidebar-mode-info">
                    <span className="sidebar-mode-label">{getModelOptionLabel(key, val)}</span>
                    <span className="sidebar-mode-desc">{key === 'auto' ? 'Cascada automática' : `Modelos: ${val.models.map((model) => getModelFamilyName(model)).join(', ')}`}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </details>

        <details className="sidebar-section" name="sidebar-menu">
          <summary className="sidebar-section-summary">
            <span>Grupos de intención</span>
            <svg className="sidebar-section-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </summary>
          <div className="sidebar-section-body">
            <div className="intent-groups-list">
              {intentGroups.filter((g) => ['visualizar','automatizar','acciones_sistema'].includes(g.id)).map((group) => (
                <div key={group.id} className="sidebar-group" style={{ '--group-color': group.color }}>
                  <div className="group-header">
                    <span className="group-icon"><IntentIcon name={group.iconName} size={18} /></span>
                    <span className="group-name">{group.name}</span>
                    <span className="group-count">{group.keywords.length}</span>
                  </div>
                  <div className="group-keywords-preview">
                    <p className="group-description">{group.details.replace(/\*\*/g, '')}</p>
                    {group.keywords.slice(0, 2).map((kw) => <span key={`${group.id}-${kw}`} className="mini-tag">{kw}</span>)}
                    {group.keywords.length > 2 && <span className="mini-tag more-tag">+{group.keywords.length - 2} mas</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>

        <details className="sidebar-section" name="sidebar-menu">
          <summary className="sidebar-section-summary">
            <span>Comandos rápidos</span>
            <svg className="sidebar-section-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </summary>
          <div className="sidebar-section-body">
            <div className="actions-grid">
              {availableActions.map((action) => (
                <button key={action.id} className="action-btn" onClick={() => handleActionClick(action.id)} title={action.label}>
                  <span className="action-icon">{getActionSvg(action.id)}</span>
                  <span className="action-label">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </details>

        <div className="sidebar-footer">
          <button className="clear-chat-btn" onClick={handleClearChat}>
            <span className="btn-icon"><IntentIcon name="clear" size={16} /></span>
            <span>Limpiar chat</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main className={`chat-main ${isEmptyState ? 'chat-main-empty' : ''}`}>
        <header className="chat-header">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Alternar menú">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="header-logo">
            <FlowLogo size={32} />
            <div className="header-info">
              <h1 className="header-title">FlowBot</h1>
              <span className={`header-status ${isAIOnline ? 'status-online' : 'status-offline'}`}>
                <span className="status-dot"></span>
                {isAIOnline ? 'En línea' : 'Offline'}
              </span>
              <div className="context-meter" aria-label={`Contexto: ${usedContextSlots}/${CONTEXT_WINDOW_SIZE}`}>
                <div className="context-meter-copy">
                  <span className="context-meter-label">Contexto</span>
                  <span className="context-meter-value">Usa {usedContextSlots}/{CONTEXT_WINDOW_SIZE}</span>
                </div>
                <div className="context-meter-track" aria-hidden="true">
                  <div className="context-meter-fill" style={{ width: `${contextProgress}%` }} />
                </div>
              </div>
            </div>
          </div>
          {!isEmptyState && (
            <div className="header-actions">
              <button className="icon-btn" onClick={handleClearChat} title="Limpiar chat" aria-label="Limpiar chat">
                <IntentIcon name="clear" size={18} />
              </button>
            </div>
          )}
        </header>

        {/* ── Messages ─────────────────────────────────────────────────────── */}
        <div className={`messages-container ${isEmptyState ? 'messages-container-empty' : ''}`} ref={messagesContainerRef}>
          <div className={`messages-inner ${isEmptyState ? 'messages-inner-empty' : ''}`}>
            {isEmptyState && <BackgroundLogo />}
            {isEmptyState && (
              <section className="empty-state-hero" aria-label="Portada de FlowBot">
                <div className="empty-state-navbar">
                  <div className="navbar-left">
                    <div className="navbar-logo">
                      <FlowLogo size={32} />
                      <span className="navbar-title">FlowBot</span>
                      <span className="navbar-badge">Asistente de desarrollo</span>
                    </div>
                  </div>
                  <div className="navbar-center">
                    <span className="navbar-subtitle">Desarrollo Web Asistido por IA</span>
                  </div>
                  <div className="navbar-right">
                    <div className="navbar-context">
                      <span className="context-label">Contexto</span>
                      <span className="context-value">{usedContextSlots}/{CONTEXT_WINDOW_SIZE}</span>
                    </div>
                    <button className="navbar-clear-btn" onClick={handleClearChat} title="Limpiar chat">
                      <IntentIcon name="clear" size={16} />
                    </button>
                  </div>
                </div>

                <div className="empty-state-kicker">
                  <span className="empty-state-kicker-dot"></span>
                  Pensado para acelerar tu flujo de trabajo
                </div>

                <div className="empty-state-head">
                  <div className="empty-state-logo-shell">
                    <FlowLogo size={58} />
                  </div>
                  <div className="empty-state-copy">
                    <p className="empty-state-eyebrow">Comenzar</p>
                    <h2 className="empty-state-title">Tu asistente de desarrollo web.</h2>
                    <div className="empty-state-description-container">
                      <p className="empty-state-description">
                        <span className="typing-text">FlowBot: lleva tu desarrollo web al siguiente nivel</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="hero-context-band">
                  <div className="hero-context-stat">
                    <span className="hero-context-value">{usedContextSlots}/{CONTEXT_WINDOW_SIZE}</span>
                    <span className="hero-context-label">contexto activo</span>
                  </div>
                  <div className="hero-context-progress" aria-hidden="true">
                    <div className="hero-context-progress-fill" style={{ width: `${contextProgress}%` }} />
                  </div>
                  <div className="hero-context-copy">
                    <strong>(El contexto es la memoria de la conversacion.)</strong>
                    <span>El historial reciente solo entra cuando ayuda a continuar, resumir o ajustar.</span>
                  </div>
                </div>
              </section>
            )}

            {visibleMessages.map((message, index) => (
              <ChatMessage key={message.id} message={message} isLatest={index === visibleMessages.length - 1} />
            ))}

            {isTyping && (
              <div className="chat-message bot-message message-enter">
                <div className="bot-avatar">
                  <svg width="24" height="24" viewBox="0 0 100 100" fill="none">
                    <path d="M 50 15 C 30 15, 20 35, 25 55 C 20 70, 30 85, 50 85 C 70 85, 80 70, 75 55 C 80 35, 70 15, 50 15 Z" stroke="#ffffff" strokeWidth="4" strokeLinecap="round"/>
                    <path d="M 23 45 C 5 35, 10 65, 26 65 M 77 45 C 95 35, 90 65, 74 65" stroke="#ffffff" strokeWidth="4" strokeLinecap="round"/>
                    <path d="M 35 20 C 30 5, 20 10, 25 25 M 65 20 C 70 5, 80 10, 75 25" stroke="#ffffff" strokeWidth="4" strokeLinecap="round"/>
                    <circle cx="42" cy="40" r="3" fill="#00ff00"/>
                    <circle cx="58" cy="40" r="3" fill="#00ff00"/>
                  </svg>
                </div>
                <div className="message-bubble bot-bubble typing-bubble">
                  <div className="typing-indicator"><span></span><span></span><span></span></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── Composer dock ─────────────────────────────────────────────────── */}
        <div className={`composer-dock ${isKeyboardVisible ? 'composer-dock-keyboard' : ''} ${isEmptyState ? 'composer-dock-empty' : ''}`}>
          <div className={`quick-actions ${isComposerFocused && viewportMetrics.isCompact ? 'quick-actions-hidden' : ''} ${isEmptyState ? 'quick-actions-empty' : ''}`}>
            {quickActions.map((action) => (
              <button key={action.label} className="quick-action-btn" onClick={() => { setInput(action.prompt); inputRef.current?.focus(); }}>
                {action.label}
              </button>
            ))}
          </div>

          <div className={`input-area ${isEmptyState ? 'input-area-empty' : ''}`}>
            <div className="input-selectors">
              <div className="selector-wrapper">
                <button
                  className={`selector-btn ${thinkingMode !== 'normal' ? 'selector-btn-active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setModeDropdownOpen((p) => !p); setModelDropdownOpen(false); }}
                  title="Modo de pensamiento"
                >
                  <ThinkingModeIcon mode={thinkingMode} size={14} />
                  <span className="selector-label">{THINKING_MODES[thinkingMode]?.label}</span>
                  <svg className="selector-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {modeDropdownOpen && (
                  <div className="selector-dropdown" onClick={(e) => e.stopPropagation()}>
                    {Object.values(THINKING_MODES).map((mode) => (
                      <button key={mode.id} className={`dropdown-option ${thinkingMode === mode.id ? 'dropdown-option-active' : ''}`} onClick={() => { setThinkingMode(mode.id); setModeDropdownOpen(false); }}>
                        <ThinkingModeIcon mode={mode.id} size={15} />
                        <div className="dropdown-option-text">
                          <span className="dropdown-option-label">{mode.label}</span>
                          <span className="dropdown-option-desc">{mode.desc}</span>
                        </div>
                        {thinkingMode === mode.id && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="selector-wrapper">
                <button
                  className={`selector-btn ${preferredModel !== 'auto' ? 'selector-btn-active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setModelDropdownOpen((p) => !p); setModeDropdownOpen(false); }}
                  title="Modelo preferido"
                >
                  <ModelIcon group={preferredModel} size={14} />
                  <span className="selector-label">{MODEL_GROUPS[preferredModel]?.label}</span>
                  <svg className="selector-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {modelDropdownOpen && (
                  <div className="selector-dropdown" onClick={(e) => e.stopPropagation()}>
                    {Object.entries(MODEL_GROUPS).map(([key, val]) => (
                      <button key={key} className={`dropdown-option ${preferredModel === key ? 'dropdown-option-active' : ''}`} onClick={() => { setPreferredModel(key); setModelDropdownOpen(false); }}>
                        <ModelIcon group={key} size={15} />
                        <div className="dropdown-option-text">
                          <span className="dropdown-option-label">{getModelOptionLabel(key, val)}</span>
                          <span className="dropdown-option-desc">{key === 'auto' ? 'Cascada automática' : `Modelos: ${val.models.map((model) => getModelFamilyName(model)).join(', ')}`}</span>
                        </div>
                        {preferredModel === key && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={`input-wrapper ${isEmptyState ? 'input-wrapper-empty' : ''}`}>
              <textarea
                ref={inputRef}
                className="chat-input"
                placeholder="haz tu primera pregunta..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleComposerFocus}
                onBlur={handleComposerBlur}
                rows={1}
                enterKeyHint="send"
                autoComplete="off"
                aria-label="Escribe tu mensaje"
              />
              <button
                className={`send-btn ${input.trim() ? 'send-btn-active' : ''}`}
                onClick={handleSend}
                disabled={!input.trim()}
                aria-label="Enviar mensaje"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/>
                </svg>
              </button>
            </div>
            <p className="input-hint">Web desarrollada por: <em>Joel Berroa</em></p>
          </div>
        </div>
      </main>

      <div className="bg-particles" aria-hidden="true">
        <div className="particle p1"></div><div className="particle p2"></div>
        <div className="particle p3"></div><div className="particle p4"></div>
        <div className="particle p5"></div>
      </div>
    </div>
  );
}

export default App;
