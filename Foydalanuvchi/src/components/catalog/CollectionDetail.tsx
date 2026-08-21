import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useI18n } from '@/src/i18n';
import { Button } from '@/src/components/ui/Base';
import { formatCurrency, tw } from '@/src/lib/utils';
import type { GroupBuy } from '@/src/types';
import { ImageSlider, photosOf } from './ImageSlider';

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
  const [qty, setQty] = useState(1);
  const pct = Math.min(100, Math.round((item.currentVolume / Math.max(1, item.minVolume)) * 100));
  const urls = photosOf(item);

  return (
    <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-8`}>
      <Pressable onPress={onBack} style={tw`flex-row items-center gap-1 mb-3 self-start py-1`}>
        <ChevronLeft size={20} color="#0B3D2E" />
        <Text style={tw`font-bold text-[#0B3D2E]`}>{t('common_back')}</Text>
      </Pressable>

      <View style={tw`bg-white rounded-3xl overflow-hidden border border-[#E8DFD0]`}>
        <ImageSlider urls={urls} height={280} unitLabel={item.unitLabel} />
        <View style={tw`p-5`}>
          <Text style={tw`text-[11px] font-bold uppercase tracking-[1.5px] text-[#C4A35A]`}>
            {t('cust_detailHint')}
          </Text>
          <Text style={tw`text-2xl font-extrabold text-[#14221B] mt-1`}>{item.title}</Text>
          {item.description ? (
            <Text style={tw`text-[#5C6B63] mt-2 leading-6`}>{item.description}</Text>
          ) : null}

          <View style={tw`flex-row flex-wrap gap-2 mt-4`}>
            <InfoChip label={t('cust_price')} value={`${formatCurrency(item.unitPriceUzs)} / ${item.unitLabel}`} />
            <InfoChip label={t('cust_unit')} value={item.unitLabel} />
            <InfoChip label={t('cust_goal')} value={`${item.minVolume} ${item.unitLabel}`} />
          </View>

          <Text style={tw`text-sm font-bold text-[#14221B] mt-5 mb-2`}>{t('cust_now')}</Text>
          <View style={tw`h-2.5 bg-[#F0E8D8] rounded-full overflow-hidden`}>
            <View style={[tw`h-2.5 bg-[#0B3D2E] rounded-full`, { width: `${pct}%` as `${number}%` }]} />
          </View>
          <Text style={tw`text-sm text-[#5C6B63] mt-2`}>
            {t('cust_gathered', { cur: item.currentVolume, unit: item.unitLabel, min: item.minVolume })}
          </Text>

          <Text style={tw`text-sm font-bold text-[#14221B] mt-5 mb-2`}>{t('cust_qty')}</Text>
          <View style={tw`flex-row items-center gap-3 mb-4`}>
            <Pressable
              onPress={() => setQty((n) => Math.max(1, n - 1))}
              style={tw`w-11 h-11 rounded-xl bg-[#F6F1E8] items-center justify-center`}
            >
              <Text style={tw`text-xl font-bold text-[#0B3D2E]`}>−</Text>
            </Pressable>
            <Text style={tw`text-lg font-extrabold w-10 text-center`}>{qty}</Text>
            <Pressable
              onPress={() => setQty((n) => n + 1)}
              style={tw`w-11 h-11 rounded-xl bg-[#F6F1E8] items-center justify-center`}
            >
              <Text style={tw`text-xl font-bold text-[#0B3D2E]`}>+</Text>
            </Pressable>
            <Text style={tw`text-[#5C6B63]`}>{item.unitLabel}</Text>
          </View>

          <Button disabled={busy} onPress={() => onAdd(qty)}>
            {busy ? t('common_adding') : t('cust_addCart')}
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={tw`px-3 py-2 rounded-xl bg-[#F6F1E8] border border-[#E8DFD0]`}>
      <Text style={tw`text-[10px] uppercase tracking-wide text-[#8A968E] font-bold`}>{label}</Text>
      <Text style={tw`text-sm font-extrabold text-[#0B3D2E] mt-0.5`}>{value}</Text>
    </View>
  );
}
