import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AnimatePresence, motion } from 'motion/react';
import { House, LayoutGrid, LogOut, ShoppingBag, ShoppingCart } from 'lucide-react';
import { LangSwitch, useI18n } from '@/src/i18n';
import { AuthScreen } from './components/auth/AuthScreen';
import { CartScreen } from './components/cart/CartScreen';
import { CatalogScreen } from './components/catalog/CatalogScreen';
import { CategoriesScreen } from './components/catalog/CategoriesScreen';
import { AppColumn, PageBackdrop, headerSafe, tabSafe, viewportFill } from './components/layout/AppFrame';
import { OnboardingScreen } from './components/onboarding/OnboardingScreen';
import { OrdersScreen } from './components/orders/OrdersScreen';
import { useAuth } from './context/AuthContext';
import { apiRequest } from './lib/api';
import { tw } from './lib/utils';

type Tab = 'catalog' | 'cats' | 'cart' | 'orders';

const TABS: { id: Tab; labelKey: 'cust_tabCatalog' | 'cust_tabCats' | 'cust_tabCart' | 'cust_tabOrders'; icon: typeof LayoutGrid }[] = [
  { id: 'catalog', labelKey: 'cust_tabCatalog', icon: House },
  { id: 'cats', labelKey: 'cust_tabCats', icon: LayoutGrid },
  { id: 'cart', labelKey: 'cust_tabCart', icon: ShoppingCart },
  { id: 'orders', labelKey: 'cust_tabOrders', icon: ShoppingBag },
];

export default function App() {
  const { user, token, ready, signOut } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('catalog');
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    if (!token || !user?.profileCompleted) return;
    const load = async () => {
      try {
        const d = await apiRequest<{ items: { quantity: number }[] }>('/api/cart', { token, silent: true });
        setCartCount((d.items || []).reduce((n, it) => n + (it.quantity || 0), 0));
      } catch {
        /* ignore */
      }
    };
    void load();
    const timer = setInterval(() => void load(), 12000);
    return () => clearInterval(timer);
  }, [token, user?.profileCompleted, tab]);

  if (!ready) {
    return (
      <View style={[tw`flex-1 items-center justify-center`, { backgroundColor: '#0B3D2E' }, viewportFill]}>
        <ActivityIndicator size="large" color="#C4A35A" />
      </View>
    );
  }
  if (!user) return <AuthScreen />;
  if (!user.profileCompleted) return <OnboardingScreen />;

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || t('common_welcome');

  return (
    <PageBackdrop>
      <AppColumn>
        <View style={[tw`px-4 sm:px-5 pb-4 flex-row justify-between items-center gap-3`, { backgroundColor: '#0B3D2E' }, headerSafe]}>
          <View style={tw`min-w-0 flex-1 pr-2`}>
            <Text style={tw`text-[11px] font-bold tracking-[2px] text-[#C4A35A] uppercase`}>{t('brand')}</Text>
            <Text style={tw`text-white font-extrabold text-base sm:text-lg`} numberOfLines={1}>
              {displayName}
            </Text>
            {user.cityName ? (
              <Text style={tw`text-[#9BB5A8] text-xs mt-0.5`} numberOfLines={1}>
                {user.cityName}
              </Text>
            ) : null}
          </View>
          <View style={tw`flex-row items-center gap-2 shrink-0`}>
            <LangSwitch tone="dark" />
            <Pressable onPress={signOut} style={tw`w-10 h-10 rounded-xl bg-[#145C44] items-center justify-center`}>
              <LogOut size={18} color="#F4EAD4" />
            </Pressable>
          </View>
        </View>
        <View style={[tw`flex-1 px-4 sm:px-5 pt-4`, { minHeight: 0 }]}>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              style={{ height: '100%' }}
            >
              {tab === 'catalog' && <CatalogScreen />}
              {tab === 'cats' && <CategoriesScreen />}
              {tab === 'cart' && <CartScreen onOrdered={() => setTab('orders')} />}
              {tab === 'orders' && <OrdersScreen />}
            </motion.div>
          </AnimatePresence>
        </View>
        <View style={[tw`flex-row`, { backgroundColor: '#0B3D2E' }, tabSafe]}>
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            const color = active ? '#C4A35A' : '#9BB5A8';
            return (
              <Pressable key={item.id} onPress={() => setTab(item.id)} style={tw`flex-1 py-3 items-center min-w-0`}>
                <View style={{ position: 'relative' }}>
                  <Icon size={20} color={color} strokeWidth={active ? 2.4 : 2} />
                  {item.id === 'cart' && cartCount > 0 ? (
                    <View style={{ position: 'absolute', top: -6, right: -10, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: '#C4A35A', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={tw`text-[9px] font-extrabold text-[#0B3D2E]`}>{cartCount > 99 ? '99+' : cartCount}</Text>
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={[tw`text-[11px] mt-1`, { color, fontWeight: active ? '700' : '500' }]}>
                  {t(item.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </AppColumn>
    </PageBackdrop>
  );
}
