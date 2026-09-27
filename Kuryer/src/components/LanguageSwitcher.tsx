import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { FlagGb, FlagRu, FlagUz } from './Flags'
import { LANG_KEY, type AppLang } from '../i18n'

const LANGS: {
  code: AppLang
  label: string
  short: string
  Flag: typeof FlagUz
}[] = [
  { code: 'uz', label: 'O‘zbekcha', short: 'UZ', Flag: FlagUz },
  { code: 'ru', label: 'Русский', short: 'RU', Flag: FlagRu },
  { code: 'en', label: 'English', short: 'EN', Flag: FlagGb },
]

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n, t } = useTranslation()
  const lang = (i18n.language?.slice(0, 2) as AppLang) || 'uz'
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
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

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0]
  const CurrentFlag = current.Flag

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('common.language')}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white pr-2 pl-1.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-teal-300"
      >
        <span className="flex h-6 w-9 overflow-hidden rounded-[6px] ring-1 ring-black/5">
          <CurrentFlag className="h-full w-full object-cover" />
        </span>
        <span className="hidden sm:inline">{current.short}</span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute top-[calc(100%+6px)] right-0 z-50 min-w-[168px] overflow-hidden rounded-2xl bg-white py-1.5 shadow-xl ring-1 ring-slate-200"
        >
          {LANGS.map(({ code, label, short, Flag }) => {
            const active = code === lang
            return (
              <li key={code} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    void i18n.changeLanguage(code)
                    localStorage.setItem(LANG_KEY, code)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-semibold transition ${
                    active
                      ? 'bg-teal-50 text-teal-800'
                      : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex h-5 w-[30px] shrink-0 overflow-hidden rounded-[5px] ring-1 ring-black/8">
                    <Flag className="h-full w-full" />
                  </span>
                  <span className="flex-1">{label}</span>
                  <span className="text-[10px] font-bold tracking-wide text-slate-400">
                    {short}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
