import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useI18n } from '@/src/i18n';
import { apiOrigin } from '@/src/lib/api';
import { tw } from '@/src/lib/utils';

function absUrl(u: string) {
  if (/^https?:\/\//i.test(u) || u.startsWith('data:')) return u;
  const origin = apiOrigin();
  return `${origin}${u.startsWith('/') ? u : `/${u}`}`;
}

export function photosOf(g: { photoUrls?: string[]; photoUrl?: string | null }) {
  const list = g.photoUrls?.filter(Boolean) ?? [];
  const raw = list.length ? list : g.photoUrl ? [g.photoUrl] : [];
  return raw.map(absUrl);
}

function Pager({
  urls,
  height,
  width,
  index,
  onIndex,
  onPressImage,
  dark,
}: {
  urls: string[];
  height: number;
  width: number;
  index: number;
  onIndex: (i: number) => void;
  onPressImage?: () => void;
  dark?: boolean;
}) {
  const ref = useRef<ScrollView>(null);
  const ready = width >= 8;

  useEffect(() => {
    if (!ready) return;
    ref.current?.scrollTo({ x: index * width, animated: false });
  }, [index, width, ready]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!ready) return;
    onIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  if (!ready) {
    return (
      <Pressable onPress={onPressImage} style={{ width: '100%', height, backgroundColor: dark ? '#0B1F18' : '#F6F1E8' }}>
        <Image source={{ uri: urls[index] || urls[0] }} resizeMode="contain" style={{ width: '100%', height }} />
      </Pressable>
    );
  }

  return (
    <ScrollView
      ref={ref}
      horizontal
      pagingEnabled
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={onScroll}
      onScroll={onScroll}
      scrollEventThrottle={16}
      decelerationRate="fast"
      snapToInterval={width}
      snapToAlignment="start"
      disableIntervalMomentum
      style={{ height, width }}
      contentContainerStyle={
        Platform.OS === 'web'
          ? ({ height, scrollSnapType: 'x mandatory' } as object)
          : { height }
      }
    >
      {urls.map((u, idx) => (
        <Pressable
          key={`${u}-${idx}`}
          onPress={onPressImage}
          style={[
            { width, height, backgroundColor: dark ? '#0B1F18' : '#F6F1E8', alignItems: 'center', justifyContent: 'center' },
            Platform.OS === 'web' ? ({ scrollSnapAlign: 'start', flexShrink: 0 } as object) : null,
          ]}
        >
          <Image source={{ uri: u }} resizeMode="contain" style={{ width, height }} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Nav({
  count,
  index,
  height,
  onGo,
  light,
}: {
  count: number;
  index: number;
  height: number;
  onGo: (n: number) => void;
  light?: boolean;
}) {
  if (count < 2) return null;
  const btnBg = light ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.92)';
  const icon = light ? '#F6F1E8' : '#0B3D2E';
  const active = light ? '#C4A35A' : '#0B3D2E';
  const idle = light ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.9)';

  return (
    <>
      <Pressable
        onPress={() => onGo(index - 1)}
        disabled={index === 0}
        style={{
          position: 'absolute',
          left: 8,
          top: height / 2 - 18,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: btnBg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: index === 0 ? 0.35 : 1,
        }}
      >
        <ChevronLeft size={20} color={icon} />
      </Pressable>
      <Pressable
        onPress={() => onGo(index + 1)}
        disabled={index === count - 1}
        style={{
          position: 'absolute',
          right: 8,
          top: height / 2 - 18,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: btnBg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: index === count - 1 ? 0.35 : 1,
        }}
      >
        <ChevronRight size={20} color={icon} />
      </Pressable>
      <View
        style={{
          position: 'absolute',
          bottom: 12,
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        {Array.from({ length: count }).map((_, idx) => (
          <Pressable
            key={idx}
            onPress={() => onGo(idx)}
            style={{
              width: idx === index ? 16 : 7,
              height: 7,
              borderRadius: 99,
              backgroundColor: idx === index ? active : idle,
            }}
          />
        ))}
      </View>
    </>
  );
}

export function ImageSlider({
  urls,
  height = 220,
  unitLabel,
}: {
  urls: string[];
  height?: number;
  unitLabel?: string;
}) {
  const { t } = useI18n();
  const win = useWindowDimensions();
  const [w, setW] = useState(0);
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);

  const go = (n: number) => {
    const next = Math.max(0, Math.min(urls.length - 1, n));
    setI(next);
  };

  if (!urls.length) {
    return (
      <View style={[tw`items-center justify-center bg-[#E3F4EA]`, { height }]}>
        <Text style={tw`text-[#0B3D2E] font-extrabold`}>{unitLabel || '—'}</Text>
      </View>
    );
  }

  const fullH = win.height;
  const fullW = win.width;

  return (
    <>
      <View
        dataSet={{ slider: 'product' }}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={{ position: 'relative', height, backgroundColor: '#F6F1E8', overflow: 'hidden' }}
      >
        <Pager
          urls={urls}
          height={height}
          width={w}
          index={i}
          onIndex={setI}
          onPressImage={() => setFull(true)}
        />
        <Nav count={urls.length} index={i} height={height} onGo={go} />
      </View>

      <Modal visible={full} transparent animationType="fade" onRequestClose={() => setFull(false)}>
        <View
          dataSet={{ lightbox: 'full' }}
          style={{ flex: 1, backgroundColor: 'rgba(7,38,28,0.96)', width: fullW, height: fullH }}
        >
          <Pressable
            onPress={() => setFull(false)}
            accessibilityLabel={t('common_close')}
            style={{
              position: 'absolute',
              top: Platform.OS === 'web' ? 18 : 48,
              right: 16,
              zIndex: 2,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.14)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={22} color="#F6F1E8" />
          </Pressable>
          <Text style={{ position: 'absolute', top: Platform.OS === 'web' ? 28 : 58, left: 0, right: 0, textAlign: 'center', color: '#F6F1E8', fontWeight: '700', zIndex: 1 }}>
            {i + 1} / {urls.length}
          </Text>
          <View style={{ flex: 1, marginTop: 64, marginBottom: 24, position: 'relative' }}>
            <Pager
              urls={urls}
              height={fullH - 88}
              width={fullW}
              index={i}
              onIndex={setI}
              dark
            />
            <Nav count={urls.length} index={i} height={fullH - 88} onGo={go} light />
          </View>
        </View>
      </Modal>
    </>
  );
}
