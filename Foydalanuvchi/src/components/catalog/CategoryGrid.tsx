import { Pressable, Text, View } from 'react-native';
import {
  Apple,
  Beef,
  Coffee,
  Cookie,
  Droplets,
  Fish,
  LayoutGrid,
  Milk,
  Package,
  Snowflake,
  Wheat,
  type LucideIcon,
} from 'lucide-react-native';
import { useI18n } from '@/src/i18n';
import { cardShadowStyle, tw } from '@/src/lib/utils';
import type { Category } from '@/src/types';

const ICONS: LucideIcon[] = [Apple, Milk, Wheat, Coffee, Cookie, Droplets, Beef, Fish, Snowflake, Package];
const PALETTE = [
  { bg: '#FFF3E0', accent: '#E07A3D' },
  { bg: '#F3E8FF', accent: '#7C5CBF' },
  { bg: '#E8F6EE', accent: '#1B7A4A' },
  { bg: '#E8F1FF', accent: '#2F6FED' },
  { bg: '#FFE8EF', accent: '#C44569' },
  { bg: '#FFF8DC', accent: '#C4A35A' },
];

function tone(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 997;
  return { Icon: ICONS[h % ICONS.length], color: PALETTE[h % PALETTE.length] };
}

export function CategoryGrid({
  categories,
  selectedId,
  onSelect,
  showAll = true,
  title,
}: {
  categories: Category[];
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
  showAll?: boolean;
  title?: string;
}) {
  const { t } = useI18n();
  if (categories.length === 0) return null;

  const tiles: { id: string | null; name: string }[] = [
    ...(showAll ? [{ id: null as string | null, name: t('common_all') }] : []),
    ...categories.map((c) => ({ id: c.id as string | null, name: c.name })),
  ];

  return (
    <View style={tw`mb-4`}>
      {title !== '' ? (
        <Text style={tw`text-sm font-extrabold text-[#14221B] mb-2`}>{title ?? t('cust_catsTitle')}</Text>
      ) : null}
      <View style={tw`flex-row flex-wrap -mx-1`}>
        {tiles.map((c) => {
          const on = selectedId != null && selectedId === c.id;
          const { Icon, color } = c.id ? tone(c.id) : { Icon: LayoutGrid, color: { bg: '#E8F6EE', accent: '#0B3D2E' } };
          return (
            <View key={c.id ?? 'all'} style={{ width: '33.333%', paddingHorizontal: 4, marginBottom: 8 }}>
              <Pressable
                onPress={() => onSelect(c.id)}
                style={[
                  tw`bg-white rounded-2xl px-2 pt-3 pb-2.5 border items-center min-h-[108px]`,
                  { borderColor: on ? '#0B3D2E' : '#E8DFD0', backgroundColor: on ? '#F3FBF6' : '#fff' },
                  cardShadowStyle(),
                ]}
              >
                <View
                  style={[
                    tw`w-12 h-12 rounded-2xl items-center justify-center mb-2`,
                    { backgroundColor: color.bg },
                  ]}
                >
                  <Icon size={24} color={color.accent} />
                </View>
                <Text
                  style={tw`text-[11px] font-bold text-center ${on ? 'text-[#0B3D2E]' : 'text-[#14221B]'}`}
                  numberOfLines={2}
                >
                  {c.name}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
