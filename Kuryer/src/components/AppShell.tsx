import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClipboardList, History, UserRound } from 'lucide-react'
import { LanguageSwitcher } from './LanguageSwitcher'

export function AppShell() {
  const { t } = useTranslation()

  const tabs = [
    { to: '/', label: t('nav.deliveries'), icon: ClipboardList, end: true },
    { to: '/tarix', label: t('nav.history'), icon: History },
    { to: '/profil', label: t('nav.profile'), icon: UserRound },
  ]

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col">
      <div className="flex items-center justify-end px-4 pt-3">
        <LanguageSwitcher />
      </div>
      <div className="flex-1 px-4 pt-2 pb-24">
        <Outlet />
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-500 hover:text-slate-700'
                }`
              }
            >
              <tab.icon size={20} strokeWidth={1.75} />
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
