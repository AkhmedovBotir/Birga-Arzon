/** Compact SVG flags for language switcher */

type FlagProps = { className?: string }

export function FlagUz({ className = '' }: FlagProps) {
  return (
    <svg
      viewBox="0 0 36 24"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="36" height="24" rx="3" fill="#1EB53A" />
      <rect width="36" height="8" y="0" fill="#0099B5" />
      <rect width="36" height="8" y="16" fill="#1EB53A" />
      <rect width="36" height="8" y="8" fill="#fff" />
      <rect width="36" height="1.2" y="7.4" fill="#CE1126" />
      <rect width="36" height="1.2" y="15.4" fill="#CE1126" />
      {/* crescent */}
      <circle cx="7.5" cy="4" r="2.4" fill="#fff" />
      <circle cx="8.3" cy="4" r="1.9" fill="#0099B5" />
      {/* small stars */}
      <circle cx="12" cy="2.2" r="0.45" fill="#fff" />
      <circle cx="13.4" cy="3.2" r="0.45" fill="#fff" />
      <circle cx="12.2" cy="4.2" r="0.45" fill="#fff" />
      <circle cx="13.6" cy="5.1" r="0.45" fill="#fff" />
      <circle cx="11.8" cy="5.6" r="0.4" fill="#fff" />
    </svg>
  )
}

export function FlagRu({ className = '' }: FlagProps) {
  return (
    <svg
      viewBox="0 0 36 24"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="36" height="24" rx="3" fill="#fff" />
      <rect width="36" height="8" y="0" fill="#fff" />
      <rect width="36" height="8" y="8" fill="#0039A6" />
      <rect width="36" height="8" y="16" fill="#D52B1E" />
      <rect
        width="35"
        height="23"
        x="0.5"
        y="0.5"
        rx="2.5"
        fill="none"
        stroke="rgba(0,0,0,0.08)"
      />
    </svg>
  )
}

export function FlagGb({ className = '' }: FlagProps) {
  return (
    <svg
      viewBox="0 0 36 24"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="36" height="24" rx="3" fill="#012169" />
      {/* white diagonals */}
      <path d="M0 0 L36 24 M36 0 L0 24" stroke="#fff" strokeWidth="5" />
      <path d="M0 0 L36 24 M36 0 L0 24" stroke="#C8102E" strokeWidth="2.2" />
      {/* white cross */}
      <path d="M18 0 V24 M0 12 H36" stroke="#fff" strokeWidth="7" />
      {/* red cross */}
      <path d="M18 0 V24 M0 12 H36" stroke="#C8102E" strokeWidth="4" />
    </svg>
  )
}
