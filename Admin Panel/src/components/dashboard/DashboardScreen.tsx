import { motion } from 'motion/react';
import { Bike, ClipboardList, Package, ShoppingBasket, Tags, Users } from 'lucide-react';
import { useI18n } from '@/src/i18n';
import { PanelCard } from '@/src/components/ui/Panel';
import type { AdminTab } from '@/src/components/layout/AdminShell';
import { formatNumber } from '@/src/lib/utils';

export function DashboardScreen({
  stats,
  onGo,
}: {
  stats: Record<string, number> | null;
  onGo: (t: AdminTab) => void;
}) {
  const { t } = useI18n();

  const cards = [
    { label: t('dash_customers'), value: stats?.customers ?? 0, tab: 'users' as const, icon: Users },
    { label: t('dash_couriers'), value: stats?.couriers ?? 0, tab: 'couriers' as const, icon: Bike },
    { label: t('dash_activeCollections'), value: stats?.activeCollections ?? 0, tab: 'collections' as const, icon: ShoppingBasket },
    { label: t('dash_products'), value: stats?.products ?? 0, tab: 'products' as const, icon: Package },
    { label: t('dash_openOrders'), value: stats?.openOrders ?? 0, tab: 'orders' as const, icon: ClipboardList },
  ];

  const steps = [
    { n: '1', title: t('dash_step1t'), text: t('dash_step1d'), tab: 'categories' as const, icon: Tags },
    { n: '2', title: t('dash_step2t'), text: t('dash_step2d'), tab: 'collections' as const, icon: ShoppingBasket },
    { n: '3', title: t('dash_step3t'), text: t('dash_step3d'), tab: 'collections' as const, icon: ShoppingBasket },
    { n: '4', title: t('dash_step4t'), text: t('dash_step4d'), tab: 'orders' as const, icon: ClipboardList },
  ];

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600 mb-1">{t('dash_kicker')}</p>
      <h1 className="text-xl sm:text-2xl font-extrabold text-ink mb-6">{t('dash_title')}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.button
              key={c.label}
              type="button"
              onClick={() => onGo(c.tab)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="text-left bg-white border border-[#E8DFD0] rounded-2xl p-4 hover:border-brand-800/40 transition"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center mb-3">
                <Icon size={18} />
              </div>
              <p className="text-2xl font-black text-ink">{formatNumber(c.value)}</p>
              <p className="text-sm text-[#5C6B63] mt-1">{c.label}</p>
            </motion.button>
          );
        })}
      </div>

      <PanelCard className="mt-6" title={t('dash_workflow')}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => onGo(s.tab)}
                className="text-left rounded-xl border border-[#E8DFD0] bg-cream/50 p-3 hover:border-brand-800/40 transition"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-900 text-white text-xs font-black grid place-items-center">
                    {s.n}
                  </span>
                  <Icon size={16} className="text-brand-800" />
                  <span className="font-bold text-ink">{s.title}</span>
                </div>
                <p className="text-sm text-[#5C6B63] leading-5">{s.text}</p>
              </button>
            );
          })}
        </div>
      </PanelCard>
    </div>
  );
}
