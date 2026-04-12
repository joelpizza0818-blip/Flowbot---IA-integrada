import React, { useState, useRef, useEffect, useCallback } from 'react';
import FlowLogo from './components/FlowLogo';
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
const IDLE_TIMEOUT_MS          = 15000;

function getEnvironmentInfo() {
  const host = window.location.hostname;
  const isProxy = !!import.meta.env.VITE_PROXY_URL;

  // 1. En linea (Deployed logic)
  if (host.endsWith('.github.io') || host.endsWith('.vercel.app') || host.endsWith('.netlify.app')) {
    return { label: 'En linea', detail: 'Deploy', isLocal: false, className: 'is-deployed' };
  }

  // 2. Proxy (Running with proxy server)
  if (isProxy) {
    return { label: 'Proxy', detail: 'Backend Proxy', isLocal: true, className: 'is-proxy' };
  }

  // 3. Local (Running local purely with frontend logic)
  return { label: 'Local', detail: 'Logica Nativa', isLocal: true, className: 'is-local' };
}

function getTimeString() {
  return new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function getViewportMetrics() {
  const vv             = window.visualViewport;
  const viewportHeight = Math.round(vv?.height ?? window.innerHeight);
  const viewportWidth  = Math.round(vv?.width  ?? window.innerWidth);
  const isCompact      = viewportWidth <= MOBILE_BREAKPOINT;
  return {
    viewportHeight,
    isCompact,
  };
}

function createWelcomeMessage() {
  return {
    id: 0, sender: 'bot',
    text: '**Bienvenido a FlowBot.** Estoy listo para ayudarte a crear interfaces, depurar errores, explicar código y aterrizar ideas web en respuestas accionables.',
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
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' };
  
  if (group === 'groq') {
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4v16" />
        <path d="M4 12h16" />
      </svg>
    );
  }
  
  if (group === 'gemini-3.1') {
    return (
      <svg {...p}>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    );
  }

  if (group === 'gemini-2.5') {
    return (
      <svg {...p}>
        <path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2z"/>
        <path d="M12 12v10M8 16l4 4 4-4"/>
      </svg>
    );
  }

  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3z"/>
      <path d="M3 12h18"/>
      <path d="M12 3a9 9 0 0 1 0 18"/>
    </svg>
  );
}

