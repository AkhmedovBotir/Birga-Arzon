import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useI18n } from '@/src/i18n';
import { reverseGeocode, searchPlaces } from '@/src/lib/geocode';
import { tw } from '@/src/lib/utils';

const UZ_CENTER: L.LatLngExpression = [41.3111, 69.2797];

function pinIcon() {
  return L.divIcon({
    className: 'bx-map-pin',
    html: '<span class="bx-map-pin-dot"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

type Props = {
  lat: string;
  lng: string;
  address: string;
  onChange: (v: { lat: string; lng: string; address?: string }) => void;
  onError?: (msg: string) => void;
};

export function LocationPicker({ lat, lng, address, onChange, onError }: Props) {
  const { t } = useI18n();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const onErrorRef = useRef(onError);
  const tRef = useRef(t);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<{ lat: number; lng: number; label: string }[]>([]);
  const [looking, setLooking] = useState(false);
  const [place, setPlace] = useState(address);

  onChangeRef.current = onChange;
  onErrorRef.current = onError;
  tRef.current = t;

  const latN = Number(lat);
  const lngN = Number(lng);
  const hasPoint = lat !== '' && lng !== '' && Number.isFinite(latN) && Number.isFinite(lngN);

  useEffect(() => {
    setPlace(address);
  }, [address]);

  useEffect(() => {
    if (!hasPoint || address.trim()) return;
    void reverseGeocode(latN, lngN).then((label) => {
      if (!label) return;
      setPlace(label);
      onChangeRef.current({ lat: latN.toFixed(6), lng: lngN.toFixed(6), address: label });
    }).catch(() => undefined);
    // one-time lookup for old coordinates without a street name
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPoint = async (clat: number, clng: number, geocode: boolean, label?: string) => {
    const next = { lat: clat.toFixed(6), lng: clng.toFixed(6) };
    const map = mapRef.current;
    if (map) {
      if (markerRef.current) markerRef.current.setLatLng([clat, clng]);
      else markerRef.current = L.marker([clat, clng], { icon: pinIcon() }).addTo(map);
      map.setView([clat, clng], Math.max(map.getZoom(), 16));
    }
    if (label) {
      setPlace(label);
      onChangeRef.current({ ...next, address: label });
      return;
    }
    onChangeRef.current(next);
    if (!geocode) return;
    setLooking(true);
    try {
      const resolved = await reverseGeocode(clat, clng);
      setPlace(resolved);
      onChangeRef.current({ ...next, address: resolved });
    } catch {
      /* keep coords even if name lookup fails */
    } finally {
      setLooking(false);
    }
  };

  const applyRef = useRef(applyPoint);
  applyRef.current = applyPoint;

  useEffect(() => {
    if (Platform.OS !== 'web' || !boxRef.current || mapRef.current) return;
    const map = L.map(boxRef.current, { zoomControl: true }).setView(
      hasPoint ? [latN, lngN] : UZ_CENTER,
      hasPoint ? 16 : 6
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    L.DomEvent.disableScrollPropagation(map.getContainer());
    if (hasPoint) {
      markerRef.current = L.marker([latN, lngN], { icon: pinIcon() }).addTo(map);
    }
    map.on('click', (e) => {
      void applyRef.current(e.latlng.lat, e.latlng.lng, true);
    });
    mapRef.current = map;
    const tmr = window.setTimeout(() => map.invalidateSize(), 80);
    return () => {
      window.clearTimeout(tmr);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const geo = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onErrorRef.current?.(tRef.current('onb_geoNone'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void applyRef.current(pos.coords.latitude, pos.coords.longitude, true);
      },
      () => onErrorRef.current?.(tRef.current('onb_geoDenied'))
    );
  };

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void searchPlaces(q)
        .then(setHits)
        .catch(() => setHits([]));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  if (Platform.OS !== 'web') {
    return (
      <View style={tw`gap-2`}>
        <Pressable onPress={geo} style={tw`py-3 flex-row items-center gap-2`}>
          <MapPin size={18} color="#0B3D2E" />
          <Text style={tw`text-[#0B3D2E] font-semibold`}>{t('onb_geoBtn')}</Text>
        </Pressable>
        {place ? <Text style={tw`text-sm font-semibold text-[#14221B]`}>{place}</Text> : null}
      </View>
    );
  }

  return (
    <View style={tw`gap-2`}>
      <Text style={tw`text-sm font-medium text-gray-700 ml-1`}>{t('onb_mapHint')}</Text>
      <View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('onb_mapSearch')}
          placeholderTextColor="#9AA59D"
          style={tw`px-3 py-3 bg-[#F8F4EC] rounded-xl border border-[#E8DFD0] text-[#14221B]`}
        />
        {hits.length > 0 ? (
          <View style={tw`bg-white border border-[#E8DFD0] rounded-xl mt-1 overflow-hidden`}>
            {hits.map((h) => (
              <Pressable
                key={`${h.lat}-${h.lng}-${h.label}`}
                onPress={() => {
                  setQuery('');
                  setHits([]);
                  void applyRef.current(h.lat, h.lng, false, h.label);
                }}
                style={tw`px-3 py-2.5 border-b border-[#F0E8D8]`}
              >
                <Text style={tw`text-sm text-[#14221B]`}>{h.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <div ref={boxRef} className="bx-map" />
      <Text style={tw`text-xs text-[#5C6B63]`}>{t('onb_mapTap')}</Text>
      <Pressable onPress={geo} style={tw`py-2 flex-row items-center gap-2 self-start`}>
        <MapPin size={18} color="#0B3D2E" />
        <Text style={tw`text-[#0B3D2E] font-semibold`}>{t('onb_geoBtn')}</Text>
      </Pressable>
      {looking ? <Text style={tw`text-sm text-[#5C6B63]`}>{t('onb_mapLoading')}</Text> : null}
      {!looking && (place || address) ? (
        <Text style={tw`text-sm font-semibold text-[#14221B]`}>
          {t('onb_pickedPlace', { address: place || address })}
        </Text>
      ) : null}
    </View>
  );
}
