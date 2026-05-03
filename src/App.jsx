import React, { useState, useRef, useEffect, useCallback } from 'react';
import FlowLogo from './components/FlowLogo';
import ChatMessage from './components/ChatMessage';
import IntentIcon from './components/IntentIcon';
import AuthPage from './components/AuthPage';
import {
  generateBotResponse,
  intentGroups,
  availableActions,
} from './chatbotLogic';
import { CONTEXT_WINDOW_SIZE, getContextUsage } from './contextPrompt';
import { checkBackendAvailability } from './appMode';
import { changeUserPassword, clearStoredAuthUser, getCurrentUser, getUserProfile, loginUser, logoutUser, registerUser } from './auth';
import { storage } from './storage';
import { useShortcuts } from './shortcuts';
import './App.css';
import './flowbot.animations.css';

const MOBILE_BREAKPOINT        = 768;
const IDLE_TIMEOUT_MS          = 10000;
const ACCOUNT_MEMORY_BONUS     = 4;

function getEnvironmentInfo({ backendAvailable, isOnline }) {
  const host = window.location.hostname;
  const isDeployedHost = host.endsWith('.github.io') || host.endsWith('.vercel.app') || host.endsWith('.netlify.app');

  if (backendAvailable) {
    return {
      label: 'En linea',
      detail: isDeployedHost
        ? 'SaaS conectado: autenticacion activa y chats persistentes.'
        : 'Backend activo con historial por usuario.',
      isLocal: false,
      className: 'is-deployed',
      mode: 'online',
    };
  }

  return {
    label: 'Local',
    detail: isOnline
      ? 'Sin backend disponible. Guardado local por dispositivo.'
      : 'Sin red y sin backend. Funcionando 100% local.',
    isLocal: true,
    className: 'is-local',
    mode: 'local',
  };
}

