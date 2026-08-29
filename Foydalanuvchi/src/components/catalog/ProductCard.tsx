import { Pressable, Text, View } from 'react-native';
import { Sparkles, Users } from 'lucide-react-native';
import { useI18n } from '@/src/i18n';
import { cardShadowStyle, formatCurrency, maxOrderQty, tw } from '@/src/lib/utils';
import type { GroupBuy } from '@/src/types';
import { ImageSlider, photosOf } from './ImageSlider';

export function ProductCard({
  item,
  busy,
  compact,
  onAdd,
  onOpen,
}: {
  item: GroupBuy;
  busy?: boolean;
  compact?: boolean;
  onAdd: () => void;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const left = maxOrderQty(item.stock, item.currentVolume);
  const pct = Math.min(100, Math.round((item.currentVolume / Math.max(1, item.minVolume)) * 100));
  const urls = photosOf(item);

  return (
    <View
      style={[
        tw`bg-white rounded-3xl overflow-hidden border border-[#E8DFD0]/90 mb-3.5 transition-all`,
        cardShadowStyle(),
        {
          boxShadow: '0 8px 24px -4px rgba(11,61,46,0.06), 0 2px 6px -1px rgba(11,61,46,0.04)',
        } as any,
      ]}
    >
      <View style={{ position: 'relative' }}>
        <ImageSlider urls={urls} height={compact ? 130 : 168} unitLabel={item.unitLabel} />
        
        {/* Top Badge overlay */}
        <View style={tw`absolute top-2.5 left-2.5 flex-row gap-1.5 z-10`}>
          {item.kind === 'combo' ? (
            <View style={tw`px-2.5 py-1 rounded-full bg-[#051b14]/85 border border-[#d4af37]/40 flex-row items-center gap-1`}>
              <Sparkles size={10} color="#d4af37" />
              <Text style={tw`text-[10px] font-black uppercase tracking-wider text-[#d4af37]`}>
                {t('cust_combo')}
              </Text>
            </View>
          ) : item.categoryName ? (
            <View style={tw`px-2.5 py-1 rounded-full bg-white/90 border border-[#e8dfd0] shadow-sm`}>
              <Text style={tw`text-[10px] font-extrabold uppercase tracking-wider text-[#0b3d2e]`} numberOfLines={1}>
                {item.categoryName}
              </Text>
            </View>
          ) : null}
        </View>

        {pct >= 75 ? (
          <View style={tw`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-amber-500/90 shadow-sm z-10`}>
            <Text style={tw`text-[9px] font-black text-white uppercase tracking-wider`}>🔥 Tez tugaydi</Text>
          </View>
        ) : null}
      </View>

      <Pressable onPress={onOpen} style={tw`p-3.5`}>
        <Text style={tw`text-[14px] font-extrabold text-[#0f1c16] leading-5 tracking-tight`} numberOfLines={2}>
          {item.title}
        </Text>

        {item.kind === 'combo' && item.items && item.items.length > 0 ? (
          <Text style={tw`text-[11px] text-[#54665d] mt-1 line-clamp-1`} numberOfLines={1}>
            {item.items.map((it) => `${it.name} (${it.quantity})`).join(' + ')}
          </Text>
        ) : null}

        {/* Pricing */}
        <View style={tw`flex-row items-baseline justify-between mt-2`}>
          <Text style={tw`text-[#1b7a4a] font-black text-base tracking-tight`} numberOfLines={1}>
            {formatCurrency(item.unitPriceUzs)}
          </Text>
          <Text style={tw`text-[10px] font-bold text-[#8c9c93]`} numberOfLines={1}>
            {t('cust_inStock', { n: left })}
          </Text>
        </View>

        {/* Progress Tracker */}
        <View style={tw`mt-2.5`}>
          <View style={tw`flex-row items-center justify-between text-[11px] mb-1`}>
            <View style={tw`flex-row items-center gap-1`}>
              <Users size={11} color="#1b7a4a" />
              <Text style={tw`text-[11px] font-bold text-[#0b3d2e]`}>
                {item.currentVolume}/{item.minVolume} {item.unitLabel}
              </Text>
            </View>
            <Text style={tw`text-[11px] font-black text-[#1b7a4a]`}>{pct}%</Text>
          </View>

          <View style={tw`h-2 bg-[#f0e8d8] rounded-full overflow-hidden`}>
            <View
              style={[
                tw`h-2 rounded-full`,
                {
                  width: `${pct}%` as `${number}%`,
                  background: 'linear-gradient(90deg, #1b7a4a 0%, #2ebb6c 100%)',
                } as any,
              ]}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={tw`flex-row gap-2 mt-3`}>
          <Pressable
            onPress={onOpen}
            style={tw`flex-1 min-h-[38px] rounded-xl border border-[#0b3d2e]/20 bg-[#fbf8f2] items-center justify-center px-1 active:scale-95 transition-transform`}
          >
            <Text style={tw`text-[11.5px] font-bold text-[#0b3d2e]`} numberOfLines={1}>
              {t('cust_details')}
            </Text>
          </Pressable>
          <Pressable
            onPress={onAdd}
            disabled={busy || left < 1}
            style={[
              tw`flex-1 min-h-[38px] rounded-xl items-center justify-center px-1 shadow-sm active:scale-95 transition-transform`,
              {
                background: left < 1 ? '#9ca3af' : 'linear-gradient(135deg, #0b3d2e 0%, #176348 100%)',
              } as any,
              busy ? tw`opacity-50` : null,
            ]}
          >
            <Text style={tw`text-[11.5px] font-bold text-white`} numberOfLines={1}>
              {busy ? t('common_adding') : t('cust_addCartShort')}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}
