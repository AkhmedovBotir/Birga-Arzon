import { motion } from 'motion/react';
import { Bike, ClipboardList, Package, ShoppingBasket, Sparkles, Tags, TrendingUp, Users } from 'lucide-react';
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
    { label: t('dash_customers'), value: stats?.customers ?? 0, tab: 'users' as const, icon: Users, color: '#1b7a4a', bg: '#f1fbf5' },
    { label: t('dash_couriers'), value: stats?.couriers ?? 0, tab: 'couriers' as const, icon: Bike, color: '#0b3d2e', bg: '#daf3e5' },
    { label: t('dash_activeCollections'), value: stats?.activeCollections ?? 0, tab: 'collections' as const, icon: ShoppingBasket, color: '#d4af37', bg: '#fdfaf3' },
    { label: t('dash_products'), value: stats?.products ?? 0, tab: 'products' as const, icon: Package, color: '#2563eb', bg: '#eff6ff' },
    { label: t('dash_openOrders'), value: stats?.openOrders ?? 0, tab: 'orders' as const, icon: ClipboardList, color: '#d97706', bg: '#fffbeb' },
  ];

  const steps = [
    { n: '1', title: t('dash_step1t'), text: t('dash_step1d'), tab: 'categories' as const, icon: Tags },
    { n: '2', title: t('dash_step2t'), text: t('dash_step2d'), tab: 'collections' as const, icon: ShoppingBasket },
    { n: '3', title: t('dash_step3t'), text: t('dash_step3d'), tab: 'collections' as const, icon: ShoppingBasket },
    { n: '4', title: t('dash_step4t'), text: t('dash_step4d'), tab: 'orders' as const, icon: ClipboardList },
  ];

  return (
    <div>
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <Sparkles size={12} className="text-[#b8913b]" />
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#b8913b]">{t('dash_kicker')}</p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0f1c16] tracking-tight">{t('dash_title')}</h1>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto px-3.5 py-1.5 rounded-2xl bg-white border border-[#e8dfd0] shadow-sm">
          <TrendingUp size={14} className="text-[#1b7a4a]" />
          <span className="text-xs font-bold text-[#0b3d2e]">Jonli Statistika</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.button
              key={c.label}
              type="button"
              onClick={() => onGo(c.tab)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="text-left bg-white border border-[#e8dfd0] rounded-3xl p-5 hover:border-[#0b3d2e]/40 hover:shadow-lg transition-all active:scale-[0.98]"
            >
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3.5 border border-black/5"
                style={{ backgroundColor: c.bg, color: c.color }}
              >
                <Icon size={20} />
              </div>
              <p className="text-3xl font-black text-[#0f1c16] tracking-tight">{formatNumber(c.value)}</p>
              <p className="text-xs font-bold text-[#54665d] mt-1 truncate">{c.label}</p>
            </motion.button>
          );
        })}
      </div>

      {/* Workflow Section */}
      <PanelCard className="mt-7 shadow-sm border border-[#e8dfd0]" title={t('dash_workflow')}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => onGo(s.tab)}
                className="text-left rounded-2xl border border-[#e8dfd0] bg-[#fbf8f2] p-4 hover:border-[#0b3d2e]/40 hover:bg-white hover:shadow-sm transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-2.5 mb-2.5">
                  <span className="w-7 h-7 rounded-xl bg-[#0b3d2e] text-white text-xs font-black grid place-items-center shrink-0">
                    {s.n}
                  </span>
                  <Icon size={16} className="text-[#1b7a4a] shrink-0" />
                  <span className="font-extrabold text-sm text-[#0f1c16] truncate">{s.title}</span>
                </div>
                <p className="text-xs text-[#54665d] leading-5 font-medium">{s.text}</p>
              </button>
            );
          })}
        </div>
      </PanelCard>
    </div>
  );
}
