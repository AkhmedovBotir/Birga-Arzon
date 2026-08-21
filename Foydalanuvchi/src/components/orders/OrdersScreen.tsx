import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { errText, useI18n } from '@/src/i18n';
import { Button, Card } from '@/src/components/ui/Base';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import { formatCurrency, tw } from '@/src/lib/utils';
import type { Order } from '@/src/types';

function stepIndex(status: string) {
  if (status === 'cancelled') return -1;
  if (status === 'collecting') return 0;
  if (status === 'awaiting_courier' || status === 'awaiting_payment') return 1;
  if (['with_courier', 'paid', 'pay_on_delivery', 'ready_for_pickup', 'out_for_delivery'].includes(status)) return 2;
  if (status === 'issued') return 3;
  return 0;
}

export function OrdersScreen() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [items, setItems] = useState<Order[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const STEPS = [
    { id: 'collecting', title: t('cust_step1t'), hint: t('cust_step1d') },
    { id: 'awaiting_courier', title: t('cust_step2t'), hint: t('cust_step2d') },
    { id: 'with_courier', title: t('cust_step3t'), hint: t('cust_step3d') },
    { id: 'issued', title: t('cust_step4t'), hint: t('cust_step4d') },
  ];

  const chip = (status: string) => {
    const idx = stepIndex(status);
    if (status === 'cancelled') return { label: t('cust_chipCancel'), bg: '#FDECEC', fg: '#C0392B' };
    if (idx === 0) return { label: t('cust_chipCollecting'), bg: '#E3F4EA', fg: '#0B3D2E' };
    if (idx === 1) return { label: t('cust_chipWait'), bg: '#F4EAD4', fg: '#7A5A1E' };
    if (idx === 2) return { label: t('cust_chipHand'), bg: '#E3F4EA', fg: '#1B7A4A' };
    return { label: t('cust_chipIssued'), bg: '#E8EEF2', fg: '#3d4a43' };
  };

  const load = useCallback(async (silent = false) => {
    if (!token) return;
    const d = await apiRequest<{ items: Order[] }>('/api/orders', { token, silent });
    const list = d.items || [];
    setItems(list);
    setOpenId((prev) => {
      if (prev && list.some((o) => o.id === prev)) return prev;
      const active = list.find((o) => o.status !== 'issued' && o.status !== 'cancelled');
      return active?.id || list[0]?.id || null;
    });
  }, [token]);

  useEffect(() => {
    void load().catch((e) => setError(errText(e)));
    const t = setInterval(() => void load(true), 12000);
    return () => clearInterval(t);
  }, [load]);

  const cancel = async (id: string) => {
    if (!token) return;
    try {
      await apiRequest(`/api/orders/${id}/cancel`, { method: 'POST', token, body: {}, success: t('cust_cancelledOk') });
      await load();
    } catch (e) {
      setError(errText(e));
    }
  };

  return (
    <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-8`}>
      <Text style={tw`text-2xl font-extrabold text-[#14221B] mb-1`}>{t('cust_myOrders')}</Text>
      <Text style={tw`text-[#5C6B63] mb-4`}>{t('cust_ordersHint')}</Text>
      {error ? <Text style={tw`text-red-600 mb-3`}>{error}</Text> : null}
      {items.length === 0 ? <Text style={tw`text-gray-500`}>{t('cust_noOrders')}</Text> : null}
      {items.map((o) => {
        const active = openId === o.id;
        const idx = stepIndex(o.status);
        const c = chip(o.status);
        return (
          <Card key={o.id} style={tw`mb-3`}>
            <Pressable onPress={() => setOpenId(active ? null : o.id)}>
              <View style={tw`flex-row justify-between items-start gap-2`}>
                <Text style={tw`flex-1 font-extrabold text-[#14221B]`}>
                  {o.items.map((it) => it.title).join(', ') || t('cust_orderWord')}
                </Text>
                <View style={[tw`px-2 py-1 rounded-lg`, { backgroundColor: c.bg }]}>
                  <Text style={{ color: c.fg, fontSize: 11, fontWeight: '800' }}>{c.label}</Text>
                </View>
              </View>
              <Text style={tw`text-[#5C6B63] mt-1`}>
                {formatCurrency(o.totalUzs)} · {o.deliveryMethod === 'home_delivery' ? t('cust_homeShort') : t('cust_mfyShort')}
              </Text>
              {!active && o.status !== 'cancelled' && idx >= 0 ? (
                <Text style={tw`text-xs text-[#5C6B63] mt-2`}>{STEPS[idx]?.title}</Text>
              ) : null}
              {!active && o.pickupCode ? (
                <Text style={tw`mt-2 font-black text-[#0B3D2E] tracking-widest text-xl`}>{o.pickupCode}</Text>
              ) : null}
            </Pressable>
            {active ? (
              <View style={tw`mt-4`}>
                {o.status === 'cancelled' ? (
                  <Text style={tw`text-red-600 font-semibold mb-3`}>{t('cust_cancelled')}</Text>
                ) : (
                  <View style={tw`mb-4`}>
                    {STEPS.map((s, i) => {
                      const done = idx > i || (idx === i && o.status === 'issued');
                      const current = idx === i && o.status !== 'issued';
                      const lastIssued = o.status === 'issued' && i === 3;
                      const on = done || current || lastIssued;
                      return (
                        <View key={s.id} style={tw`flex-row mb-3`}>
                          <View style={tw`items-center mr-3`}>
                            <View
                              style={[
                                tw`w-6 h-6 rounded-full items-center justify-center`,
                                { backgroundColor: on ? '#0B3D2E' : '#E8DFD0' },
                              ]}
                            >
                              <Text style={tw`text-white text-xs font-bold`}>{i + 1}</Text>
                            </View>
                            {i < STEPS.length - 1 ? (
                              <View style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: idx > i ? '#0B3D2E' : '#E8DFD0' }} />
                            ) : null}
                          </View>
                          <View style={tw`flex-1 pb-1`}>
                            <Text style={tw`font-bold ${on ? 'text-[#0B3D2E]' : 'text-[#8A968E]'}`}>{s.title}</Text>
                            <Text style={tw`text-xs text-[#5C6B63] mt-0.5`}>{s.hint}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                {o.items.map((it) => (
                  <Text key={it.id} style={tw`text-gray-700`}>
                    {it.title} × {it.quantity} {it.unitLabel}
                  </Text>
                ))}
                {o.pickupCode ? (
                  <View style={tw`mt-4 bg-[#0B3D2E] rounded-2xl py-4 items-center`}>
                    <Text style={tw`text-[#C4A35A] text-[11px] font-bold tracking-[2px] uppercase`}>{t('cust_pickupCode')}</Text>
                    <Text style={tw`text-white text-4xl font-black tracking-widest mt-1`}>{o.pickupCode}</Text>
                    <Text style={tw`text-[#D5E6DC] text-xs mt-2`}>{t('cust_tellCode')}</Text>
                  </View>
                ) : null}
                {o.status === 'collecting' ? (
                  <Button variant="outline" className="mt-4" onPress={() => void cancel(o.id)}>
                    {t('cust_cancelOrder')}
                  </Button>
                ) : null}
              </View>
            ) : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}
