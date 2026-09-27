import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Search } from 'lucide-react'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type Props = {
  label?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
  clearable?: boolean
  searchable?: boolean
  className?: string
  emptyText?: string
}

type MenuPos = { top: number; left: number; width: number; maxHeight: number }

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  required,
  clearable,
  searchable = false,
  className = '',
  emptyText,
}: Props) {
  const { t } = useTranslation()
  const resolvedPlaceholder = placeholder ?? t('common.select')
  const resolvedEmpty = emptyText ?? t('common.noOptions')
  const autoId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState<MenuPos | null>(null)
  const canClear = clearable ?? !required
  const selected = options.find((o) => o.value === value)

  const filtered = searchable
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : options

  const updatePos = () => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom - 8
    const spaceAbove = r.top - 8
    const preferBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove
    const maxHeight = Math.min(240, preferBelow ? spaceBelow : spaceAbove)
    setPos({
      top: preferBelow ? r.bottom + 6 : r.top - 6,
      left: r.left,
      width: r.width,
      maxHeight: Math.max(120, maxHeight),
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    updatePos()
    const onScroll = () => updatePos()
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openUp =
    pos &&
    btnRef.current &&
    pos.top < btnRef.current.getBoundingClientRect().top

  const menu =
    open &&
    pos &&
    createPortal(
      <div
        ref={menuRef}
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: pos.width,
          maxHeight: pos.maxHeight,
          transform: openUp ? 'translateY(-100%)' : undefined,
          zIndex: 100,
        }}
        className="overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-[var(--line)]"
      >
        {searchable && (
          <div className="relative border-b border-[var(--line)] p-2">
            <Search
              size={14}
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('common.search')}
              className="w-full rounded-lg bg-[var(--surface)] py-2 pr-3 pl-8 text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
            />
          </div>
        )}
        <ul
          role="listbox"
          className="overflow-y-auto py-1"
          style={{ maxHeight: searchable ? pos.maxHeight - 48 : pos.maxHeight }}
        >
          {canClear && (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!value}
                className="flex w-full px-3 py-2 text-left text-sm font-bold text-[var(--muted)] hover:bg-[var(--brand-soft)]"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
              >
                {resolvedPlaceholder}
              </button>
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-center text-sm text-[var(--muted)]">
              {resolvedEmpty}
            </li>
          ) : (
            filtered.map((o) => {
              const active = o.value === value
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={o.disabled}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-bold transition hover:bg-[var(--brand-soft)] disabled:opacity-40 ${
                      active
                        ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                        : 'text-[var(--ink)]'
                    }`}
                    onClick={() => {
                      onChange(o.value)
                      setOpen(false)
                    }}
                  >
                    <span className="truncate">{o.label}</span>
                    {active && <Check size={15} className="shrink-0" />}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>,
      document.body,
    )

  return (
    <div ref={rootRef} className={`relative block space-y-1 ${className}`}>
      {label && (
        <span
          className="text-[10px] font-extrabold tracking-[0.14em] text-[var(--muted)] uppercase"
          id={`${autoId}-label`}
        >
          {label}
        </span>
      )}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          value={value}
          onChange={() => undefined}
          required
        />
      )}
      <button
        ref={btnRef}
        type="button"
        id={autoId}
        aria-labelledby={label ? `${autoId}-label` : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 text-left text-sm font-bold shadow-sm ring-1 ring-[var(--line)] outline-none transition focus:ring-2 focus:ring-[var(--brand)]/30 disabled:cursor-not-allowed disabled:opacity-50 sm:bg-[var(--surface)] ${
          open ? 'ring-2 ring-[var(--brand)]/30' : ''
        }`}
      >
        <span
          className={`truncate ${selected ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}
        >
          {selected?.label || resolvedPlaceholder}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[var(--muted)] transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {menu}
    </div>
  )
}
