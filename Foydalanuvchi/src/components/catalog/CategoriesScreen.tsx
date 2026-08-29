import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, ChevronLeft, LayoutGrid, Package } from 'lucide-react-native';
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

  // Faqat kamida bitta ochiq yig'uvga ega bo'lgan kategoriyalarni ko'rsatamiz
  const activeCats = useMemo(() => {
    return cats.filter((cat) =>
      items.some((g) => g.categoryId === cat.id || (g.categoryName && g.categoryName.toLowerCase() === cat.name.toLowerCase())),
    );
  }, [cats, items]);

  const selectedCat = activeCats.find((c) => c.id === catId) ?? null;
  const selected = items.find((g) => g.id === openId) ?? null;
  const visible = useMemo(
    () =>
      catId
        ? items.filter(
            (g) => g.categoryId === catId || (selectedCat && g.categoryName?.toLowerCase() === selectedCat.name.toLowerCase()),
          )
        : [],
    [items, catId, selectedCat],
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
      <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-8`} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => setCatId(null)}
          style={tw`flex-row items-center gap-2 mb-3.5 self-start px-3 py-1.5 rounded-2xl bg-white border border-[#E8DFD0] shadow-sm`}
        >
          <ArrowLeft size={15} color="#0B3D2E" />
          <Text style={tw`font-extrabold text-xs text-[#0B3D2E]`}>{t('common_back')}</Text>
        </Pressable>

        <View style={tw`mb-4`}>
          <Text style={tw`text-2xl sm:text-3xl font-black text-[#0f1c16] tracking-tight`}>{selectedCat.name}</Text>
          <Text style={tw`text-[#54665d] text-xs sm:text-sm mt-0.5`}>
            {t('cust_itemsCount', { n: visible.length })}
          </Text>
        </View>

        {error ? (
          <View style={tw`p-3 bg-red-50 border border-red-200 rounded-2xl mb-4`}>
            <Text style={tw`text-red-700 text-xs font-bold`}>{error}</Text>
          </View>
        ) : null}

        {visible.length === 0 ? (
          <Card className="items-center text-center py-10">
            <Package size={36} color="#8c9c93" />
            <Text style={tw`font-extrabold text-base text-[#0f1c16] mt-3`}>{t('cust_noOpen')}</Text>
            <Text style={tw`text-[#54665d] text-xs mt-1 text-center max-w-[280px]`}>{t('cust_noOpenHint')}</Text>
          </Card>
        ) : (
          <View
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              setCols(w >= 860 ? 3 : 2);
            }}
            style={tw`flex-row flex-wrap -mx-1.5`}
          >
            {visible.map((g) => (
              <View
                key={g.id}
                style={{
                  width: `${100 / cols}%`,
                  maxWidth: `${100 / cols}%`,
                  paddingHorizontal: 6,
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
    <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-8`} showsVerticalScrollIndicator={false}>
      <View style={tw`mb-4`}>
        <Text style={tw`text-2xl sm:text-3xl font-black text-[#0f1c16] tracking-tight`}>{t('cust_catsTitle')}</Text>
        <Text style={tw`text-[#54665d] text-xs sm:text-sm mt-0.5`}>{t('cust_catsHint')}</Text>
      </View>

      {error ? (
        <View style={tw`p-3 bg-red-50 border border-red-200 rounded-2xl mb-4`}>
          <Text style={tw`text-red-700 text-xs font-bold`}>{error}</Text>
        </View>
      ) : null}

      {activeCats.length === 0 ? (
        <Card className="items-center text-center py-12">
          <LayoutGrid size={36} color="#8c9c93" />
          <Text style={tw`font-extrabold text-base text-[#0f1c16] mt-3`}>{t('cust_noCats')}</Text>
          <Text style={tw`text-[#54665d] text-xs mt-1 text-center max-w-[280px]`}>{t('cust_noCatsHint')}</Text>
        </Card>
      ) : (
        <CategoryGrid categories={activeCats} showAll={false} title="" onSelect={setCatId} />
      )}
    </ScrollView>
  );
}
