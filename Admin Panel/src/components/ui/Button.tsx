import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  children: ReactNode
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: Props) {
  const styles =
    variant === 'primary'
      ? 'border border-teal-700 bg-teal-700 text-white hover:border-teal-800 hover:bg-teal-800 shadow-sm'
      : variant === 'secondary'
        ? 'border border-teal-700/25 bg-white text-teal-800 hover:border-teal-600 hover:bg-teal-50 shadow-sm'
        : variant === 'danger'
          ? 'border border-rose-600 bg-rose-600 text-white hover:border-rose-700 hover:bg-rose-700 shadow-sm'
          : 'border border-transparent bg-transparent text-slate-700 hover:bg-slate-100'

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