// â”€â”€ App â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function App() {
  const [messages, setMessages]         = useState([]);
  const [input, setInput]               = useState('');
  const [isTyping, setIsTyping]         = useState(false);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [timerAlert, setTimerAlert]     = useState(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [viewportMetrics, setViewportMetrics] = useState(() => getViewportMetrics());
  const [navigationUrl, setNavigationUrl]     = useState(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchModalType, setSearchModalType] = useState(null);
  const [searchModalInput, setSearchModalInput] = useState('');
  const [timerModalOpen, setTimerModalOpen]   = useState(false);
  const [timerModalValue, setTimerModalValue] = useState('');

  const [thinkingMode, setThinkingMode]       = useState('normal');
  const [preferredModel, setPreferredModel]   = useState('auto');
  const [memoryPreviewEnabled, setMemoryPreviewEnabled] = useState(true);
  const [isEphemeralMode, setIsEphemeralMode] = useState(false);
  const [thinkingDropdownOpen, setThinkingDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [islandOpen, setIslandOpen] = useState(false);
  const [islandX, setIslandX] = useState(() => Math.max(88, Math.round(window.innerWidth / 2)));

  // Mascot mood state
  const [mascotMood, setMascotMood] = useState('idle'); // idle | listening | thinking | celebrating | sleeping | excited | coveringEyes | shh
  const [justReceivedResponse, setJustReceivedResponse] = useState(false);
  const idleTimerRef = useRef(null);
  const envInfo = getEnvironmentInfo();

  const handleEphemeralStatus = useCallback((status) => {
    if (status === 'revealed') {
      setMascotMood('coveringEyes');
    } else if (status === 'consumed') {
      setMascotMood('shh');
      // Auto revert 'shh' after 2.5s
      setTimeout(() => {
        setMascotMood((current) => current === 'shh' ? 'idle' : current);
      }, 2500);
    }
  }, []);

  const messagesEndRef        = useRef(null);
  const messagesContainerRef  = useRef(null);
  const inputRef              = useRef(null);
  const nextId                = useRef(1);
  const islandDragStateRef    = useRef(null);
  const wasCompactRef         = useRef(null);

  const clampIslandX = useCallback((x) => {
    const margin = 12;
    const halfWidth = 88 / 2;
    return Math.max(margin + halfWidth, Math.min(window.innerWidth - margin - halfWidth, x));
  }, []);



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

      // When entering mobile layout, start the island centered but still draggable.
      // Avoid doing this on every resize to keep the user's chosen position.
      if (wasCompactRef.current === null) wasCompactRef.current = nextMetrics.isCompact;
      if (!wasCompactRef.current && nextMetrics.isCompact) {
        setIslandX(clampIslandX(Math.round(window.innerWidth / 2)));
      }
      wasCompactRef.current = nextMetrics.isCompact;
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
  }, [clampIslandX]);

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

  // â”€â”€ Mascot mood: idle â†’ sleeping after 30s â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (mascotMood === 'sleeping') setMascotMood('idle');
    idleTimerRef.current = setTimeout(() => {
      setMascotMood((prev) => (prev === 'idle' ? 'sleeping' : prev));
    }, IDLE_TIMEOUT_MS);
  }, [mascotMood]);

  useEffect(() => {
    const bootstrapTimerId = window.setTimeout(() => {
      resetIdleTimer();
    }, 0);
    const wakeEvents = ['mousemove', 'keydown', 'touchstart', 'scroll'];
    const wakeHandler = () => resetIdleTimer();
    wakeEvents.forEach((ev) => window.addEventListener(ev, wakeHandler, { passive: true }));
    return () => {
      window.clearTimeout(bootstrapTimerId);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      wakeEvents.forEach((ev) => window.removeEventListener(ev, wakeHandler));
    };
  }, [resetIdleTimer]);

  // Mascot reacts to typing state
  useEffect(() => {
    if (isTyping) {
      const thinkingTimerId = window.setTimeout(() => {
        setMascotMood('thinking');
      }, 0);
      return () => window.clearTimeout(thinkingTimerId);
    } else if (justReceivedResponse) {
      const celebrateTimerId = window.setTimeout(() => {
        setMascotMood('celebrating');
      }, 0);
      const idleTimerId = window.setTimeout(() => {
        setMascotMood('idle');
        setJustReceivedResponse(false);
      }, 2200);
      return () => {
        window.clearTimeout(celebrateTimerId);
        window.clearTimeout(idleTimerId);
      };
    }
  }, [isTyping, justReceivedResponse]);

  // â”€â”€ Send message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMsg = { id: nextId.current++, sender: 'user', text: trimmed, intents: [], time: getTimeString(), ephemeral: isEphemeralMode };
    const recentConversation = [...visibleMessages, userMsg];

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setMascotMood('excited'); // brief excited on send
    setTimeout(() => setMascotMood('thinking'), 600);

    (async () => {
      const response    = await generateBotResponse(trimmed, recentConversation, preferredModel, thinkingMode);

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
        ephemeral:     isEphemeralMode,
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
      setJustReceivedResponse(true);

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

  function handleIslandPointerDown(e) {
    if (islandOpen) return;
    islandDragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      originX: islandX,
      moved: false,
      threshold: e.pointerType === 'touch' ? 12 : 4,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function handleIslandPointerMove(e) {
    const dragState = islandDragStateRef.current;
    if (!dragState || dragState.pointerId !== e.pointerId || islandOpen) return;
    const delta = e.clientX - dragState.startX;
    if (Math.abs(delta) > dragState.threshold) dragState.moved = true;
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
    const m = trimmed.match(/(\d+(?:[.,]\d+)?)\s*(s|seg|segúndo|minuto|min|m|h|hora)?/i);
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
      mobileLabel: 'UI',
      hint: 'Componentes y UI',
      prompt: 'Crea un navbar responsive en React con menú móvil accesible y estados claros.',
    },
    {
      label: 'Aprender',
      mobileLabel: 'Explicar',
      hint: 'Explicado paso a paso',
      prompt: 'Explícame este concepto de React como si estuviera empezando y dame un ejemplo práctico.',
    },
    {
      label: 'Debug',
      mobileLabel: 'Bug',
      hint: 'Errores y fixes',
      prompt: 'Ayudame a depurar este error de React. Explica la causa raiz y propon una solucion limpia.',
    },
    {
      label: 'Optimizar',
      mobileLabel: 'Mejorar',
      hint: 'Rendimiento y limpieza',
      prompt: 'Optimiza este componente para rendimiento y claridad sin cambiar su comportamiento.',
    },
  ];

  const modelOptions = [
    { key: 'auto', label: 'Automático', desc: 'FlowBot elige entre Gemini 3.1 y GPT OSS según la consulta.' },
    { key: 'gemini-3.1', label: 'Gemini 3.1', desc: 'Más fuerte para arquitectura, UI compleja y respuestas largas.' },
    { key: 'groq', label: 'GPT OSS / Llama', desc: 'Más rápido para debugging, dudas breves y consultas iterativas.' },
  ];
  const thinkingOptions = [
    { id: 'normal', label: 'Normal', desc: 'Equilibrado para la mayoría de consultas.' },
    { id: 'deep', label: 'Profundo', desc: 'Analiza con mas detalle y razonamiento paso a paso.' },
    { id: 'short', label: 'Rápido', desc: 'Va directo al punto con menos texto.' },
  ];

  const isCompactViewport = viewportMetrics.isCompact;
  const hasConversation = messages.length > 1;
  const isEmptyState = !hasConversation;
  const visibleMessages = messages;
  const { usedSlots: displayedContextSlots } = getContextUsage(messages);

  const activeModelOption = modelOptions.find((option) => option.key === preferredModel) || modelOptions[0];
  const activeThinkingOption = thinkingOptions.find((option) => option.id === thinkingMode) || thinkingOptions[0];

  const composerPlaceholder =
    activeModelOption.key === 'gemini-3.1'
      ? 'Arquitecta un dashboard en React con estados claros, filtros y tabla responsive'
      : activeModelOption.key === 'groq'
        ? 'Depura este error de hydration en Next.js 15 y dime la causa raiz'
        : 'Crea un navbar responsive en React con menú móvil accesible';
  const memorySummary = !memoryPreviewEnabled
    ? 'Vista previa pausada'
    : displayedContextSlots === 0
      ? 'Lista para seguir tu hilo'
      : displayedContextSlots < CONTEXT_WINDOW_SIZE * 0.55
        ? 'Memoria aprendiendo el contexto actual'
        : 'Memoria lista para conversaciónes largas';
  const heroDescription = isCompactViewport
    ? 'Pide una feature, pega un bug o aterriza una idea en codigo listo para iterar.'
    : 'Pídele una feature, pega un bug o aterriza una idea en codigo listo para iterar. Todo desde un chat pensado para productos web reales.';
  const composerStatusLabel = isTyping ? 'Respondiendo' : (isCompactViewport ? 'Nueva consulta' : 'Listo para colaborar');
  const composerStatusDescription = isTyping
    ? 'FlowBot está preparando una respuesta.'
    : 'Pega codigo, describe el bug o pide la feature completa.';
  const composerHint = isCompactViewport
    ? 'Atajos rápidos arriba. Enter para enviar.'
    : 'Ejemplos útiles: "Crea un navbar responsive en React", "Explícame este error", "Optimiza este componente".';

  return (
    <div className="app-container">
      {/* â”€â”€ Timer alert â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {timerAlert && (
        <div className="timer-modal-overlay" onClick={() => setTimerAlert(null)}>
          <div className="timer-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="timer-modal-header">
              <div className={`timer-status-icon ${timerAlert.finished ? 'status-finished' : 'status-running'}`}>
                <IntentIcon name="automatizar" size={24} />
              </div>
              <div>
                <p className="modal-eyebrow">Automatización</p>
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

      {/* â”€â”€ Search modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {searchModalOpen && (
        <div className="search-modal-overlay" onClick={() => { setSearchModalOpen(false); setSearchModalInput(''); }}>
          <div className="search-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="search-modal-header">
              <div>
                <p className="modal-eyebrow">Búsqueda rápida</p>
                <h3>{searchModalType === 'youtube' ? 'Abrir en YouTube' : 'Abrir en Google'}</h3>
              </div>
              <button className="search-modal-close" onClick={() => { setSearchModalOpen(false); setSearchModalInput(''); }}>X</button>
            </div>
            <div className="search-modal-body">
              <input type="text" className="search-modal-input" placeholder={searchModalType === 'youtube' ? 'Busca un tutorial o video' : 'Busca una referencia, bug o librería'} value={searchModalInput} onChange={(e) => setSearchModalInput(e.target.value)}
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

      {/* â”€â”€ Timer modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

      {/* â”€â”€ Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
            <span>Nueva conversación</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="dynamic-island-layer" aria-hidden={false}>
        <div
          className={`dynamic-island ${islandOpen ? 'dynamic-island-open' : 'dynamic-island-closed'} ${isTyping ? 'dynamic-island-busy' : ''}`}
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
              <span className="dynamic-island-glow-ring" />
              <FlowLogo
                size={28}
                animated={true}
                trackCursor={true}
                wave={!islandOpen && !isTyping && hasConversation}
                thinking={mascotMood === 'thinking'}
                celebrating={mascotMood === 'celebrating'}
                sleeping={mascotMood === 'sleeping'}
                excited={mascotMood === 'excited'}
                listening={mascotMood === 'listening'}
                coveringEyes={mascotMood === 'coveringEyes'}
                shh={mascotMood === 'shh'}
              />
            </button>
          ) : (
            <div className="dynamic-island-panel">
              <button
                type="button"
                className="dynamic-island-brand"
                onClick={() => setIslandOpen(false)}
                aria-label="Cerrar isla dinamica"
              >
                <FlowLogo
                  size={22}
                  animated={true}
                  trackCursor={true}
                  wave={hasConversation}
                  thinking={mascotMood === 'thinking'}
                  celebrating={mascotMood === 'celebrating'}
                  sleeping={mascotMood === 'sleeping'}
                  excited={mascotMood === 'excited'}
                  listening={mascotMood === 'listening'}
                  coveringEyes={mascotMood === 'coveringEyes'}
                  shh={mascotMood === 'shh'}
                />
                <div className="dynamic-island-copy">
                  <span className="dynamic-island-name">FlowBot</span>
                  <div className="dynamic-island-meta-row">
                    <span className={`dynamic-island-env-pill ${envInfo.className}`}>{envInfo.label}</span>
                    <span className="dynamic-island-memory">
                      <span className="dynamic-island-memory-label">Memoria</span>
                      <span className="dynamic-island-memory-value">{displayedContextSlots}/{CONTEXT_WINDOW_SIZE}</span>
                    </span>
                  </div>
                </div>
              </button>

              {/* Memory mini progress bar */}
              <div className="dynamic-island-progress">
                <div className="dynamic-island-progress-fill" style={{ width: `${Math.min(100, (displayedContextSlots / CONTEXT_WINDOW_SIZE) * 100)}%` }} />
              </div>

              <div className="dynamic-island-actions">
                <button type="button" className="dynamic-island-action" onClick={() => { setSidebarOpen(true); setIslandOpen(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                  <span>Menu</span>
                </button>
                <button type="button" className="dynamic-island-action" onClick={() => { setMemoryPreviewEnabled((v) => !v); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  <span>Memoria</span>
                </button>
                <button type="button" className="dynamic-island-action dynamic-island-action-danger" onClick={handleClearChat}>
                  <IntentIcon name="clear" size={16} />
                  <span>Limpiar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <main className="chat-main">
        {/* â”€â”€ Messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className={`messages-container ${isEmptyState ? 'messages-container-empty' : ''}`} ref={messagesContainerRef}>
          <div className={`messages-inner ${isEmptyState ? 'messages-inner-empty' : ''}`}>
            {isEmptyState && (
              <section className="empty-state-hero" aria-label="Portada de FlowBot">
                <div className="hero-live-row">
                  <div className="empty-state-kicker">
                    <span className="empty-state-kicker-dot"></span>
                    Desarrolla y crea mas rapido
                  </div>
                  <span className={`hero-live-pill ${envInfo.className}`}>
                    <span className="hero-env-dot" />
                    {envInfo.label}
                  </span>
                </div>

                <div className="empty-state-head">
                  <div className="empty-state-copy">
                    <p className="empty-state-eyebrow">FlowBot para developers</p>
                    <h2 className="empty-state-title">Construye más rapido. Depura con contexto. Aprende mientras envías.</h2>
                    <div className="empty-state-description-container">
                      <p className="empty-state-description">
                        {heroDescription}
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
                    <p>{isCompactViewport ? 'Preferencia activa para responder.' : activeModelOption.desc}</p>
                  </article>

                  <article className={`hero-feature-card ${isEphemeralMode ? 'hero-feature-card-active' : ''}`}>
                    <div className="hero-feature-topline">
                      <span className="hero-feature-label">Efímero</span>
                      <button
                        type="button"
                        className={`memory-toggle ${isEphemeralMode ? 'memory-toggle-on' : ''}`}
                        aria-pressed={isEphemeralMode}
                        onClick={() => setIsEphemeralMode((v) => !v)}
                      >
                        <span></span>
                      </button>
                    </div>
                    <strong>{isEphemeralMode ? 'Vista única ON' : 'Vista única OFF'}</strong>
                    <p>Los mensajes desaparecen por completo después de ser vistos.</p>
                  </article>
                </div>
              </section>
            )}

            {visibleMessages.map((message, index) => (
              <ChatMessage 
                key={message.id} 
                message={message} 
                isLatest={index === visibleMessages.length - 1}
                onStatusChange={handleEphemeralStatus}
              />
            ))}

            {isTyping && (
              <div className="chat-message bot-message message-enter">
                <div className="bot-avatar">
                  <FlowLogo size={24} reading thinking />
                </div>
                <div className="message-bubble bot-bubble typing-bubble">
                  <div className="typing-indicator"><span></span><span></span><span></span></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* â”€â”€ Composer dock â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className={`composer-dock ${hasConversation ? 'composer-dock-compact' : ''}`}>
          <div className="composer-shell">
            <div className={`quick-actions ${isComposerFocused && viewportMetrics.isCompact ? 'quick-actions-hidden' : ''} ${hasConversation ? 'quick-actions-compact' : ''}`}>
              {quickActions.map((action) => (
                <button key={action.label} className="quick-action-btn" onClick={() => { setInput(action.prompt); inputRef.current?.focus(); }} title={action.prompt}>
                  <span className="quick-action-copy">
                    <span className="quick-action-title">{isCompactViewport ? action.mobileLabel || action.label : action.label}</span>
                    {!isCompactViewport && <span className="quick-action-description">{action.hint}</span>}
                  </span>
                  <span className="quick-action-arrow" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="m13 5 7 7-7 7" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>

            <div className={`input-area ${hasConversation ? 'input-area-compact' : ''}`}>
              <div className={`composer-topline ${hasConversation ? 'composer-topline-compact' : ''}`}>
                <div className="composer-status-stack">
                  <span className={`composer-status-badge ${isTyping ? 'is-busy' : ''}`}>
                    {composerStatusLabel}
                  </span>
                  {!isCompactViewport && (
                    <p className="composer-status-copy">
                      {composerStatusDescription}
                    </p>
                  )}
                </div>
                <div className="composer-top-meta">
                  <span className="composer-inline-pill">{activeModelOption.label}</span>
                  {!isCompactViewport && <span className={`composer-inline-pill ${memoryPreviewEnabled ? '' : 'is-muted'}`}>Memoria {displayedContextSlots}/{CONTEXT_WINDOW_SIZE}</span>}
                  <span className={`composer-inline-pill ${envInfo.className}`}>{envInfo.label}</span>
                </div>
              </div>

              <div className={`input-wrapper ${isTyping ? 'input-wrapper-loading' : ''}`}>
                <textarea
                  ref={inputRef}
                  className="chat-input"
                  placeholder={composerPlaceholder}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); if (e.target.value.trim() && !isTyping) setMascotMood('listening'); else if (!e.target.value.trim() && !isTyping) setMascotMood('idle'); }}
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

                <div className={`memory-pill ${isEphemeralMode ? 'memory-pill-on' : 'memory-pill-off'}`}>
                  <span className="memory-pill-label">Efímero</span>
                  <button type="button" className={`memory-toggle ${isEphemeralMode ? 'memory-toggle-on' : ''}`} aria-pressed={isEphemeralMode} onClick={() => setIsEphemeralMode((v) => !v)}>
                    <span></span>
                  </button>
                </div>

                <div className={`memory-pill ${memoryPreviewEnabled ? 'memory-pill-on' : 'memory-pill-off'}`}>
                  <span className="memory-pill-label">Memoria</span>
                  <button type="button" className={`memory-toggle ${memoryPreviewEnabled ? 'memory-toggle-on' : ''}`} aria-pressed={memoryPreviewEnabled} onClick={() => setMemoryPreviewEnabled((value) => !value)}>
                    <span></span>
                  </button>
                </div>
              </div>

              <div className={`composer-footer ${hasConversation ? 'composer-footer-compact' : ''}`}>
                <p className="input-hint">
                  {composerHint}
                </p>
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


