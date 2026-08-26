import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { errText, useI18n } from '@/src/i18n';
import { Card } from '@/src/components/ui/Base';
import { CategoryGrid } from '@/src/components/catalog/CategoryGrid';
import { CollectionDetail } from '@/src/components/catalog/CollectionDetail';
import { ProductCard } from '@/src/components/catalog/ProductCard';
import { useAuth } from '@/src/context/AuthContext';
import { apiRequest } from '@/src/lib/api';
import { maxOrderQty, tw } from '@/src/lib/utils';
import type { Category, GroupBuy } from '@/src/types';

export function CategoriesScreen() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [items, setItems] = useState<GroupBuy[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [catId, setCatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cols, setCols] = useState(2);

  const load = useCallback(async (silent = false) => {
    if (!token) return;
    try {
      const [d, c] = await Promise.all([
        apiRequest<{ items: GroupBuy[] }>('/api/group-buys?status=open', { token, silent }),
        apiRequest<{ items: Category[] }>('/api/categories', { token, silent }),
      ]);
      setItems(d.items || []);
      setCats(c.items || []);
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

  const selectedCat = cats.find((c) => c.id === catId) ?? null;
  const selected = items.find((g) => g.id === openId) ?? null;
  const visible = useMemo(
    () => (catId ? items.filter((g) => g.categoryId === catId) : []),
    [items, catId],
  );

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

  if (selectedCat) {
    return (
      <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-6`}>
        <Pressable onPress={() => setCatId(null)} style={tw`flex-row items-center gap-1 mb-3 self-start py-1`}>
          <ChevronLeft size={20} color="#0B3D2E" />
          <Text style={tw`font-bold text-[#0B3D2E]`}>{t('common_back')}</Text>
        </Pressable>
        <Text style={tw`text-2xl font-extrabold text-[#14221B] mb-1`}>{selectedCat.name}</Text>
        <Text style={tw`text-[#5C6B63] mb-4`}>{t('cust_itemsCount', { n: visible.length })}</Text>
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

  return (
    <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-6`}>
      <Text style={tw`text-2xl font-extrabold text-[#14221B] mb-1`}>{t('cust_catsTitle')}</Text>
      <Text style={tw`text-[#5C6B63] mb-4`}>{t('cust_catsHint')}</Text>
      {error ? <Text style={tw`text-red-600 mb-3`}>{error}</Text> : null}
      {cats.length === 0 ? (
        <Card>
          <Text style={tw`font-bold text-[#14221B]`}>{t('cust_noCats')}</Text>
          <Text style={tw`text-[#5C6B63] mt-1`}>{t('cust_noCatsHint')}</Text>
        </Card>
      ) : (
        <CategoryGrid categories={cats} showAll={false} title="" onSelect={setCatId} />
      )}
    </ScrollView>
  );
}
