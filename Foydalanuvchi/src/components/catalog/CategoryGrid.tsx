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
      {title ? (
        <Text style={tw`text-base font-black text-[#0f1c16] mb-3`}>{title}</Text>
      ) : null}
      <View style={tw`flex-row flex-wrap -mx-1.5`}>
        {tiles.map((c) => {
          const on = selectedId != null && selectedId === c.id;
          const { Icon, color } = c.id ? tone(c.id) : { Icon: LayoutGrid, color: { bg: '#E8F6EE', accent: '#0B3D2E' } };
          return (
            <View key={c.id ?? 'all'} style={{ width: '33.333%', paddingHorizontal: 6, marginBottom: 12 }}>
              <Pressable
                onPress={() => onSelect(c.id)}
                style={[
                  tw`bg-white rounded-3xl p-3.5 border items-center min-h-[114px] justify-center transition-all shadow-sm active:scale-95`,
                  {
                    borderColor: on ? '#0b3d2e' : '#e8dfd0',
                    backgroundColor: on ? '#f1fbf5' : '#ffffff',
                    boxShadow: '0 4px 16px -2px rgba(11,61,46,0.05)',
                  } as any,
                  cardShadowStyle(),
                ]}
              >
                <View
                  style={[
                    tw`w-12 h-12 rounded-2xl items-center justify-center mb-2.5 border border-black/5 shadow-sm`,
                    { backgroundColor: color.bg },
                  ]}
                >
                  <Icon size={24} color={color.accent} />
                </View>
                <Text
                  style={[
                    tw`text-xs text-center font-extrabold tracking-tight leading-4`,
                    on ? tw`text-[#0b3d2e]` : tw`text-[#0f1c16]`,
                  ]}
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
