import React from 'react';

function IconShape({ name }) {
  switch (name) {
    case 'visualizar':
      return (
        <>
          <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      );
    case 'eliminar':
    case 'clear':
      return (
        <>
          <path d="M4 7h16" />
          <path d="M9 3h6" />
          <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </>
      );
    case 'informar':
      return (
        <>
          <path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M9 7h6" />
          <path d="M9 11h6" />
          <path d="M9 15h4" />
        </>
      );
    case 'crear':
      return (
        <>
          <path d="m12 3 1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3Z" />
          <path d="m18 13 .8 2.1L21 16l-2.2.9L18 19l-.8-2.1L15 16l2.2-.9.8-2.1Z" />
          <path d="M6 14v7" />
          <path d="M2.5 17.5H9.5" />
        </>
      );
    case 'modificar':
      return (
        <>
          <path d="m4 20 4.5-1 9-9a2.1 2.1 0 0 0-3-3l-9 9L4 20Z" />
          <path d="m13 8 3 3" />
        </>
      );
    case 'buscar':
      return (
        <>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4.2-4.2" />
        </>
      );
    case 'enviar':
      return (
        <>
          <path d="M21 3 10 14" />
          <path d="m21 3-7 18-4-7-7-4 18-7Z" />
        </>
      );
    case 'seguridad':
      return (
        <>
          <path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6l-7-3Z" />
          <path d="m9.5 12 1.8 1.8 3.7-4" />
        </>
      );
    case 'ayuda':
      return (
        <>
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M8.2 14.5A6.5 6.5 0 1 1 16 14.3c-.9.7-1.5 1.5-1.8 2.7h-4.4c-.3-1.1-.8-1.8-1.6-2.5Z" />
        </>
      );
    case 'automatizar':
      return (
        <>
          <circle cx="6" cy="6" r="2" />
          <circle cx="18" cy="6" r="2" />
          <circle cx="12" cy="18" r="2" />
          <path d="M8 6h8" />
          <path d="m7.2 7.4 3.6 8.1" />
          <path d="m16.8 7.4-3.6 8.1" />
        </>
      );
    case 'external':
      return (
        <>
          <path d="M14 5h5v5" />
          <path d="M10 14 19 5" />
          <path d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
        </>
      );
    case 'close':
      return (
        <>
          <path d="M6 6 18 18" />
          <path d="M18 6 6 18" />
        </>
      );
    default:
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5" />
          <circle cx="12" cy="16.5" r="0.5" fill="currentColor" stroke="none" />
        </>
      );
  }
}

export default function IntentIcon({ name, size = 20, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <IconShape name={name} />
    </svg>
  );
}
