import type { ComponentType, ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bike,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  Package,
  ShoppingBasket,
  Tags,
  Users,
  X,
} from 'lucide-react';
import { LangSwitch, useI18n, type DictKey } from '@/src/i18n';
import { cn } from '@/src/lib/utils';

export type AdminTab =
  | 'dashboard'
  | 'collections'
  | 'categories'
  | 'products'
  | 'users'
  | 'couriers'
  | 'locations'
  | 'orders';

const NAV: { id: AdminTab; labelKey: DictKey; icon: ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { id: 'dashboard', labelKey: 'nav_dashboard', icon: LayoutDashboard },
  { id: 'categories', labelKey: 'nav_categories', icon: Tags },
  { id: 'products', labelKey: 'nav_products', icon: Package },
  { id: 'collections', labelKey: 'nav_collections', icon: ShoppingBasket },
  { id: 'orders', labelKey: 'nav_orders', icon: ClipboardList },
  { id: 'users', labelKey: 'nav_users', icon: Users },
  { id: 'couriers', labelKey: 'nav_couriers', icon: Bike },
  { id: 'locations', labelKey: 'nav_locations', icon: MapPinned },
];

const TITLE_KEYS: Record<AdminTab, DictKey> = {
  dashboard: 'title_dashboard',
  collections: 'title_collections',
  categories: 'title_categories',
  products: 'title_products',
  users: 'title_users',
  couriers: 'title_couriers',
  locations: 'title_locations',
  orders: 'title_orders',
};

export function AdminShell({
  tab,
  onTab,
  collapsed,
  onToggle,
  mobileOpen,
  onMobile,
  userName,
  statsLine,
  onSignOut,
  children,
}: {
  tab: AdminTab;
  onTab: (t: AdminTab) => void;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobile: (open: boolean) => void;
  userName: string;
  statsLine?: string;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();

  const go = (id: AdminTab) => {
    onTab(id);
    onMobile(false);
  };

  const sidebar = (opts: { overlay?: boolean }) => (
    <motion.aside
      initial={false}
      animate={{ width: opts.overlay ? 260 : collapsed ? 80 : 260 }}
      transition={{ type: 'spring', stiffness: 280, damping: 32 }}
      className={cn(
        'h-full flex flex-col text-white overflow-hidden',
        opts.overlay ? 'w-[260px]' : ''
      )}
      style={{ background: 'linear-gradient(180deg, #0B3D2E 0%, #07261c 100%)' }}
    >
      <div className="flex items-center gap-3 px-4 h-16 shrink-0">
        <img
          src="/icon.png"
          alt={t('brandAdmin')}
          className="w-10 h-10 rounded-xl object-cover shrink-0 shadow-md"
        />
        <AnimatePresence>
          {(opts.overlay || !collapsed) && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="min-w-0"
            >
              <p className="font-extrabold truncate">{t('brandAdmin')}</p>
              <p className="text-[11px] text-gold-600 truncate">{t('title_adminPanel')}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto scrollbar-hide">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          const label = t(item.labelKey);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.id)}
              title={label}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl mb-1 h-11 px-3 transition-colors',
                active ? 'bg-[#145C44] text-white' : 'text-[#D5E6DC] hover:bg-white/5'
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              <AnimatePresence>
                {(opts.overlay || !collapsed) && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm font-semibold truncate"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </nav>

      <div className="px-2 pb-4">
        <button
          type="button"
          onClick={onSignOut}
          className="w-full flex items-center gap-3 rounded-xl h-11 px-3 text-[#F4EAD4] hover:bg-white/5"
        >
          <LogOut size={20} />
          <AnimatePresence>
            {(opts.overlay || !collapsed) && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm font-semibold">
                {t('common_logout')}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );

  return (
    <div className="h-dvh max-h-dvh flex bg-cream overflow-hidden">
      <div className="hidden md:flex h-full shrink-0">{sidebar({})}</div>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            className="fixed inset-0 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button type="button" className="absolute inset-0 bg-black/40" onClick={() => onMobile(false)} aria-label={t('common_close')} />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 280, damping: 32 }}
              className="absolute left-0 top-0 bottom-0"
            >
              {sidebar({ overlay: true })}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 md:h-16 shrink-0 bg-white/90 backdrop-blur border-b border-[#E8DFD0]">
          <div className="h-full w-full max-w-7xl mx-auto flex items-center gap-2 sm:gap-3 px-3 sm:px-5 md:px-8">
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 768) onMobile(!mobileOpen);
                else onToggle();
              }}
              className="w-10 h-10 shrink-0 rounded-xl border border-[#E8DFD0] bg-cream flex items-center justify-center text-brand-900"
              aria-label={t('common_menu')}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider text-gold-600 font-bold">{t('title_adminPanel')}</p>
              <h2 className="font-extrabold text-ink truncate leading-5 text-sm sm:text-base">{t(TITLE_KEYS[tab])}</h2>
            </div>
            <div className="shrink-0">
              <LangSwitch />
            </div>
            <div className="text-right hidden md:block min-w-0">
              <p className="text-sm font-bold text-ink truncate max-w-[12rem]">{userName}</p>
              {statsLine ? <p className="text-[11px] text-[#5C6B63] truncate max-w-[12rem]">{statsLine}</p> : null}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-5 md:px-8 py-4 sm:py-6 md:py-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
