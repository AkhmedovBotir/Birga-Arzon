import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import { Loader2, LocateFixed } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

export type LatLng = { lat: number; lng: number }

/** Toshkent markazi — fallback */
const FALLBACK: LatLng = { lat: 41.3111, lng: 69.2797 }

/** Viloyat markazlari — geocode ishlamasa */
const VILOYAT_CENTERS: Record<string, LatLng> = {
  andijon: { lat: 40.7821, lng: 72.3442 },
  buxoro: { lat: 39.7681, lng: 64.4556 },
  "farg'ona": { lat: 40.3864, lng: 71.7864 },
  fargona: { lat: 40.3864, lng: 71.7864 },
  jizzax: { lat: 40.1158, lng: 67.8422 },
  xorazm: { lat: 41.3775, lng: 60.3597 },
  namangan: { lat: 41.0011, lng: 71.6725 },
  navoiy: { lat: 40.1039, lng: 65.3686 },
  qashqadaryo: { lat: 38.8606, lng: 65.7891 },
  samarqand: { lat: 39.6542, lng: 66.9597 },
  sirdaryo: { lat: 40.8436, lng: 68.6617 },
  surxondaryo: { lat: 37.9409, lng: 67.5709 },
  toshkent: { lat: 41.3111, lng: 69.2797 },
  qoraqalpog: { lat: 43.7683, lng: 59.0214 },
}

/** Ba'zi tuman markazlari (Nominatim xato bersa) */
const TUMAN_CENTERS: Record<string, LatLng> = {
  'andijon|buloqboshi': { lat: 40.595, lng: 72.47 },
  'andijon|asaka': { lat: 40.6415, lng: 72.2387 },
  'andijon|andijon': { lat: 40.7821, lng: 72.3442 },
  'andijon|xonobod': { lat: 40.8128, lng: 72.982 },
  'andijon|shahrixon': { lat: 40.7133, lng: 72.057 },
  'andijon|marxamat': { lat: 40.511, lng: 72.333 },
  'andijon|ulugnor': { lat: 40.78, lng: 71.7 },
  'andijon|oltai': { lat: 40.85, lng: 72.45 },
  "andijon|o'ltinko'l": { lat: 40.8, lng: 72.15 },
  'andijon|oltinkol': { lat: 40.8, lng: 72.15 },
  'andijon|jalolquduq': { lat: 40.67, lng: 72.6 },
  'andijon|qo': { lat: 40.53, lng: 72.78 },
  'andijon|paxtaobod': { lat: 40.93, lng: 72.5 },
  'andijon|baliqchi': { lat: 40.9, lng: 71.9 },
  'andijon|boz': { lat: 40.68, lng: 71.88 },
  'andijon|izboskan': { lat: 40.95, lng: 72.25 },
}

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:28px;height:28px;border-radius:50% 50% 50% 0;
    background:#ff6a00;border:3px solid #fff;
    box-shadow:0 6px 16px rgba(255,106,0,.45);
    transform:rotate(-45deg);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
})

function Recenter({ pos, zoom }: { pos: LatLng; zoom?: number }) {
  const map = useMap()
  useEffect(() => {
    const z = zoom ?? Math.max(map.getZoom(), 14)
    map.setView([pos.lat, pos.lng], z, { animate: true })
  }, [map, pos.lat, pos.lng, zoom])
  return null
}

