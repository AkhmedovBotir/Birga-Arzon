import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { formatPhoneLocal, phoneDigits } from '../lib/phone'

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
  const autoId = useId()
  const inputId = id ?? name ?? autoId
  const display = formatPhoneLocal(value)
  const resolvedLabel = label ?? t('common.phone')

  return (
    <label className={`block space-y-2 ${className}`}>
      {resolvedLabel && (
        <span className="text-[11px] font-extrabold tracking-[0.16em] text-[var(--muted)] uppercase">
          {resolvedLabel}
        </span>
      )}
      <div
        className={`flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[var(--line)] focus-within:ring-2 focus-within:ring-[var(--brand)]/30 sm:bg-[var(--surface)] ${
          disabled ? 'opacity-60' : ''
        }`}
      >
        <span className="flex shrink-0 items-center border-r border-[var(--line)] bg-[var(--green-soft)] px-3.5 text-sm font-extrabold text-[var(--green)]">
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
          className="min-w-0 flex-1 bg-transparent px-3.5 py-3.5 text-base font-bold outline-none"
        />
      </div>
    </label>
  )
}
