import React, { useEffect, useRef, useState, useId } from 'react';

export default function FlowLogo({
  size = 48,
  animated = true,
  mood = 'default',
  reading = false,
  wave = false,
  thinking = false,
  celebrating = false,
  sleeping = false,
  excited = false,
  listening = false,
  coveringEyes = false,
  shh = false,
  trackCursor = false,
  className = '',
}) {
  const svgRef = useRef(null);
  const [cursorPose, setCursorPose] = useState({
    eyeX: 0,
    eyeY: 0,
    bodyX: 0,
    bodyY: 0,
    bodyRotate: 0,
  });

  // Eye-tracking: follow cursor on desktop
  useEffect(() => {
    if (!animated || sleeping || !trackCursor) return;
    const handleMove = (e) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;

      const normalizedX = Math.max(-1, Math.min(1, dx / (rect.width * 0.45)));
      const normalizedY = Math.max(-1, Math.min(1, dy / (rect.height * 0.45)));

      setCursorPose({
        eyeX: normalizedX * -3.6,
        eyeY: normalizedY * 2.8,
        bodyX: normalizedX * -5.8,
        bodyY: normalizedY * 3.8,
        bodyRotate: normalizedX * -9.5,
      });
    };

    const resetPose = () => {
      setCursorPose({ eyeX: 0, eyeY: 0, bodyX: 0, bodyY: 0, bodyRotate: 0 });
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('mouseleave', resetPose);
    window.addEventListener('blur', resetPose);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseleave', resetPose);
      window.removeEventListener('blur', resetPose);
    };
  }, [animated, sleeping, trackCursor]);

  const isError = mood === 'error';

  const logoClassName = [
    'flow-logo',
    animated ? 'flow-logo-animated' : '',
    reading ? 'flow-logo-reading' : '',
    wave ? 'flow-logo-wave' : '',
    thinking ? 'flow-logo-thinking' : '',
    celebrating ? 'flow-logo-celebrating' : '',
    sleeping ? 'flow-logo-sleeping' : '',
    excited ? 'flow-logo-excited' : '',
    listening ? 'flow-logo-listening' : '',
    coveringEyes ? 'flow-logo-covering-eyes' : '',
    shh ? 'flow-logo-shh' : '',
    isError ? 'flow-logo-error' : '',
    className,
  ].filter(Boolean).join(' ');

  const eyeTransform = sleeping || coveringEyes
    ? 'translate(0, 0)'
    : `translate(${cursorPose.eyeX}px, ${cursorPose.eyeY}px)`;

  const bodyTransform = sleeping
    ? 'translate(0, 0)'
    : `translate(${cursorPose.bodyX}px, ${cursorPose.bodyY}px) rotate(${cursorPose.bodyRotate}deg)`;

  // Unique filter IDs to avoid clashes when multiple logos are rendered
  const uid = useId().replace(/:/g, "");
  const glowId = `flowGlow_${uid}`;
  const gradId = `flowEyeGrad_${uid}`;
  const bodyGradId = `flowBodyGrad_${uid}`;

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      style={{ overflow: 'visible' }}
      xmlns="http://www.w3.org/2000/svg"
      className={logoClassName}
      aria-label="FlowBot Logo"
    >
      <defs>
        <filter id={glowId}>
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id={gradId} cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#b4ffe6" />
          <stop offset="100%" stopColor="#6dffb3" />
        </radialGradient>
        <linearGradient id={bodyGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="100%" stopColor="#c7f5ff" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={`shhGrad_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>

      {/* Glow aura behind body — changes color with mood */}
      <circle
        cx="50"
        cy="48"
        r="42"
        fill="none"
        className="flow-logo-aura"
      />

      <g className="flow-logo-body-track" style={{ transform: bodyTransform, transformOrigin: '50px 50px' }}>
      <g className="flow-logo-body" filter={`url(#${glowId})`}>
        {/* Body outline */}
        <path
          d="M 50 15 C 30 15, 20 35, 25 55 C 20 70, 30 85, 50 85 C 70 85, 80 70, 75 55 C 80 35, 70 15, 50 15 Z"
          stroke={`url(#${bodyGradId})`}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Left wing */}
        <path
          d="M 23 45 C 5 35, 10 65, 26 65"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
          className="flow-logo-wing flow-logo-wing-left"
        />
        {/* Right wing */}
        <path
          d="M 77 45 C 95 35, 90 65, 74 65"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
          className={`flow-logo-wing flow-logo-wing-right ${wave ? 'flow-logo-wing-hidden' : ''}`}
        />
        {/* Left antenna */}
        <path
          d="M 35 20 C 30 5, 20 10, 25 25"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
          className="flow-logo-antenna flow-logo-antenna-left"
        />
        {/* Right antenna */}
        <path
          d="M 65 20 C 70 5, 80 10, 75 25"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
          className="flow-logo-antenna flow-logo-antenna-right"
        />
        {/* Antenna tips — glow dots */}
        <circle cx="23" cy="18" r="2.2" fill="#66e1ff" className="flow-logo-antenna-tip flow-logo-antenna-tip-left" />
        <circle cx="77" cy="18" r="2.2" fill="#66e1ff" className="flow-logo-antenna-tip flow-logo-antenna-tip-right" />
      </g>
      </g>

      {/* Eyes */}
      {sleeping ? (
        <g className="flow-logo-sleeping-eyes">
          {/* Closed eyes as arcs */}
          <path d="M37 41 Q42 38 47 41" stroke="#6dffb3" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M53 41 Q58 38 63 41" stroke="#6dffb3" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </g>
      ) : isError ? (
        <g className="flow-logo-error-eyes">
          <path d="M38 36 L46 44 M46 36 L38 44" stroke="#ff5c79" strokeWidth="3" strokeLinecap="round" />
          <path d="M54 36 L62 44 M62 36 L54 44" stroke="#ff5c79" strokeWidth="3" strokeLinecap="round" />
        </g>
      ) : (
        <g className="flow-logo-eyes-group" style={{ transform: eyeTransform }}>
          {/* Left eye */}
          <circle cx="42" cy="40" r={excited ? 3.6 : 2.6} fill={`url(#${gradId})`} className="flow-logo-eye flow-logo-eye-left" />
          {/* Right eye */}
          <circle cx="58" cy="40" r={excited ? 3.6 : 2.6} fill={`url(#${gradId})`} className="flow-logo-eye flow-logo-eye-right" />
          {/* Pupils (tiny darker dots) */}
          <circle cx="42" cy="40" r="1" fill="#1a4032" className="flow-logo-pupil flow-logo-pupil-left" />
          <circle cx="58" cy="40" r="1" fill="#1a4032" className="flow-logo-pupil flow-logo-pupil-right" />
        </g>
      )}

      {/* Sleeping Zzz */}
      {sleeping && (
        <g className="flow-logo-zzz">
          <text x="68" y="26" fontSize="10" fontWeight="bold" fill="#66e1ff" className="flow-logo-z flow-logo-z1">z</text>
          <text x="76" y="18" fontSize="7" fontWeight="bold" fill="#66e1ff" className="flow-logo-z flow-logo-z2">z</text>
          <text x="82" y="12" fontSize="5" fontWeight="bold" fill="#66e1ff" className="flow-logo-z flow-logo-z3">z</text>
        </g>
      )}

      {/* Celebrate sparkles */}
      {celebrating && (
        <g className="flow-logo-sparkles">
          <circle cx="25" cy="20" r="1.5" fill="#ffd700" className="flow-logo-sparkle s1" />
          <circle cx="78" cy="22" r="1.8" fill="#ff6eb4" className="flow-logo-sparkle s2" />
          <circle cx="15" cy="55" r="1.2" fill="#66e1ff" className="flow-logo-sparkle s3" />
          <circle cx="85" cy="50" r="1.6" fill="#6dffb3" className="flow-logo-sparkle s4" />
          <circle cx="50" cy="8" r="1.4" fill="#ffd700" className="flow-logo-sparkle s5" />
          <circle cx="35" cy="90" r="1.3" fill="#ff6eb4" className="flow-logo-sparkle s6" />
          <circle cx="70" cy="88" r="1.1" fill="#66e1ff" className="flow-logo-sparkle s7" />
        </g>
      )}

      {/* Thinking swirl effect (around head) */}
      {thinking && (
        <g className="flow-logo-think-particles">
          <circle cx="20" cy="30" r="1.4" fill="#66e1ff" className="flow-logo-think-dot td1" />
          <circle cx="80" cy="30" r="1.4" fill="#66e1ff" className="flow-logo-think-dot td2" />
          <circle cx="15" cy="50" r="1.1" fill="#b3f0ff" className="flow-logo-think-dot td3" />
          <circle cx="85" cy="50" r="1.1" fill="#b3f0ff" className="flow-logo-think-dot td4" />
        </g>
      )}

      {/* Magnifier (reading mode) */}
      {reading && (
        <g className="flow-logo-magnifier">
          <circle cx="70" cy="31" r="8.5" fill="rgba(139, 232, 255, 0.14)" stroke="#c7f5ff" strokeWidth="2.8" />
          <circle cx="70" cy="31" r="4.2" fill="rgba(255, 255, 255, 0.08)" />
          <path d="M76.5 37.5 L83 44" stroke="#c7f5ff" strokeWidth="2.8" strokeLinecap="round" />
        </g>
      )}

      {/* Wave hand */}
      {wave && (
        <g className="flow-logo-hand">
          <path d="M75 43 C80 34, 89 32, 92 39 C94 44, 91 49, 86 52 C83 54, 80 57, 78 61" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <path d="M88 31 C93 34, 94 39, 92 43" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" fill="none" className="flow-logo-wave-lines" />
          <path d="M92 26 C98 31, 99 39, 95 45" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" className="flow-logo-wave-lines" />
        </g>
      )}

      {/* Covering Eyes */}
      {coveringEyes && (
        <g className="flow-logo-covering">
          {/* Hands crossing over the eyes */}
          <path d="M28 45 Q42 35 56 45" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M72 45 Q58 35 44 45" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
        </g>
      )}

      {/* Shh Speech Bubble */}
      {shh && (
        <g className="flow-logo-shh-bubble">
          {/* Bubble body attached to antenna, scaled up and protruding */}
          <path d="M68 20 Q95 -10 115 5 Q135 25 105 35 L82 35 L80 25 Z" fill="#ffffff" opacity="0.95" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.15))" />
          <text x="79" y="24" fontSize="15" fontWeight="900" fill={`url(#shhGrad_${uid})`}>Shh...</text>
        </g>
      )}

      {/* Mascot mouth removed per user request */}
    </svg>
  );
}
