import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { errText, useI18n } from '@/src/i18n';
import { Card } from '@/src/components/ui/Base';
import { CollectionDetail } from '@/src/components/catalog/CollectionDetail';
import { ProductCard } from '@/src/components/catalog/ProductCard';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import { maxOrderQty, tw } from '@/src/lib/utils';
import type { GroupBuy } from '@/src/types';

export function CatalogScreen() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [items, setItems] = useState<GroupBuy[]>([]);
  const [query, setQuery] = useState('');
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
    const item = items.find((g) => g.id === id);
    const max = maxOrderQty(item?.stock ?? 0, item?.currentVolume ?? 0);
    if (max < 1) {
      setError(t('cust_qtyFull'));
      return;
    }
    const q = Math.min(max, Math.max(1, quantity));
    setBusyId(id);
    try {
      await apiRequest('/api/cart/items', {
        method: 'PUT',
        token,
        body: { groupBuyId: id, quantity: q, add: true },
        success: t('cust_added'),
      });
      await load();
      setError(null);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusyId(null);
    }
  };

  const selected = items.find((g) => g.id === openId) ?? null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((g) => g.title.toLowerCase().includes(q) || (g.categoryName || '').toLowerCase().includes(q));
  }, [items, query]);

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
    <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-6`} keyboardShouldPersistTaps="handled">
      <Text style={tw`text-2xl font-extrabold text-[#14221B] mb-1`}>{t('cust_openTitle')}</Text>
      <Text style={tw`text-[#5C6B63] mb-3`}>{t('cust_openHint')}</Text>
      <View style={tw`flex-row items-center px-3 mb-4 bg-white border border-[#E8DFD0] rounded-2xl min-h-[48px]`}>
        <Search size={18} color="#8A968E" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('cust_searchPh')}
          placeholderTextColor="#9AA59D"
          style={tw`flex-1 px-2 py-2 text-base text-[#14221B]`}
        />
      </View>
      {error ? <Text style={tw`text-red-600 mb-3`}>{error}</Text> : null}
      {visible.length === 0 ? (
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
          {visible.map((g) => (
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
