export const config = {
  apiBaseUrl: 'https://api.birgaarzon.uz/api/v1',
  mediaBaseUrl: 'https://api.birgaarzon.uz',
  appName: 'Birga Arzon Kuryer',
} as const

export function mediaUrl(path?: string | null) {
  if (!path) return ''
  const raw = String(path).trim()
  if (!raw) return ''
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  const normalized = raw.startsWith('/') ? raw : `/${raw}`
  return `${config.mediaBaseUrl}${normalized}`
}

export function formatSom(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}
