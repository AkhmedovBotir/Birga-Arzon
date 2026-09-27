import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight,
  ClipboardList,
  LogOut,
  MapPinned,
  PencilLine,
  Phone,
} from 'lucide-react'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../auth/AuthContext'
import { phoneDisplay } from '../lib/phone'

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:28px;height:28px;border-radius:50% 50% 50% 0;
    background:#ff6a00;border:3px solid #fff;
    box-shadow:0 6px 16px rgba(255,106,0,.45);
    transform:rotate(-45deg);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
})

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function ProfilePage() {
  const { t } = useTranslation()
  const { user, isAuthenticated, loading, logout } = useAuth()

  if (loading && !user) {
    return (
      <div className="mx-auto max-w-md space-y-4 pt-6">
        <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-white" />
        <div className="mx-auto h-6 w-40 animate-pulse rounded-lg bg-white" />
        <div className="h-48 animate-pulse rounded-[1.5rem] bg-white" />
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/kirish" replace state={{ from: '/profil' }} />
  }

  const displayName =
    user.full_name?.trim() ||
    [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
    t('profile.user')

  const region = [user.viloyat_name, user.tuman_name]
    .filter(Boolean)
    .join(', ')
  const hasCoords = user.lat != null && user.lng != null
  const position = hasCoords ? { lat: user.lat!, lng: user.lng! } : null

  const menu = [
    {
      to: '/buyurtmalar',
      label: t('profile.myOrders'),
      hint: t('profile.myOrdersHint'),
      Icon: ClipboardList,
    },
    {
      to: '/kirish/profil',
      label: t('profile.editProfile'),
      hint: user.profile_complete
        ? t('profile.editHint')
        : t('profile.editHintNeed'),
      Icon: PencilLine,
      warn: !user.profile_complete,
    },
  ] as const

  return (
    <div className="mx-auto max-w-md space-y-5 pb-4">
      <div className="flex flex-col items-center pt-2 text-center">
        <div className="relative mb-4">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--brand)] text-3xl font-extrabold text-white shadow-[var(--shadow-btn)] ring-[6px] ring-[var(--brand-soft)]">
            {initials(displayName)}
          </span>
          <span
            className={`absolute -right-1 -bottom-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-2 ring-[var(--surface)] ${
              user.profile_complete
                ? 'bg-[var(--green-soft)] text-[var(--green-mid)]'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {user.profile_complete ? t('profile.complete') : t('profile.incomplete')}
          </span>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ink)]">
          {displayName}
        </h1>
        <a
          href={`tel:${user.phone}`}
          className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--muted)] transition hover:text-[var(--brand)]"
        >
          <Phone size={14} className="text-[var(--brand)]" />
          {phoneDisplay(user.phone)}
        </a>
      </div>

      <section className="overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-[var(--line)]">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
              <MapPinned size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-[var(--ink)]">
                {region ||
                  (position ? t('profile.locationSaved') : t('profile.noAddress'))}
              </p>
              {position && (
                <p className="truncate text-[11px] font-semibold text-[var(--muted)]">
                  {position.lat.toFixed(4)}, {position.lng.toFixed(4)}
                </p>
              )}
            </div>
          </div>
          <Link
            to="/kirish/profil"
            className="shrink-0 text-xs font-extrabold text-[var(--brand)]"
          >
            {t('common.change')}
          </Link>
        </div>

        {position ? (
          <div className="relative h-48 overflow-hidden border-t border-[var(--line)] sm:h-56">
            <MapContainer
              center={[position.lat, position.lng]}
              zoom={15}
              scrollWheelZoom={false}
              dragging={false}
              doubleClickZoom={false}
              zoomControl={false}
              attributionControl={false}
              className="h-full w-full"
              style={{ background: 'var(--sand)' }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[position.lat, position.lng]} icon={pinIcon} />
            </MapContainer>
            <a
              href={`https://www.openstreetmap.org/?mlat=${position.lat}&mlon=${position.lng}#map=16/${position.lat}/${position.lng}`}
              target="_blank"
              rel="noreferrer"
              className="absolute right-3 bottom-3 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-extrabold text-[var(--ink)] shadow-md ring-1 ring-[var(--line)] backdrop-blur transition hover:bg-white"
            >
              {t('common.openMap')}
            </a>
          </div>
        ) : (
          <div className="border-t border-[var(--line)] bg-[var(--sand)] px-4 py-8 text-center">
            <p className="text-sm font-semibold text-[var(--muted)]">
              {t('profile.noLocation')}
            </p>
            <Link
              to="/kirish/profil"
              className="mt-2 inline-block text-sm font-extrabold text-[var(--brand)]"
            >
              {t('profile.pickOnMap')}
            </Link>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-[var(--line)]">
        {menu.map(({ to, label, hint, Icon, ...rest }, i) => {
          const warn = 'warn' in rest && rest.warn
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-[var(--surface)] ${
                i < menu.length - 1 ? 'border-b border-[var(--line)]' : ''
              }`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                  warn
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-[var(--green-soft)] text-[var(--green)]'
                }`}
              >
                <Icon size={18} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-[var(--ink)]">
                  {label}
                </span>
                <span
                  className={`block text-xs font-semibold ${
                    warn ? 'text-amber-700' : 'text-[var(--muted)]'
                  }`}
                >
                  {hint}
                </span>
              </span>
              <ChevronRight size={17} className="shrink-0 text-[var(--muted)]" />
            </Link>
          )
        })}
      </section>

      <button
        type="button"
        onClick={() => logout()}
        className="group flex w-full items-center gap-3.5 rounded-[1.5rem] bg-white px-4 py-3.5 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] transition hover:bg-rose-50 hover:ring-rose-200 active:scale-[0.99]"
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
