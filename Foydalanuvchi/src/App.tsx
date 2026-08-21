import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AnimatePresence, motion } from 'motion/react';
import { LayoutGrid, LogOut, ShoppingBag, ShoppingCart } from 'lucide-react';
import { LangSwitch, useI18n } from '@/src/i18n';
import { AuthScreen } from './components/auth/AuthScreen';
import { CartScreen } from './components/cart/CartScreen';
import { CatalogScreen } from './components/catalog/CatalogScreen';
import { AppColumn, PageBackdrop, headerSafe, tabSafe, viewportFill } from './components/layout/AppFrame';
import { OnboardingScreen } from './components/onboarding/OnboardingScreen';
import { OrdersScreen } from './components/orders/OrdersScreen';
import { useAuth } from './context/AuthContext';
import { tw } from './lib/utils';

type Tab = 'catalog' | 'cart' | 'orders';

const TABS: { id: Tab; labelKey: 'cust_tabCatalog' | 'cust_tabCart' | 'cust_tabOrders'; icon: typeof LayoutGrid }[] = [
  { id: 'catalog', labelKey: 'cust_tabCatalog', icon: LayoutGrid },
  { id: 'cart', labelKey: 'cust_tabCart', icon: ShoppingCart },
  { id: 'orders', labelKey: 'cust_tabOrders', icon: ShoppingBag },
];

export default function App() {
  const { user, ready, signOut } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('catalog');

  if (!ready) {
    return (
      <View style={[tw`flex-1 items-center justify-center`, { backgroundColor: '#0B3D2E' }, viewportFill]}>
        <ActivityIndicator size="large" color="#C4A35A" />
      </View>
    );
  }
  if (!user) return <AuthScreen />;
  if (!user.profileCompleted) return <OnboardingScreen />;

  return (
    <PageBackdrop>
      <AppColumn>
        <View style={[tw`px-4 sm:px-5 pb-4 flex-row justify-between items-center gap-3`, { backgroundColor: '#0B3D2E' }, headerSafe]}>
          <View style={tw`min-w-0 flex-1 pr-2`}>
            <Text style={tw`text-[11px] font-bold tracking-[2px] text-[#C4A35A] uppercase`}>{t('brand')}</Text>
            <Text style={tw`text-white font-extrabold text-base sm:text-lg`} numberOfLines={1}>
              {[user.cityName, user.mfyName].filter(Boolean).join(' · ') || t('common_neighborhood')}
            </Text>
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
              {tab === 'catalog' && <CatalogScreen onAdded={() => setTab('cart')} />}
              {tab === 'cart' && <CartScreen onOrdered={() => setTab('orders')} />}
              {tab === 'orders' && <OrdersScreen />}
            </motion.div>
          </AnimatePresence>
        </View>
        <View style={[tw`flex-row border-t border-[#E8DFD0] bg-white`, tabSafe]}>
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <Pressable key={item.id} onPress={() => setTab(item.id)} style={tw`flex-1 py-3 items-center min-w-0`}>
                <Icon size={20} color={active ? '#0B3D2E' : '#8A968E'} strokeWidth={active ? 2.4 : 2} />
                <Text numberOfLines={1} style={tw`text-[11px] mt-1 ${active ? 'font-bold text-[#0B3D2E]' : 'text-gray-500'}`}>{t(item.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>
      </AppColumn>
    </PageBackdrop>
  );
}
