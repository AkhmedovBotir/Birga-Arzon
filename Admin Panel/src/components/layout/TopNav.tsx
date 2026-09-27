import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Check,
  ChevronDown,
  LogOut,
  Search,
  Settings,
  UserRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/AuthContext'
import { phoneDisplay } from '../../lib/phone'
import { Hamburger } from './Hamburger'
import { LanguageSwitcher } from '../LanguageSwitcher'

type Props = {
  title: string
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

type Notif = {
  id: string
  title: string
  body: string
  time: string
  read: boolean
}

export function TopNav({ title, sidebarOpen, onToggleSidebar }: Props) {
  const { admin, logout } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const rootRef = useRef<HTMLElement>(null)

  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const searchPages = useMemo(
    () => [
      { label: t('nav.dashboard'), path: '/', keywords: 'dashboard bosh' },
      { label: t('nav.admins'), path: '/admins', keywords: 'adminlar admin' },
      {
        label: t('nav.regions'),
        path: '/hududlar',
        keywords: 'hudud viloyat tuman region',
      },
      {
        label: t('nav.categories'),
        path: '/kategoriyalar',
        keywords: 'kategoriya category',
      },
      {
        label: t('nav.products'),
        path: '/mahsulotlar',
        keywords: 'mahsulot product',
      },
      { label: t('nav.yigims'), path: '/yigimlar', keywords: 'yigim group' },
      {
        label: t('nav.deliveries'),
        path: '/buyurtmalar',
        keywords: 'buyurtma order',
      },
      {
        label: t('nav.payments'),
        path: '/tolovlar',
        keywords: 'tolov payment atmos',
      },
      {
        label: t('nav.users'),
        path: '/users',
        keywords: 'users foydalanuvchi',
      },
      {
        label: t('nav.couriers'),
        path: '/kuryerlar',
        keywords: 'kuryer courier',
      },
      {
        label: t('nav.settings'),
        path: '/settings',
        keywords: 'settings sozlama',
      },
    ],
    [t],
  )

  const seedNotifs = useMemo<Notif[]>(
    () => [
      {
        id: '1',
        title: t('admin.welcomeNotifTitle'),
        body: t('admin.welcomeNotifBody'),
        time: t('admin.timeNow'),
        read: false,
      },
      {
        id: '2',
        title: t('admin.systemNotifTitle'),
        body: t('admin.systemNotifBody'),
        time: t('admin.timeHourAgo'),
        read: false,
      },
    ],
    [t],
  )

  const [notifs, setNotifs] = useState<Notif[]>(seedNotifs)

  useEffect(() => {
    setNotifs((prev) => {
      const readMap = new Map(prev.map((n) => [n.id, n.read]))
      return seedNotifs.map((n) => ({
        ...n,
        read: readMap.get(n.id) ?? n.read,
      }))
    })
  }, [seedNotifs])

  const unread = notifs.filter((n) => !n.read).length

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return searchPages
    return searchPages.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.keywords.toLowerCase().includes(q) ||
        p.path.includes(q),
    )
  }, [query, searchPages])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setSearchOpen(false)
        setNotifOpen(false)
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const closeAll = () => {
    setSearchOpen(false)
    setNotifOpen(false)
    setProfileOpen(false)
  }

  return (
    <header
      ref={rootRef}
      className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 py-3 backdrop-blur-md sm:px-6"
    >
      <Hamburger open={sidebarOpen} onToggle={onToggleSidebar} />

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="hidden text-xs text-slate-500 sm:block">
          {t('admin.controlPanel')}
        </p>
      </div>

      {/* Search */}
      <div className="relative hidden md:block">
        <div
          className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm transition ${
            searchOpen
              ? 'border-teal-600 ring-2 ring-teal-600/15'
              : 'border-slate-200'
          }`}
        >
          <Search size={16} className="shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSearchOpen(true)
              setNotifOpen(false)
              setProfileOpen(false)
            }}
            onFocus={() => {
              setSearchOpen(true)
              setNotifOpen(false)
              setProfileOpen(false)
            }}
            placeholder={t('common.search')}
            className="w-40 bg-transparent text-slate-800 outline-none placeholder:text-slate-400 lg:w-52"
          />
        </div>
        {searchOpen && (
          <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
              {t('footer.nav')}
            </p>
            <ul className="max-h-64 overflow-y-auto py-1">
              {results.length === 0 ? (
                <li className="px-3 py-3 text-sm text-slate-500">
                  {t('common.nothingFound')}
                </li>
              ) : (
                results.map((item) => (
                  <li key={item.path}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-teal-50 hover:text-teal-900"
                      onClick={() => {
                        navigate(item.path)
                        setQuery('')
                        closeAll()
                      }}
                    >
                      <span>{item.label}</span>
                      <span className="text-xs text-slate-400">{item.path}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>

      <LanguageSwitcher />

      {/* Notifications */}
      <div className="relative">
        <button
          type="button"
          className={`relative rounded-xl border bg-white p-2.5 text-slate-600 shadow-sm transition hover:bg-slate-50 ${
            notifOpen ? 'border-teal-600' : 'border-slate-200'
          }`}
          aria-label={t('admin.notifications')}
          aria-expanded={notifOpen}
          onClick={() => {
            setNotifOpen((v) => !v)
            setSearchOpen(false)
            setProfileOpen(false)
          }}
        >
          <Bell size={17} />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-teal-600" />
          )}
        </button>
        {notifOpen && (
          <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
              <p className="text-sm font-semibold text-slate-900">
                {t('admin.notifications')}
              </p>
              {unread > 0 && (
                <button
                  type="button"
                  className="text-xs font-medium text-teal-700 hover:underline"
                  onClick={() =>
                    setNotifs((list) =>
                      list.map((n) => ({ ...n, read: true })),
                    )
                  }
                >
                  {t('admin.markAllRead')}
                </button>
              )}
            </div>
            <ul className="max-h-72 overflow-y-auto">
              {notifs.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-slate-500">
                  {t('admin.noNotifications')}
                </li>
              ) : (
                notifs.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`flex w-full gap-3 px-3 py-3 text-left transition hover:bg-slate-50 ${
                        n.read ? '' : 'bg-teal-50/40'
                      }`}
                      onClick={() =>
                        setNotifs((list) =>
                          list.map((x) =>
                            x.id === n.id ? { ...x, read: true } : x,
                          ),
                        )
                      }
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          n.read ? 'bg-slate-300' : 'bg-teal-600'
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-slate-900">
                            {n.title}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {n.time}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {n.body}
                        </span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="relative">
        <button
          type="button"
          className={`flex items-center gap-2 rounded-xl border bg-white px-2.5 py-1.5 shadow-sm transition hover:bg-slate-50 ${
            profileOpen ? 'border-teal-600' : 'border-slate-200'
          }`}
          aria-expanded={profileOpen}
          onClick={() => {
            setProfileOpen((v) => !v)
            setSearchOpen(false)
            setNotifOpen(false)
          }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-xs font-semibold text-white">
            {(admin?.first_name?.[0] || admin?.username?.[0] || 'A').toUpperCase()}
          </div>
          <div className="hidden pr-0.5 text-left sm:block">
            <p className="text-xs font-semibold text-slate-800">
              {admin?.first_name || admin?.username}
            </p>
            <p className="text-[10px] tracking-wide text-teal-700 uppercase">
              {admin?.role}
            </p>
          </div>
          <ChevronDown
            size={14}
            className={`hidden text-slate-400 transition sm:block ${
              profileOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        {profileOpen && (
          <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-3 py-3">
              <p className="text-sm font-semibold text-slate-900">
                {admin?.first_name} {admin?.last_name}
              </p>
              <p className="text-xs text-slate-500">
                @{admin?.username} · {admin?.phone ? phoneDisplay(admin.phone) : '—'}
              </p>
            </div>
            <div className="py-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                onClick={() => {
                  closeAll()
                  navigate('/settings')
                }}
              >
                <UserRound size={16} />
                {t('nav.profile')}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                onClick={() => {
                  closeAll()
                  navigate('/settings')
                }}
              >
                <Settings size={16} />
                {t('nav.settings')}
              </button>
              {unread === 0 && (
                <p className="flex items-center gap-2 px-3 py-2 text-xs text-teal-700">
                  <Check size={14} />
                  {t('admin.notificationsRead')}
                </p>
              )}
            </div>
            <div className="border-t border-slate-100 p-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-rose-700 transition hover:bg-rose-50"
                onClick={() => {
                  closeAll()
                  logout()
                }}
              >
                <LogOut size={16} />
                {t('common.logout')}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
