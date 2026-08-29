import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  Home,
  MapPin,
  Plus,
  Radio,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react-native';
import { errText, useI18n } from '@/src/i18n';
import { QtyInput } from '@/src/components/ui/QtyInput';
import { Button } from '@/src/components/ui/Base';
import { LocationPicker } from '@/src/components/map/LocationPicker';
import { HOME_DELIVERY_FEE_UZS, MIN_ORDER_UZS } from '@/src/config';
import { useAuth } from '@/src/context/AuthContext';
import { apiOrigin, apiRequest } from '@/src/lib/api';
import { cardShadowStyle, formatCurrency, maxOrderQty, tw } from '@/src/lib/utils';
import type { CartItem, DeliveryMethod, PaymentProvider } from '@/src/types';

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
  const [payMethod, setPayMethod] = useState<'payme' | 'click' | 'balance' | 'cash'>('cash');
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
      await apiRequest('/api/orders', {
        method: 'POST',
        token,
        body: {
          deliveryMethod: method,
          paymentProvider: payMethod === 'cash' ? 'cash_on_delivery' : payMethod,
        },
        success: t('cust_ordered'),
      });
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
      <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-6`} showsVerticalScrollIndicator={false}>
        {/* Top Header with Back button */}
        {step !== 'cart' ? (
          <View style={tw`flex-row items-center gap-3 mb-4`}>
            <Pressable
              onPress={() => setStep(step === 'payment' ? 'checkout' : 'cart')}
              style={tw`w-10 h-10 rounded-2xl bg-white border border-[#E8DFD0] items-center justify-center active:scale-95 shadow-sm`}
            >
              <ArrowLeft size={18} color="#0B3D2E" />
            </Pressable>
            <Text style={tw`text-xl sm:text-2xl font-black text-[#0f1c16] tracking-tight`}>
              {step === 'payment' ? "Buyurtma to'lovi" : 'Buyurtma berish'}
            </Text>
          </View>
        ) : (
          <View style={tw`mb-4`}>
            <Text style={tw`text-2xl sm:text-3xl font-black text-[#0f1c16] tracking-tight`}>
              {t('cust_tabCart')}
            </Text>
            <Text style={tw`text-[#54665d] text-xs sm:text-sm mt-0.5`}>
              {items.length} ta mahsulot
            </Text>
          </View>
        )}

        {error ? (
          <View style={tw`p-3.5 bg-red-50 border border-red-200 rounded-2xl mb-4`}>
            <Text style={tw`text-red-700 text-xs font-bold`}>{error}</Text>
          </View>
        ) : null}

        {/* ================= STEP 1: CART ================= */}
        {step === 'cart' ? (
          <>
            {items.length === 0 ? (
              <View style={tw`items-center text-center py-14 px-4 bg-white rounded-3xl border border-[#e8dfd0] mt-2`}>
                <ShoppingCart size={42} color="#8c9c93" />
                <Text style={tw`font-extrabold text-base text-[#0f1c16] mt-3`}>{t('cust_cartEmpty')}</Text>
                <Text style={tw`text-[#54665d] text-xs mt-1 text-center max-w-[260px]`}>
                  Savatda hech qanday tovar yo'q. Katalogdan qiziqarli jamoaviy takliflarni toping!
                </Text>
              </View>
            ) : null}

            {items.map((it) => {
              const img = media(it.photoUrl);
              const max = maxOrderQty(it.stock, it.currentVolume);
              return (
                <View
                  key={it.groupBuyId}
                  style={[
                    tw`bg-white rounded-3xl p-4 mb-3.5 border border-[#E8DFD0] flex-row gap-3.5 items-start shadow-sm`,
                    cardShadowStyle(),
                  ]}
                >
                  <View style={tw`w-20 h-20 rounded-2xl bg-[#fbf8f2] border border-[#e8dfd0] overflow-hidden items-center justify-center shrink-0`}>
                    {img ? (
                      <Image source={{ uri: img }} resizeMode="contain" style={{ width: 72, height: 72 }} />
                    ) : (
                      <Text style={tw`text-xs font-bold text-[#8c9c93]`}>{it.unitLabel}</Text>
                    )}
                  </View>

                  <View style={tw`flex-1 min-w-0`}>
                    <Text style={tw`font-extrabold text-sm text-[#0f1c16] leading-4`} numberOfLines={2}>
                      {it.title}
                    </Text>
                    <Text style={tw`text-[#1b7a4a] font-black text-sm mt-1`}>
                      {formatCurrency(it.unitPriceUzs)}
                    </Text>
                    <Text style={tw`text-[11px] text-[#8c9c93] mt-0.5`}>
                      {t('cust_inStock', { n: max })}
                    </Text>

                    <View style={tw`mt-3 flex-row items-center justify-between`}>
                      <QtyInput
                        value={it.quantity}
                        min={0}
                        max={max}
                        onChange={(n) => void qty(it.groupBuyId, n)}
                      />
                      <Text style={tw`text-sm font-black text-[#0b3d2e]`}>
                        {formatCurrency(it.unitPriceUzs * it.quantity)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {belowMin && items.length > 0 ? (
              <View style={tw`p-3.5 bg-amber-50 border border-amber-200 rounded-2xl mb-3`}>
                <Text style={tw`text-amber-900 text-xs font-bold leading-5`}>
                  {t('cust_minOrderNeed', { sum: formatCurrency(MIN_ORDER_UZS), now: formatCurrency(sub) })}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        {/* ================= STEP 2: CHECKOUT (2-rasmdagi dizayn) ================= */}
        {step === 'checkout' ? (
          <>
            {/* Olish usuli Card */}
            <View style={[tw`bg-white rounded-3xl p-5 mb-4 border border-[#e8dfd0] shadow-sm`, cardShadowStyle()]}>
              <Text style={tw`font-black text-base text-[#0f1c16] mb-3`}>Olish usuli</Text>

              {/* Segmented Switcher Tab (Yetkazib berish | Olib ketish) */}
              <View style={tw`flex-row bg-[#f0ece1] p-1 rounded-2xl mb-3 border border-[#e8dfd0]`}>
                <Pressable
                  onPress={() => setMethod('home_delivery')}
                  style={[
                    tw`flex-1 py-3 px-2 rounded-xl items-center justify-center transition-all`,
                    method === 'home_delivery'
                      ? tw`bg-[#0b3d2e] shadow-md`
                      : tw`bg-transparent`,
                  ]}
                >
                  <Text
                    style={[
                      tw`text-sm font-extrabold tracking-tight`,
                      method === 'home_delivery' ? tw`text-white` : tw`text-[#0f1c16]`,
                    ]}
                  >
                    Yetkazib berish
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setMethod('pickup_mfy')}
                  style={[
                    tw`flex-1 py-3 px-2 rounded-xl items-center justify-center transition-all`,
                    method === 'pickup_mfy'
                      ? tw`bg-[#0b3d2e] shadow-md`
                      : tw`bg-transparent`,
                  ]}
                >
                  <Text
                    style={[
                      tw`text-sm font-extrabold tracking-tight`,
                      method === 'pickup_mfy' ? tw`text-white` : tw`text-[#0f1c16]`,
                    ]}
                  >
                    Olib ketish
                  </Text>
                </Pressable>
              </View>

              {/* Oxirgi tanlangan tag */}
              <View style={tw`flex-row justify-end mb-3`}>
                <View style={tw`px-3 py-1 bg-[#0f1c16] rounded-xl`}>
                  <Text style={tw`text-[10.5px] font-bold text-white`}>Oxirgi tanlangan</Text>
                </View>
              </View>

              {/* Address / Pickup point details sub-card */}
              <View style={tw`p-4 bg-[#fbf8f2] rounded-2xl border border-[#e8dfd0] mb-3`}>
                <View style={tw`flex-row items-center gap-3 mb-1.5`}>
                  <View style={tw`w-10 h-10 rounded-2xl bg-[#0b3d2e] items-center justify-center`}>
                    {method === 'home_delivery' ? (
                      <Home size={18} color="#d4af37" />
                    ) : (
                      <MapPin size={18} color="#d4af37" />
                    )}
                  </View>
                  <View style={tw`flex-1`}>
                    <Text style={tw`font-black text-sm text-[#0f1c16]`}>
                      {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Foydalanuvchi'}
                    </Text>
                    <Text style={tw`text-xs text-[#54665d] font-semibold mt-0.5`}>
                      {user?.phoneMasked || user?.phone} • {user?.cityName || 'Andijon'}
                    </Text>
                  </View>
                </View>

                <Text style={tw`text-xs font-bold text-[#0b3d2e] mt-1`}>
                  {method === 'home_delivery'
                    ? user?.deliveryAddress || "Manzil kiritilmagan (Xonadongacha yetkazib berish)"
                    : user?.mfyName ? `${user.mfyName} MFY topshirish punkti (Bepul)` : "Mahalla MFY punkti"}
                </Text>
              </View>

              {/* Boshqa manzilni tanlash button */}
              <Pressable
                onPress={() => setEditAddr((v) => !v)}
                style={tw`py-3 px-4 rounded-2xl bg-[#f0ece1] border border-[#e8dfd0] items-center justify-center active:scale-[0.99]`}
              >
                <Text style={tw`font-extrabold text-xs text-[#0f1c16]`}>Boshqa manzilni tanlash</Text>
              </Pressable>

              {/* Expandable Location / Address Picker */}
              {editAddr ? (
                <View style={tw`mt-4 gap-3 pt-3 border-t border-[#e8dfd0]`}>
                  <LocationPicker
                    lat={lat}
                    lng={lng}
                    address={address}
                    onChange={(v) => {
                      setLat(v.lat);
                      setLng(v.lng);
                      if (v.address) setAddress(v.address);
                    }}
                    onError={setError}
                  />
                  <TextInput
                    value={address}
                    onChangeText={setAddress}
                    placeholder={t('onb_street')}
                    placeholderTextColor="#9AA59D"
                    style={tw`px-4 py-3 bg-[#F8F4EC] rounded-2xl border border-[#E8DFD0] text-[#14221B] text-sm`}
                  />
                  <Button disabled={busy} onPress={() => void saveAddress()}>
                    {busy ? t('common_saving') : t('cust_saveAddress')}
                  </Button>
                </View>
              ) : null}
            </View>

            {/* Yetkazib berish shartlari Card */}
            <View style={[tw`bg-white rounded-3xl p-5 mb-4 border border-[#e8dfd0] shadow-sm`, cardShadowStyle()]}>
              <View style={tw`flex-row items-center gap-3 mb-2.5`}>
                <View style={tw`w-10 h-10 rounded-2xl bg-[#0b3d2e] items-center justify-center`}>
                  <Truck size={18} color="#d4af37" />
                </View>
                <View>
                  <Text style={tw`font-black text-sm text-[#0f1c16]`}>
                    {method === 'pickup_mfy' ? 'Bepul yetkazib berish' : 'Xonadongacha yetkazib berish'}
                  </Text>
                  <Text style={tw`text-[11px] text-[#54665d]`}>Tezkor va ishonchli xizmat</Text>
                </View>
              </View>

              <Text style={tw`text-xs text-[#54665d] leading-5 font-medium`}>
                • Mahalladagi MFY topshirish punktlarigacha yetkazish — <Text style={tw`font-bold text-[#1b7a4a]`}>mutlaqo bepul</Text>.
              </Text>
              {method === 'home_delivery' ? (
                <Text style={tw`text-xs text-[#54665d] leading-5 font-medium mt-1`}>
                  • Kuryer orqali eshikkacha yetkazib berish: <Text style={tw`font-bold text-[#b8913b]`}>+{formatCurrency(HOME_DELIVERY_FEE_UZS)}</Text>.
                </Text>
              ) : null}
            </View>

            {/* Buyurtmadagi tovarlar qisqacha ro'yxati */}
            <View style={[tw`bg-white rounded-3xl p-5 mb-4 border border-[#e8dfd0] shadow-sm`, cardShadowStyle()]}>
              <Text style={tw`font-black text-sm text-[#0f1c16] mb-3`}>Buyurtma tarkibi</Text>
              {items.map((it) => {
                const img = media(it.photoUrl);
                return (
                  <View key={it.groupBuyId} style={tw`flex-row items-center gap-3 py-2.5 border-b border-gray-100 last:border-0`}>
                    <View style={tw`w-14 h-14 rounded-2xl bg-[#fbf8f2] border border-[#e8dfd0] overflow-hidden items-center justify-center shrink-0`}>
                      {img ? (
                        <Image source={{ uri: img }} resizeMode="contain" style={{ width: 48, height: 48 }} />
                      ) : (
                        <Text style={tw`text-[10px] font-bold text-[#8c9c93]`}>{it.unitLabel}</Text>
                      )}
                    </View>
                    <View style={tw`flex-1 min-w-0`}>
                      <Text style={tw`font-bold text-xs text-[#0f1c16]`} numberOfLines={1}>
                        {it.title}
                      </Text>
                      <Text style={tw`text-xs font-black text-[#1b7a4a] mt-0.5`}>
                        {formatCurrency(it.unitPriceUzs)}
                      </Text>
                    </View>
                    <Text style={tw`text-xs font-bold text-[#54665d]`}>
                      {it.quantity} dona
                    </Text>
                  </View>
                );
              })}

              <View style={tw`mt-3 pt-3 border-t border-[#e8dfd0] flex-row justify-between items-center`}>
                <Text style={tw`text-xs font-bold text-[#54665d]`}>Ichki yetkazib berish</Text>
                <Text style={tw`text-xs font-extrabold text-[#0f1c16]`}>
                  {method === 'home_delivery' ? formatCurrency(HOME_DELIVERY_FEE_UZS) : 'Bepul'}
                </Text>
              </View>
            </View>
          </>
        ) : null}

        {/* ================= STEP 3: PAYMENT (3-rasmdagi dizayn) ================= */}
        {step === 'payment' ? (
          <>
            {/* Top Luxury Dark Amount Card */}
            <View
              style={[
                tw`rounded-3xl p-6 mb-5 items-center border border-[#d4af37]/30 shadow-xl overflow-hidden`,
                {
                  background: 'linear-gradient(145deg, #051b14 0%, #0b3d2e 55%, #12543e 100%)',
                } as any,
              ]}
            >
              {/* Wallet Icon with Golden Glow */}
              <View style={tw`w-14 h-14 rounded-2xl bg-[#d4af37]/20 border border-[#d4af37]/40 items-center justify-center mb-3 shadow-inner`}>
                <Wallet size={26} color="#d4af37" />
              </View>

              <Text style={tw`text-[#daf3e5] text-xs font-extrabold uppercase tracking-wider`}>
                To'lov summasi:
              </Text>
              <Text style={tw`text-3xl sm:text-4xl font-black text-[#d4af37] mt-1 tracking-tight`}>
                {formatCurrency(total)}
              </Text>

              {/* Status Pill */}
              <View style={tw`mt-4 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 flex-row items-center gap-1.5`}>
                <ShieldCheck size={14} color="#52d68e" />
                <Text style={tw`text-[#daf3e5] text-xs font-bold`}>
                  Xavfsiz va kafolatlangan to'lov
                </Text>
              </View>
            </View>

            <Text style={tw`font-black text-base text-[#0f1c16] mb-3`}>To'lov usuli</Text>

            {/* Option 1: Payme Card (Disabled - Tez kunda) */}
            <View
              style={[
                tw`bg-white rounded-3xl p-4 mb-3 border border-[#e8dfd0] opacity-70 shadow-sm`,
                cardShadowStyle(),
              ]}
            >
              <View style={tw`flex-row items-center justify-between mb-3`}>
                <View style={tw`flex-row items-center gap-3`}>
                  <View style={tw`px-3 py-1 rounded-xl bg-[#00cccc]/15 border border-[#00cccc]/30`}>
                    <Text style={tw`text-xs font-black text-[#008b8b] tracking-wider`}>Payme</Text>
                  </View>
                  <Text style={tw`font-black text-sm text-[#0f1c16]`}>Payme</Text>
                </View>

                {/* Tez kunda badge */}
                <View style={tw`px-3 py-1 rounded-full bg-[#fdfaf3] border border-[#e8dfd0]`}>
                  <Text style={tw`text-[10.5px] font-black text-[#b8913b] uppercase tracking-wider`}>
                    Tez kunda
                  </Text>
                </View>
              </View>

              {/* Uzcard & Humo Sub-card */}
              <View style={tw`p-3 bg-[#f6f8f7] rounded-2xl border border-[#e8dfd0] flex-row items-center gap-4`}>
                <View style={tw`flex-row items-center gap-2`}>
                  <View style={tw`w-6 h-6 rounded-lg bg-[#0052cc] items-center justify-center`}>
                    <Text style={tw`text-[9px] font-black text-white`}>Uz</Text>
                  </View>
                  <Text style={tw`text-xs font-extrabold text-[#0f1c16]`}>Uzcard</Text>
                </View>

                <View style={tw`h-4 w-[1px] bg-gray-300`} />

                <View style={tw`flex-row items-center gap-2`}>
                  <View style={tw`w-6 h-6 rounded-lg bg-[#b8913b] items-center justify-center`}>
                    <Text style={tw`text-[9px] font-black text-white`}>H</Text>
                  </View>
                  <Text style={tw`text-xs font-extrabold text-[#0f1c16]`}>Humo</Text>
                </View>
              </View>
            </View>

            {/* Option 2: Balans / Qabul qilganda to'lash (Active Default) */}
            <Pressable
              onPress={() => setPayMethod('cash')}
              style={[
                tw`bg-white rounded-3xl p-4 mb-3 border-2 transition-all shadow-sm active:scale-[0.99]`,
                payMethod === 'cash'
                  ? tw`border-[#0b3d2e] bg-white`
                  : tw`border-[#e8dfd0]`,
                cardShadowStyle(),
              ]}
            >
              <View style={tw`flex-row items-center justify-between mb-3`}>
                <View style={tw`flex-row items-center gap-3`}>
                  <View style={tw`w-9 h-9 rounded-2xl bg-[#0b3d2e] items-center justify-center`}>
                    <Wallet size={18} color="#d4af37" />
                  </View>
                  <Text style={tw`font-black text-sm text-[#0f1c16]`}>
                    Balans orqali to'lash / Qabul qilganda
                  </Text>
                </View>

                <View
                  style={[
                    tw`w-6 h-6 rounded-full border-2 items-center justify-center`,
                    payMethod === 'cash' ? tw`border-[#0b3d2e]` : tw`border-[#8c9c93]`,
                  ]}
                >
                  {payMethod === 'cash' ? <View style={tw`w-3 h-3 rounded-full bg-[#0b3d2e]`} /> : null}
                </View>
              </View>

              {/* Sub-container */}
              <View style={tw`p-3 bg-[#f6f8f7] rounded-2xl border border-[#e8dfd0]`}>
                <View style={tw`flex-row justify-between items-center mb-2`}>
                  <Text style={tw`text-xs text-[#54665d] font-semibold`}>Mavjud balans</Text>
                  <Text style={tw`text-xs font-black text-[#0f1c16]`}>0 so'm</Text>
                </View>
                <View style={tw`py-2 rounded-xl bg-[#ede6da] items-center justify-center flex-row gap-1.5 border border-[#e8dfd0]`}>
                  <Plus size={13} color="#0f1c16" />
                  <Text style={tw`text-xs font-extrabold text-[#0f1c16]`}>Balans to'ldirish</Text>
                </View>
              </View>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      {/* ================= STICKY BOTTOM BAR ================= */}
      {items.length > 0 ? (
        <View
          style={[
            tw`pt-3.5 pb-3 px-4 border-t border-[#E8DFD0] flex-row items-center justify-between gap-3 shadow-2xl`,
            step === 'payment'
              ? { background: 'linear-gradient(180deg, #0b3d2e 0%, #051b14 100%)' } as any
              : tw`bg-white rounded-t-3xl`,
          ]}
        >
          <View style={tw`min-w-0 flex-1 pl-1`}>
            <View style={tw`flex-row items-center gap-1.5`}>
              {step === 'payment' ? <CreditCard size={14} color="#d4af37" /> : null}
              <Text
                style={[
                  tw`text-[11px] font-bold uppercase tracking-wider`,
                  step === 'payment' ? tw`text-[#daf3e5]` : tw`text-[#8c9c93]`,
                ]}
              >
                To'lovga:
              </Text>
            </View>
            <Text
              style={[
                tw`text-lg sm:text-xl font-black tracking-tight mt-0.5`,
                step === 'payment' ? tw`text-[#d4af37]` : tw`text-[#0b3d2e]`,
              ]}
              numberOfLines={1}
            >
              {formatCurrency(total)}
            </Text>
          </View>

          {step === 'payment' ? (
            <Pressable
              disabled={busy || belowMin}
              onPress={() => void checkout()}
              style={[
                tw`px-6 py-3.5 rounded-2xl items-center justify-center shadow-lg active:scale-95 transition-all`,
                {
                  background: 'linear-gradient(135deg, #f5d77f 0%, #d4af37 100%)',
                } as any,
              ]}
            >
              <Text style={tw`text-[#051b14] font-black text-sm tracking-tight`}>
                {busy ? t('common_processing') : "To'lovni tasdiqlash"}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              disabled={belowMin}
              onPress={goNext}
              style={[
                tw`px-6 py-3.5 rounded-2xl items-center justify-center shadow-lg active:scale-95 transition-all bg-[#0b3d2e]`,
              ]}
            >
              <Text style={tw`text-white font-black text-sm tracking-tight`}>
                {step === 'cart' ? 'Buyurtma berish' : 'Buyurtma berish'}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}
