/** Local 9 digits → "90 123 45 67" */
export function formatPhoneLocal(raw: string): string {
  const d = raw.replace(/\D/g, '')
  const local = d.startsWith('998') && d.length >= 12 ? d.slice(-9) : d.slice(0, 9)
  const parts = [
    local.slice(0, 2),
    local.slice(2, 5),
    local.slice(5, 7),
    local.slice(7, 9),
  ].filter(Boolean)
  return parts.join(' ')
}

export function phoneDigits(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.startsWith('998') && d.length >= 12) return d.slice(-9)
  return d.slice(0, 9)
}

export function phoneDisplay(phone: string): string {
  const local = phoneDigits(phone)
  if (local.length !== 9) return phone || '—'
  return `+998 ${formatPhoneLocal(local)}`
}
