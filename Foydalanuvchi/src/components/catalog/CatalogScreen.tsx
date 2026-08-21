import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { errText, useI18n } from '@/src/i18n';
import { Card } from '@/src/components/ui/Base';
import { CollectionDetail } from '@/src/components/catalog/CollectionDetail';
import { ProductCard } from '@/src/components/catalog/ProductCard';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import { tw } from '@/src/lib/utils';
import type { GroupBuy } from '@/src/types';

export function CatalogScreen({ onAdded }: { onAdded?: () => void }) {
  const { t } = useI18n();
  const { token } = useAuth();
  const [items, setItems] = useState<GroupBuy[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cols, setCols] = useState(2);

  const load = useCallback(async (silent = false) => {
    if (!token) return;
    try {
      const d = await apiRequest<{ items: GroupBuy[] }>('/api/group-buys?status=open', { token, silent });
      setItems(d.items || []);
      setError(null);
    } catch (e) {
      if (!silent) setError(errText(e));
    }
  }, [token]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(true), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const add = async (id: string, quantity = 1) => {
    if (!token) return;
    setBusyId(id);
    try {
      await apiRequest('/api/cart/items', {
        method: 'PUT',
        token,
        body: { groupBuyId: id, quantity },
        success: t('cust_added'),
      });
      onAdded?.();
      await load();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusyId(null);
    }
  };

  const selected = items.find((g) => g.id === openId) ?? null;

  if (selected) {
    return (
      <CollectionDetail
        item={selected}
        busy={busyId === selected.id}
        onBack={() => setOpenId(null)}
        onAdd={(qty) => void add(selected.id, qty)}
      />
    );
  }

  return (
    <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-6`}>
      <Text style={tw`text-2xl font-extrabold text-[#14221B] mb-1`}>{t('cust_openTitle')}</Text>
      <Text style={tw`text-[#5C6B63] mb-4`}>{t('cust_openHint')}</Text>
      {error ? <Text style={tw`text-red-600 mb-3`}>{error}</Text> : null}
      {items.length === 0 ? (
        <Card>
          <Text style={tw`font-bold text-[#14221B]`}>{t('cust_noOpen')}</Text>
          <Text style={tw`text-[#5C6B63] mt-1`}>{t('cust_noOpenHint')}</Text>
        </Card>
      ) : (
        <View
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            setCols(w >= 860 ? 3 : 2);
          }}
          style={tw`flex-row flex-wrap -mx-1`}
        >
          {items.map((g) => (
            <View
              key={g.id}
              style={{
                width: `${100 / cols}%`,
                maxWidth: `${100 / cols}%`,
                paddingHorizontal: 4,
              }}
            >
              <ProductCard
                item={g}
                compact={cols === 3}
                busy={busyId === g.id}
                onOpen={() => setOpenId(g.id)}
                onAdd={() => void add(g.id, 1)}
              />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
