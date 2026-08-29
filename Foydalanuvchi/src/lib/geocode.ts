type NominatimAddress = Record<string, string | undefined>;

type NominatimPlace = {
  lat: string;
  lon: string;
  display_name?: string;
  address?: NominatimAddress;
};

function langHeader(): string {
  if (typeof document === 'undefined') return 'uz';
  const lang = document.documentElement.lang || 'uz';
  if (lang.startsWith('ru')) return 'ru';
  return 'uz';
}

function formatAddress(place: NominatimPlace): string {
  const a = place.address || {};
  const street = [a.road, a.house_number].filter(Boolean).join(' ');
  const area = a.neighbourhood || a.suburb || a.quarter || a.village || a.hamlet;
  const city = a.town || a.city || a.municipality || a.county;
  const region = a.state;
  const parts = [street, area, city, region].filter((p): p is string => Boolean(p));
  const unique = [...new Set(parts)];
  return unique.join(', ') || place.display_name || '';
}

async function nominatim(path: string): Promise<unknown> {
  const res = await fetch(`https://nominatim.openstreetmap.org/${path}`, {
    headers: { Accept: 'application/json', 'Accept-Language': langHeader() },
  });
  if (!res.ok) throw new Error('manzil aniqlanmadi');
  return res.json();
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const data = (await nominatim(
    `reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&zoom=18`
  )) as NominatimPlace;
  return formatAddress(data);
}

export async function searchPlaces(query: string): Promise<{ lat: number; lng: number; label: string }[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const data = (await nominatim(
    `search?format=jsonv2&q=${encodeURIComponent(q)}&countrycodes=uz&addressdetails=1&limit=6`
  )) as NominatimPlace[];
  if (!Array.isArray(data)) return [];
  return data
    .map((p) => ({
      lat: Number(p.lat),
      lng: Number(p.lon),
      label: formatAddress(p),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.label);
}
