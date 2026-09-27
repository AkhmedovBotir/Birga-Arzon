import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'

export function AdminLayout() {
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : true,
  )
  const location = useLocation()

  const titles: Record<string, string> = useMemo(
    () => ({
      '/': t('nav.dashboard'),
      '/admins': t('nav.admins'),
      '/hududlar': t('nav.regions'),
      '/kategoriyalar': t('nav.categories'),
      '/mahsulotlar': t('nav.products'),
      '/yigimlar': t('nav.yigims'),
      '/buyurtmalar': t('nav.deliveries'),
      '/tolovlar': t('nav.payments'),
      '/users': t('nav.users'),
      '/kuryerlar': t('nav.couriers'),
      '/settings': t('nav.settings'),
    }),
    [t],
  )

  const title = titles[location.pathname] ?? t('admin.panelTitle')

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => {
      setSidebarOpen(mq.matches)
    }
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <div className="flex min-h-svh bg-[#eef6f4]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav
          title={title}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
