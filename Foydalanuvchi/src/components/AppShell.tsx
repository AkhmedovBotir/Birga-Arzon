import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { BottomNav } from './BottomNav'
import { CategoryPickerProvider } from './CategoryPicker'
import { shell } from './layout'

export function AppShell() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  return (
    <CategoryPickerProvider>
      <div className="flex min-h-svh w-full min-w-0 flex-col overflow-x-clip">
        <Header />
        <main
          className={`${shell} min-w-0 flex-1 overflow-x-clip pt-2.5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pt-5 md:pb-10`}
        >
          <Outlet />
        </main>
        {isHome && <Footer />}
        <BottomNav />
      </div>
    </CategoryPickerProvider>
  )
}
