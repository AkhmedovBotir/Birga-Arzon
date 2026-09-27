import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard,
  Shield,
  Users,
  Truck,
  Settings,
  LogOut,
  X,
  MapPinned,
  FolderTree,
  Package,
  Layers,
  ClipboardList,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { useTranslation } from 'react-i18next'

const FULL_W = 280
const RAIL_W = 80

type Props = {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: Props) {
  const { admin, logout } = useAuth()
  const { t } = useTranslation()

  const links = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/admins', label: t('nav.admins'), icon: Shield },
    { to: '/hududlar', label: t('nav.regions'), icon: MapPinned },
    { to: '/kategoriyalar', label: t('nav.categories'), icon: FolderTree },
    { to: '/mahsulotlar', label: t('nav.products'), icon: Package },
    { to: '/yigimlar', label: t('nav.yigims'), icon: Layers },
    { to: '/buyurtmalar', label: t('nav.deliveries'), icon: ClipboardList },
    { to: '/tolovlar', label: t('nav.payments'), icon: Wallet },
    { to: '/users', label: t('nav.users'), icon: Users },
    { to: '/kuryerlar', label: t('nav.couriers'), icon: Truck },
    { to: '/settings', label: t('nav.settings'), icon: Settings },
  ]
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : true,
  )

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsDesktop(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!isDesktop && open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open, isDesktop])

  // Desktop: ochiq = to‘liq, yopiq = icon-rail. Mobile: drawer.
  const showLabels = !isDesktop || open
  const desktopWidth = open ? FULL_W : RAIL_W

  const shellStyle = {
    background:
      'linear-gradient(165deg, #0a3531 0%, #0d4a43 42%, #0f5c54 100%)',
  } as const

  const content = (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 0%, rgba(94,234,212,0.22), transparent 42%), radial-gradient(circle at 100% 80%, rgba(13,148,136,0.35), transparent 45%)',
        }}
      />

      <div
        className={`relative flex items-center pt-5 pb-4 ${
          showLabels ? 'justify-between gap-3 px-5' : 'justify-center px-2'
        }`}
      >
        <div className={`flex min-w-0 items-center ${showLabels ? 'gap-3' : ''}`}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-400/20 ring-1 ring-teal-200/30">
            <span className="text-sm font-bold tracking-tight text-teal-50">
              BA
            </span>
          </div>
          {showLabels && (
            <div className="min-w-0 overflow-hidden">
              <p className="truncate text-[10px] font-semibold tracking-[0.28em] text-teal-200/70 uppercase">
                {t('admin.brand')}
              </p>
              <p className="truncate text-base font-semibold tracking-tight text-white">
                {t('admin.roleAdmin')}
              </p>
            </div>
          )}
        </div>
        {!isDesktop && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-teal-50 transition hover:bg-white/15"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {showLabels && (
        <>
          <div className="relative mx-5 mb-3 h-px bg-gradient-to-r from-transparent via-teal-200/25 to-transparent" />
          <p className="relative px-5 pb-2 text-[10px] font-semibold tracking-[0.22em] text-teal-200/55 uppercase">
            {t('common.menu')}
          </p>
        </>
      )}

      <nav
        className={`relative flex-1 space-y-1 overflow-x-hidden overflow-y-auto pb-4 ${
          showLabels ? 'px-3' : 'px-2'
        }`}
      >
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            onClick={() => {
              if (!isDesktop) onClose()
            }}
            className={({ isActive }) =>
              `group relative flex items-center rounded-2xl text-sm font-medium transition ${
                showLabels ? 'gap-3 px-3 py-2.5' : 'justify-center px-0 py-2.5'
              } ${
                isActive
                  ? 'bg-teal-300/20 text-white shadow-inner'
                  : 'text-teal-100/75 hover:bg-white/8 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && showLabels && (
                  <span className="absolute top-1/2 left-0 h-7 w-1 -translate-y-1/2 rounded-r-full bg-teal-300" />
                )}
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                    isActive
                      ? 'bg-teal-900/35 text-teal-100'
                      : 'bg-white/5 text-teal-200/80 group-hover:bg-white/10'
                  }`}
                >
                  <Icon size={17} strokeWidth={1.9} />
                </span>
                {showLabels && (
                  <span className="truncate whitespace-nowrap">{label}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div
        className={`relative mt-auto ${
          showLabels
            ? 'm-3 rounded-2xl border border-white/10 bg-black/20 p-3'
            : 'mx-2 mb-3'
        }`}
      >
        {showLabels ? (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/25 text-sm font-semibold text-teal-50 ring-1 ring-teal-200/20">
                {(admin?.first_name?.[0] || admin?.username?.[0] || 'A').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-white">
                  {admin?.first_name} {admin?.last_name}
                </p>
                <p className="truncate text-[11px] text-teal-200/65">
                  @{admin?.username} · {admin?.role}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/8 px-3 py-2.5 text-sm text-teal-50 transition hover:bg-rose-500/20 hover:text-rose-100"
            >
              <LogOut size={16} />
              {t('common.logout')}
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              title={`${admin?.first_name ?? ''} ${admin?.last_name ?? ''}`.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/25 text-sm font-semibold text-teal-50 ring-1 ring-teal-200/20"
            >
              {(admin?.first_name?.[0] || admin?.username?.[0] || 'A').toUpperCase()}
            </div>
            <button
              type="button"
              title={t('common.logout')}
              onClick={logout}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/8 text-teal-50 transition hover:bg-rose-500/20 hover:text-rose-100"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  )

  if (isDesktop) {
    return (
      <motion.aside
        className="sticky top-0 z-20 flex h-svh shrink-0 flex-col overflow-hidden text-teal-50"
        style={shellStyle}
        initial={false}
        animate={{ width: desktopWidth }}
        transition={{ duration: 0.28, ease: 'easeInOut' }}
      >
        {content}
      </motion.aside>
    )
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            key="mobile-sidebar"
            className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col overflow-hidden text-teal-50 shadow-2xl shadow-teal-950/40"
            style={shellStyle}
            initial={{ x: -FULL_W }}
            animate={{ x: 0 }}
            exit={{ x: -FULL_W }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          >
            {content}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
