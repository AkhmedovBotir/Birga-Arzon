/** Nomdan hudud kodi: bo‘shliqlar tozalash, viloyat/tuman qo‘shimchalarini olib tashlash */
export function formatRegionCode(name: string): string {
  let code = name.trim()
  if (!code) return ''

  code = code.replace(/\s+/g, ' ')

  code = code.replace(
    /\s+(viloyati|tumani|tuman|shahri|shahar)$/gi,
    '',
  )

  // Bosh harf katta, qolgani saqlanadi (har so‘z)
  code = code
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      if (word.length === 0) return word
      return word.charAt(0).toLocaleUpperCase('uz') + word.slice(1)
    })
    .join(' ')

  return code.trim()
}
