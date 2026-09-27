import type { InputHTMLAttributes } from 'react'
import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
}

const fieldClass =
  'w-full rounded-xl border border-slate-200/90 bg-slate-50/80 px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15'

export function Input({ label, className = '', id, ...props }: Props) {
  const autoId = useId()
  const inputId = id ?? props.name ?? autoId
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input id={inputId} className={`${fieldClass} ${className}`} {...props} />
    </label>
  )
}

export function PasswordInput({
  label,
  className = '',
  id,
  ...props
}: Omit<Props, 'type'>) {
  const autoId = useId()
  const inputId = id ?? props.name ?? autoId
  const [visible, setVisible] = useState(false)

  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={`${fieldClass} pr-11 ${className}`}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={visible ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
          onClick={() => setVisible((v) => !v)}
          className="absolute top-1/2 right-2.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/60 hover:text-teal-700"
        >
          {visible ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
        </button>
      </div>
    </label>
  )
}