function MapClick({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function normalizeKey(name: string) {
  return name
    .toLowerCase()
    .replace(/viloyati|shahri|respublikasi|tumani|tuman/gi, '')
    .replace(/ʻ|ʼ|'|‘|’|ʻ/g, "'")
    .replace(/ʻ/g, "'")
    .replace(/\s+/g, '')
    .trim()
}

function viloyatFallback(viloyatName: string): LatLng {
  const key = normalizeKey(viloyatName)
  for (const [k, pos] of Object.entries(VILOYAT_CENTERS)) {
    if (key.includes(k) || k.includes(key.slice(0, 6))) return pos
  }
  return FALLBACK
}

function tumanFallback(tumanName: string, viloyatName: string): LatLng | null {
  const v = normalizeKey(viloyatName)
  const t = normalizeKey(tumanName)
  const compound = `${v.includes('andijon') ? 'andijon' : v}|${t}`
  for (const [k, pos] of Object.entries(TUMAN_CENTERS)) {
    const [vk, tk] = k.split('|')
    if (compound.includes(vk) && (t.includes(tk) || tk.includes(t.slice(0, 5)))) {
      return pos
    }
  }
  // viloyat kaliti bilan qidirish
  for (const [k, pos] of Object.entries(TUMAN_CENTERS)) {
    const [, tk] = k.split('|')
    if (v.includes('andijon') && (t.includes(tk) || tk.includes(t.slice(0, 5)))) {
      return pos
    }
  }
  return null
}

async function geocodeRegion(
  tuman: string,
  viloyat: string,
): Promise<LatLng | null> {
  const local = tumanFallback(tuman, viloyat)
  if (local) return local

  const queries = [
    `${tuman} tumani, ${viloyat}, Uzbekistan`,
    `${tuman}, ${viloyat}, Uzbekistan`,
    `${tuman}, Andijan Region, Uzbekistan`,
  ]
  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=uz&q=${encodeURIComponent(q)}`
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) continue
      const data = (await res.json()) as { lat: string; lon: string }[]
      if (data?.[0]) {
        const lat = Number(data[0].lat)
        const lng = Number(data[0].lon)
        // Toshkentga tushib qolgan bo‘lsa (noto‘g‘ri natija) — rad etamiz
        const isTashkent =
          lat > 41.0 && lat < 41.6 && lng > 69.0 && lng < 69.6
        const wantsTashkent = /toshkent/i.test(viloyat)
        if (isTashkent && !wantsTashkent) continue
        return { lat, lng }
      }
    } catch {
      /* next query */
    }
  }
  return null
}

export type RegionFocus = {
  viloyatName: string
  tumanName: string
}

type Props = {
  value: LatLng | null
  onChange: (pos: LatLng) => void
  compact?: boolean
  /** Viloyat+tuman tanlanganda avval shu joy, keyin GPS */
  regionFocus?: RegionFocus | null
}

export function LocationPicker({
  value,
  onChange,
  compact = false,
  regionFocus = null,
}: Props) {
  const { t } = useTranslation()
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [mapZoom, setMapZoom] = useState(12)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const center = value ?? FALLBACK
  const focusKey = regionFocus
    ? `${regionFocus.viloyatName}|${regionFocus.tumanName}`
    : ''

  const locateMe = useCallback(
    (opts?: { keepIfFail?: boolean; zoom?: number }) => {
      setGeoError('')
      if (!navigator.geolocation) {
        setGeoError(t('location.unsupported'))
        setLocating(false)
        if (!opts?.keepIfFail && !value) onChangeRef.current(FALLBACK)
        return
      }
      setLocating(true)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          onChangeRef.current({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          })
          setMapZoom(opts?.zoom ?? 16)
          setLocating(false)
        },
        (err) => {
          setLocating(false)
          setGeoError(
            err.code === 1 ? t('location.denied') : t('location.failed'),
          )
          if (!opts?.keepIfFail && !value) onChangeRef.current(FALLBACK)
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      )
    },
    [value, t],
  )

  /** Viloyat + tuman tanlangach — faqat shu joy (GPS emas) */
  useEffect(() => {
    if (!regionFocus) return
    let cancelled = false

    void (async () => {
      setLocating(true)
      setGeoError('')

      const geo = await geocodeRegion(
        regionFocus.tumanName,
        regionFocus.viloyatName,
      )
      if (cancelled) return

      const localTuman = tumanFallback(
        regionFocus.tumanName,
        regionFocus.viloyatName,
      )
      const regionPos =
        geo ?? localTuman ?? viloyatFallback(regionFocus.viloyatName)

      onChangeRef.current(regionPos)
      setMapZoom(geo || localTuman ? 13 : 11)
      setLocating(false)
    })()

    return () => {
      cancelled = true
    }
  }, [focusKey, regionFocus])

  return (
    <div className={`flex h-full min-h-0 flex-col ${compact ? 'gap-1.5' : 'gap-2'}`}>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <span
          className={`font-extrabold tracking-[0.14em] text-[var(--muted)] uppercase ${
            compact ? 'text-[10px]' : 'text-[11px] tracking-[0.16em]'
          }`}
        >
          {t('location.mapLabel')}
        </span>
        <button
          type="button"
          onClick={() => locateMe({ keepIfFail: true, zoom: 16 })}
          disabled={locating}
          className={`inline-flex items-center gap-1 rounded-full bg-[var(--brand-soft)] font-extrabold text-[var(--brand)] transition hover:bg-[var(--brand)] hover:text-white disabled:opacity-60 ${
            compact ? 'px-2.5 py-1 text-[10px]' : 'gap-1.5 px-3 py-1.5 text-[11px]'
          }`}
        >
          {locating ? (
            <Loader2 size={compact ? 11 : 12} className="animate-spin" />
          ) : (
            <LocateFixed size={compact ? 11 : 12} />
          )}
          {t('location.myLocation')}
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl ring-1 ring-[var(--line)]">
        <div
          className={
            compact
              ? 'h-full min-h-[120px] w-full max-h-[28svh] sm:min-h-[160px] sm:max-h-none sm:h-44'
              : 'h-56 w-full sm:h-64'
          }
        >
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={mapZoom}
            scrollWheelZoom
            className="h-full w-full"
            attributionControl={false}
            zoomControl={!compact}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {value && (
              <>
                <Marker
                  position={[value.lat, value.lng]}
                  icon={pinIcon}
                  draggable
                  eventHandlers={{
                    dragend: (e) => {
                      const m = e.target as L.Marker
                      const p = m.getLatLng()
                      onChange({ lat: p.lat, lng: p.lng })
                    },
                  }}
                />
                <Recenter pos={value} zoom={mapZoom} />
              </>
            )}
            <MapClick onPick={onChange} />
          </MapContainer>
        </div>

        {locating && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/70 backdrop-blur-[2px]">
            <div
              className={`flex items-center gap-2 rounded-2xl bg-white font-bold text-[var(--ink)] shadow-lg ring-1 ring-[var(--line)] ${
                compact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'
              }`}
            >
              <Loader2
                size={compact ? 14 : 16}
                className="animate-spin text-[var(--brand)]"
              />
              {t('location.detectingLong')}
            </div>
          </div>
        )}
      </div>

      {geoError && (
        <p className="shrink-0 text-[10px] font-semibold text-amber-800 sm:text-xs">
          {geoError}
        </p>
      )}
    </div>
  )
}
