import { type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Grid2x2, Home, ShoppingCart, UserRound } from 'lucide-react'
import { useCart } from '../cart/CartContext'
import { useAuth } from '../auth/AuthContext'
import { useCategoryPicker } from './CategoryPicker'

const tabBase =
  'flex h-full w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1.5 text-center transition'

const labelClass =
  'w-full max-w-full truncate px-0.5 text-[10px] leading-tight font-bold sm:text-[11px]'

type TabVisualProps = {
  active: boolean
  icon: ReactNode
  label: string
  badge?: number
}

function TabVisual({ active, icon, label, badge }: TabVisualProps) {
  return (
    <>
      <span
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
          active ? 'bg-[var(--green-soft)]' : ''
        }`}
      >
        {icon}
        {badge != null && badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[9px] font-extrabold text-white">
            {badge}
          </span>
        )}
      </span>
      <span className={labelClass}>{label}</span>
    </>
  )
}

export function BottomNav() {
  const { t } = useTranslation()
  const { count } = useCart()
  const { isAuthenticated } = useAuth()
  const { open, togglePicker } = useCategoryPicker()

  const profileTo = isAuthenticated ? '/profil' : '/kirish'

  const tone = (active: boolean) =>
    active
      ? 'text-[var(--green)]'
      : 'text-[var(--muted)] hover:text-[var(--ink)]'

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-white/95 backdrop-blur-md md:hidden">
      <div className="mx-auto grid h-[3.75rem] max-w-lg grid-cols-4 items-stretch px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-0.5">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `${tabBase} ${tone(isActive && !open)}`
          }
        >
          {({ isActive }) => (
            <TabVisual
              active={isActive && !open}
              label={t('nav.home')}
              icon={
                <Home
                  size={20}
                  strokeWidth={isActive && !open ? 2.4 : 2}
                />
              }
            />
          )}
        </NavLink>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            togglePicker()
          }}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={`${tabBase} border-0 bg-transparent ${tone(open)}`}
        >
          <TabVisual
            active={open}
            label={t('nav.categories')}
            icon={<Grid2x2 size={20} strokeWidth={open ? 2.4 : 2} />}
          />
        </button>

        <NavLink
          to="/savat"
          className={({ isActive }) =>
            `${tabBase} ${tone(isActive && !open)}`
          }
        >
          {({ isActive }) => (
            <TabVisual
              active={isActive && !open}
              label={t('nav.cart')}
              badge={count}
              icon={
                <ShoppingCart
                  size={20}
                  strokeWidth={isActive && !open ? 2.4 : 2}
                />
              }
            />
          )}
        </NavLink>

        <NavLink
          to={profileTo}
          className={({ isActive }) =>
            `${tabBase} ${tone(isActive && !open && isAuthenticated)}`
          }
        >
          {({ isActive }) => {
            const active = isActive && !open && isAuthenticated
            return (
              <TabVisual
                active={active}
                label={t('nav.profile')}
                icon={
                  <UserRound size={20} strokeWidth={active ? 2.4 : 2} />
                }
              />
            )
          }}
        </NavLink>
      </div>
    </nav>
  )
}
