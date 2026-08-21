import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AnimatePresence, motion } from 'motion/react';
import { ClipboardList, KeyRound, LogOut, ShoppingBasket } from 'lucide-react';
import { LangSwitch, useI18n } from '@/src/i18n';
import { AuthScreen } from './components/auth/AuthScreen';
import { DeliveriesScreen } from './components/deliveries/DeliveriesScreen';
import { IssueCodeScreen } from './components/issue/IssueCodeScreen';
import { AppColumn, PageBackdrop, headerSafe, tabSafe, viewportFill } from './components/layout/AppFrame';
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
      <View style={[tw`flex-1 items-center justify-center`, { backgroundColor: '#0B3D2E' }, viewportFill]}>
        <ActivityIndicator color="#C4A35A" />
      </View>
    );
  }
  if (!user) return <AuthScreen role="courier" />;
  if (user.role !== 'courier' && user.role !== 'admin') {
    return (
      <View style={tw`flex-1 items-center justify-center`}>
        <Text>{t('app_courierOnly')}</Text>
        <Pressable onPress={signOut}><Text style={tw`text-red-600 mt-3`}>{t('common_logout')}</Text></Pressable>
      </View>
    );
  }

  return (
    <PageBackdrop>
      <AppColumn>
        <View style={[tw`px-4 sm:px-5 pb-4 flex-row justify-between items-center gap-3`, { backgroundColor: '#0B3D2E' }, headerSafe]}>
          <View style={tw`min-w-0 flex-1 pr-2`}>
            <Text style={tw`text-[11px] font-bold tracking-[2px] text-[#C4A35A] uppercase`}>{t('brandCourier')}</Text>
            <Text style={tw`text-white font-extrabold text-base sm:text-lg`} numberOfLines={1}>
              {user.firstName ? `${user.firstName} ${user.lastName}`.trim() : t('cour_roleCourier')}
            </Text>
            {user.mfyName ? (
              <Text style={tw`text-[#D5E6DC] text-xs mt-0.5`} numberOfLines={1}>
                {[user.cityName, user.mfyName].filter(Boolean).join(' · ')}
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
        <View style={[tw`flex-row border-t border-[#E8DFD0] bg-white`, tabSafe]}>
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <Pressable key={item.id} onPress={() => setTab(item.id)} style={tw`flex-1 py-3 items-center min-w-0`}>
                <Icon size={20} color={active ? '#0B3D2E' : '#8A968E'} strokeWidth={active ? 2.4 : 2} />
                <Text numberOfLines={1} style={tw`text-[11px] mt-1 ${active ? 'font-bold text-[#0B3D2E]' : 'text-gray-500'}`}>{tabLabel(item.id)}</Text>
              </Pressable>
            );
          })}
        </View>
      </AppColumn>
    </PageBackdrop>
  );
}
