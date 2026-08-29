import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Search, Sparkles, TrendingUp, X } from 'lucide-react-native';
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
  const [selectedCat, setSelectedCat] = useState<string>('all');
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

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.categoryName) set.add(it.categoryName);
    });
    return Array.from(set);
  }, [items]);

  const selected = items.find((g) => g.id === openId) ?? null;

  const visible = useMemo(() => {
    let list = items;
    if (selectedCat !== 'all') {
      list = list.filter((g) => g.categoryName === selectedCat);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((g) => g.title.toLowerCase().includes(q) || (g.categoryName || '').toLowerCase().includes(q));
  }, [items, query, selectedCat]);

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
    <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-8`} keyboardShouldPersistTaps="handled">
      {/* Search Bar */}
      <View style={tw`flex-row items-center px-3.5 mb-3.5 bg-white border border-[#E8DFD0] rounded-2xl min-h-[48px] shadow-sm`}>
        <Search size={18} color="#8A968E" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('cust_searchPh')}
          placeholderTextColor="#9AA59D"
          style={tw`flex-1 px-2.5 py-2.5 text-sm sm:text-base text-[#0f1c16]`}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} style={tw`p-1`}>
            <X size={16} color="#8A968E" />
          </Pressable>
        ) : null}
      </View>

      {/* Category Pills */}
      {categories.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={tw`gap-2 pb-1 mb-4`}
        >
          <Pressable
            onPress={() => setSelectedCat('all')}
            style={[
              tw`px-3.5 py-1.5 rounded-full border text-xs font-bold transition-all`,
              selectedCat === 'all'
                ? tw`bg-[#0b3d2e] border-[#07261c] shadow-sm`
                : tw`bg-white border-[#e8dfd0]`,
            ]}
          >
            <Text
              style={[
                tw`text-xs font-bold`,
                selectedCat === 'all' ? tw`text-white` : tw`text-[#54665d]`,
              ]}
            >
              Barchasi ({items.length})
            </Text>
          </Pressable>
          {categories.map((cat) => {
            const active = selectedCat === cat;
            const count = items.filter((it) => it.categoryName === cat).length;
            return (
              <Pressable
                key={cat}
                onPress={() => setSelectedCat(cat)}
                style={[
                  tw`px-3.5 py-1.5 rounded-full border text-xs font-bold transition-all`,
                  active
                    ? tw`bg-[#0b3d2e] border-[#07261c] shadow-sm`
                    : tw`bg-white border-[#e8dfd0]`,
                ]}
              >
                <Text
                  style={[
                    tw`text-xs font-bold`,
                    active ? tw`text-white` : tw`text-[#54665d]`,
                  ]}
                >
                  {cat} ({count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {error ? (
        <View style={tw`p-3 bg-red-50 border border-red-200 rounded-2xl mb-4`}>
          <Text style={tw`text-red-700 text-xs font-bold`}>{error}</Text>
        </View>
      ) : null}

      {visible.length === 0 ? (
        <Card className="items-center text-center py-8">
          <Text style={tw`font-extrabold text-base text-[#0f1c16]`}>{t('cust_noOpen')}</Text>
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