function getTimeString() {
  return new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function getViewportMetrics() {
  const vv             = window.visualViewport;
  const viewportHeight = Math.round(vv?.height ?? window.innerHeight);
  const viewportWidth  = Math.round(vv?.width  ?? window.innerWidth);
  const isCompact      = viewportWidth <= MOBILE_BREAKPOINT;
  const obscuredBottom = Math.max(0, Math.round(window.innerHeight - ((vv?.height ?? window.innerHeight) + (vv?.offsetTop ?? 0))));
  const keyboardOpen   = isCompact && obscuredBottom > 120;
  return {
    viewportHeight,
    isCompact,
    keyboardOpen,
    keyboardOffset: keyboardOpen ? obscuredBottom : 0,
  };
}

function getConnectivityInfo() {
  const isOnline = navigator.onLine;
  return {
    label: isOnline ? 'Con internet' : 'Desconectado',
    detail: isOnline ? 'Red activa' : 'Sin conexión',
    className: isOnline ? 'is-online' : 'is-offline',
    isOnline,
  };
}

function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function isWelcomeMessage(message) {
  return (
    message?.sender === 'bot' &&
    (message.id === 0 || message.id === '0') &&
    typeof message.text === 'string' &&
    message.text.includes('Bienvenido a FlowBot')
  );
}

function removeWelcomeMessages(messages = []) {
  return messages.filter((message) => !isWelcomeMessage(message));
}

function getProfileInitials(name = '') {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
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

// App
function App() {
  const [messages, setMessages]         = useState([]);
  const [input, setInput]               = useState('');
  const [isTyping, setIsTyping]         = useState(false);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [timerAlert, setTimerAlert]     = useState(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [viewportMetrics, setViewportMetrics] = useState(() => getViewportMetrics());
  const [connectivityInfo, setConnectivityInfo] = useState(() => getConnectivityInfo());
  const [navigationUrl, setNavigationUrl]     = useState(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchModalType, setSearchModalType] = useState(null);
  const [searchModalInput, setSearchModalInput] = useState('');
  const [timerModalOpen, setTimerModalOpen]   = useState(false);
  const [timerModalValue, setTimerModalValue] = useState('');
  const [recentChats, setRecentChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [appReady, setAppReady] = useState(false);
  const [chatBootstrapReady, setChatBootstrapReady] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState('login');
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authErrorMessage, setAuthErrorMessage] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordStatus, setPasswordStatus] = useState('');
  const [accountBenefitsOpen, setAccountBenefitsOpen] = useState(false);

  const [thinkingMode, setThinkingMode]       = useState('normal');
  const [preferredModel, setPreferredModel]   = useState('auto');
  const [memoryPreviewEnabled, setMemoryPreviewEnabled] = useState(true);
  const [isEphemeralMode, setIsEphemeralMode] = useState(false);
  const [thinkingDropdownOpen, setThinkingDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [islandOpen, setIslandOpen] = useState(false);
  const [islandPosition, setIslandPosition] = useState(() => ({
    x: window.innerWidth <= MOBILE_BREAKPOINT
      ? Math.max(88, Math.round(window.innerWidth / 2))
      : Math.max(88, window.innerWidth - 96),
    y: 92,
  }));
  const [isGreetingWaveActive, setIsGreetingWaveActive] = useState(false);

  // Mascot mood state
  const [mascotMood, setMascotMood] = useState('idle'); // idle | listening | searching | thinking | celebrating | sleeping | excited | bored | lookingDown | coveringEyes | shh
  const [justReceivedResponse, setJustReceivedResponse] = useState(false);
  const idleTimerRef = useRef(null);
  const mascotMoodRef = useRef('idle');
  const shhTimerRef = useRef(null);
  const coveringEyesTimerRef = useRef(null);
  const sendSearchTimerRef = useRef(null);
  const sendThinkingTimerRef = useRef(null);
  const ambientMoodStartTimerRef = useRef(null);
  const ambientMoodEndTimerRef = useRef(null);
  const hasPlayedGreetingRef = useRef(false);
  const envInfo = getEnvironmentInfo({ backendAvailable, isOnline: connectivityInfo.isOnline });
  const hasConversation = messages.length > 0;

  const handleEphemeralStatus = useCallback((status) => {
    if (status === 'revealed') {
      if (coveringEyesTimerRef.current) window.clearTimeout(coveringEyesTimerRef.current);
      setMascotMood('coveringEyes');
      coveringEyesTimerRef.current = window.setTimeout(() => {
        setMascotMood((current) => (current === 'coveringEyes' ? 'idle' : current));
      }, 1800);
    } else if (status === 'consumed') {
      if (shhTimerRef.current) window.clearTimeout(shhTimerRef.current);
      setMascotMood('shh');
      shhTimerRef.current = window.setTimeout(() => {
        setMascotMood((current) => current === 'shh' ? 'idle' : current);
      }, 2600);
    }
  }, []);

  const messagesEndRef        = useRef(null);
  const messagesContainerRef  = useRef(null);
  const inputRef              = useRef(null);
  const composerDockRef       = useRef(null);
  const nextId                = useRef(1);
  const activeUserRef         = useRef(null);
  const activeChatIdRef       = useRef(null);
  const loadedUserRef         = useRef(null);
  const islandDragStateRef    = useRef(null);
  const wasCompactRef         = useRef(null);
  const [composerHeight, setComposerHeight] = useState(0);

  const clampIslandPosition = useCallback((position) => {
    const margin = 12;
    const halfWidth = 88 / 2;
    const halfHeight = 88 / 2;
    return {
      x: Math.max(margin + halfWidth, Math.min(window.innerWidth - margin - halfWidth, position.x)),
      y: Math.max(margin + halfHeight, Math.min(window.innerHeight - margin - halfHeight, position.y)),
    };
  }, []);

  const sortChatsByDate = useCallback((chats) => (
    [...chats].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  ), []);

  const clearSendMoodTimers = useCallback(() => {
    if (sendSearchTimerRef.current) {
      window.clearTimeout(sendSearchTimerRef.current);
      sendSearchTimerRef.current = null;
    }
    if (sendThinkingTimerRef.current) {
      window.clearTimeout(sendThinkingTimerRef.current);
      sendThinkingTimerRef.current = null;
    }
  }, []);

  const clearAmbientMoodStartTimer = useCallback(() => {
    if (ambientMoodStartTimerRef.current) {
      window.clearTimeout(ambientMoodStartTimerRef.current);
      ambientMoodStartTimerRef.current = null;
    }
  }, []);

  const clearAmbientMoodTimers = useCallback(() => {
    clearAmbientMoodStartTimer();
    if (ambientMoodEndTimerRef.current) {
      window.clearTimeout(ambientMoodEndTimerRef.current);
      ambientMoodEndTimerRef.current = null;
    }
  }, [clearAmbientMoodStartTimer]);

  useEffect(() => {
    mascotMoodRef.current = mascotMood;
  }, [mascotMood]);

  useEffect(() => () => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    if (shhTimerRef.current) window.clearTimeout(shhTimerRef.current);
    if (coveringEyesTimerRef.current) window.clearTimeout(coveringEyesTimerRef.current);
    clearSendMoodTimers();
    clearAmbientMoodTimers();
  }, [clearAmbientMoodTimers, clearSendMoodTimers]);



  useEffect(() => {
    let mounted = true;
    let pollTimer = null;

    (async () => {
      const availability = await checkBackendAvailability();
      if (!mounted) return;
      setBackendAvailable(Boolean(availability.backendAvailable));
      const user = await getCurrentUser();
      if (!mounted) return;
      setAuthUser(user || null);
      if (!user?.id) setChatBootstrapReady(false);
      setAppReady(true);

      pollTimer = window.setInterval(async () => {
        const nextAvailability = await checkBackendAvailability(2200, 0);
        if (!mounted) return;
        setBackendAvailable(Boolean(nextAvailability.backendAvailable));
      }, 5000);
    })();

    return () => {
      mounted = false;
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!appReady) return () => {};
    const effectiveUserId = authUser?.id || 'guest';
    if (loadedUserRef.current === effectiveUserId) return () => {};
    loadedUserRef.current = effectiveUserId;

    (async () => {
      const user = authUser || { id: 'guest', name: 'Invitado', isGuest: true };
      activeUserRef.current = user;

      let chats = await storage.getChats(user.id);

      // Find an existing empty "Nuevo chat" to use as the active chat
      let emptyNewChat = null;
      for (const chat of chats) {
        if (chat.title === 'Nuevo chat') {
          const msgs = await storage.getMessages(chat.id);
          if (!msgs || msgs.length === 0) { emptyNewChat = chat; break; }
        }
      }

      let activeChat = emptyNewChat || chats[0];

      if (!activeChat) {
        activeChat = await storage.saveChat(user.id, {
          id: `chat-${crypto.randomUUID()}`,
          title: 'Nuevo chat',
        });
        chats = [activeChat];
      }

      activeChatIdRef.current = activeChat.id;
      setActiveChatId(activeChat.id);
      setRecentChats(sortChatsByDate(chats));
      await storage.syncOfflineChats(user.id);

      const storedMessages = removeWelcomeMessages(await storage.getMessages(activeChat.id));
      if (!mounted) return;

      setMessages(storedMessages);
      const highestId = storedMessages.reduce((max, item) => {
        const numeric = Number(item.id);
        return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
      }, 0);
      nextId.current = highestId + 1;
      setChatBootstrapReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, [appReady, authUser, sortChatsByDate]);

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
      setIslandPosition((current) => clampIslandPosition(current));
      if (nextMetrics.isCompact) setSidebarOpen(false);

      // When entering mobile layout, start the island centered but still draggable.
      // Avoid doing this on every resize to keep the user's chosen position.
      if (wasCompactRef.current === null) wasCompactRef.current = nextMetrics.isCompact;
      if (!wasCompactRef.current && nextMetrics.isCompact) {
        setIslandPosition((current) => clampIslandPosition({
          ...current,
          x: Math.round(window.innerWidth / 2),
        }));
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
  }, [clampIslandPosition]);

  useEffect(() => {
    const updateConnectivity = () => setConnectivityInfo(getConnectivityInfo());
    window.addEventListener('online', updateConnectivity);
    window.addEventListener('offline', updateConnectivity);
    return () => {
      window.removeEventListener('online', updateConnectivity);
      window.removeEventListener('offline', updateConnectivity);
    };
  }, []);

  useEffect(() => {
    const element = composerDockRef.current;
    if (!element) return;

    const updateHeight = () => setComposerHeight(element.offsetHeight);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    window.addEventListener('resize', updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [hasConversation, viewportMetrics.isCompact]);

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

  useEffect(() => {
    if (!hasConversation || hasPlayedGreetingRef.current) return;
    hasPlayedGreetingRef.current = true;
    const greetingStartTimerId = window.setTimeout(() => {
      setIsGreetingWaveActive(true);
    }, 0);
    const greetingTimerId = window.setTimeout(() => {
      setIsGreetingWaveActive(false);
    }, 3600);
    return () => {
      window.clearTimeout(greetingStartTimerId);
      window.clearTimeout(greetingTimerId);
    };
  }, [hasConversation]);

  // Mascot mood: idle â†’ sleeping after 10s
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    clearAmbientMoodStartTimer();
    setMascotMood((current) => (
      current === 'sleeping' || current === 'bored' || current === 'lookingDown'
        ? 'idle'
        : current
    ));
    idleTimerRef.current = window.setTimeout(() => {
      setMascotMood((prev) => (
        ['coveringEyes', 'shh', 'celebrating', 'excited', 'thinking', 'searching'].includes(prev)
          ? prev
          : 'sleeping'
      ));
    }, IDLE_TIMEOUT_MS);
  }, [clearAmbientMoodStartTimer]);

  useEffect(() => {
    const bootstrapTimerId = window.setTimeout(() => {
      resetIdleTimer();
    }, 0);
    const wakeEvents = ['mousemove', 'keydown', 'touchstart', 'scroll'];
    const wakeHandler = () => resetIdleTimer();
    wakeEvents.forEach((ev) => window.addEventListener(ev, wakeHandler, { passive: true }));
    return () => {
      window.clearTimeout(bootstrapTimerId);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      wakeEvents.forEach((ev) => window.removeEventListener(ev, wakeHandler));
    };
  }, [resetIdleTimer]);

  // Random ambient moods while idle so the mascot feels alive.
  useEffect(() => {
    const canRunAmbientMood = mascotMood === 'idle' && !isTyping && !input.trim();

    if (!canRunAmbientMood) {
      clearAmbientMoodStartTimer();
      return;
    }

    if (ambientMoodStartTimerRef.current || ambientMoodEndTimerRef.current) return;

    ambientMoodStartTimerRef.current = window.setTimeout(() => {
      ambientMoodStartTimerRef.current = null;
      if (mascotMoodRef.current !== 'idle') return;

      const nextMood = Math.random() < 0.58 ? 'lookingDown' : 'bored';
      const holdMs = nextMood === 'bored'
        ? randomBetween(2800, 4600)
        : randomBetween(1700, 3200);

      setMascotMood(nextMood);
      ambientMoodEndTimerRef.current = window.setTimeout(() => {
        ambientMoodEndTimerRef.current = null;
        setMascotMood((current) => (current === nextMood ? 'idle' : current));
      }, holdMs);
    }, randomBetween(6500, 14500));
  }, [clearAmbientMoodStartTimer, input, isTyping, mascotMood]);

  // Mascot reacts to typing state
  useEffect(() => {
    if (isTyping) {
      const thinkingTimerId = window.setTimeout(() => {
        setMascotMood((current) => (
          current === 'excited' || current === 'searching'
            ? current
            : 'thinking'
        ));
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

  // Send message
  async function persistMessage(message) {
    const chatId = activeChatIdRef.current;
    if (!chatId) return;
    if (message?.ephemeral) return;
    const activeChat = recentChats.find((chat) => chat.id === chatId);
    await storage.saveMessage({ ...message, chatId, storageSource: activeChat?.source || 'backend' });
  }

  function createMessageId() {
    return `msg-${crypto.randomUUID()}`;
  }

  async function ensureChatTitleFromFirstUserMessage(messageText) {
    if (!activeUserRef.current?.id || !activeChatIdRef.current) return;
    const chatId = activeChatIdRef.current;
    const current = recentChats.find((chat) => chat.id === chatId);
    if (!current || (current.title && current.title !== 'Nuevo chat')) return;
    const nextTitle = (messageText || '').trim().slice(0, 72);
    if (!nextTitle) return;

    const updated = await storage.saveChat(activeUserRef.current.id, {
      id: chatId,
      title: nextTitle,
      createdAt: current.createdAt,
      source: current.source,
    });
    setRecentChats((prev) => sortChatsByDate(prev.map((chat) => (
      chat.id === chatId ? { ...chat, ...updated } : chat
    ))));
  }

  function handleSend() {
    if (!chatBootstrapReady) return;
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMsg = { id: createMessageId(), sender: 'user', text: trimmed, intents: [], time: getTimeString(), ephemeral: isEphemeralMode };
    const recentConversation = [...visibleMessages, userMsg];

    setMessages((prev) => [...prev, userMsg]);
    void persistMessage(userMsg);
    if (!isEphemeralMode) {
      void ensureChatTitleFromFirstUserMessage(trimmed);
    }
    setInput('');
    setIsTyping(true);
    setIslandOpen(false);
    clearSendMoodTimers();
    setMascotMood('excited'); // brief excited on send
    sendSearchTimerRef.current = window.setTimeout(() => {
      setMascotMood((current) => (current === 'excited' ? 'searching' : current));
    }, 420);
    sendThinkingTimerRef.current = window.setTimeout(() => {
      setMascotMood((current) => (
        current === 'excited' || current === 'searching'
          ? 'thinking'
          : current
      ));
    }, 1580);

    (async () => {
      try {
        const response = await generateBotResponse(trimmed, recentConversation, preferredModel, thinkingMode, effectiveContextWindowSize);

        const botMsg = {
          id:            createMessageId(),
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
        void persistMessage(botMsg);
        setJustReceivedResponse(true);

        if (botMsg.actions?.length) {
          botMsg.actions.forEach(({ action }) => {
            if (action === 'set_timer') { setTimerModalOpen(true); setTimerModalValue(''); }
          });
        }
      } catch (error) {
        console.error('Error generating bot response:', error);
        const fallbackMsg = {
          id: createMessageId(),
          sender: 'bot',
          text: 'Tuve un problema temporal al generar la respuesta. Intenta de nuevo en unos segundos.',
          iconName: 'alert',
          intents: [],
          actions: [],
          time: getTimeString(),
          fallbackReason: 'runtime_error',
          thinkingMode,
          ephemeral: isEphemeralMode,
        };
        setMessages((prev) => [...prev, fallbackMsg]);
        void persistMessage(fallbackMsg);
        setJustReceivedResponse(true);
      } finally {
        clearSendMoodTimers();
        setIsTyping(false);
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

  async function handleClearChat() {
    setMessages([]);
    nextId.current = 1;
    setIslandOpen(false);
    setIsGreetingWaveActive(false);
    hasPlayedGreetingRef.current = false;

    const userId = activeUserRef.current?.id || 'guest';

    // 1. Fetch latest chats and messages to strictly check for empty "Nuevo chat"
    const allChats = await storage.getChats(userId);
    
    // Check current chat first
    const currentChat = allChats.find(c => c.id === activeChatIdRef.current);
    if (currentChat?.title === 'Nuevo chat') {
      const currentMsgs = await storage.getMessages(currentChat.id);
      if (!currentMsgs || currentMsgs.length === 0) {
        return; // Already on an empty new chat
      }
    }

    // Check for any other empty "Nuevo chat"
    for (const chat of allChats) {
      if (chat.title === 'Nuevo chat') {
        const msgs = await storage.getMessages(chat.id);
        if (!msgs || msgs.length === 0) {
          activeChatIdRef.current = chat.id;
          setActiveChatId(chat.id);
          return;
        }
      }
    }

    // 2. Create new one if none found
    const chat = await storage.saveChat(userId, {
      id: `chat-${crypto.randomUUID()}`,
      title: 'Nuevo chat',
    });
    if (chat) {
      activeChatIdRef.current = chat.id;
      setActiveChatId(chat.id);
      setRecentChats((prev) => sortChatsByDate([chat, ...prev]));
    }
  }

  async function handleSelectChat(chatId) {
    if (!chatId) return;
    const selectedMessages = removeWelcomeMessages(await storage.getMessages(chatId));
    activeChatIdRef.current = chatId;
    setActiveChatId(chatId);
    setMessages(selectedMessages);
    const highestId = (selectedMessages || []).reduce((max, item) => {
      const numeric = Number(item.id);
      return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
    }, 0);
    nextId.current = highestId + 1;
    if (viewportMetrics.isCompact) setSidebarOpen(false);
  }

  async function handleDeleteRecentChat(chatId) {
    if (!chatId) return;
    const activeUserId = activeUserRef.current?.id || 'guest';
    if (!activeUserId) return;

    try {
      const deletingActiveChat = activeChatIdRef.current === chatId;

      await storage.deleteChat(chatId);

      let nextChats = sortChatsByDate(recentChats.filter((chat) => chat.id !== chatId));

      if (!nextChats.length) {
        const fallbackChat = await storage.saveChat(activeUserId, {
          id: `chat-${crypto.randomUUID()}`,
          title: 'Nuevo chat',
        });
        if (fallbackChat) nextChats = [fallbackChat];
      }

      setRecentChats(nextChats);

      if (!deletingActiveChat) return;

      const nextActiveChat = nextChats[0] || null;
      if (!nextActiveChat) {
        activeChatIdRef.current = null;
        setActiveChatId(null);
        setMessages([]);
        nextId.current = 1;
        return;
      }

      activeChatIdRef.current = nextActiveChat.id;
      setActiveChatId(nextActiveChat.id);
      const selectedMessages = removeWelcomeMessages(await storage.getMessages(nextActiveChat.id));
      setMessages(selectedMessages);
      const highestId = (selectedMessages || []).reduce((max, item) => {
        const numeric = Number(item.id);
        return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
      }, 0);
      nextId.current = highestId + 1;
    } catch (error) {
      console.error('No se pudo eliminar el chat:', error);
    }
  }

  function handleIslandPointerDown(e) {
    if (islandOpen) return;
    islandDragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: islandPosition.x,
      originY: islandPosition.y,
      moved: false,
      threshold: e.pointerType === 'touch' ? 12 : 4,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function handleIslandPointerMove(e) {
    const dragState = islandDragStateRef.current;
    if (!dragState || dragState.pointerId !== e.pointerId || islandOpen) return;
    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;
    if (Math.hypot(deltaX, deltaY) > dragState.threshold) dragState.moved = true;
    setIslandPosition(clampIslandPosition({
      x: dragState.originX + deltaX,
      y: dragState.originY + deltaY,
    }));
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
    { key: 'auto', label: 'Automático', desc: 'El modelo es elegido de manera automatica ' },
    { key: 'gemini-3.1', label: 'Gemini 3.1', desc: 'Más fuerte para arquitectura, UI compleja y respuestas largas.' },
    { key: 'groq', label: 'GPT OSS / Llama', desc: 'Más rápido para debugging, dudas breves y consultas iterativas.' },
  ];
  const thinkingOptions = [
    { id: 'normal', label: 'Normal', desc: 'Equilibrado para la mayoría de consultas.' },
    { id: 'deep', label: 'Profundo', desc: 'Analiza con mas detalle y razonamiento paso a paso.' },
    { id: 'short', label: 'Rápido', desc: 'Va directo al punto con menos texto.' },
  ];

  const isCompactViewport = viewportMetrics.isCompact;
  const isMobileKeyboardOpen = viewportMetrics.isCompact && viewportMetrics.keyboardOpen;
  const isMobileComposerPinned = hasConversation && isCompactViewport;
  const composerMobileHeight = isMobileComposerPinned ? composerHeight : 0;
  const composerMobileOffset = isMobileComposerPinned ? viewportMetrics.keyboardOffset : 0;
  const isEmptyState = !hasConversation;
  const visibleMessages = messages;
  const hasActiveAccount = Boolean(backendAvailable && authUser?.id && !authUser?.isGuest);
  const canSelectModel = hasActiveAccount;
  const canUseDeepThinking = hasActiveAccount;
  const effectiveContextWindowSize = CONTEXT_WINDOW_SIZE + (hasActiveAccount ? ACCOUNT_MEMORY_BONUS : 0);
  const { usedSlots: displayedContextSlots } = getContextUsage(messages, effectiveContextWindowSize);
  const liveStatusItems = [envInfo, connectivityInfo];
  const hasLocalChats = recentChats.some((chat) => chat.source === 'local');
  const profileInitials = getProfileInitials(authUser?.name || authUser?.email);
  const profileStats = profileData || {
    totalChats: recentChats.length,
    totalMessages: messages.length,
    memoryBase: CONTEXT_WINDOW_SIZE,
    memoryBonus: hasActiveAccount ? ACCOUNT_MEMORY_BONUS : 0,
    memoryLimit: effectiveContextWindowSize,
  };

  const activeModelOption = modelOptions.find((option) => option.key === preferredModel) || modelOptions[0];
  const activeThinkingOption = thinkingOptions.find((option) => option.id === thinkingMode) || thinkingOptions[0];

  useShortcuts({
    onClearChat: handleClearChat,
    onToggleMemory: () => setMemoryPreviewEnabled((v) => !v),
    onToggleEphemeral: () => setIsEphemeralMode((v) => !v),
    onOpenModelSelector: () => {
      setModelDropdownOpen((value) => !value);
      setThinkingDropdownOpen(false);
    },
    hasActiveAccount,
  });

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
      : displayedContextSlots < effectiveContextWindowSize * 0.55
        ? 'Memoria aprendiendo el contexto actual'
        : 'Memoria lista para conversaciónes largas';
  const programCopy = envInfo.mode === 'online'
    ? {
      heroCompact: 'Version en linea: autenticacion activa y chats persistentes por usuario.',
      heroDesktop: 'Version en linea: autenticacion, persistencia y continuidad real de historiales entre sesiones.',
      hintCompact: 'Modo SaaS activo. Enter para enviar.',
      hintDesktop: 'Modo en linea: historial por usuario, reapertura de chats y sincronizacion con el servidor.',
      statusIdle: 'Trabaja con contexto persistente y sesiones autenticadas.',
    }
    : {
      heroCompact: 'Version local: guardado por dispositivo con fallback automatico.',
      heroDesktop: 'Version local: chatbot funcional sin servidor, usando localStorage por dispositivo para continuar tus chats.',
      hintCompact: 'Modo local activo. Enter para enviar.',
      hintDesktop: 'Modo local: historial por dispositivo y funcionamiento sin servidor.',
      statusIdle: 'Pega codigo, describe el bug o pide la feature completa.',
    };
  const heroDescription = isCompactViewport ? programCopy.heroCompact : programCopy.heroDesktop;
  const composerStatusLabel = isTyping ? 'Respondiendo' : (isCompactViewport ? 'Nueva consulta' : 'Listo para colaborar');
  const composerStatusDescription = isTyping
    ? 'FlowBot está preparando una respuesta.'
    : programCopy.statusIdle;
  const composerHint = isCompactViewport
    ? programCopy.hintCompact
    : programCopy.hintDesktop;
  const isGreetingWaveVisible = isGreetingWaveActive && !isTyping && mascotMood === 'idle';
  const islandMascotStateProps = {
    animated: true,
    trackCursor: !isCompactViewport,
    wave: isGreetingWaveVisible,
    thinking: mascotMood === 'thinking',
    celebrating: mascotMood === 'celebrating',
    sleeping: mascotMood === 'sleeping',
    excited: mascotMood === 'excited',
    listening: mascotMood === 'listening',
    coveringEyes: mascotMood === 'coveringEyes',
    shh: mascotMood === 'shh',
    reading: mascotMood === 'searching' || mascotMood === 'thinking' || mascotMood === 'listening',
    searching: mascotMood === 'searching',
    bored: mascotMood === 'bored',
    lookingDown: mascotMood === 'lookingDown',
  };

  async function handleAuthLogin(credentials) {
    try {
      const user = await loginUser(credentials);
      setAuthErrorMessage('');
      setAuthUser(user);
    } catch (error) {
      setAuthErrorMessage(error.message || 'No se pudo iniciar sesión.');
      throw error;
    }
  }

  async function handleAuthRegister(credentials) {
    try {
      const user = await registerUser(credentials);
      setAuthErrorMessage('');
      setAuthUser(user);
    } catch (error) {
      setAuthErrorMessage(error.message || 'No se pudo registrar.');
      throw error;
    }
  }

  async function handleLogout() {
    await logoutUser();
    setAuthInitialTab('login');
    setAuthUser(null);
    setProfileOpen(false);
    setProfileData(null);
    setChatBootstrapReady(false);
    setRecentChats([]);
    setActiveChatId(null);
    activeChatIdRef.current = null;
    loadedUserRef.current = null;
  }

  function handleShowAuth(tab) {
    clearStoredAuthUser();
    setAuthInitialTab(tab === 'register' ? 'register' : 'login');
    setAuthUser(null);
    setProfileOpen(false);
    setProfileData(null);
    setChatBootstrapReady(false);
    setRecentChats([]);
    setActiveChatId(null);
    activeChatIdRef.current = null;
    loadedUserRef.current = null;
  }

  async function handleOpenProfile() {
    if (!hasActiveAccount) return;
    setProfileOpen(true);
    setSidebarOpen(false);
    setIslandOpen(false);
    setProfileError('');
    setPasswordStatus('');

    try {
      setProfileLoading(true);
      const profile = await getUserProfile(authUser.id);
      setProfileData(profile);
    } catch (error) {
      setProfileError(error.message || 'No se pudo cargar tu perfil.');
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    if (!hasActiveAccount) return;
    setPasswordStatus('');
    setProfileError('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setProfileError('La contraseña nueva no coincide con la confirmación.');
      return;
    }

    try {
      await changeUserPassword({
        userId: authUser.id,
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordStatus('Contraseña actualizada.');
    } catch (error) {
      setProfileError(error.message || 'No se pudo cambiar la contraseña.');
    }
  }

  if (!appReady) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <h1>FlowBot</h1>
          <p className="auth-subtitle">Inicializando sistema...</p>
        </section>
      </main>
    );
  }

  if (!authUser) {
    return (
      <AuthPage
        backendAvailable={backendAvailable}
        onLogin={handleAuthLogin}
        onRegister={handleAuthRegister}
        errorMessage={authErrorMessage}
        initialTab={authInitialTab}
      />
    );
  }

  if (!chatBootstrapReady) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <h1>FlowBot</h1>
          <p className="auth-subtitle">Cargando tus chats...</p>
        </section>
      </main>
    );
  }

  return (
    <div
      className={`app-container ${hasConversation ? 'app-container-has-conversation' : ''} ${isMobileKeyboardOpen ? 'app-container-keyboard-open' : ''}`}
      style={{
        '--composer-mobile-height': `${composerMobileHeight}px`,
        '--composer-mobile-offset': `${composerMobileOffset}px`,
      }}
    >
      {/* Timer alert */}
      {timerAlert && (
        <div className="timer-modal-overlay" onClick={() => setTimerAlert(null)}>
          <div className="timer-modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="timer-modal-header">
              <div className={`timer-status-icon ${timerAlert.finished ? 'status-finished' : 'status-running'}`}>
                <IntentIcon name="automatizar" size={24} />
              </div>
              <div>
                <p className="modal-eyebrow">Automatización</p>
                <h3>{timerAlert.finished ? 'Temporizador completado' : 'Temporizador activo'}</h3>
              </div>
            </header>
            <div className="timer-display">
              {!timerAlert.finished && <div className="timer-countdown"><span className="timer-number">{timerAlert.remaining || timerAlert.total}</span><span className="timer-unit">seg</span></div>}
              {timerAlert.finished && <div className="timer-complete-text">COMPLETADO</div>}
            </div>
            <div className="timer-label">{timerAlert.label}</div>
            <footer className="timer-modal-footer">
              <button className="timer-close-btn" onClick={() => setTimerAlert(null)}>Cerrar</button>
            </footer>
          </div>
        </div>
      )}

      {/* Search modal */}
      {searchModalOpen && (
        <div className="search-modal-overlay" onClick={() => { setSearchModalOpen(false); setSearchModalInput(''); }}>
          <div className="search-modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="search-modal-header">
              <div>
                <p className="modal-eyebrow">Búsqueda rápida</p>
                <h3>{searchModalType === 'youtube' ? 'Abrir en YouTube' : 'Abrir en Google'}</h3>
              </div>
              <button className="search-modal-close" onClick={() => { setSearchModalOpen(false); setSearchModalInput(''); }}>X</button>
            </header>
            <div className="search-modal-body">
              <input type="text" className="search-modal-input" placeholder={searchModalType === 'youtube' ? 'Busca un tutorial o video' : 'Busca una referencia, bug o librería'} value={searchModalInput} onChange={(e) => setSearchModalInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && searchModalInput.trim()) { const url = searchModalType === 'youtube' ? `https://www.youtube.com/results?search_query=${encodeURIComponent(searchModalInput)}` : `https://www.google.com/search?q=${encodeURIComponent(searchModalInput)}`; setNavigationUrl(url); setSearchModalOpen(false); setSearchModalInput(''); } }} autoFocus />
            </div>
            <footer className="search-modal-footer">
              <button className="search-modal-cancel" onClick={() => { setSearchModalOpen(false); setSearchModalInput(''); }}>Cancelar</button>
              <button className="search-modal-submit" onClick={() => { if (searchModalInput.trim()) { const url = searchModalType === 'youtube' ? `https://www.youtube.com/results?search_query=${encodeURIComponent(searchModalInput)}` : `https://www.google.com/search?q=${encodeURIComponent(searchModalInput)}`; setNavigationUrl(url); setSearchModalOpen(false); setSearchModalInput(''); } }} disabled={!searchModalInput.trim()}>
                {searchModalType === 'youtube' ? 'Abrir YouTube' : 'Buscar'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Timer modal */}
      {timerModalOpen && (
        <div className="timer-modal-overlay" onClick={() => { setTimerModalOpen(false); setTimerModalValue(''); }}>
          <div className="timer-modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="timer-modal-header">
              <div>
                <p className="modal-eyebrow">Herramientas</p>
                <h3>Configurar temporizador</h3>
              </div>
              <button className="timer-modal-close" onClick={() => { setTimerModalOpen(false); setTimerModalValue(''); }}>X</button>
            </header>
            <div className="timer-modal-body">
              <input type="text" className="timer-modal-input" placeholder="Ej: 30s, 2 minutos, 1 hora" value={timerModalValue} onChange={(e) => setTimerModalValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && timerModalValue.trim()) { startTimer(timerModalValue); setTimerModalOpen(false); setTimerModalValue(''); } }} autoFocus />
              <div className="timer-modal-examples"><p>Ejemplos: <code>5</code>, <code>30s</code>, <code>2 minutos</code>, <code>1 hora</code></p></div>
            </div>
            <footer className="timer-modal-footer">
              <button className="timer-modal-cancel" onClick={() => { setTimerModalOpen(false); setTimerModalValue(''); }}>Cancelar</button>
              <button className="timer-modal-submit" onClick={() => { if (timerModalValue.trim()) { startTimer(timerModalValue); setTimerModalOpen(false); setTimerModalValue(''); } }} disabled={!timerModalValue.trim()}>Iniciar</button>
            </footer>
          </div>
        </div>
      )}

      {profileOpen && hasActiveAccount && (
        <div className="profile-modal-overlay" onClick={() => setProfileOpen(false)}>
          <section className="profile-modal-content" onClick={(e) => e.stopPropagation()} aria-label="Mi perfil">
            <header className="profile-modal-header">
              <div className="profile-title-row">
                <span className="profile-avatar">{profileInitials}</span>
                <div>
                  <p className="modal-eyebrow">Mi perfil</p>
                  <h3>{authUser.name || 'Cuenta FlowBot'}</h3>
                </div>
              </div>
              <button className="profile-modal-close" onClick={() => setProfileOpen(false)} aria-label="Cerrar perfil">X</button>
            </header>

            <div className="profile-summary-grid">
              <article className="profile-stat">
                <span>Chats</span>
                <strong>{profileLoading ? '...' : profileStats.totalChats || 0}</strong>
              </article>
              <article className="profile-stat">
                <span>Mensajes</span>
                <strong>{profileLoading ? '...' : profileStats.totalMessages || 0}</strong>
              </article>
              <article className="profile-stat profile-stat-accent">
                <span>Memoria</span>
                <strong>{profileStats.memoryLimit || effectiveContextWindowSize}</strong>
                <small>+{profileStats.memoryBonus || ACCOUNT_MEMORY_BONUS} bonus</small>
              </article>
            </div>

            <div className="profile-info-list">
              <div>
                <span>Correo</span>
                <strong>{authUser.email}</strong>
              </div>
              <div>
                <span>Nombre</span>
                <strong>{authUser.name || 'Sin nombre'}</strong>
              </div>
              <div>
                <span>Cuenta creada</span>
                <strong>{profileStats.createdAt ? new Date(profileStats.createdAt).toLocaleDateString('es-ES') : 'Disponible conectado a servidor'}</strong>
              </div>
            </div>

            <form className="profile-password-form" onSubmit={handleChangePassword}>
              <p className="modal-eyebrow">Cambiar password</p>
              <label>
                Password actual
                <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((form) => ({ ...form, currentPassword: e.target.value }))} required />
              </label>
              <label>
                Nuevo password
                <input type="password" minLength={6} value={passwordForm.newPassword} onChange={(e) => setPasswordForm((form) => ({ ...form, newPassword: e.target.value }))} required />
              </label>
              <label>
                Confirmar password
                <input type="password" minLength={6} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((form) => ({ ...form, confirmPassword: e.target.value }))} required />
              </label>
              {profileError && <p className="profile-error">{profileError}</p>}
              {passwordStatus && <p className="profile-success">{passwordStatus}</p>}
              <button type="submit" className="profile-submit-btn">Actualizar password</button>
            </form>
          </section>
        </div>
      )}

      {/* Benefits modal */}
      {accountBenefitsOpen && (
        <div className="benefits-modal-overlay" onClick={() => setAccountBenefitsOpen(false)}>
          <section className="benefits-modal-content" onClick={(e) => e.stopPropagation()} aria-label="Ventajas de cuenta">
            <header className="benefits-modal-header">
              <div className="benefits-title-row">
                <div className="benefits-title-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                  </svg>
                </div>
                <div>
                  <p className="modal-eyebrow">FlowBot Pro</p>
                  <h3>Ventajas de iniciar con cuenta</h3>
                </div>
              </div>
              <button className="profile-modal-close" onClick={() => setAccountBenefitsOpen(false)} aria-label="Cerrar ventajas">X</button>
            </header>

            <ul className="benefits-list benefits-list-modal">
              <li className="benefit-item benefit-item-modal">
                <div className="benefit-icon benefit-icon-cloud">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                  </svg>
                </div>
                <div className="benefit-copy">
                  <strong>Chats guardados globalmente</strong>
                  <span>Tus conversaciones se sincronizan en la nube y puedes acceder desde cualquier dispositivo. Nunca pierdas una conversación.</span>
                </div>
              </li>
              <li className="benefit-item benefit-item-modal">
                <div className="benefit-icon benefit-icon-memory">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div className="benefit-copy">
                  <strong>+{ACCOUNT_MEMORY_BONUS} slots de contexto</strong>
                  <span>Memoria expandida de {CONTEXT_WINDOW_SIZE} a {CONTEXT_WINDOW_SIZE + ACCOUNT_MEMORY_BONUS} mensajes para conversaciones mas largas y coherentes.</span>
                </div>
              </li>
              <li className="benefit-item benefit-item-modal">
                <div className="benefit-icon benefit-icon-model">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <div className="benefit-copy">
                  <strong>Modelos y Pensamiento Avanzado</strong>
                  <span>Acceso a Gemini 1.5 Pro y modo de "Pensamiento Profundo" para resolver problemas complejos paso a paso.</span>
                </div>
              </li>
              <li className="benefit-item benefit-item-modal">
                <div className="benefit-icon benefit-icon-fire">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
                  </svg>
                </div>
                <div className="benefit-copy">
                  <strong>Mensajes efímeros</strong>
                  <span>Los mensajes desaparecen por completo después de ser leídos para mayor privacidad.</span>
                </div>
              </li>
            </ul>

            <footer className="benefits-modal-footer">
              <p className="benefits-footer-hint">Conecta un servidor para registrarte y desbloquear estas funciones.</p>
            </footer>
          </section>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-scroll">
        <header className="sidebar-header">
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
        </header>

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
                <button
                  key={option.key}
                  className={`sidebar-mode-btn ${preferredModel === option.key ? 'sidebar-mode-active' : ''} ${!canSelectModel && option.key !== 'auto' ? 'sidebar-mode-locked' : ''}`}
                  onClick={() => {
                    if (!canSelectModel && option.key !== 'auto') return;
                    setPreferredModel(option.key); if (viewportMetrics.isCompact) setSidebarOpen(false);
                  }}
                  title={!canSelectModel && option.key !== 'auto' ? 'Inicia sesión con cuenta para seleccionar modelo' : ''}
                >
                  <ModelIcon group={option.key} size={18} />
                  <div className="sidebar-mode-info">
                    <span className="sidebar-mode-label">{option.label}</span>
                    <span className="sidebar-mode-desc">{option.desc}</span>
                  </div>
                  {!canSelectModel && option.key !== 'auto' && (
                    <svg className="sidebar-mode-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  )}
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
              {intentGroups.filter((g) => ['visualizar','automatizar'].includes(g.id)).map((group) => (
                <div key={group.id} className="sidebar-group" style={{ '--group-color': group.color }}>
                  <header className="group-header">
                    <span className="group-icon"><IntentIcon name={group.iconName} size={18} /></span>
                    <span className="group-name">{group.name}</span>
                    <span className="group-count">{group.keywords.length}</span>
                  </header>
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

        <details className="sidebar-section" name="sidebar-menu" open>
          <summary className="sidebar-section-summary">
            <span>Chats recientes</span>
            <svg className="sidebar-section-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </summary>
          <div className="sidebar-section-body">
            <div className="recent-chat-list">
              {recentChats.length === 0 && (
                <p className="recent-chat-empty">No hay chats guardados todavía.</p>
              )}
              {recentChats.map((chat) => (
                <div key={chat.id} className="recent-chat-row">
                  <button
                    type="button"
                    className={`recent-chat-item ${activeChatId === chat.id ? 'recent-chat-item-active' : ''}`}
                    onClick={() => { void handleSelectChat(chat.id); }}
                  >
                    <span className="recent-chat-title">{chat.title || 'Nuevo chat'}</span>
                    <span className={`recent-chat-source ${chat.source === 'backend' ? 'is-backend' : 'is-local'}`}>
                      {chat.source === 'backend' ? 'En linea' : 'Local'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="recent-chat-delete"
                    aria-label={`Eliminar chat ${chat.title || 'Nuevo chat'}`}
                    title="Eliminar chat"
                    onClick={() => { void handleDeleteRecentChat(chat.id); }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            {hasLocalChats && (
              <p className="local-chat-warning">
                Advertencia: chat local guardado por dispositivo, no por usuario.
              </p>
            )}
          </div>
        </details>

        <details className="sidebar-section" name="sidebar-menu">
          <summary className="sidebar-section-summary">
            <span>Atajos</span>
            <svg className="sidebar-section-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </summary>
          <div className="sidebar-section-body">
            <ul className="shortcut-list">
              <li className="shortcut-row"><span className="shortcut-desc">Limpiar chat</span><span className="shortcut-kbd"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>U</kbd></span></li>
              <li className="shortcut-row"><span className="shortcut-desc">Memoria</span><span className="shortcut-kbd"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>K</kbd></span></li>
              <li className="shortcut-row"><span className="shortcut-desc">Modo efímero</span><span className="shortcut-kbd"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>J</kbd></span></li>
              <li className="shortcut-row"><span className="shortcut-desc">Selector modelo</span><span className="shortcut-kbd"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>L</kbd></span></li>
            </ul>
          </div>
        </details>

        <details className="sidebar-section" open>
          <summary className="sidebar-section-summary">
            <span>Cuenta</span>
            <svg className="sidebar-section-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </summary>
          <div className="sidebar-section-body">
            {backendAvailable ? (
              <div className="sidebar-auth-actions">
                {hasActiveAccount ? (
                  <button type="button" className="sidebar-auth-btn sidebar-account-card" onClick={handleOpenProfile}>
                    <span className="profile-avatar profile-avatar-small">{profileInitials}</span>
                    <span className="sidebar-account-copy">
                      <span>Ver cuenta</span>
                      <small>{authUser.email}</small>
                    </span>
                  </button>
                ) : (
                  <>
                    <button type="button" className="sidebar-auth-btn" onClick={() => handleShowAuth('login')}>
                      Login
                    </button>
                    <button type="button" className="sidebar-auth-btn" onClick={() => handleShowAuth('register')}>
                      Registro
                    </button>
                  </>
                )}
                <button type="button" className="sidebar-auth-btn sidebar-auth-btn-danger" onClick={() => { void handleLogout(); }}>
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <div className="sidebar-offline-account">
                <p className="recent-chat-empty">Servidor no disponible para autenticación.</p>
                <button
                  type="button"
                  className="sidebar-auth-btn sidebar-benefits-toggle"
                  onClick={() => { setAccountBenefitsOpen(true); setSidebarOpen(false); }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                  </svg>
                  <span>Ver ventajas de cuenta</span>
                </button>
              </div>
            )}
          </div>
        </details>

        </div>{/* end sidebar-scroll */}
        <footer className="sidebar-footer">
          <button className="clear-chat-btn" onClick={handleClearChat}>
            <span className="btn-icon"><IntentIcon name="clear" size={16} /></span>
            <div className="clear-chat-copy" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
              <span>Nueva conversación</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Ctrl+Shift+U</span>
            </div>
          </button>
        </footer>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="dynamic-island-layer" aria-hidden={false}>
        <div
          className={`dynamic-island ${islandOpen ? 'dynamic-island-open' : 'dynamic-island-closed'} ${isTyping ? 'dynamic-island-busy' : ''} ${isCompactViewport ? 'dynamic-island-mobile' : 'dynamic-island-desktop'}`}
          style={islandOpen
            ? { left: '50%', top: '18px' }
            : { left: `${islandPosition.x}px`, top: `${islandPosition.y}px` }}
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
                {...islandMascotStateProps}
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
                  {...islandMascotStateProps}
                />
                <div className="dynamic-island-copy">
                  <span className="dynamic-island-name">FlowBot</span>
                  <div className="dynamic-island-meta-row">
                    <span className={`dynamic-island-env-pill ${envInfo.className}`}>{envInfo.label}</span>
                    <span className={`dynamic-island-env-pill ${connectivityInfo.className}`}>{connectivityInfo.label}</span>
                    <span className="dynamic-island-memory">
                      <span className="dynamic-island-memory-label">Memoria</span>
                      <span className="dynamic-island-memory-value">{displayedContextSlots}/{effectiveContextWindowSize}</span>
                    </span>
                  </div>
                </div>
              </button>

              {/* Memory mini progress bar */}
              <div className="dynamic-island-progress">
                <div className="dynamic-island-progress-fill" style={{ width: `${Math.min(100, (displayedContextSlots / effectiveContextWindowSize) * 100)}%` }} />
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
                {backendAvailable && (
                  <>
                    {hasActiveAccount ? (
                      <button type="button" className="dynamic-island-action" onClick={handleOpenProfile}>
                        <span className="profile-avatar profile-avatar-tiny">{profileInitials}</span>
                        <span>Ver cuenta</span>
                      </button>
                    ) : (
                      <>
                        <button type="button" className="dynamic-island-action" onClick={() => handleShowAuth('login')}>
                          <span>Login</span>
                        </button>
                        <button type="button" className="dynamic-island-action" onClick={() => handleShowAuth('register')}>
                          <span>Registro</span>
                        </button>
                      </>
                    )}
                    <button type="button" className="dynamic-island-action dynamic-island-action-danger" onClick={handleLogout}>
                      <span>Cerrar sesión</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main */}
      <main className="chat-main">
        {/* Messages */}
        <div className={`messages-container ${isEmptyState ? 'messages-container-empty' : ''}`} ref={messagesContainerRef}>
          <div className={`messages-inner ${isEmptyState ? 'messages-inner-empty' : ''}`}>
            {isEmptyState && (
              <section className="empty-state-hero" aria-label="Portada de FlowBot">
                <div className="hero-live-row">
                  <div className="empty-state-kicker">
                    <span className="empty-state-kicker-dot"></span>
                    Desarrolla y crea mas rapido
                  </div>
                  {liveStatusItems.map((status) => (
                    <span key={status.className} className={`hero-live-pill ${status.className}`} title={status.detail}>
                      <span className="hero-env-dot" />
                      {status.label}
                    </span>
                  ))}
                </div>

                <header className="empty-state-head">
                  <div className="empty-state-copy">
                    <p className="empty-state-eyebrow">FlowBot para developers</p>
                    <h2 className="empty-state-title">Construye más rapido. Depura con contexto. Aprende mientras envías.</h2>
                    <div className="empty-state-description-container">
                      <p className="empty-state-description">
                        {heroDescription}
                      </p>
                    </div>
                  </div>
                </header>

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
                    <strong>{displayedContextSlots}/{effectiveContextWindowSize}</strong>
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

        {/* Composer dock */}
        <div
          ref={composerDockRef}
          className={`composer-dock ${hasConversation ? 'composer-dock-compact' : ''} ${isMobileComposerPinned ? 'composer-dock-mobile-pinned' : ''}`}
        >
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
                  {!isCompactViewport && <span className={`composer-inline-pill ${memoryPreviewEnabled ? '' : 'is-muted'}`}>Memoria {displayedContextSlots}/{effectiveContextWindowSize}</span>}
                  <span className={`composer-inline-pill ${envInfo.className}`}>{envInfo.label}</span>
                  <span className={`composer-inline-pill ${connectivityInfo.className}`}>{connectivityInfo.label}</span>
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
                    className={`selector-btn ${thinkingMode !== 'normal' ? 'selector-btn-active' : ''} ${thinkingMode === 'deep' && !canUseDeepThinking ? 'selector-btn-locked' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setThinkingDropdownOpen((value) => !value); setModelDropdownOpen(false); }}
                    title={thinkingMode === 'deep' && !canUseDeepThinking ? 'Inicia sesión para usar Pensamiento Profundo' : 'Modo de pensamiento'}
                  >
                    {thinkingMode === 'deep' && !canUseDeepThinking ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="selector-lock-icon">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    ) : (
                      <ThinkingModeIcon mode={thinkingMode} size={14} />
                    )}
                    <span className="selector-label">{activeThinkingOption.label}</span>
                    {thinkingMode === 'deep' && !canUseDeepThinking ? (
                      <span className="selector-lock-hint">PRO</span>
                    ) : (
                      <svg className="selector-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    )}
                  </button>
                  {thinkingDropdownOpen && (
                    <div className="selector-dropdown" onClick={(e) => e.stopPropagation()}>
                      {thinkingOptions.map((option) => (
                        <button
                          key={option.id}
                          className={`dropdown-option ${thinkingMode === option.id ? 'dropdown-option-active' : ''} ${option.id === 'deep' && !canUseDeepThinking ? 'sidebar-mode-locked' : ''}`}
                          onClick={() => {
                            if (option.id === 'deep' && !canUseDeepThinking) return;
                            setThinkingMode(option.id);
                            setThinkingDropdownOpen(false);
                          }}
                        >
                          <ThinkingModeIcon mode={option.id} size={15} />
                          <div className="dropdown-option-text">
                            <span className="dropdown-option-label">{option.label}</span>
                            <span className="dropdown-option-desc">{option.desc}</span>
                          </div>
                          {thinkingMode === option.id && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>}
                          {option.id === 'deep' && !canUseDeepThinking && (
                            <svg className="sidebar-mode-lock" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="selector-wrapper">
                  <button
                    className={`selector-btn ${preferredModel !== 'auto' ? 'selector-btn-active' : ''} ${!canSelectModel ? 'selector-btn-locked' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!canSelectModel) return;
                      setModelDropdownOpen((value) => !value); setThinkingDropdownOpen(false);
                    }}
                    title={canSelectModel ? 'Modelo' : 'Inicia sesión para seleccionar modelo'}
                  >
                    {!canSelectModel ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="selector-lock-icon">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    ) : (
                      <ModelIcon group={activeModelOption.key} size={14} />
                    )}
                    <span className="selector-label">{activeModelOption.label}</span>
                    {canSelectModel ? (
                      <svg className="selector-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    ) : (
                      <span className="selector-lock-hint">PRO</span>
                    )}
                  </button>
                  {modelDropdownOpen && canSelectModel && (
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

                <div className={`memory-pill ${isEphemeralMode ? 'memory-pill-on' : 'memory-pill-off'} ${!canSelectModel ? 'selector-btn-locked' : ''}`} title={canSelectModel ? 'Ctrl+Shift+J para cambiar' : 'Inicia sesión para usar efímero'}>
                  <span className="memory-pill-label">Efímero</span>
                  {!canSelectModel ? (
                    <span className="selector-lock-hint" style={{ marginLeft: 4 }}>PRO</span>
                  ) : (
                    <button type="button" className={`memory-toggle ${isEphemeralMode ? 'memory-toggle-on' : ''}`} aria-pressed={isEphemeralMode} onClick={() => setIsEphemeralMode((v) => !v)}>
                      <span></span>
                    </button>
                  )}
                </div>

                <div className={`memory-pill ${memoryPreviewEnabled ? 'memory-pill-on' : 'memory-pill-off'}`} title="Ctrl+Shift+K para cambiar">
                  <span className="memory-pill-label">Memoria</span>
                  <button type="button" className={`memory-toggle ${memoryPreviewEnabled ? 'memory-toggle-on' : ''}`} aria-pressed={memoryPreviewEnabled} onClick={() => setMemoryPreviewEnabled((value) => !value)}>
                    <span></span>
                  </button>
                </div>
              </div>

              <footer className={`composer-footer ${hasConversation ? 'composer-footer-compact' : ''}`}>
                <p className="input-hint">
                  {composerHint}
                </p>
              </footer>
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
