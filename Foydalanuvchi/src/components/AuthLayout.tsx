import type { ReactNode } from 'react'

/** Auth screens: full-bleed mobile, centered card on tablet/desktop */
export function AuthLayout({
  children,
  wide = false,
  compact = false,
}: {
  children: ReactNode
  wide?: boolean
  compact?: boolean
}) {
  return (
    <div
      className={`w-full sm:flex sm:items-center sm:justify-center sm:px-6 ${
        compact
          ? 'flex h-svh flex-col overflow-hidden px-3 py-3 sm:h-auto sm:min-h-svh sm:overflow-visible sm:py-8'
          : 'min-h-svh px-4 py-6 sm:py-10'
      }`}
    >
      <div
        className={`mx-auto flex w-full flex-col sm:rounded-[2rem] sm:bg-white/90 sm:shadow-[var(--shadow-card)] sm:ring-1 sm:ring-[var(--line)] sm:backdrop-blur ${
          compact
            ? 'h-full min-h-0 overflow-hidden sm:h-auto sm:max-h-[min(92svh,720px)] sm:overflow-y-auto sm:p-6'
            : 'sm:p-8'
        } ${wide ? 'max-w-lg' : 'max-w-md'}`}
      >
        {children}
      </div>
    </div>
  )
}
