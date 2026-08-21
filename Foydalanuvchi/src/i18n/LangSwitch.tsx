import { Pressable, Text, View } from 'react-native';
import { LOCALE_META, type Locale } from './core';
import { useI18n } from './LocaleProvider';

export function LangSwitch({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { locale, setLocale } = useI18n();
  const dark = tone === 'dark';
  return (
    <View
      style={{
        flexDirection: 'row',
        flexShrink: 0,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: dark ? 'rgba(255,255,255,0.2)' : '#E8DFD0',
        backgroundColor: dark ? 'rgba(20,92,68,0.8)' : '#fff',
      }}
    >
      {LOCALE_META.map((m) => {
        const on = locale === m.id;
        return (
          <Pressable
            key={m.id}
            onPress={() => setLocale(m.id as Locale)}
            style={{
            paddingHorizontal: 8,
              paddingVertical: 7,
              backgroundColor: on ? (dark ? '#C4A35A' : '#0B3D2E') : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '800',
                color: on ? (dark ? '#0B3D2E' : '#fff') : dark ? '#D5E6DC' : '#5C6B63',
              }}
            >
              {m.short}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
