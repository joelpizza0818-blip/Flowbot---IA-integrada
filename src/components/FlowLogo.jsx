import React from 'react';

export default function FlowLogo({ size = 48, animated = true }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={animated ? 'flow-logo-animated' : ''}
      aria-label="FlowBot Logo"
    >
      <defs>
        <linearGradient id="spiralGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00d4ff" />
          <stop offset="50%" stopColor="#0088ff" />
          <stop offset="100%" stopColor="#0040aa" />
        </linearGradient>
        <linearGradient id="spiralGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#00e5ff" />
          <stop offset="100%" stopColor="#0057ff" />
        </linearGradient>
        <filter id="neonGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="outerGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Dragon Body & Head (Tux shape) */}
      <path
        d="M 50 15 
           C 30 15, 20 35, 25 55 
           C 20 70, 30 85, 50 85 
           C 70 85, 80 70, 75 55 
           C 80 35, 70 15, 50 15 Z"
        stroke="#ffffff"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        filter="url(#outerGlow)"
        className="dragon-body"
      />

      {/* Dragon Wings */}
      <path
        d="M 23 45 C 5 35, 10 65, 26 65 M 77 45 C 95 35, 90 65, 74 65"
        stroke="#ffffff"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        filter="url(#outerGlow)"
        className="dragon-wings"
      />

      {/* Dragon Horns */}
      <path
        d="M 35 20 C 30 5, 20 10, 25 25 M 65 20 C 70 5, 80 10, 75 25"
        stroke="#ffffff"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        filter="url(#outerGlow)"
        className="dragon-horns"
      />

      {/* Eyes */}
      <circle cx="42" cy="40" r="2.5" fill="#00ff00" filter="url(#neonGlow)">
        {animated && (
          <animate
            attributeName="r"
            values="2;3.5;2"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </circle>
      <circle cx="58" cy="40" r="2.5" fill="#00ff00" filter="url(#neonGlow)">
        {animated && (
          <animate
            attributeName="r"
            values="2;3.5;2"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* Flow particles */}
      {animated && (
        <>
          <circle r="1.5" fill="#00ff00" opacity="0.8">
            <animateMotion
              path="M 50 15 C 30 15, 20 35, 25 55 C 20 70, 30 85, 50 85 C 70 85, 80 70, 75 55 C 80 35, 70 15, 50 15 Z"
              dur="4s"
              repeatCount="indefinite"
            />
          </circle>
          <circle r="1.5" fill="#00ff00" opacity="0.8">
            <animateMotion
              path="M 23 45 C 5 35, 10 65, 26 65"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle r="1.5" fill="#00ff00" opacity="0.8">
            <animateMotion
              path="M 77 45 C 95 35, 90 65, 74 65"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        </>
      )}
    </svg>
  );
}
