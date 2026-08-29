import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AnimatePresence, motion } from 'motion/react';
import { House, LayoutGrid, LogOut, MapPin, ShoppingBag, ShoppingCart, Sparkles } from 'lucide-react';
import { LangSwitch, useI18n } from '@/src/i18n';
import { AuthScreen } from './components/auth/AuthScreen';
import { CartScreen } from './components/cart/CartScreen';
import { CatalogScreen } from './components/catalog/CatalogScreen';
import { CategoriesScreen } from './components/catalog/CategoriesScreen';
import { AppColumn, PageBackdrop, headerSafe, tabSafe, viewportFill } from './components/layout/AppFrame';
import { OnboardingScreen } from './components/onboarding/OnboardingScreen';
import { OrdersScreen } from './components/orders/OrdersScreen';
import { AppIcon } from './components/ui/AppIcon';
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
      <View style={[tw`flex-1 items-center justify-center`, { backgroundColor: '#051b14' }, viewportFill]}>
        <View style={tw`items-center gap-4`}>
          <AppIcon size={72} rounded={20} />
          <ActivityIndicator size="small" color="#d4af37" />
          <Text style={tw`text-[#d4af37] text-xs font-bold tracking-widest uppercase`}>{t('brand')}</Text>
        </View>
      </View>
    );
  }
  if (!user) return <AuthScreen />;
  if (!user.profileCompleted) return <OnboardingScreen />;

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || t('common_welcome');

  return (
    <PageBackdrop>
      <AppColumn>
        {/* Header */}
        <View
          style={[
            tw`px-4 sm:px-6 pb-4 flex-row justify-between items-center gap-3 border-b border-[#d4af37]/15 shrink-0`,
            {
              background: 'linear-gradient(135deg, #051b14 0%, #0b3d2e 60%, #12543e 100%)',
              zIndex: 30,
            } as any,
            headerSafe,
          ]}
        >
          <View style={tw`flex-row items-center gap-3 min-w-0 flex-1 pr-2`}>
            <AppIcon size={40} rounded={12} containerStyle={{ backgroundColor: '#0B3D2E' }} />
            <View style={tw`min-w-0 flex-1`}>
              <View style={tw`flex-row items-center gap-1.5 mb-0.5`}>
                <Sparkles size={11} color="#d4af37" />
                <Text style={tw`text-[10px] font-extrabold tracking-[2px] text-[#d4af37] uppercase`}>
                  {t('brand')}
                </Text>
              </View>
              <Text style={tw`text-white font-extrabold text-base sm:text-lg tracking-tight`} numberOfLines={1}>
                {displayName}
              </Text>
              {user.cityName ? (
                <View style={tw`flex-row items-center gap-1 mt-0.5`}>
                  <MapPin size={11} color="#52d68e" />
                  <Text style={tw`text-[#daf3e5] text-xs font-medium`} numberOfLines={1}>
                    {user.cityName}
                    {user.mfyName ? ` • ${user.mfyName}` : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={tw`flex-row items-center gap-2 shrink-0`}>
            <LangSwitch tone="dark" />
            <Pressable
              onPress={signOut}
              style={tw`w-10 h-10 rounded-2xl bg-white/10 border border-white/15 items-center justify-center hover:bg-white/20 active:scale-95`}
            >
              <LogOut size={16} color="#faf3e0" />
            </Pressable>
          </View>
        </View>

        {/* Content View */}
        <View style={[tw`flex-1 px-3 sm:px-5 pt-3 sm:pt-4 overflow-hidden`, { minHeight: 0 }]}>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{ height: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
            >
              {tab === 'catalog' && <CatalogScreen />}
              {tab === 'cats' && <CategoriesScreen />}
              {tab === 'cart' && <CartScreen onOrdered={() => setTab('orders')} />}
              {tab === 'orders' && <OrdersScreen />}
            </motion.div>
          </AnimatePresence>
        </View>

        {/* Bottom Tab Bar */}
        <View
          style={[
            tw`flex-row border-t border-[#d4af37]/20 shadow-lg px-2 shrink-0`,
            {
              background: 'linear-gradient(180deg, #0b3d2e 0%, #051b14 100%)',
              zIndex: 40,
            } as any,
            tabSafe,
          ]}
        >
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            const color = active ? '#d4af37' : '#9bb5a8';
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                style={tw`flex-1 py-2.5 items-center min-w-0 active:scale-95 transition-transform`}
              >
                <View
                  style={[
                    tw`px-3 py-1 rounded-xl items-center justify-center transition-all`,
                    active ? tw`bg-white/10 shadow-sm border border-[#d4af37]/30` : {},
                    { position: 'relative' },
                  ]}
                >
                  <Icon size={20} color={color} strokeWidth={active ? 2.5 : 2} />
                  {item.id === 'cart' && cartCount > 0 ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: -5,
                        right: -8,
                        minWidth: 18,
                        height: 18,
                        paddingHorizontal: 4,
                        borderRadius: 9,
                        backgroundColor: '#d4af37',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1.5,
                        borderColor: '#051b14',
                      }}
                    >
                      <Text style={tw`text-[10px] font-black text-[#051b14]`}>
                        {cartCount > 99 ? '99+' : cartCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    tw`text-[11px] mt-0.5 tracking-tight`,
                    { color, fontWeight: active ? '800' : '600' },
                  ]}
                >
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
