import type { ReactNode } from 'react'

type BoxProps = {
  children: ReactNode
  className?: string
  title?: string
  subtitle?: string
  action?: ReactNode
}

export function Box({ children, className = '', title, subtitle, action }: BoxProps) {
  return (
    <section
      className={`rounded-2xl border border-teal-900/8 bg-white/90 p-5 shadow-[0_10px_40px_-24px_rgba(15,118,110,0.45)] backdrop-blur ${className}`}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}
