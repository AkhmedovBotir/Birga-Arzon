import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight,
  ClipboardList,
  History,
  LogOut,
  MapPinned,
  Phone,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { phoneDisplay } from '../lib/phone'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

/** Skip junk names like "123456 123456" from bad seed data */
function looksLikeRealName(name: string) {
  const cleaned = name.replace(/\s+/g, '')
  if (cleaned.length < 2) return false
  if (/^\d+$/.test(cleaned)) return false
  return /[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳʼ'’-]/.test(cleaned)
}

function titleCaseRegion(part: string) {
  const s = part.trim()
  if (!s) return s
  if (s !== s.toUpperCase()) return s
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function ProfilePage() {
  const { t } = useTranslation()
  const { kuryer, logout } = useAuth()

  const rawName =
    kuryer?.full_name?.trim() ||
    [kuryer?.first_name, kuryer?.last_name].filter(Boolean).join(' ').trim()

  const displayName =
    rawName && looksLikeRealName(rawName)
      ? rawName
      : t('common.courier')

  const region = [kuryer?.viloyat_name, kuryer?.tuman_name]
    .filter(Boolean)
    .map((p) => titleCaseRegion(String(p)))
    .join(', ')

  const menu = [
    {
      to: '/',
      label: t('nav.deliveries'),
      hint: t('profile.activeOrdersHint'),
      Icon: ClipboardList,
    },
    {
      to: '/tarix',
      label: t('nav.history'),
      hint: t('profile.historyHint'),
      Icon: History,
    },
  ] as const

  return (
    <div className="mx-auto max-w-md space-y-5 pb-2">
      <div className="flex flex-col items-center pt-1 text-center">
        <div className="relative mb-4">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-700 text-3xl font-extrabold text-white shadow-[0_12px_28px_-10px_rgba(29,78,216,0.55)] ring-[6px] ring-blue-100">
            {initials(displayName)}
          </span>
          <span
            className={`absolute -right-1 -bottom-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-2 ring-[#eef4fb] ${
              kuryer?.is_active
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {kuryer?.is_active ? t('common.active') : t('common.inactive')}
          </span>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          {displayName}
        </h1>
        <p className="mt-0.5 text-sm font-semibold text-slate-500">
          {t('profile.courierInfo')}
        </p>

        {kuryer?.phone && (
          <a
            href={`tel:${kuryer.phone}`}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 transition hover:text-blue-700"
          >
            <Phone size={14} className="text-blue-600" />
            {phoneDisplay(kuryer.phone)}
          </a>
        )}
      </div>

      <section className="overflow-hidden rounded-[1.5rem] border border-blue-900/8 bg-white shadow-[0_10px_36px_-22px_rgba(15,23,42,0.35)]">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <MapPinned size={18} />
          </span>
          <div className="min-w-0 text-left">
            <p className="text-[11px] font-extrabold tracking-wide text-slate-400 uppercase">
              {t('profile.workRegion')}
            </p>
            <p className="mt-0.5 text-sm font-extrabold text-slate-900">
              {region || t('profile.noRegion')}
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-blue-900/8 bg-white shadow-[0_10px_36px_-22px_rgba(15,23,42,0.35)]">
        {menu.map(({ to, label, hint, Icon }, i) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-slate-50 ${
              i < menu.length - 1 ? 'border-b border-slate-100' : ''
            }`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Icon size={18} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-slate-900">
                {label}
              </span>
              <span className="block text-xs font-semibold text-slate-500">
                {hint}
              </span>
            </span>
            <ChevronRight size={17} className="shrink-0 text-slate-400" />
          </Link>
        ))}
      </section>

      <button
        type="button"
        onClick={logout}
        className="group flex w-full items-center gap-3.5 rounded-[1.5rem] border border-blue-900/8 bg-white px-4 py-3.5 shadow-[0_10px_36px_-22px_rgba(15,23,42,0.35)] transition hover:border-rose-200 hover:bg-rose-50 active:scale-[0.99]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 transition group-hover:bg-rose-500 group-hover:text-white">
          <LogOut size={18} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-extrabold text-rose-700">
            {t('common.logout')}
          </span>
          <span className="block text-xs font-semibold text-rose-400">
            {t('profile.logoutHint')}
          </span>
        </span>
      </button>
    </div>
  )
}
