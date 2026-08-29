import { useCallback, useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  QrCode,
  Sparkles,
  Truck,
  X,
  XCircle,
} from 'lucide-react-native';
import { errText, useI18n } from '@/src/i18n';
import { Button, Card } from '@/src/components/ui/Base';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import { cardShadowStyle, formatCurrency, tw } from '@/src/lib/utils';
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
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  const STEPS = [
    { id: 'collecting', title: t('cust_step1t'), hint: t('cust_step1d'), icon: Clock },
    { id: 'awaiting_courier', title: t('cust_step2t'), hint: t('cust_step2d'), icon: Package },
    { id: 'with_courier', title: t('cust_step3t'), hint: t('cust_step3d'), icon: Truck },
    { id: 'issued', title: t('cust_step4t'), hint: t('cust_step4d'), icon: CheckCircle2 },
  ];

  const chip = (status: string) => {
    const idx = stepIndex(status);
    if (status === 'cancelled') return { label: t('cust_chipCancel'), bg: '#fef2f2', fg: '#dc2626', border: '#fecaca' };
    if (idx === 0) return { label: t('cust_chipCollecting'), bg: '#f1fbf5', fg: '#0b3d2e', border: '#daf3e5' };
    if (idx === 1) return { label: t('cust_chipWait'), bg: '#fdfaf3', fg: '#b8913b', border: '#faf3e0' };
    if (idx === 2) return { label: t('cust_chipHand'), bg: '#f1fbf5', fg: '#1b7a4a', border: '#52d68e' };
    return { label: t('cust_chipIssued'), bg: '#f3f4f6', fg: '#4b5563', border: '#e5e7eb' };
  };

  const load = useCallback(async (silent = false) => {
    if (!token) return;
    const d = await apiRequest<{ items: Order[] }>('/api/orders', { token, silent });
    const list = d.items || [];
    setItems(list);
    // Modalda ochiq buyurtma bo'lsa ma'lumotini yangilash
    setSelectedOrder((prev) => (prev ? list.find((o) => o.id === prev.id) || null : null));
  }, [token]);

  useEffect(() => {
    void load().catch((e) => setError(errText(e)));
    const timer = setInterval(() => void load(true), 12000);
    return () => clearInterval(timer);
  }, [load]);

  const cancel = async (id: string) => {
    if (!token) return;
    try {
      await apiRequest(`/api/orders/${id}/cancel`, { method: 'POST', token, body: {}, success: t('cust_cancelledOk') });
      await load();
      setSelectedOrder(null);
    } catch (e) {
      setError(errText(e));
    }
  };

  const modalStepIdx = selectedOrder ? stepIndex(selectedOrder.status) : 0;
  const modalChip = selectedOrder ? chip(selectedOrder.status) : null;

  return (
    <View style={tw`flex-1`}>
      <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-10`} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={tw`mb-4`}>
          <Text style={tw`text-2xl sm:text-3xl font-black text-[#0f1c16] tracking-tight`}>{t('cust_myOrders')}</Text>
          <Text style={tw`text-[#54665d] text-xs sm:text-sm mt-0.5`}>{t('cust_ordersHint')}</Text>
        </View>

        {error ? (
          <View style={tw`p-3 bg-red-50 border border-red-200 rounded-2xl mb-4`}>
            <Text style={tw`text-red-700 text-xs font-bold`}>{error}</Text>
          </View>
        ) : null}

        {items.length === 0 ? (
          <Card className="items-center text-center py-12">
            <Package size={36} color="#8c9c93" />
            <Text style={tw`font-extrabold text-base text-[#0f1c16] mt-3`}>{t('cust_noOrders')}</Text>
            <Text style={tw`text-[#54665d] text-xs mt-1 text-center max-w-[280px]`}>
              Sizda hali faol buyurtmalar mavjud emas. Katalogdan tovar tanlang va jamoaga qo'shiling!
            </Text>
          </Card>
        ) : null}

        {/* Alohida alohida Cardlar */}
        {items.map((o) => {
          const idx = stepIndex(o.status);
          const c = chip(o.status);
          return (
            <Pressable
              key={o.id}
              onPress={() => setSelectedOrder(o)}
              style={[
                tw`bg-white rounded-3xl border border-[#E8DFD0] mb-3.5 p-4 sm:p-5 transition-all shadow-sm active:scale-[0.99]`,
                {
                  boxShadow: '0 8px 24px -4px rgba(11,61,46,0.06), 0 2px 6px -1px rgba(11,61,46,0.03)',
                } as any,
                cardShadowStyle(),
              ]}
            >
              {/* Yuqori qism: Sarlavha & Status */}
              <View style={tw`flex-row justify-between items-start gap-2.5`}>
                <View style={tw`flex-1`}>
                  <Text style={tw`font-black text-base text-[#0f1c16] leading-5`} numberOfLines={2}>
                    {o.items.map((it) => it.title).join(', ') || t('cust_orderWord')}
                  </Text>
                  <View style={tw`flex-row items-center gap-2 mt-1.5`}>
                    <Text style={tw`text-sm font-black text-[#1b7a4a]`}>
                      {formatCurrency(o.totalUzs)}
                    </Text>
                    <Text style={tw`text-xs text-[#8c9c93]`}>•</Text>
                    <Text style={tw`text-xs font-semibold text-[#54665d]`}>
                      {o.deliveryMethod === 'home_delivery' ? t('cust_homeShort') : t('cust_mfyShort')}
                    </Text>
                  </View>
                </View>

                <View style={[tw`px-3 py-1 rounded-full border shrink-0`, { backgroundColor: c.bg, borderColor: c.border }]}>
                  <Text style={{ color: c.fg, fontSize: 11, fontWeight: '800' }}>{c.label}</Text>
                </View>
              </View>

              {/* Status bosqichi */}
              {o.status !== 'cancelled' && idx >= 0 ? (
                <View style={tw`flex-row items-center gap-1.5 mt-3 pt-2.5 border-t border-[#f0e8d8]`}>
                  <View style={tw`w-2 h-2 rounded-full bg-[#1b7a4a]`} />
                  <Text style={tw`text-xs font-bold text-[#0b3d2e]`}>{STEPS[idx]?.title}</Text>
                </View>
              ) : null}

              {/* Topshirish kodi & Batafsil ko'rish tugmasi */}
              <View style={tw`mt-3 flex-row items-center justify-between`}>
                {o.pickupCode ? (
                  <View style={tw`flex-row items-center gap-1.5 px-3 py-1.5 bg-[#f1fbf5] rounded-xl border border-[#daf3e5]`}>
                    <Text style={tw`text-[11px] font-bold text-[#0b3d2e] uppercase`}>Topshirish kodi:</Text>
                    <Text style={tw`font-black text-[#0b3d2e] text-base tracking-widest`}>{o.pickupCode}</Text>
                  </View>
                ) : (
                  <View />
                )}

                <View style={tw`flex-row items-center gap-1 px-3 py-1.5 rounded-xl bg-[#fbf8f2] border border-[#e8dfd0]`}>
                  <Text style={tw`text-xs font-extrabold text-[#0b3d2e]`}>Batafsil</Text>
                  <ArrowRight size={13} color="#0b3d2e" />
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Buyurtma Tafsilotlari MODAL oynasi */}
      <Modal
        visible={Boolean(selectedOrder)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedOrder(null)}
      >
        <Pressable
          onPress={() => setSelectedOrder(null)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(5, 27, 20, 0.65)',
            backdropFilter: 'blur(8px)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          } as any}
        >
          {selectedOrder && modalChip ? (
            <Pressable
              onPress={() => undefined}
              style={[
                tw`bg-white rounded-3xl overflow-hidden w-full border border-[#e8dfd0] shadow-2xl`,
                { maxHeight: '88%', maxWidth: 540 },
              ]}
            >
              {/* Modal Header */}
              <View style={tw`px-5 py-4 bg-[#fbf8f2] border-b border-[#e8dfd0] flex-row items-center justify-between`}>
                <View style={tw`flex-1 pr-2`}>
                  <View style={tw`flex-row items-center gap-2`}>
                    <Text style={tw`text-base sm:text-lg font-black text-[#0f1c16]`}>
                      Buyurtma Tafsilotlari
                    </Text>
                    <View style={[tw`px-2.5 py-0.5 rounded-full border`, { backgroundColor: modalChip.bg, borderColor: modalChip.border }]}>
                      <Text style={{ color: modalChip.fg, fontSize: 10.5, fontWeight: '800' }}>{modalChip.label}</Text>
                    </View>
                  </View>
                  <Text style={tw`text-xs text-[#54665d] mt-0.5`}>
                    {formatCurrency(selectedOrder.totalUzs)} • {selectedOrder.deliveryMethod === 'home_delivery' ? t('cust_homeShort') : t('cust_mfyShort')}
                  </Text>
                </View>

                <Pressable
                  onPress={() => setSelectedOrder(null)}
                  style={tw`w-9 h-9 rounded-2xl bg-white border border-[#e8dfd0] items-center justify-center active:scale-95 shadow-sm`}
                >
                  <X size={18} color="#0f1c16" />
                </Pressable>
              </View>

              {/* Modal Body */}
              <ScrollView style={tw`p-5`} contentContainerStyle={tw`pb-4`}>
                {selectedOrder.status === 'cancelled' ? (
                  <View style={tw`p-3.5 bg-red-50 border border-red-200 rounded-2xl mb-4 flex-row items-center gap-2.5`}>
                    <XCircle size={20} color="#dc2626" />
                    <Text style={tw`text-red-700 text-xs font-extrabold`}>{t('cust_cancelled')}</Text>
                  </View>
                ) : (
                  /* Vertical Step Timeline */
                  <View style={tw`mb-4 p-4 rounded-2xl bg-[#fbf8f2] border border-[#e8dfd0]`}>
                    <Text style={tw`text-[11px] font-black text-[#8c9c93] uppercase tracking-wider mb-3.5`}>
                      Yetkazib berish bosqichlari
                    </Text>
                    {STEPS.map((s, i) => {
                      const done = modalStepIdx > i || (modalStepIdx === i && selectedOrder.status === 'issued');
                      const current = modalStepIdx === i && selectedOrder.status !== 'issued';
                      const lastIssued = selectedOrder.status === 'issued' && i === 3;
                      const on = done || current || lastIssued;
                      const StepIcon = s.icon;

                      return (
                        <View key={s.id} style={tw`flex-row mb-3 last:mb-0`}>
                          <View style={tw`items-center mr-3`}>
                            <View
                              style={[
                                tw`w-7 h-7 rounded-full items-center justify-center border-2`,
                                on
                                  ? tw`bg-[#0b3d2e] border-[#07261c]`
                                  : tw`bg-white border-[#e8dfd0]`,
                              ]}
                            >
                              <StepIcon size={12} color={on ? '#ffffff' : '#8c9c93'} />
                            </View>
                            {i < STEPS.length - 1 ? (
                              <View
                                style={{
                                  width: 2,
                                  flex: 1,
                                  minHeight: 22,
                                  backgroundColor: modalStepIdx > i ? '#0b3d2e' : '#e8dfd0',
                                }}
                              />
                            ) : null}
                          </View>
                          <View style={tw`flex-1 pb-1`}>
                            <Text style={tw`font-extrabold text-xs ${on ? 'text-[#0b3d2e]' : 'text-[#8c9c93]'}`}>
                              {s.title}
                            </Text>
                            <Text style={tw`text-[11px] text-[#54665d] mt-0.5 leading-4`}>{s.hint}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Buyurtma tarkibi */}
                <View style={tw`mb-4 p-4 bg-white rounded-2xl border border-[#e8dfd0]`}>
                  <Text style={tw`text-[11px] font-black text-[#8c9c93] uppercase tracking-wider mb-2.5`}>
                    Buyurtma tarkibi
                  </Text>
                  {selectedOrder.items.map((it) => (
                    <View key={it.id} style={tw`flex-row justify-between items-center py-2 border-b border-gray-100 last:border-0`}>
                      <View style={tw`flex-1 mr-2`}>
                        <Text style={tw`text-xs font-bold text-[#0f1c16]`} numberOfLines={2}>
                          {it.title}
                        </Text>
                        <Text style={tw`text-[11px] text-[#1b7a4a] font-extrabold mt-0.5`}>
                          {formatCurrency(it.unitPriceUzs)}
                        </Text>
                      </View>
                      <Text style={tw`text-xs font-extrabold text-[#0b3d2e]`}>
                        {it.quantity} {it.unitLabel}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Topshirish Kodi */}
                {selectedOrder.pickupCode ? (
                  <View
                    style={[
                      tw`rounded-3xl p-5 items-center border border-[#d4af37]/30 shadow-lg mb-4`,
                      {
                        background: 'linear-gradient(135deg, #051b14 0%, #0b3d2e 60%, #12543e 100%)',
                      } as any,
                    ]}
                  >
                    <View style={tw`flex-row items-center gap-1.5 mb-1`}>
                      <QrCode size={14} color="#d4af37" />
                      <Text style={tw`text-[#d4af37] text-[11px] font-black tracking-[2px] uppercase`}>
                        {t('cust_pickupCode')}
                      </Text>
                    </View>
                    <Text style={tw`text-white text-4xl sm:text-5xl font-black tracking-widest my-1`}>
                      {selectedOrder.pickupCode}
                    </Text>
                    <Text style={tw`text-[#daf3e5] text-xs text-center font-medium mt-1`}>
                      {t('cust_tellCode')}
                    </Text>
                  </View>
                ) : null}

                {/* Bekor qilish */}
                {selectedOrder.status === 'collecting' ? (
                  <Button
                    variant="outline"
                    className="w-full border-red-200 text-red-600 mb-2"
                    onPress={() => void cancel(selectedOrder.id)}
                  >
                    {t('cust_cancelOrder')}
                  </Button>
                ) : null}
              </ScrollView>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
