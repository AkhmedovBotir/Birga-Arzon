import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useI18n } from '@/src/i18n';
import { Button, Card } from '@/src/components/ui/Base';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import { tw } from '@/src/lib/utils';
import type { Order } from '@/src/types';

type Seg = 'hand' | 'open';

export function CourierOrdersScreen({ onIssue }: { onIssue?: () => void }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [seg, setSeg] = useState<Seg>('hand');
  const [open, setOpen] = useState<Order[]>([]);
  const [active, setActive] = useState<Order[]>([]);
  const [needArea, setNeedArea] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!token) return;
    const d = await apiRequest<{ open: Order[]; active: Order[]; needArea?: boolean }>('/api/courier/deliveries', { token, silent });
    setOpen(d.open || []);
    setActive(d.active || []);
    setNeedArea(Boolean(d.needArea));
  }, [token]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(true), 15000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-6`}>
      <Text style={tw`text-2xl font-extrabold text-[#14221B] mb-1`}>{t('cour_ordersTitle')}</Text>
      <Text style={tw`text-[#5C6B63] mb-3`}>{t('cour_ordersHint')}</Text>

      <View style={tw`flex-row mb-4 bg-white border border-[#E8DFD0] rounded-xl p-1`}>
        {([
          { id: 'hand' as const, label: t('cour_tabHand'), count: active.length },
          { id: 'open' as const, label: t('cour_tabOpen'), count: open.length },
        ]).map((item) => {
          const on = seg === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setSeg(item.id)}
              style={[
                tw`flex-1 py-2 rounded-lg items-center`,
                { backgroundColor: on ? '#0B3D2E' : 'transparent' },
              ]}
            >
              <Text style={{ color: on ? '#fff' : '#5C6B63', fontWeight: '800', fontSize: 13 }}>
                {item.label} {item.count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {needArea ? (
        <Card>
          <Text style={tw`font-bold text-[#14221B]`}>{t('cour_needMfyTitle')}</Text>
          <Text style={tw`text-[#5C6B63] mt-1`}>{t('cour_needMfyOrders')}</Text>
        </Card>
      ) : null}

      {!needArea && seg === 'hand' ? (
        <>
          <Text style={tw`text-xs text-[#5C6B63] mb-3`}>{t('cour_handHint')}</Text>
          {active.length === 0 ? <Text style={tw`text-gray-500`}>{t('cour_noHand')}</Text> : null}
          {active.map((o) => (
            <Card key={o.id} style={tw`mb-3`}>
              <View style={[tw`self-start px-2 py-1 rounded-lg mb-2`, { backgroundColor: '#E3F4EA' }]}>
                <Text style={{ color: '#1B7A4A', fontSize: 11, fontWeight: '800' }}>{t('cour_waitCode')}</Text>
              </View>
              <Text style={tw`font-bold`}>{o.customerName}</Text>
              <Text style={tw`text-gray-500`}>{o.customerPhone}</Text>
              <Text style={tw`text-gray-700 mt-1`}>
                {o.deliveryMethod === 'home_delivery'
                  ? o.deliveryAddress || `${o.deliveryLat || '—'}, ${o.deliveryLng || '—'}`
                  : t('cour_mfyPick')}
              </Text>
              {o.items.map((it) => (
                <Text key={it.id} style={tw`text-gray-600`}>{it.title} × {it.quantity}</Text>
              ))}
              <Button className="mt-4" onPress={() => onIssue?.()}>
                {t('cour_enterCode')}
              </Button>
            </Card>
          ))}
        </>
      ) : null}

      {!needArea && seg === 'open' ? (
        <>
          <Text style={tw`text-xs text-[#5C6B63] mb-3`}>{t('cour_openHint')}</Text>
          {open.length === 0 ? <Text style={tw`text-gray-500`}>{t('cour_noOpen')}</Text> : null}
          {open.map((o) => (
            <Card key={o.id} style={{ ...tw`mb-3`, opacity: 0.9 }}>
              <View style={[tw`self-start px-2 py-1 rounded-lg mb-2`, { backgroundColor: '#F4EAD4' }]}>
                <Text style={{ color: '#7A5A1E', fontSize: 11, fontWeight: '800' }}>{t('st_open')}</Text>
              </View>
              <Text style={tw`font-bold`}>{o.customerName}</Text>
              <Text style={tw`text-amber-800 text-sm mt-1`}>{t('cour_waitAdmin')}</Text>
              {o.items.map((it) => (
                <Text key={it.id} style={tw`text-gray-600`}>{it.title} × {it.quantity}</Text>
              ))}
            </Card>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}
