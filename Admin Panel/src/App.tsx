import { useEffect, useState } from 'react';
import { useI18n } from '@/src/i18n';
import { AuthScreen } from './components/auth/AuthScreen';
import { CategoriesScreen } from './components/catalog/CategoriesScreen';
import { ProductsScreen } from './components/catalog/ProductsScreen';
import { CollectionsScreen } from './components/collections/CollectionsScreen';
import { CouriersScreen } from './components/couriers/CouriersScreen';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { AdminShell, type AdminTab } from './components/layout/AdminShell';
import { LocationsScreen } from './components/locations/LocationsScreen';
import { AdminOrdersScreen } from './components/orders/AdminOrdersScreen';
import { UsersScreen } from './components/users/UsersScreen';
import { useAuth } from './context/AuthContext';
import { apiRequest } from './lib/api';

export default function App() {
  const { t } = useI18n();
  const { user, ready, token, signOut } = useAuth();
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!token || user?.role !== 'admin') return;
    void apiRequest<Record<string, number>>('/api/admin/stats', { token }).then(setStats);
  }, [token, user, tab]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center bg-brand-900">
        <div className="flex flex-col items-center gap-4">
          <img src="/icon.png" alt="Birga Xarid" className="w-16 h-16 rounded-2xl object-cover shadow-xl animate-pulse" />
          <div className="w-8 h-8 rounded-full border-2 border-gold-600 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }
  if (!user) return <AuthScreen role="admin" />;
  if (user.role !== 'admin') {
    return (
      <div className="min-h-dvh grid place-items-center bg-cream p-6">
        <div className="w-full max-w-md text-center">
        <p>{t('app_adminOnly')}</p>
        <button type="button" className="mt-3 text-danger-500" onClick={signOut}>
          {t('common_logout')}
        </button>
        </div>
      </div>
    );
  }

  return (
    <AdminShell
      tab={tab}
      onTab={setTab}
      collapsed={collapsed}
      onToggle={() => setCollapsed((v) => !v)}
      mobileOpen={mobileOpen}
      onMobile={setMobileOpen}
      userName={`${user.firstName} ${user.lastName}`}
      statsLine={stats ? t('app_statsLine', { customers: stats.customers, couriers: stats.couriers ?? 0 }) : undefined}
      onSignOut={signOut}
    >
      {tab === 'dashboard' && <DashboardScreen stats={stats} onGo={setTab} />}
      {tab === 'collections' && <CollectionsScreen />}
      {tab === 'categories' && <CategoriesScreen />}
      {tab === 'products' && <ProductsScreen />}
      {tab === 'users' && <UsersScreen />}
      {tab === 'couriers' && <CouriersScreen />}
      {tab === 'locations' && <LocationsScreen />}
      {tab === 'orders' && <AdminOrdersScreen />}
    </AdminShell>
  );
}
