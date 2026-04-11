import React, { useState, useRef, useEffect } from 'react';
import FlowLogo from './components/FlowLogo';
import BackgroundLogo from './components/BackgroundLogo';
import ChatMessage from './components/ChatMessage';
import IntentIcon from './components/IntentIcon';
import {
  generateBotResponse,
  intentGroups,
  availableActions,
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
    text: '**Bienvenido a FlowBot.** Estoy listo para ayudarte a crear interfaces, depurar errores, explicar codigo y aterrizar ideas web en respuestas accionables.',
    iconName: 'ayuda', intents: [], time: getTimeString(),
  };
}

function ThinkingModeIcon({ mode, size = 16 }) {
  const svgProps = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (mode === 'deep') return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
      <path d="M7 3.34A9 9 0 0 0 3.34 7" />
    </svg>
  );
  if (mode === 'short') return (
    <svg {...svgProps}>
      <path d="M8 6h8M8 10h5M8 14h3" />
      <path d="M18 14l2 2-2 2" />
    </svg>
  );
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8M12 8v8" />
    </svg>
  );
}

function ModelIcon({ group, size = 16 }) {
  const svgProps = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' };
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

// ── App ────────────────────────────────────────────────────────────────────────
function App() {
  const [messages, setMessages]         = useState([createWelcomeMessage()]);
  const [input, setInput]               = useState('');
  const [isTyping, setIsTyping]         = useState(false);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [timerAlert, setTimerAlert]     = useState(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
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
  const [memoryPreviewEnabled, setMemoryPreviewEnabled] = useState(true);
  const [thinkingDropdownOpen, setThinkingDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [islandOpen, setIslandOpen] = useState(false);
  const [islandX, setIslandX] = useState(() => Math.max(88, Math.round(window.innerWidth / 2)));

  const messagesEndRef        = useRef(null);
  const messagesContainerRef  = useRef(null);
  const inputRef              = useRef(null);
  const nextId                = useRef(1);
  const islandDragStateRef    = useRef(null);

  const isKeyboardVisible   = viewportMetrics.isCompact && viewportMetrics.keyboardOffset > 0;
  const visibleMessages     = messages.filter((m) => m.id !== 0);
  const isEmptyState        = visibleMessages.length === 0;
  const { usedSlots: usedContextSlots } = getContextUsage(visibleMessages);
  const displayedContextSlots = memoryPreviewEnabled ? usedContextSlots : 0;
  const hasConversation = visibleMessages.length > 0;

  const appContainerClassName = ['app-container', viewportMetrics.isCompact ? 'is-mobile' : 'is-desktop', isComposerFocused && isKeyboardVisible ? 'keyboard-visible' : '', isComposerFocused ? 'composer-focused' : '', sidebarOpen ? 'sidebar-open-state' : ''].filter(Boolean).join(' ');
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
    const update = () => {
      const nextMetrics = getViewportMetrics();
      setViewportMetrics(nextMetrics);
      setIslandX((current) => clampIslandX(current));
      if (nextMetrics.isCompact) setSidebarOpen(false);
    };
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
    const handler = () => { setThinkingDropdownOpen(false); setModelDropdownOpen(false); };
    if (thinkingDropdownOpen || modelDropdownOpen) document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [thinkingDropdownOpen, modelDropdownOpen]);

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

  function handleClearChat() { setMessages([createWelcomeMessage()]); nextId.current = 1; setIslandOpen(false); }

  function clampIslandX(nextX) {
    const min = 72;
    const max = Math.max(min, window.innerWidth - 72);
    return Math.min(Math.max(nextX, min), max);
  }

  function handleIslandPointerDown(e) {
    if (islandOpen) return;
    islandDragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      originX: islandX,
      moved: false,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function handleIslandPointerMove(e) {
    const dragState = islandDragStateRef.current;
    if (!dragState || dragState.pointerId !== e.pointerId || islandOpen) return;
    const delta = e.clientX - dragState.startX;
    if (Math.abs(delta) > 4) dragState.moved = true;
    setIslandX(clampIslandX(dragState.originX + delta));
  }

  function handleIslandPointerUp(e) {
    const dragState = islandDragStateRef.current;
    if (!dragState || dragState.pointerId !== e.pointerId || islandOpen) return;
    if (!dragState.moved) setIslandOpen(true);
    islandDragStateRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

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
    {
      label: 'Codigo',
      hint: 'Componentes y UI',
      prompt: 'Crea un navbar responsive en React con menu movil accesible y estados claros.',
    },
    {
      label: 'Aprender',
      hint: 'Explicado paso a paso',
      prompt: 'Explicame este concepto de React como si estuviera empezando y dame un ejemplo practico.',
    },
    {
      label: 'Debug',
      hint: 'Errores y fixes',
      prompt: 'Ayudame a depurar este error de React. Explica la causa raiz y propon una solucion limpia.',
    },
    {
      label: 'Optimizar',
      hint: 'Rendimiento y limpieza',
      prompt: 'Optimiza este componente para rendimiento y claridad sin cambiar su comportamiento.',
    },
  ];

  const modelOptions = [
    { key: 'auto', label: 'Automatico', desc: 'FlowBot elige entre Gemini 3.1 y GPT OSS segun la consulta.' },
    { key: 'gemini-3.1', label: 'Gemini 3.1', desc: 'Mas fuerte para arquitectura, UI compleja y respuestas largas.' },
    { key: 'groq', label: 'GPT OSS / Llama', desc: 'Mas rapido para debugging, dudas breves y consultas iterativas.' },
  ];
  const thinkingOptions = [
    { id: 'normal', label: 'Normal', desc: 'Equilibrado para la mayoria de consultas.' },
    { id: 'deep', label: 'Profundo', desc: 'Analiza con mas detalle y razonamiento paso a paso.' },
    { id: 'short', label: 'Rapido', desc: 'Va directo al punto con menos texto.' },
  ];

  const activeModelOption = modelOptions.find((option) => option.key === preferredModel) || modelOptions[0];
  const activeThinkingOption = thinkingOptions.find((option) => option.id === thinkingMode) || thinkingOptions[0];
  const composerPlaceholder =
    activeModelOption.key === 'gemini-3.1'
      ? 'Arquitecta un dashboard en React con estados claros, filtros y tabla responsive'
      : activeModelOption.key === 'groq'
        ? 'Depura este error de hydration en Next.js 15 y dime la causa raiz'
        : 'Crea un navbar responsive en React con menu movil accesible';
  const memorySummary = !memoryPreviewEnabled
    ? 'Vista previa pausada'
    : displayedContextSlots === 0
      ? 'Lista para seguir tu hilo'
      : displayedContextSlots < CONTEXT_WINDOW_SIZE * 0.55
        ? 'Memoria aprendiendo el contexto actual'
        : 'Memoria lista para conversaciones largas';

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
              <div>
                <p className="modal-eyebrow">Automatizacion</p>
                <h3>{timerAlert.finished ? 'Temporizador completado' : 'Temporizador activo'}</h3>
              </div>
            </div>
            <div className="timer-display">
              {!timerAlert.finished && <div className="timer-countdown"><span className="timer-number">{timerAlert.remaining || timerAlert.total}</span><span className="timer-unit">seg</span></div>}
              {timerAlert.finished && <div className="timer-complete-text">COMPLETADO</div>}
            </div>
            <div className="timer-label">{timerAlert.label}</div>
            <div className="timer-modal-footer">
              <button className="timer-close-btn" onClick={() => setTimerAlert(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Search modal ─────────────────────────────────────────────────────── */}
      {searchModalOpen && (
        <div className="search-modal-overlay" onClick={() => { setSearchModalOpen(false); setSearchModalInput(''); }}>
          <div className="search-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="search-modal-header">
              <div>
                <p className="modal-eyebrow">Busqueda rapida</p>
                <h3>{searchModalType === 'youtube' ? 'Abrir en YouTube' : 'Abrir en Google'}</h3>
              </div>
              <button className="search-modal-close" onClick={() => { setSearchModalOpen(false); setSearchModalInput(''); }}>X</button>
            </div>
            <div className="search-modal-body">
              <input type="text" className="search-modal-input" placeholder={searchModalType === 'youtube' ? 'Busca un tutorial o video' : 'Busca una referencia, bug o libreria'} value={searchModalInput} onChange={(e) => setSearchModalInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && searchModalInput.trim()) { const url = searchModalType === 'youtube' ? `https://www.youtube.com/results?search_query=${encodeURIComponent(searchModalInput)}` : `https://www.google.com/search?q=${encodeURIComponent(searchModalInput)}`; setNavigationUrl(url); setSearchModalOpen(false); setSearchModalInput(''); } }} autoFocus />
            </div>
            <div className="search-modal-footer">
              <button className="search-modal-cancel" onClick={() => { setSearchModalOpen(false); setSearchModalInput(''); }}>Cancelar</button>
              <button className="search-modal-submit" onClick={() => { if (searchModalInput.trim()) { const url = searchModalType === 'youtube' ? `https://www.youtube.com/results?search_query=${encodeURIComponent(searchModalInput)}` : `https://www.google.com/search?q=${encodeURIComponent(searchModalInput)}`; setNavigationUrl(url); setSearchModalOpen(false); setSearchModalInput(''); } }} disabled={!searchModalInput.trim()}>
                {searchModalType === 'youtube' ? 'Abrir YouTube' : 'Buscar'}
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
              <div>
                <p className="modal-eyebrow">Herramientas</p>
                <h3>Configurar temporizador</h3>
              </div>
              <button className="timer-modal-close" onClick={() => { setTimerModalOpen(false); setTimerModalValue(''); }}>X</button>
            </div>
            <div className="timer-modal-body">
              <input type="text" className="timer-modal-input" placeholder="Ej: 30s, 2 minutos, 1 hora" value={timerModalValue} onChange={(e) => setTimerModalValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && timerModalValue.trim()) { startTimer(timerModalValue); setTimerModalOpen(false); setTimerModalValue(''); } }} autoFocus />
              <div className="timer-modal-examples"><p>Ejemplos: <code>5</code>, <code>30s</code>, <code>2 minutos</code>, <code>1 hora</code></p></div>
            </div>
            <div className="timer-modal-footer">
              <button className="timer-modal-cancel" onClick={() => { setTimerModalOpen(false); setTimerModalValue(''); }}>Cancelar</button>
              <button className="timer-modal-submit" onClick={() => { if (timerModalValue.trim()) { startTimer(timerModalValue); setTimerModalOpen(false); setTimerModalValue(''); } }} disabled={!timerModalValue.trim()}>Iniciar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <FlowLogo size={34} />
            <div className="sidebar-brand-copy">
              <span className="sidebar-eyebrow">Workspace</span>
              <h2 className="sidebar-title">FlowBot</h2>
            </div>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menu">
            <IntentIcon name="close" size={18} />
          </button>
        </div>

        <details className="sidebar-section" name="sidebar-menu" open>
          <summary className="sidebar-section-summary">
            <span>Modelo</span>
            <svg className="sidebar-section-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </summary>
          <div className="sidebar-section-body">
            <div className="sidebar-mode-list">
              {modelOptions.map((option) => (
                <button key={option.key} className={`sidebar-mode-btn ${preferredModel === option.key ? 'sidebar-mode-active' : ''}`} onClick={() => { setPreferredModel(option.key); if (viewportMetrics.isCompact) setSidebarOpen(false); }}>
                  <ModelIcon group={option.key} size={18} />
                  <div className="sidebar-mode-info">
                    <span className="sidebar-mode-label">{option.label}</span>
                    <span className="sidebar-mode-desc">{option.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </details>

        <details className="sidebar-section" name="sidebar-menu">
          <summary className="sidebar-section-summary">
            <span>Capacidades</span>
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
                    {group.keywords.slice(0, 3).map((kw) => <span key={`${group.id}-${kw}`} className="mini-tag">{kw}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>

        <details className="sidebar-section" name="sidebar-menu">
          <summary className="sidebar-section-summary">
            <span>Toolbox</span>
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
            <span>Nueva conversacion</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="dynamic-island-layer" aria-hidden={false}>
        <div
          className={`dynamic-island ${islandOpen ? 'dynamic-island-open' : 'dynamic-island-closed'}`}
          style={{ left: `${islandX}px` }}
        >
          {!islandOpen ? (
            <button
              type="button"
              className="dynamic-island-sphere"
              onPointerDown={handleIslandPointerDown}
              onPointerMove={handleIslandPointerMove}
              onPointerUp={handleIslandPointerUp}
              onPointerCancel={() => { islandDragStateRef.current = null; }}
              aria-label="Abrir isla dinamica"
            >
              <FlowLogo size={28} wave={hasConversation} />
            </button>
          ) : (
            <div className="dynamic-island-panel">
              <button
                type="button"
                className="dynamic-island-brand"
                onClick={() => setIslandOpen(false)}
                aria-label="Cerrar isla dinamica"
              >
                <FlowLogo size={22} wave={hasConversation} />
                <div className="dynamic-island-copy">
                  <span className="dynamic-island-name">FlowBot</span>
                  <span className="dynamic-island-memory">Memoria {displayedContextSlots}/{CONTEXT_WINDOW_SIZE}</span>
                </div>
              </button>

              <div className="dynamic-island-actions">
                <button type="button" className="dynamic-island-action" onClick={() => { setSidebarOpen(true); setIslandOpen(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                  <span>Menu</span>
                </button>
                <button type="button" className="dynamic-island-action" onClick={handleClearChat}>
                  <IntentIcon name="clear" size={16} />
                  <span>Limpiar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main className={`chat-main ${isEmptyState ? 'chat-main-empty' : ''}`}>
        {/* ── Messages ─────────────────────────────────────────────────────── */}
        <div className={`messages-container ${isEmptyState ? 'messages-container-empty' : ''}`} ref={messagesContainerRef}>
          <div className={`messages-inner ${isEmptyState ? 'messages-inner-empty' : ''}`}>
            {isEmptyState && <BackgroundLogo />}
            {isEmptyState && (
              <section className="empty-state-hero" aria-label="Portada de FlowBot">
                <div className="hero-live-row">
                  <div className="empty-state-kicker">
                    <span className="empty-state-kicker-dot"></span>
                    Menos setup. Mas shipping.
                  </div>
                  <span className={`hero-live-pill ${isAIOnline ? 'is-online' : 'is-offline'}`}>
                    {isAIOnline ? 'Servicio online' : 'Modo fallback'}
                  </span>
                </div>

                <div className="empty-state-head">
                  <div className="empty-state-copy">
                    <p className="empty-state-eyebrow">FlowBot para developers</p>
                    <h2 className="empty-state-title">Construye mas rapido. Depura con contexto. Aprende mientras envias.</h2>
                    <div className="empty-state-description-container">
                      <p className="empty-state-description">
                        Pidele una feature, pega un bug o aterriza una idea en codigo listo para iterar. Todo desde un chat pensado para productos web reales.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="hero-feature-grid">
                  <article className={`hero-feature-card ${!memoryPreviewEnabled ? 'hero-feature-card-off' : ''}`}>
                    <div className="hero-feature-topline">
                      <span className="hero-feature-label">Memoria</span>
                      <button
                        type="button"
                        className={`memory-toggle ${memoryPreviewEnabled ? 'memory-toggle-on' : ''}`}
                        aria-pressed={memoryPreviewEnabled}
                        onClick={() => setMemoryPreviewEnabled((value) => !value)}
                      >
                        <span></span>
                      </button>
                    </div>
                    <strong>{displayedContextSlots}/{CONTEXT_WINDOW_SIZE}</strong>
                    <p>{memorySummary}</p>
                  </article>

                  <article className="hero-feature-card">
                    <div className="hero-feature-topline">
                      <span className="hero-feature-label">Modelo</span>
                      <span className="hero-feature-badge">{activeModelOption.label}</span>
                    </div>
                    <strong>{activeModelOption.label}</strong>
                    <p>{activeModelOption.desc}</p>
                  </article>
                </div>
              </section>
            )}

            {visibleMessages.map((message, index) => (
              <ChatMessage key={message.id} message={message} isLatest={index === visibleMessages.length - 1} />
            ))}

            {isTyping && (
              <div className="chat-message bot-message message-enter">
                <div className="bot-avatar">
                  <FlowLogo size={24} reading />
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
        <div className={`composer-dock ${isKeyboardVisible ? 'composer-dock-keyboard' : ''} ${isEmptyState ? 'composer-dock-empty' : ''} ${hasConversation ? 'composer-dock-compact' : ''}`}>
          <div className="composer-shell">
            <div className={`quick-actions ${isComposerFocused && viewportMetrics.isCompact ? 'quick-actions-hidden' : ''} ${isEmptyState ? 'quick-actions-empty' : ''} ${hasConversation ? 'quick-actions-compact' : ''}`}>
              {quickActions.map((action) => (
                <button key={action.label} className="quick-action-btn" onClick={() => { setInput(action.prompt); inputRef.current?.focus(); }}>
                  <span className="quick-action-title">{action.label}</span>
                  <span className="quick-action-description">{action.hint}</span>
                </button>
              ))}
            </div>

            <div className={`input-area ${isEmptyState ? 'input-area-empty' : ''} ${hasConversation ? 'input-area-compact' : ''}`}>
              <div className={`composer-topline ${hasConversation ? 'composer-topline-compact' : ''}`}>
                <span className={`composer-status-badge ${isTyping ? 'is-busy' : ''}`}>
                  {isTyping ? 'Generando respuesta' : 'Listo para usar'}
                </span>
                <p className="composer-status-copy">
                  {isTyping ? 'FlowBot esta preparando una respuesta.' : 'Pega codigo, describe el bug o pide la feature completa.'}
                </p>
              </div>

              <div className="input-selectors">
                <div className="selector-wrapper">
                  <button
                    className={`selector-btn ${thinkingMode !== 'normal' ? 'selector-btn-active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setThinkingDropdownOpen((value) => !value); setModelDropdownOpen(false); }}
                    title="Modo de pensamiento"
                  >
                    <ThinkingModeIcon mode={thinkingMode} size={14} />
                    <span className="selector-label">{activeThinkingOption.label}</span>
                    <svg className="selector-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {thinkingDropdownOpen && (
                    <div className="selector-dropdown" onClick={(e) => e.stopPropagation()}>
                      {thinkingOptions.map((option) => (
                        <button key={option.id} className={`dropdown-option ${thinkingMode === option.id ? 'dropdown-option-active' : ''}`} onClick={() => { setThinkingMode(option.id); setThinkingDropdownOpen(false); }}>
                          <ThinkingModeIcon mode={option.id} size={15} />
                          <div className="dropdown-option-text">
                            <span className="dropdown-option-label">{option.label}</span>
                            <span className="dropdown-option-desc">{option.desc}</span>
                          </div>
                          {thinkingMode === option.id && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="selector-wrapper">
                  <button
                    className={`selector-btn ${preferredModel !== 'auto' ? 'selector-btn-active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setModelDropdownOpen((value) => !value); setThinkingDropdownOpen(false); }}
                    title="Modelo"
                  >
                    <ModelIcon group={activeModelOption.key} size={14} />
                    <span className="selector-label">{activeModelOption.label}</span>
                    <svg className="selector-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {modelDropdownOpen && (
                    <div className="selector-dropdown" onClick={(e) => e.stopPropagation()}>
                      {modelOptions.map((option) => (
                        <button key={option.key} className={`dropdown-option ${preferredModel === option.key ? 'dropdown-option-active' : ''}`} onClick={() => { setPreferredModel(option.key); setModelDropdownOpen(false); }}>
                          <ModelIcon group={option.key} size={15} />
                          <div className="dropdown-option-text">
                            <span className="dropdown-option-label">{option.label}</span>
                            <span className="dropdown-option-desc">{option.desc}</span>
                          </div>
                          {preferredModel === option.key && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className={`memory-pill ${memoryPreviewEnabled ? 'memory-pill-on' : 'memory-pill-off'}`}>
                  <span className="memory-pill-label">Memoria</span>
                  <button type="button" className={`memory-toggle ${memoryPreviewEnabled ? 'memory-toggle-on' : ''}`} aria-pressed={memoryPreviewEnabled} onClick={() => setMemoryPreviewEnabled((value) => !value)}>
                    <span></span>
                  </button>
                </div>
              </div>

              <div className={`input-wrapper ${isEmptyState ? 'input-wrapper-empty' : ''} ${isTyping ? 'input-wrapper-loading' : ''}`}>
                <textarea
                  ref={inputRef}
                  className="chat-input"
                  placeholder={composerPlaceholder}
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
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22,2 15,22 11,13 2,9" />
                  </svg>
                </button>
              </div>

              <div className={`composer-footer ${hasConversation ? 'composer-footer-compact' : ''}`}>
                <p className="input-hint">
                  Ejemplos utiles: "Crea un navbar responsive en React", "Explicame este error", "Optimiza este componente".
                </p>
                <div className="composer-footer-meta">
                  <span className="composer-inline-pill">{activeModelOption.label}</span>
                  <span className={`composer-inline-pill ${memoryPreviewEnabled ? '' : 'is-muted'}`}>Memoria {displayedContextSlots}/{CONTEXT_WINDOW_SIZE}</span>
                  <span className="composer-inline-pill">{isAIOnline ? 'Servicio activo' : 'Modo fallback'}</span>
                </div>
              </div>
            </div>
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
