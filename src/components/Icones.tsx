type Props = { className?: string }

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
}

export const Seta = ({ className = 'size-4' }: Props) => (
  <svg {...base} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

export const Voltar = ({ className = 'size-4' }: Props) => (
  <svg {...base} className={className}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
)

export const Cubo = ({ className = 'size-5' }: Props) => (
  <svg {...base} className={className}>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
    <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
  </svg>
)

export const Camera = ({ className = 'size-5' }: Props) => (
  <svg {...base} className={className}>
    <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" />
    <path d="M12 8l4 2.2v4.6L12 17l-4-2.2v-4.6L12 8z" />
  </svg>
)

export const Whatsapp = ({ className = 'size-5' }: Props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 004.74 1.21c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm0 18.15a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" />
  </svg>
)

export const Menu = ({ className = 'size-6' }: Props) => (
  <svg {...base} className={className}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </svg>
)

export const Fechar = ({ className = 'size-6' }: Props) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const Instagram = ({ className = 'size-5' }: Props) => (
  <svg {...base} className={className}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
  </svg>
)

export const Folha = ({ className = 'size-5' }: Props) => (
  <svg {...base} className={className}>
    <path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" />
    <path d="M5 19c3-4 6-7 10-9" />
  </svg>
)

export const Escudo = ({ className = 'size-5' }: Props) => (
  <svg {...base} className={className}>
    <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)

export const Paleta = ({ className = 'size-5' }: Props) => (
  <svg {...base} className={className}>
    <path d="M12 3a9 9 0 100 18c1.1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 005-5c0-4-4-7.2-9-7.2z" />
    <circle cx="7.5" cy="11" r="1" fill="currentColor" />
    <circle cx="10" cy="7" r="1" fill="currentColor" />
    <circle cx="15" cy="7.5" r="1" fill="currentColor" />
  </svg>
)

export const Conversa = ({ className = 'size-5' }: Props) => (
  <svg {...base} className={className}>
    <path d="M20 12a8 8 0 01-11.8 7L4 20l1.1-3.9A8 8 0 1120 12z" />
    <path d="M9 11h6M9 14h4" />
  </svg>
)

export const Expandir = ({ className = 'size-5' }: Props) => (
  <svg {...base} className={className}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
)

export const Planta = ({ className = 'size-5' }: Props) => (
  <svg {...base} className={className}>
    <path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2V6z" />
    <path d="M9 4v14M15 6v14" />
  </svg>
)

export const Desfazer = ({ className = 'size-4' }: Props) => (
  <svg {...base} className={className}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
  </svg>
)

export const Girar = ({ className = 'size-4' }: Props) => (
  <svg {...base} className={className}>
    <path d="M20 12a8 8 0 11-2.34-5.66" />
    <path d="M20 4v5h-5" />
  </svg>
)

export const GirarAnti = ({ className = 'size-4' }: Props) => (
  <svg {...base} className={className}>
    <path d="M4 12a8 8 0 102.34-5.66" />
    <path d="M4 4v5h5" />
  </svg>
)

export const Duplicar = ({ className = 'size-4' }: Props) => (
  <svg {...base} className={className}>
    <rect x="8" y="8" width="12" height="12" rx="2.5" />
    <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />
  </svg>
)

export const Lixeira = ({ className = 'size-4' }: Props) => (
  <svg {...base} className={className}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" />
  </svg>
)

export const Alvo = ({ className = 'size-4' }: Props) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
)

export const Olho = ({ className = 'size-4' }: Props) => (
  <svg {...base} className={className}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const Porta = ({ className = 'size-4' }: Props) => (
  <svg {...base} className={className}>
    <path d="M5 21V4a1 1 0 011-1h12a1 1 0 011 1v17M3 21h18" />
    <path d="M15 12h.01" />
  </svg>
)

export const Mover = ({ className = 'size-4' }: Props) => (
  <svg {...base} className={className}>
    <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />
  </svg>
)

export const Mais = ({ className = 'size-4' }: Props) => (
  <svg {...base} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const Menos = ({ className = 'size-4' }: Props) => (
  <svg {...base} className={className}>
    <path d="M5 12h14" />
  </svg>
)

export const Check = ({ className = 'size-4' }: Props) => (
  <svg {...base} className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

export const Sacola = ({ className = 'size-5' }: Props) => (
  <svg {...base} className={className}>
    <path d="M5 8h14l-1.2 12H6.2L5 8z" />
    <path d="M9 8V6.5a3 3 0 016 0V8" />
  </svg>
)
