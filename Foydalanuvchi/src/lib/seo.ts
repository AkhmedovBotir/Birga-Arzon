import { useEffect } from 'react'

const BASE_TITLE = 'Birga Arzon'
const DEFAULT_DESCRIPTION =
  'Birga Arzon — O‘zbekistondagi birinchi ommaviy xarid platformasi. Do‘stlar va yaqinlar bilan yig‘ilib xarid qiling va ulgurji arzon narxlarda oling!'

/**
 * Sahifa sarlavhasi va meta tavsifini dinamik yangilash (SEO va Google uchun)
 */
export function useSEO(title?: string, description?: string) {
  useEffect(() => {
    // Sarlavhani o'zgartirish
    if (title) {
      document.title = `${title} | ${BASE_TITLE}`
    } else {
      document.title = `${BASE_TITLE} — Birga xarid qiling, arzonroq oling`
    }

    // Meta description ni o'zgartirish
    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) {
      metaDesc.setAttribute('content', description || DEFAULT_DESCRIPTION)
    }

    // Og:title ni yangilash
    const ogTitle = document.querySelector('meta[property="og:title"]')
    if (ogTitle) {
      ogTitle.setAttribute(
        'content',
        title ? `${title} — ${BASE_TITLE}` : `${BASE_TITLE} — Birga xarid qiling, arzonroq oling!`
      )
    }
  }, [title, description])
}
