import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AnimatePresence, motion } from 'motion/react';
import { ClipboardList, KeyRound, LogOut, MapPin, ShoppingBasket, Sparkles } from 'lucide-react';
import { LangSwitch, useI18n } from '@/src/i18n';
import { AuthScreen } from './components/auth/AuthScreen';
import { DeliveriesScreen } from './components/deliveries/DeliveriesScreen';
import { IssueCodeScreen } from './components/issue/IssueCodeScreen';
import { AppColumn, PageBackdrop, headerSafe, tabSafe, viewportFill } from './components/layout/AppFrame';
import { AppIcon } from './components/ui/AppIcon';
import { CourierOrdersScreen } from './components/orders/CourierOrdersScreen';
import { useAuth } from './context/AuthContext';
import { tw } from './lib/utils';

type Tab = 'accept' | 'orders' | 'code';

const TABS: { id: Tab; icon: typeof ShoppingBasket }[] = [
  { id: 'accept', icon: ShoppingBasket },
  { id: 'orders', icon: ClipboardList },
  { id: 'code', icon: KeyRound },
];

export default function App() {
  const { user, ready, signOut } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('accept');

  const tabLabel = (id: Tab) =>
    id === 'accept' ? t('nav_accept') : id === 'orders' ? t('nav_orders') : t('nav_handover');

  if (!ready) {
    return (
      <View style={[tw`flex-1 items-center justify-center`, { backgroundColor: '#051b14' }, viewportFill]}>
        <View style={tw`items-center gap-4`}>
          <AppIcon size={72} rounded={20} />
          <ActivityIndicator size="small" color="#d4af37" />
          <Text style={tw`text-[#d4af37] text-xs font-black tracking-widest uppercase`}>{t('brandCourier')}</Text>
        </View>
      </View>
    );
  }
  if (!user) return <AuthScreen role="courier" />;
  if (user.role !== 'courier' && user.role !== 'admin') {
    return (
      <View style={tw`flex-1 items-center justify-center p-6 bg-[#ede6da]`}>
        <View style={tw`bg-white p-6 rounded-3xl border border-[#e8dfd0] items-center text-center max-w-sm`}>
          <Text style={tw`font-extrabold text-base text-[#0f1c16]`}>{t('app_courierOnly')}</Text>
          <Pressable onPress={signOut} style={tw`mt-4 px-6 py-2.5 rounded-xl bg-red-600`}>
            <Text style={tw`text-white font-bold text-xs`}>{t('common_logout')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <PageBackdrop>
      <AppColumn>
        {/* Header */}
        <View
          style={[
            tw`px-4 sm:px-6 pb-4 flex-row justify-between items-center gap-3 border-b border-[#d4af37]/20 shrink-0`,
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
                <Text style={tw`text-[10px] font-black tracking-[2px] text-[#d4af37] uppercase`}>
                  {t('brandCourier')}
                </Text>
              </View>
              <Text style={tw`text-white font-black text-base sm:text-lg tracking-tight`} numberOfLines={1}>
                {user.firstName ? `${user.firstName} ${user.lastName}`.trim() : t('cour_roleCourier')}
              </Text>
              {user.cityName ? (
                <View style={tw`flex-row items-center gap-1 mt-0.5`}>
                  <MapPin size={11} color="#52d68e" />
                  <Text style={tw`text-[#daf3e5] text-xs font-medium`} numberOfLines={1}>
                    {[user.regionName, user.cityName].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={tw`flex-row items-center gap-2 shrink-0`}>
            <LangSwitch tone="dark" />
            <Pressable
              onPress={signOut}
              style={tw`w-10 h-10 rounded-2xl bg-white/10 border border-white/15 items-center justify-center active:scale-95`}
            >
              <LogOut size={16} color="#faf3e0" />
            </Pressable>
          </View>
        </View>

        {/* Tab Content */}
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
              {tab === 'accept' ? (
                <DeliveriesScreen onAccepted={() => setTab('orders')} />
              ) : tab === 'orders' ? (
                <CourierOrdersScreen onIssue={() => setTab('code')} />
              ) : (
                <IssueCodeScreen onIssued={() => setTab('orders')} />
              )}
            </motion.div>
          </AnimatePresence>
        </View>

        {/* Tab Navigation */}
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
                    active ? tw`bg-white/10 border border-[#d4af37]/30 shadow-sm` : {},
                  ]}
                >
                  <Icon size={20} color={color} strokeWidth={active ? 2.5 : 2} />
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    tw`text-[11px] mt-0.5 tracking-tight`,
                    { color, fontWeight: active ? '800' : '600' },
                  ]}
                >
                  {tabLabel(item.id)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </AppColumn>
    </PageBackdrop>
  );
}
