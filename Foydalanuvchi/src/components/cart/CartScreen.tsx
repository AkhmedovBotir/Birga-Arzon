import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ChevronLeft, CreditCard, MapPin, Truck, Wallet } from 'lucide-react-native';
import { errText, useI18n } from '@/src/i18n';
import { QtyInput } from '@/src/components/ui/QtyInput';
import { Button } from '@/src/components/ui/Base';
import { HOME_DELIVERY_FEE_UZS, MIN_ORDER_UZS } from '@/src/config';
import { useAuth } from '@/src/context/AuthContext';
import { apiOrigin, apiRequest } from '@/src/lib/api';
import { cardShadowStyle, formatCurrency, maxOrderQty, tw } from '@/src/lib/utils';
import type { CartItem, DeliveryMethod } from '@/src/types';

type Step = 'cart' | 'checkout' | 'payment';

function media(url?: string | null) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const origin = apiOrigin();
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
}

export function CartScreen({ onOrdered }: { onOrdered?: () => void }) {
  const { t } = useI18n();
  const { token, user, updateProfile } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [method, setMethod] = useState<DeliveryMethod>(user?.deliveryLat ? 'home_delivery' : 'pickup_mfy');
  const [step, setStep] = useState<Step>('cart');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editAddr, setEditAddr] = useState(false);
  const [address, setAddress] = useState(user?.deliveryAddress || '');
  const [lat, setLat] = useState(user?.deliveryLat?.toString() || '');
  const [lng, setLng] = useState(user?.deliveryLng?.toString() || '');

  const load = useCallback(async () => {
    if (!token) return;
    const d = await apiRequest<{ items: CartItem[] }>('/api/cart', { token });
    setItems(d.items || []);
  }, [token]);

  useEffect(() => {
    void load().catch((e) => setError(errText(e)));
  }, [load]);

  const qty = async (id: string, quantity: number) => {
    if (!token) return;
    const it = items.find((x) => x.groupBuyId === id);
    const max = maxOrderQty(it?.stock ?? 0, it?.currentVolume ?? 0);
    const n = Math.min(max, Math.max(0, quantity));
    try {
      await apiRequest('/api/cart/items', { method: 'PUT', token, body: { groupBuyId: id, quantity: n } });
      await load();
      setError(null);
    } catch (e) {
      setError(errText(e));
    }
  };

  const geo = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError(t('onb_geoNone'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setEditAddr(true);
      },
      () => setError(t('onb_geoDenied'))
    );
  };

  const saveAddress = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateProfile({
        deliveryAddress: address || null,
        deliveryLat: lat ? Number(lat) : null,
        deliveryLng: lng ? Number(lng) : null,
      });
      setEditAddr(false);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const checkout = async () => {
    if (!token) return;
    if (method === 'home_delivery' && (!user?.deliveryLat || !user?.deliveryLng)) {
      setError(t('cust_needLocation'));
      setEditAddr(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiRequest('/api/orders', { method: 'POST', token, body: { deliveryMethod: method }, success: t('cust_ordered') });
      await load();
      setStep('cart');
      onOrdered?.();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const sub = items.reduce((s, i) => s + i.unitPriceUzs * i.quantity, 0);
  const fee = method === 'home_delivery' ? HOME_DELIVERY_FEE_UZS : 0;
  const total = sub + fee;
  const belowMin = sub < MIN_ORDER_UZS;
  const locLine = [user?.cityName, user?.deliveryAddress].filter(Boolean).join(' · ') || t('cust_noAddress');
  const title =
    step === 'payment' ? t('cust_paymentTitle') : step === 'checkout' ? t('cust_checkoutTitle') : t('cust_cartTitle');

  const goNext = () => {
    setError(null);
    if (belowMin) {
      setError(t('cust_minOrderNeed', { sum: formatCurrency(MIN_ORDER_UZS), now: formatCurrency(sub) }));
      return;
    }
    if (step === 'cart') setStep('checkout');
    else if (step === 'checkout') {
      if (method === 'home_delivery' && (!user?.deliveryLat || !user?.deliveryLng)) {
        setError(t('cust_needLocation'));
        setEditAddr(true);
        return;
      }
      setStep('payment');
    }
  };

  return (
    <View style={tw`flex-1`}>
      <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-4`}>
        {step !== 'cart' ? (
          <Pressable onPress={() => setStep(step === 'payment' ? 'checkout' : 'cart')} style={tw`flex-row items-center gap-1 mb-2 self-start py-1`}>
            <ChevronLeft size={20} color="#0B3D2E" />
            <Text style={tw`font-bold text-[#0B3D2E]`}>{t('common_back')}</Text>
          </Pressable>
        ) : null}
        <Text style={tw`text-2xl font-extrabold text-[#14221B] mb-1`}>{title}</Text>
        {step === 'cart' ? <Text style={tw`text-[#5C6B63] mb-3`}>{t('cust_cartHint')}</Text> : null}
        {error ? <Text style={tw`text-red-600 mb-3`}>{error}</Text> : null}

        {step === 'cart' ? (
          <>
            {items.length === 0 ? <Text style={tw`text-gray-500`}>{t('cust_cartEmpty')}</Text> : null}
            {items.map((it) => {
              const img = media(it.photoUrl);
              return (
                <View
                  key={it.groupBuyId}
                  style={[tw`bg-white rounded-2xl p-3 mb-3 border border-[#E8DFD0] flex-row gap-3`, cardShadowStyle()]}
                >
                  <View style={tw`w-16 h-16 rounded-xl bg-[#F6F1E8] overflow-hidden items-center justify-center`}>
                    {img ? (
                      <Image source={{ uri: img }} resizeMode="contain" style={{ width: 64, height: 64 }} />
                    ) : (
                      <Text style={tw`text-[10px] text-[#8A968E]`}>{it.unitLabel}</Text>
                    )}
                  </View>
                  <View style={tw`flex-1 min-w-0`}>
                    <Text style={tw`font-bold text-[#14221B]`} numberOfLines={2}>
                      {it.title}
                    </Text>
                    <Text style={tw`text-[#1B7A4A] font-extrabold mt-0.5`}>
                      {formatCurrency(it.unitPriceUzs)}
                    </Text>
                    <Text style={tw`text-xs text-[#5C6B63] mt-0.5`}>
                      {t('cust_inStock', { n: it.stock })}
                    </Text>
                    <View style={tw`mt-2`}>
                      <QtyInput
                        value={it.quantity}
                        min={0}
                        max={maxOrderQty(it.stock, it.currentVolume)}
                        onChange={(n) => void qty(it.groupBuyId, n)}
                      />
                    </View>
                    <Text style={tw`text-xs text-[#5C6B63] mt-1`}>{t('cust_qtyHint')}</Text>
                    <Text style={tw`text-xs text-[#5C6B63]`}>
                      {t('cust_qtyMax', { n: maxOrderQty(it.stock, it.currentVolume) })}
                    </Text>
                  </View>
                </View>
              );
            })}
            {belowMin && items.length > 0 ? (
              <Text style={tw`text-amber-800 mb-2 text-sm`}>
                {t('cust_minOrderNeed', { sum: formatCurrency(MIN_ORDER_UZS), now: formatCurrency(sub) })}
              </Text>
            ) : null}
          </>
        ) : null}

        {step === 'checkout' ? (
          <>
            <Text style={tw`font-extrabold text-[#14221B] mb-2`}>{t('cust_howGet')}</Text>
            <View style={tw`flex-row gap-2 mb-4`}>
              <Pressable
                onPress={() => setMethod('home_delivery')}
                style={[
                  tw`flex-1 py-3 px-2 rounded-2xl items-center border`,
                  {
                    backgroundColor: method === 'home_delivery' ? '#0B3D2E' : '#fff',
                    borderColor: method === 'home_delivery' ? '#0B3D2E' : '#E8DFD0',
                  },
                ]}
              >
                <Truck size={18} color={method === 'home_delivery' ? '#C4A35A' : '#5C6B63'} />
                <Text
                  style={tw`mt-1 text-center text-[12px] font-bold ${method === 'home_delivery' ? 'text-[#C4A35A]' : 'text-[#14221B]'}`}
                >
                  {t('cust_delivery')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMethod('pickup_mfy')}
                style={[
                  tw`flex-1 py-3 px-2 rounded-2xl items-center border`,
                  {
                    backgroundColor: method === 'pickup_mfy' ? '#0B3D2E' : '#fff',
                    borderColor: method === 'pickup_mfy' ? '#0B3D2E' : '#E8DFD0',
                  },
                ]}
              >
                <MapPin size={18} color={method === 'pickup_mfy' ? '#C4A35A' : '#5C6B63'} />
                <Text
                  style={tw`mt-1 text-center text-[12px] font-bold ${method === 'pickup_mfy' ? 'text-[#C4A35A]' : 'text-[#14221B]'}`}
                >
                  {t('cust_pickup')}
                </Text>
              </Pressable>
            </View>

            <View style={[tw`bg-white rounded-2xl p-4 mb-3 border border-[#E8DFD0]`, cardShadowStyle()]}>
              <Text style={tw`text-[11px] font-bold uppercase tracking-wide text-[#C4A35A] mb-2`}>
                {t('cust_addressTitle')}
              </Text>
              <Text style={tw`font-extrabold text-[#14221B]`}>
                {[user?.firstName, user?.lastName].filter(Boolean).join(' ')}
              </Text>
              <Text style={tw`text-[#5C6B63] mt-0.5`}>{user?.phoneMasked || user?.phone}</Text>
              <Text style={tw`text-[#14221B] mt-1`}>{locLine}</Text>
              {method === 'home_delivery' ? (
                <Text style={tw`text-xs text-[#5C6B63] mt-1`}>{t('cust_homeFee', { fee: formatCurrency(HOME_DELIVERY_FEE_UZS) })}</Text>
              ) : (
                <Text style={tw`text-xs text-[#5C6B63] mt-1`}>{t('cust_pickupFree')}</Text>
              )}
              <Pressable
                onPress={() => setEditAddr((v) => !v)}
                style={tw`mt-3 py-3 rounded-xl bg-[#F6F1E8] items-center`}
              >
                <Text style={tw`font-bold text-[#0B3D2E]`}>{t('cust_changeAddress')}</Text>
              </Pressable>
              {editAddr ? (
                <View style={tw`mt-3 gap-2`}>
                  <TextInput
                    value={address}
                    onChangeText={setAddress}
                    placeholder={t('onb_street')}
                    placeholderTextColor="#9AA59D"
                    style={tw`px-3 py-3 bg-[#F8F4EC] rounded-xl border border-[#E8DFD0] text-[#14221B]`}
                  />
                  <Pressable onPress={geo} style={tw`py-2 flex-row items-center gap-2`}>
                    <MapPin size={16} color="#0B3D2E" />
                    <Text style={tw`text-[#0B3D2E] font-semibold`}>{t('onb_geoBtn')}</Text>
                  </Pressable>
                  {lat && lng ? <Text style={tw`text-xs text-[#5C6B63]`}>{t('onb_point', { lat, lng })}</Text> : null}
                  <Button disabled={busy} onPress={() => void saveAddress()}>
                    {busy ? t('common_saving') : t('cust_saveAddress')}
                  </Button>
                </View>
              ) : null}
            </View>

            {items.map((it) => (
              <View key={it.groupBuyId} style={tw`flex-row justify-between py-2 border-b border-[#F0E8D8]`}>
                <Text style={tw`flex-1 pr-2 text-[#14221B]`} numberOfLines={2}>
                  {it.title} · {it.quantity} {it.unitLabel}
                </Text>
                <Text style={tw`font-bold text-[#0B3D2E]`}>{formatCurrency(it.unitPriceUzs * it.quantity)}</Text>
              </View>
            ))}
          </>
        ) : null}

        {step === 'payment' ? (
          <>
            <View style={[tw`rounded-3xl p-5 mb-4 items-center`, { backgroundColor: '#0B3D2E' }]}>
              <Wallet size={28} color="#C4A35A" />
              <Text style={tw`text-[#9BB5A8] mt-3`}>{t('cust_paymentAmount')}</Text>
              <Text style={tw`text-2xl font-extrabold text-[#C4A35A] mt-1`}>{formatCurrency(total)}</Text>
            </View>

            <Text style={tw`font-extrabold text-[#14221B] mb-2`}>{t('cust_payMethod')}</Text>

            <View style={[tw`bg-white rounded-2xl p-4 mb-3 border border-[#E8DFD0] opacity-60`, cardShadowStyle()]}>
              <View style={tw`flex-row items-center justify-between`}>
                <View style={tw`flex-row items-center gap-3 flex-1 pr-2`}>
                  <CreditCard size={22} color="#8A968E" />
                  <View style={tw`flex-1`}>
                    <Text style={tw`font-bold text-[#14221B]`}>{t('cust_payCard')}</Text>
                    <Text style={tw`text-xs text-[#5C6B63] mt-0.5`}>{t('cust_payCardHint')}</Text>
                  </View>
                </View>
                <View style={tw`px-2 py-1 rounded-full bg-[#F6F1E8]`}>
                  <Text style={tw`text-[10px] font-extrabold text-[#C4A35A] uppercase`}>{t('cust_paySoon')}</Text>
                </View>
              </View>
            </View>

            <View style={[tw`bg-white rounded-2xl p-4 mb-3 border-2 border-[#0B3D2E]`, cardShadowStyle()]}>
              <View style={tw`flex-row items-center justify-between`}>
                <View style={tw`flex-row items-center gap-3 flex-1 pr-2`}>
                  <Wallet size={22} color="#0B3D2E" />
                  <View style={tw`flex-1`}>
                    <Text style={tw`font-bold text-[#14221B]`}>{t('cust_payManual')}</Text>
                    <Text style={tw`text-xs text-[#5C6B63] mt-0.5`}>{t('cust_payManualHint')}</Text>
                  </View>
                </View>
                <View style={tw`w-5 h-5 rounded-full border-2 border-[#0B3D2E] items-center justify-center`}>
                  <View style={tw`w-2.5 h-2.5 rounded-full bg-[#0B3D2E]`} />
                </View>
              </View>
            </View>
            <Text style={tw`text-xs text-[#5C6B63] leading-5`}>{t('cust_orderHint')}</Text>
          </>
        ) : null}
      </ScrollView>

      {items.length > 0 ? (
        <View style={[tw`pt-3 pb-1 border-t border-[#E8DFD0] bg-[#F6F1E8] flex-row items-center gap-3`]}>
          <View style={tw`flex-1 min-w-0`}>
            <Text style={tw`text-[11px] text-[#5C6B63]`}>{t('cust_toPay')}</Text>
            <Text style={tw`text-base font-extrabold text-[#0B3D2E]`} numberOfLines={1}>
              {formatCurrency(total)}
            </Text>
          </View>
          {step === 'payment' ? (
            <Button disabled={busy || belowMin} onPress={() => void checkout()} style={tw`flex-1 max-w-[210px]`}>
              {busy ? t('common_processing') : t('cust_confirmPay')}
            </Button>
          ) : (
            <Button disabled={belowMin} onPress={goNext} style={tw`flex-1 max-w-[210px]`}>
              {step === 'cart' ? t('cust_continueApp') : t('common_continue')}
            </Button>
          )}
        </View>
      ) : null}
    </View>
  );
}
