import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, CheckCircle2, Clock, Sparkles, TrendingUp, Users } from 'lucide-react-native';
import { useI18n } from '@/src/i18n';
import { Button } from '@/src/components/ui/Base';
import { QtyInput } from '@/src/components/ui/QtyInput';
import { formatCurrency, maxOrderQty, tw } from '@/src/lib/utils';
import type { GroupBuy } from '@/src/types';
import { ImageSlider, absMedia, photosOf } from './ImageSlider';

export function CollectionDetail({
  item,
  busy,
  onBack,
  onAdd,
}: {
  item: GroupBuy;
  busy?: boolean;
  onBack: () => void;
  onAdd: (qty: number) => void;
}) {
  const { t } = useI18n();
  const maxQty = maxOrderQty(item.stock, item.currentVolume);
  const [qty, setQty] = useState(maxQty < 1 ? 0 : 1);
  const pct = Math.min(100, Math.round((item.currentVolume / Math.max(1, item.minVolume)) * 100));
  const urls = photosOf(item);

  const totalPrice = qty * item.unitPriceUzs;

  return (
    <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-10`} showsVerticalScrollIndicator={false}>
      {/* Back Button */}
      <Pressable
        onPress={onBack}
        style={tw`flex-row items-center gap-2 mb-3.5 self-start px-3 py-2 rounded-2xl bg-white border border-[#E8DFD0] shadow-sm active:scale-95 transition-transform`}
      >
        <ArrowLeft size={16} color="#0B3D2E" />
        <Text style={tw`font-extrabold text-xs text-[#0B3D2E]`}>{t('common_back')}</Text>
      </Pressable>

      <View
        style={[
          tw`bg-white rounded-3xl overflow-hidden border border-[#E8DFD0] shadow-lg`,
          {
            boxShadow: '0 12px 36px -6px rgba(11,61,46,0.08), 0 4px 12px -2px rgba(11,61,46,0.04)',
          } as any,
        ]}
      >
        <ImageSlider urls={urls} height={300} unitLabel={item.unitLabel} />

        <View style={tw`p-5 sm:p-6`}>
          {/* Category / Combo Tag */}
          <View style={tw`flex-row items-center gap-2 mb-1.5`}>
            {item.kind === 'combo' ? (
              <View style={tw`px-3 py-1 rounded-full bg-[#051b14] border border-[#d4af37]/40 flex-row items-center gap-1.5`}>
                <Sparkles size={11} color="#d4af37" />
                <Text style={tw`text-[10.5px] font-black uppercase tracking-wider text-[#d4af37]`}>
                  {t('cust_combo')} {item.categoryName ? `• ${item.categoryName}` : ''}
                </Text>
              </View>
            ) : item.categoryName ? (
              <View style={tw`px-3 py-1 rounded-full bg-[#fbf8f2] border border-[#e8dfd0]`}>
                <Text style={tw`text-[10.5px] font-extrabold uppercase tracking-wider text-[#0b3d2e]`}>
                  {item.categoryName}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={tw`text-2xl sm:text-3xl font-black text-[#0f1c16] tracking-tight leading-tight`}>
            {item.title}
          </Text>

          {item.description ? (
            <Text style={tw`text-[#54665d] text-sm mt-2.5 leading-6 font-medium`}>{item.description}</Text>
          ) : null}

          {/* Combo items list */}
          {item.kind === 'combo' && item.items && item.items.length > 0 ? (
            <View style={tw`mt-4 rounded-2xl bg-[#fbf8f2] border border-[#e8dfd0] p-4`}>
              <Text style={tw`text-[11px] uppercase tracking-wider text-[#8c9c93] font-black mb-3`}>
                {t('cust_comboIncludes')}
              </Text>
              {item.items.map((it) => {
                const img = absMedia(it.photoUrl);
                const short = it.stock < it.quantity;
                return (
                  <View key={it.productId} style={tw`flex-row items-center gap-3 mb-2.5 last:mb-0`}>
                    {img ? (
                      <Image source={{ uri: img }} style={tw`w-12 h-12 rounded-xl bg-white border border-[#e8dfd0]`} resizeMode="cover" />
                    ) : (
                      <View style={tw`w-12 h-12 rounded-xl bg-white border border-[#e8dfd0] items-center justify-center`}>
                        <Text style={tw`text-[10px] font-bold text-[#8c9c93]`} numberOfLines={1}>
                          {it.unitLabel}
                        </Text>
                      </View>
                    )}
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-sm font-extrabold text-[#0f1c16]`}>{it.name}</Text>
                      <Text style={tw`text-xs text-[#54665d]`}>
                        {t('cust_comboNeed', { n: it.quantity, unit: it.unitLabel })}
                        {' · '}
                        {t('cust_comboHave', { n: it.stock, unit: it.unitLabel })}
                      </Text>
                      {short ? (
                        <Text style={tw`text-xs font-bold text-red-600 mt-0.5`}>
                          {t('cust_comboShort', { have: it.stock, need: it.quantity })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* Key Metrics Chips */}
          <View style={tw`grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5`}>
            <InfoChip label={t('cust_price')} value={formatCurrency(item.unitPriceUzs)} highlight />
            <InfoChip label={t('cust_unit')} value={item.unitLabel} />
            <InfoChip label={t('cust_inStockLabel')} value={`${maxQty} dona`} />
            <InfoChip label={t('cust_goal')} value={`${item.minVolume} ${item.unitLabel}`} />
          </View>

          {/* Progress Tracker Card */}
          <View style={tw`mt-5 p-4 rounded-2xl bg-[#f1fbf5] border border-[#daf3e5]`}>
            <View style={tw`flex-row items-center justify-between mb-2`}>
              <View style={tw`flex-row items-center gap-1.5`}>
                <Users size={15} color="#1b7a4a" />
                <Text style={tw`text-xs font-black text-[#0b3d2e] uppercase tracking-wide`}>
                  Yig'uv Jarayoni
                </Text>
              </View>
              <Text style={tw`text-sm font-black text-[#1b7a4a]`}>{pct}% to'ldi</Text>
            </View>

            <View style={tw`h-3 bg-white rounded-full overflow-hidden border border-[#daf3e5]`}>
              <View
                style={[
                  tw`h-3 rounded-full`,
                  {
                    width: `${pct}%` as `${number}%`,
                    background: 'linear-gradient(90deg, #1b7a4a 0%, #2ebb6c 100%)',
                  } as any,
                ]}
              />
            </View>

            <Text style={tw`text-xs text-[#54665d] font-semibold mt-2.5 leading-5`}>
              {t('cust_gathered', { cur: item.currentVolume, unit: item.unitLabel, min: item.minVolume })}
            </Text>
          </View>

          {/* Quantity Selector Section */}
          <View style={tw`mt-6 pt-5 border-t border-[#e8dfd0]`}>
            <View style={tw`flex-row justify-between items-center mb-2`}>
              <Text style={tw`text-sm font-extrabold text-[#0f1c16]`}>{t('cust_qty')}</Text>
              {maxQty > 0 ? (
                <Text style={tw`text-xs font-bold text-[#1b7a4a]`}>
                  Maksimum: {maxQty} {item.unitLabel}
                </Text>
              ) : null}
            </View>

            <View style={tw`mb-4`}>
              {maxQty < 1 ? (
                <View style={tw`p-3.5 bg-red-50 border border-red-200 rounded-2xl`}>
                  <Text style={tw`text-xs font-bold text-red-700 text-center`}>
                    {item.kind === 'combo' ? t('cust_qtyFullCombo') : t('cust_qtyFull')}
                  </Text>
                </View>
              ) : (
                <QtyInput value={qty} min={1} max={maxQty} onChange={setQty} />
              )}
            </View>

            {/* Total summary & Action */}
            {maxQty >= 1 && qty > 0 ? (
              <View style={tw`flex-row items-center justify-between p-3.5 bg-[#fbf8f2] rounded-2xl border border-[#e8dfd0] mb-4`}>
                <Text style={tw`text-xs font-bold text-[#54665d]`}>Jami hisoblangan narx:</Text>
                <Text style={tw`text-base font-black text-[#0b3d2e]`}>
                  {formatCurrency(totalPrice)}
                </Text>
              </View>
            ) : null}

            <Button
              disabled={busy || maxQty < 1}
              onPress={() => onAdd(Math.min(qty, maxQty))}
              className="w-full shadow-lg"
            >
              {busy ? t('common_adding') : `${t('cust_addCart')} • ${formatCurrency(totalPrice || item.unitPriceUzs)}`}
            </Button>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function InfoChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View
      style={[
        tw`px-3.5 py-2.5 rounded-2xl border`,
        highlight
          ? tw`bg-[#f1fbf5] border-[#daf3e5]`
          : tw`bg-[#fbf8f2] border-[#e8dfd0]`,
      ]}
    >
      <Text style={tw`text-[10px] uppercase tracking-wider text-[#8c9c93] font-bold`}>{label}</Text>
      <Text
        style={[
          tw`text-sm font-black mt-0.5`,
          highlight ? tw`text-[#1b7a4a]` : tw`text-[#0b3d2e]`,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
