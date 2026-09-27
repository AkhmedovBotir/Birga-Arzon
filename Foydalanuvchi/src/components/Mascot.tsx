type Props = { size?: number; className?: string }

/** Compact brand mark for header */
export function MascotMark({ size = 40, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="ba-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a5c44" />
          <stop offset="100%" stopColor="#0f3d2e" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#ba-mark)" />
      <path
        d="M18 28h6l2.2 14h19.6L48 28h-4.5"
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="28" cy="46" r="2.6" fill="#fff" />
      <circle cx="42" cy="46" r="2.6" fill="#fff" />
      <path
        d="M20 22h10c6 0 8 4 9 8"
        fill="none"
        stroke="#ff6a00"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Hero visual — abstract “birga xarid” scene (cart + people + savings),
 * not the old bag-with-face mascot.
 */
export function MascotHero({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 320 300"
        className="h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="hero-orb" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffb06a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ff6a00" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="hero-card" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#fff4eb" />
          </linearGradient>
          <linearGradient id="hero-accent" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff8a2b" />
            <stop offset="100%" stopColor="#ff5a00" />
          </linearGradient>
          <filter id="hero-shadow" x="-15%" y="-15%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="10"
              stdDeviation="10"
              floodColor="#ff6a00"
              floodOpacity="0.22"
            />
          </filter>
        </defs>

        {/* background orbs */}
        <circle cx="210" cy="90" r="88" fill="url(#hero-orb)" />
        <circle cx="70" cy="200" r="52" fill="#ffd4a8" opacity="0.45" />

        {/* floating savings badge */}
        <g filter="url(#hero-shadow)" transform="translate(214 28)">
          <rect width="72" height="72" rx="22" fill="url(#hero-accent)" />
          <text
            x="36"
            y="46"
            textAnchor="middle"
            fill="#fff"
            fontSize="28"
            fontWeight="800"
            fontFamily="Nunito, Segoe UI, sans-serif"
          >
            %
          </text>
        </g>

        {/* main white card panel */}
        <g filter="url(#hero-shadow)">
          <rect
            x="36"
            y="70"
            width="200"
            height="170"
            rx="28"
            fill="url(#hero-card)"
          />
          {/* top bar */}
          <rect x="56" y="92" width="72" height="10" rx="5" fill="#ffd4a8" />
          <rect x="56" y="112" width="120" height="8" rx="4" fill="#ffe0c2" />

          {/* product tiles */}
          <rect x="56" y="140" width="52" height="52" rx="14" fill="#fff1e6" />
          <rect x="118" y="140" width="52" height="52" rx="14" fill="#ffe8d1" />
          <rect x="180" y="140" width="36" height="52" rx="14" fill="#ffd4a8" />

          {/* cart glyph on first tile */}
          <path
            d="M66 156h8l4 22h22l5-14H78"
            fill="none"
            stroke="#ff6a00"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="86" cy="184" r="2.4" fill="#ff6a00" />
          <circle cx="98" cy="184" r="2.4" fill="#ff6a00" />

          {/* people dots on second tile — “birga” */}
          <circle cx="136" cy="158" r="7" fill="#ff8a2b" />
          <circle cx="152" cy="158" r="7" fill="#ff6a00" />
          <path
            d="M126 182c4-10 14-12 20-12s16 2 20 12"
            fill="#ffb06a"
            opacity="0.9"
          />

          {/* progress bar = yig‘im */}
          <rect x="56" y="208" width="140" height="10" rx="5" fill="#ffe0c2" />
          <rect x="56" y="208" width="88" height="10" rx="5" fill="#ff6a00" />
        </g>

        {/* small floating chip */}
        <g filter="url(#hero-shadow)" transform="translate(18 48)">
          <rect width="78" height="34" rx="17" fill="#fff" />
          <circle cx="18" cy="17" r="8" fill="#ff6a00" />
          <circle cx="18" cy="17" r="3.5" fill="#fff" />
          <rect x="32" y="11" width="34" height="6" rx="3" fill="#ffd4a8" />
          <rect x="32" y="20" width="24" height="5" rx="2.5" fill="#ffe8d1" />
        </g>

        {/* another chip bottom-right */}
        <g filter="url(#hero-shadow)" transform="translate(190 210)">
          <rect width="90" height="36" rx="18" fill="#1a1410" />
          <text
            x="45"
            y="23"
            textAnchor="middle"
            fill="#fff"
            fontSize="12"
            fontWeight="800"
            fontFamily="Nunito, Segoe UI, sans-serif"
          >
            Birga −50%
          </text>
        </g>
      </svg>
    </div>
  )
}

/** Empty cart illustration — shopping cart */
export function EmptyCart({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 180" className={className} aria-hidden>
      <defs>
        <linearGradient id="cart-g" x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#ff8a2b" />
          <stop offset="100%" stopColor="#ff5a00" />
        </linearGradient>
      </defs>
      <ellipse cx="112" cy="160" rx="54" ry="9" fill="#ffd4a8" opacity="0.5" />

      {/* continuous cart outline: handle → rim → basket */}
      <path
        d="M52 54
           C52 40 64 30 80 30
           M52 54 L74 54
           L88 118 H168 L184 70 H86"
        fill="none"
        stroke="url(#cart-g)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* basket fill */}
      <path
        d="M90 76 H172 L162 112 H96 Z"
        fill="url(#cart-g)"
        opacity="0.95"
      />

      {/* soft highlight on basket */}
      <path
        d="M98 86 H158"
        stroke="#fff"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.28"
      />

      {/* wheels */}
      <circle cx="108" cy="140" r="13" fill="#fff1e6" />
      <circle cx="108" cy="140" r="13" fill="none" stroke="#ff6a00" strokeWidth="6" />
      <circle cx="156" cy="140" r="13" fill="#fff1e6" />
      <circle cx="156" cy="140" r="13" fill="none" stroke="#ff6a00" strokeWidth="6" />
      <circle cx="108" cy="140" r="3.5" fill="#ff6a00" />
      <circle cx="156" cy="140" r="3.5" fill="#ff6a00" />

      {/* plus badge */}
      <circle cx="178" cy="48" r="18" fill="#fff1e6" />
      <path
        d="M169 48h18M178 39v18"
        stroke="#ff6a00"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Empty state illustration */
export function EmptyBox({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 180" className={className} aria-hidden>
      <defs>
        <linearGradient id="empty-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff8a2b" />
          <stop offset="100%" stopColor="#ff5a00" />
        </linearGradient>
      </defs>
      <ellipse cx="110" cy="158" rx="58" ry="10" fill="#ffd4a8" opacity="0.55" />
      <rect
        x="52"
        y="58"
        width="116"
        height="90"
        rx="18"
        fill="url(#empty-g)"
        opacity="0.95"
      />
      <rect x="68" y="74" width="84" height="12" rx="6" fill="#fff" opacity="0.35" />
      <rect x="68" y="96" width="58" height="10" rx="5" fill="#fff" opacity="0.25" />
      <circle cx="110" cy="48" r="22" fill="#fff1e6" />
      <path
        d="M98 48h24M110 36v24"
        stroke="#ff6a00"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}
