import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type MapLatLng = { lat: number; lng: number }

const FALLBACK: MapLatLng = { lat: 41.3111, lng: 69.2797 }

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:26px;height:26px;border-radius:50% 50% 50% 0;
    background:#0f766e;border:3px solid #fff;
    box-shadow:0 6px 14px rgba(15,118,110,.4);
    transform:rotate(-45deg);
  "></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
})

function Recenter({ pos }: { pos: MapLatLng }) {
  const map = useMap()
  useEffect(() => {
    map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 14), {
      animate: true,
    })
  }, [map, pos.lat, pos.lng])
  return null
}

function MapClick({ onPick }: { onPick: (p: MapLatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

type Props = {
  lat: string
  lng: string
  onChange: (lat: string, lng: string) => void
  className?: string
}

function parseCoord(lat: string, lng: string): MapLatLng | null {
  const a = Number(lat)
  const b = Number(lng)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  if (a < -90 || a > 90 || b < -180 || b > 180) return null
  return { lat: a, lng: b }
}

export function LocationMapField({ lat, lng, onChange, className = '' }: Props) {
  const { t } = useTranslation()
  const pos = useMemo(() => parseCoord(lat, lng), [lat, lng])
  const center = pos ?? FALLBACK

  const pick = (p: MapLatLng) => {
    onChange(String(p.lat), String(p.lng))
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {t('admin.mapLocation')}
        </span>
        {pos ? (
          <span className="text-[11px] font-medium text-teal-700">
            {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400">
            {t('admin.pickOnMapShort')}
          </span>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="h-48 w-full sm:h-56">
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={pos ? 14 : 6}
            scrollWheelZoom
            className="h-full w-full"
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
            />
            {pos && (
              <>
                <Marker
                  position={[pos.lat, pos.lng]}
                  icon={pinIcon}
                  draggable
                  eventHandlers={{
                    dragend: (e) => {
                      const m = e.target as L.Marker
                      const p = m.getLatLng()
                      pick({ lat: p.lat, lng: p.lng })
                    },
                  }}
                />
                <Recenter pos={pos} />
              </>
            )}
            <MapClick onPick={pick} />
          </MapContainer>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Marker — sudrab yoki xaritaga bosib joylashuvni belgilang.
      </p>
    </div>
  )
}
