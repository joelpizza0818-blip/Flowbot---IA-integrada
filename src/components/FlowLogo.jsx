import React from 'react';

export default function FlowLogo({
  size = 48,
  animated = true,
  mood = 'default',
  reading = false,
  wave = false,
  className = '',
}) {
  const isError = mood === 'error';
  const logoClassName = [
    'flow-logo',
    animated ? 'flow-logo-animated' : '',
    reading ? 'flow-logo-reading' : '',
    wave ? 'flow-logo-wave' : '',
    isError ? 'flow-logo-error' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={logoClassName}
      aria-label="FlowBot Logo"
    >
      <defs>
        <filter id="flowLogoGlow">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g className="flow-logo-body" filter="url(#flowLogoGlow)">
        <path
          d="M 50 15 C 30 15, 20 35, 25 55 C 20 70, 30 85, 50 85 C 70 85, 80 70, 75 55 C 80 35, 70 15, 50 15 Z"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M 23 45 C 5 35, 10 65, 26 65"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
          className="flow-logo-wing flow-logo-wing-left"
        />
        <path
          d="M 77 45 C 95 35, 90 65, 74 65"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
          className={`flow-logo-wing flow-logo-wing-right ${wave ? 'flow-logo-wing-hidden' : ''}`}
        />
        <path
          d="M 35 20 C 30 5, 20 10, 25 25"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M 65 20 C 70 5, 80 10, 75 25"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </g>

      {!isError ? (
        <>
          <circle cx="42" cy="40" r="2.6" fill="#6dffb3" className="flow-logo-eye flow-logo-eye-left" />
          <circle cx="58" cy="40" r="2.6" fill="#6dffb3" className="flow-logo-eye flow-logo-eye-right" />
        </>
      ) : (
        <g className="flow-logo-error-eyes">
          <path d="M38 36 L46 44 M46 36 L38 44" stroke="#ff5c79" strokeWidth="3" strokeLinecap="round" />
          <path d="M54 36 L62 44 M62 36 L54 44" stroke="#ff5c79" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}

      {reading && (
        <g className="flow-logo-magnifier">
          <circle cx="70" cy="31" r="8.5" fill="rgba(139, 232, 255, 0.14)" stroke="#c7f5ff" strokeWidth="2.8" />
          <circle cx="70" cy="31" r="4.2" fill="rgba(255, 255, 255, 0.08)" />
          <path d="M76.5 37.5 L83 44" stroke="#c7f5ff" strokeWidth="2.8" strokeLinecap="round" />
        </g>
      )}

      {wave && (
        <g className="flow-logo-hand">
          <path d="M75 43 C80 34, 89 32, 92 39 C94 44, 91 49, 86 52 C83 54, 80 57, 78 61" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <path d="M88 31 C93 34, 94 39, 92 43" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" fill="none" className="flow-logo-wave-lines" />
          <path d="M92 26 C98 31, 99 39, 95 45" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" className="flow-logo-wave-lines" />
        </g>
      )}
    </svg>
  );
}
