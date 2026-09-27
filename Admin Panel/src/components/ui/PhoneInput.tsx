import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { formatPhoneLocal, phoneDigits } from '../../lib/phone'

type Props = {
  label?: string
  value: string
  onChange: (digits: string) => void
  required?: boolean
  disabled?: boolean
  name?: string
  id?: string
  className?: string
}

export function PhoneInput({
  label,
  value,
  onChange,
  required,
  disabled,
  name,
  id,
  className = '',
}: Props) {
  const { t } = useTranslation()
  const resolvedLabel = label ?? t('common.phone')
  const autoId = useId()
  const inputId = id ?? name ?? autoId
  const display = formatPhoneLocal(value)

  return (
    <label className={`block space-y-1.5 ${className}`}>
      {resolvedLabel && (
        <span className="text-sm font-medium text-slate-700">{resolvedLabel}</span>
      )}
      <div
        className={`flex overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50/80 transition focus-within:border-teal-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-600/15 ${
          disabled ? 'opacity-60' : ''
        }`}
      >
        <span className="flex shrink-0 items-center border-r border-slate-200 bg-slate-100/90 px-3 text-sm font-semibold text-slate-600">
          +998
        </span>
        <input
          id={inputId}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          disabled={disabled}
          required={required}
          placeholder={t('auth.phonePlaceholder')}
          value={display}
          onChange={(e) => onChange(phoneDigits(e.target.value))}
          className="min-w-0 flex-1 bg-transparent px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
      </div>
    </label>
  )
}
