import { Pressable, Text, View } from 'react-native';
import { useI18n } from '@/src/i18n';
import { cardShadowStyle, formatCurrency, tw } from '@/src/lib/utils';
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
  const pct = Math.min(100, Math.round((item.currentVolume / Math.max(1, item.minVolume)) * 100));
  const urls = photosOf(item);

  return (
    <View
      style={[
        tw`bg-white rounded-2xl overflow-hidden border border-[#E8DFD0] mb-3`,
        cardShadowStyle(),
      ]}
    >
      <ImageSlider urls={urls} height={compact ? 120 : 156} unitLabel={item.unitLabel} />
      <Pressable onPress={onOpen} style={tw`p-2.5`}>
        {item.categoryName ? (
          <Text style={tw`text-[10px] font-bold uppercase tracking-wide text-[#C4A35A] mb-1`} numberOfLines={1}>
            {item.categoryName}
          </Text>
        ) : null}
        <Text style={tw`text-[13px] font-extrabold text-[#14221B] leading-4`} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={tw`text-[#1B7A4A] font-extrabold text-sm mt-1`} numberOfLines={1}>
          {formatCurrency(item.unitPriceUzs)}
        </Text>
        <Text style={tw`text-[11px] text-[#5C6B63] mt-0.5`} numberOfLines={1}>
          {t('cust_inStock', { n: item.stock })}
        </Text>
        <View style={tw`h-1.5 bg-[#F0E8D8] rounded-full mt-2 overflow-hidden`}>
          <View style={[tw`h-1.5 bg-[#0B3D2E] rounded-full`, { width: `${pct}%` as `${number}%` }]} />
        </View>
        <Text style={tw`text-[11px] text-[#5C6B63] mt-1`} numberOfLines={1}>
          {item.currentVolume}/{item.minVolume} {item.unitLabel}
        </Text>
        <View style={tw`flex-row gap-1.5 mt-2.5`}>
          <Pressable
            onPress={onOpen}
            style={tw`flex-1 min-h-[40px] rounded-xl border border-[#0B3D2E]/20 bg-[#F6F1E8] items-center justify-center px-1`}
          >
            <Text style={tw`text-[12px] font-bold text-[#0B3D2E]`} numberOfLines={1}>
              {t('cust_details')}
            </Text>
          </Pressable>
          <Pressable
            onPress={onAdd}
            disabled={busy}
            style={[
              tw`flex-1 min-h-[40px] rounded-xl bg-[#0B3D2E] items-center justify-center px-1`,
              busy ? tw`opacity-50` : null,
            ]}
          >
            <Text style={tw`text-[12px] font-bold text-white`} numberOfLines={1}>
              {busy ? t('common_adding') : t('cust_addCartShort')}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}
