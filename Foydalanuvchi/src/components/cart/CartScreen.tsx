import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { errText, useI18n } from '@/src/i18n';
import { Button, Card } from '@/src/components/ui/Base';
import { HOME_DELIVERY_FEE_UZS } from '@/src/config';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import { formatCurrency, tw } from '@/src/lib/utils';
import type { CartItem, DeliveryMethod } from '@/src/types';

export function CartScreen({ onOrdered }: { onOrdered?: () => void }) {
  const { t } = useI18n();
  const { token } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [method, setMethod] = useState<DeliveryMethod>('pickup_mfy');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    await apiRequest('/api/cart/items', { method: 'PUT', token, body: { groupBuyId: id, quantity } });
    await load();
  };

  const checkout = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest('/api/orders', { method: 'POST', token, body: { deliveryMethod: method }, success: t('cust_ordered') });
      await load();
      onOrdered?.();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const sub = items.reduce((s, i) => s + i.unitPriceUzs * i.quantity, 0);
  const fee = method === 'home_delivery' ? HOME_DELIVERY_FEE_UZS : 0;

  return (
    <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-8`}>
      <Text style={tw`text-2xl font-extrabold text-[#14221B] mb-1`}>{t('cust_cartTitle')}</Text>
      <Text style={tw`text-[#5C6B63] mb-4`}>{t('cust_cartHint')}</Text>
      {error ? <Text style={tw`text-red-600 mb-3`}>{error}</Text> : null}
      {items.length === 0 ? <Text style={tw`text-gray-500`}>{t('cust_cartEmpty')}</Text> : null}
      {items.map((it) => (
        <Card key={it.groupBuyId} style={tw`mb-3`}>
          <Text style={tw`font-bold text-gray-900`}>{it.title}</Text>
          <Text style={tw`text-green-700 mt-1`}>{formatCurrency(it.unitPriceUzs)} / {it.unitLabel}</Text>
          <View style={tw`flex-row items-center mt-3 gap-3`}>
            <Pressable onPress={() => void qty(it.groupBuyId, it.quantity - 1)} style={tw`w-9 h-9 bg-gray-100 rounded-full items-center justify-center`}>
              <Text style={tw`text-lg`}>−</Text>
            </Pressable>
            <Text style={tw`font-semibold`}>{it.quantity}</Text>
            <Pressable onPress={() => void qty(it.groupBuyId, it.quantity + 1)} style={tw`w-9 h-9 bg-gray-100 rounded-full items-center justify-center`}>
              <Text style={tw`text-lg`}>+</Text>
            </Pressable>
          </View>
        </Card>
      ))}
      {items.length > 0 ? (
        <Card>
          <Text style={tw`font-semibold mb-3`}>{t('cust_howGet')}</Text>
          <Pressable
            onPress={() => setMethod('pickup_mfy')}
            style={[tw`py-3 px-3 rounded-xl mb-2`, { backgroundColor: method === 'pickup_mfy' ? '#E3F4EA' : '#F8F4EC' }]}
          >
            <Text style={tw`${method === 'pickup_mfy' ? 'text-[#0B3D2E] font-bold' : 'text-gray-700'}`}>{t('cust_pickupFree')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setMethod('home_delivery')}
            style={[tw`py-3 px-3 rounded-xl`, { backgroundColor: method === 'home_delivery' ? '#E3F4EA' : '#F8F4EC' }]}
          >
            <Text style={tw`${method === 'home_delivery' ? 'text-[#0B3D2E] font-bold' : 'text-gray-700'}`}>
              {t('cust_homeFee', { fee: formatCurrency(HOME_DELIVERY_FEE_UZS) })}
            </Text>
          </Pressable>
          <Text style={tw`mt-3 text-gray-600`}>{t('cust_total', { sum: formatCurrency(sub + fee) })}</Text>
          <Button className="mt-4" disabled={busy} onPress={() => void checkout()}>
            {busy ? t('common_processing') : t('cust_order')}
          </Button>
          <Text style={tw`text-xs text-[#5C6B63] mt-3 leading-5`}>
            {t('cust_orderHint')}
          </Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}
