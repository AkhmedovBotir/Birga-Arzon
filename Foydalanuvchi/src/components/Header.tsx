import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, UserRound, X } from 'lucide-react'
import { useCart } from '../cart/CartContext'
import { useAuth } from '../auth/AuthContext'
import { LanguageSwitcher } from './LanguageSwitcher'
import { useCategoryPicker } from './CategoryPicker'
import { shell } from './layout'
import { config } from '../config'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function Header() {
  const { t } = useTranslation()
  const { count } = useCart()
  const { user, isAuthenticated, loading } = useAuth()
  const { open: pickerOpen, togglePicker } = useCategoryPicker()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const mobileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setQ(params.get('q') ?? '')
  }, [params])

  useEffect(() => {
    if (!mobileSearchOpen) return
    const id = window.setTimeout(() => mobileInputRef.current?.focus(), 50)
    return () => window.clearTimeout(id)
  }, [mobileSearchOpen])

  const applySearch = (value: string) => {
    const next = value.trim()
    const sp = new URLSearchParams(params)
    if (next) sp.set('q', next)
    else sp.delete('q')
    navigate({ pathname: '/', search: sp.toString() ? `?${sp}` : '' })
    setMobileSearchOpen(false)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    applySearch(q)
  }

  const clear = () => {
    setQ('')
    const sp = new URLSearchParams(params)
    sp.delete('q')
    setParams(sp, { replace: true })
    if (window.location.pathname !== '/') {
      navigate({ pathname: '/', search: sp.toString() ? `?${sp}` : '' })
    }
  }

  const displayName =
    user?.full_name?.trim() ||
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
    user?.phone ||
    t('nav.profile')

  const linkClass = (isActive: boolean) =>
    `relative px-3 py-2 text-[14px] font-bold whitespace-nowrap transition xl:px-3.5 ${
      isActive
        ? 'text-[var(--brand)]'
        : 'text-[var(--ink)]/75 hover:text-[var(--ink)]'
    }`

  return (
    <header className="sticky top-0 z-30 w-full overflow-x-clip border-b border-[var(--line)]/50 bg-[var(--surface)]/95 backdrop-blur-md">
      <div
        className={`${shell} flex min-w-0 items-center gap-2 py-2.5 sm:gap-3 sm:py-3 md:gap-4 md:py-3.5`}
      >
        {/* Brand */}
        <Link
          to="/"
          className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5"
          onClick={() => setMobileSearchOpen(false)}
        >
          <img
            src="/images/hero-mascot-removebg.png"
            alt=""
            className="h-9 w-9 object-contain drop-shadow-sm sm:h-11 sm:w-11 md:h-12 md:w-12"
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = '/images/hero-mascot.png'
            }}
          />
          <div className="min-w-0 leading-none">
            <p className="text-[15px] font-extrabold tracking-tight sm:text-[17px] md:text-[18px]">
              <span className="text-[var(--green)]">Birga</span>
              <span className="text-[var(--brand)]">Arzon</span>
            </p>
            <p className="mt-1 hidden text-[9px] font-bold tracking-[0.14em] text-[var(--muted)] uppercase lg:block">
              {config.tagline}
            </p>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="mx-auto hidden items-center gap-0.5 lg:flex">
          <NavLink to="/" end className={({ isActive }) => linkClass(isActive)}>
            {({ isActive }) => (
              <>
                <span>{t('nav.home')}</span>
                {isActive && (
                  <span className="absolute right-3 bottom-0 left-3 h-[2px] rounded-full bg-[var(--brand)]" />
                )}
              </>
            )}
          </NavLink>
          <button
            type="button"
            onClick={togglePicker}
            className={linkClass(pickerOpen)}
          >
            {t('nav.categories')}
            {pickerOpen && (
              <span className="absolute right-3 bottom-0 left-3 h-[2px] rounded-full bg-[var(--brand)]" />
            )}
          </button>
          <NavLink
            to="/savat"
            className={({ isActive }) => linkClass(isActive)}
          >
            {({ isActive }) => (
              <>
                <span className="relative inline-flex items-center">
                  {t('nav.cart')}
                  {count > 0 && (
                    <span className="absolute -top-2 -right-4 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[9px] font-extrabold text-white">
                      {count}
                    </span>
                  )}
                </span>
                {isActive && (
                  <span className="absolute right-3 bottom-0 left-3 h-[2px] rounded-full bg-[var(--brand)]" />
                )}
              </>
            )}
          </NavLink>
          <NavLink
            to="/profil"
            className={({ isActive }) => linkClass(isActive)}
          >
            {({ isActive }) => (
              <>
                <span>{t('nav.profile')}</span>
                {isActive && (
                  <span className="absolute right-3 bottom-0 left-3 h-[2px] rounded-full bg-[var(--brand)]" />
                )}
              </>
            )}
          </NavLink>
        </nav>

        {/* Spacer on mobile when search is icon-only */}
        <div className="min-w-0 flex-1 lg:hidden" aria-hidden />

        {/* Desktop / tablet search */}
        <form
          onSubmit={onSubmit}
          className="hidden min-w-0 flex-1 items-center gap-1.5 rounded-full bg-white py-1.5 pr-1.5 pl-3 ring-1 ring-[var(--line)] transition focus-within:ring-2 focus-within:ring-[var(--brand)]/30 sm:flex md:max-w-[200px] lg:max-w-[220px] xl:max-w-[280px]"
          role="search"
        >
          <Search size={15} className="shrink-0 text-[var(--muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('common.search')}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
            aria-label={t('home.searchPlaceholder')}
          />
          {q && (
            <button
              type="button"
              onClick={clear}
              aria-label={t('cart.clear')}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
            >
              <X size={14} />
            </button>
          )}
        </form>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Mobile search toggle */}
          <button
            type="button"
            onClick={() => setMobileSearchOpen((v) => !v)}
            aria-expanded={mobileSearchOpen}
            aria-label={t('common.search')}
            className={`flex h-9 w-9 items-center justify-center rounded-full bg-white text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)] transition sm:hidden ${
              mobileSearchOpen || q
                ? 'text-[var(--brand)] ring-[var(--brand)]/35'
                : ''
            }`}
          >
            {mobileSearchOpen ? <X size={16} /> : <Search size={16} />}
          </button>

          <LanguageSwitcher />

          {loading && !user ? (
            <div className="hidden h-9 w-20 animate-pulse rounded-xl bg-[var(--sand)] md:block" />
          ) : isAuthenticated && user ? (
            <Link
              to="/profil"
              className="hidden h-9 max-w-[140px] items-center gap-2 rounded-xl bg-white py-1 pr-2.5 pl-1 text-sm font-extrabold text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)] transition hover:ring-[var(--brand)]/35 md:inline-flex lg:h-10 lg:max-w-[180px] lg:pr-3 lg:pl-1.5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)] text-[11px] font-extrabold text-white">
                {initials(displayName)}
              </span>
              <span className="truncate">{displayName.split(' ')[0]}</span>
            </Link>
          ) : (
            <Link
              to="/kirish"
              className="ba-btn !hidden h-9 items-center gap-1.5 rounded-xl px-3.5 text-[13px] whitespace-nowrap md:!inline-flex lg:h-10 lg:px-5 lg:text-sm"
            >
              <UserRound size={15} />
              {t('common.login')}
            </Link>
          )}
        </div>
      </div>

      {/* Mobile expanded search */}
      {mobileSearchOpen && (
        <div className={`${shell} pb-2.5 sm:hidden`}>
          <form
            onSubmit={onSubmit}
            className="flex items-center gap-1.5 rounded-full bg-white py-1.5 pr-1.5 pl-3 ring-1 ring-[var(--line)] focus-within:ring-2 focus-within:ring-[var(--brand)]/30"
            role="search"
          >
            <Search size={15} className="shrink-0 text-[var(--muted)]" />
            <input
              ref={mobileInputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('home.searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
              aria-label={t('home.searchPlaceholder')}
            />
            {q && (
              <button
                type="button"
                onClick={clear}
                aria-label={t('cart.clear')}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--muted)]"
              >
                <X size={14} />
              </button>
            )}
          </form>
        </div>
      )}
    </header>
  )
}
