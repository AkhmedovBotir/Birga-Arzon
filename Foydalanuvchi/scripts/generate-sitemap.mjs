import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SITE_URL = 'https://birgaarzon.uz'
const API_BASE = 'https://api.birgaarzon.uz/api/v1'
const PUBLIC_DIR = path.resolve(__dirname, '../public')
const SITEMAP_PATH = path.join(PUBLIC_DIR, 'sitemap.xml')

const today = new Date().toISOString().split('T')[0]

async function fetchJson(url, timeoutMs = 4000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function generate() {
  console.log('Generating sitemap.xml for Birga Arzon...')

  // Asosiy statik sahifalar
  const urls = [
    {
      loc: `${SITE_URL}/`,
      lastmod: today,
      changefreq: 'daily',
      priority: '1.0',
      images: [
        {
          loc: `${SITE_URL}/images/hero-mascot.png`,
          title: 'Birga Arzon — Birga xarid, arzon narx',
          caption: 'Birga Arzon ommaviy xarid platformasi ramzi',
        },
        {
          loc: `${SITE_URL}/images/hero-bazaar.png`,
          title: 'Birga Arzon bozor',
        },
      ],
    },
    {
      loc: `${SITE_URL}/kategoriyalar`,
      lastmod: today,
      changefreq: 'daily',
      priority: '0.9',
    },
    {
      loc: `${SITE_URL}/qanday-ishlaydi`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.8',
    },
  ]

  // Kategoriyalarni API dan olishga urinish
  try {
    const catData = await fetchJson(`${API_BASE}/categories/tree`)
    const categories = catData?.items || []
    for (const cat of categories) {
      if (cat.id) {
        urls.push({
          loc: `${SITE_URL}/kategoriyalar?cat=${encodeURIComponent(cat.id)}`,
          lastmod: today,
          changefreq: 'daily',
          priority: '0.8',
          images: cat.image
            ? [
                {
                  loc: cat.image.startsWith('http')
                    ? cat.image
                    : `https://api.birgaarzon.uz${cat.image.startsWith('/') ? '' : '/'}${cat.image}`,
                  title: cat.name || 'Kategoriya',
                },
              ]
            : undefined,
        })
      }
    }
  } catch (err) {
    console.warn('Could not fetch categories tree for sitemap, continuing with base URLs:', err.message)
  }

  // Faol yig'imlarni API dan olishga urinish
  try {
    const yigimData = await fetchJson(`${API_BASE}/yigimlar?status=active&limit=100`)
    const yigimlar = yigimData?.items || []
    for (const y of yigimlar) {
      if (y.id) {
        const itemImages = []
        if (y.images && Array.isArray(y.images)) {
          for (const img of y.images) {
            if (img) {
              itemImages.push({
                loc: img.startsWith('http')
                  ? img
                  : `https://api.birgaarzon.uz${img.startsWith('/') ? '' : '/'}${img}`,
                title: y.name || 'Yig‘im mahsuloti',
              })
            }
          }
        }

        urls.push({
          loc: `${SITE_URL}/yigim/${encodeURIComponent(y.id)}`,
          lastmod: today,
          changefreq: 'daily',
          priority: '0.9',
          images: itemImages.length > 0 ? itemImages : undefined,
        })
      }
    }
  } catch (err) {
    console.warn('Could not fetch yigimlar for sitemap, continuing with base URLs:', err.message)
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`
  xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml"\n`
  xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`

  for (const u of urls) {
    xml += `  <url>\n`
    xml += `    <loc>${escapeXml(u.loc)}</loc>\n`
    xml += `    <lastmod>${u.lastmod}</lastmod>\n`
    xml += `    <changefreq>${u.changefreq}</changefreq>\n`
    xml += `    <priority>${u.priority}</priority>\n`
    xml += `    <xhtml:link rel="alternate" hreflang="uz" href="${escapeXml(u.loc)}" />\n`
    xml += `    <xhtml:link rel="alternate" hreflang="ru" href="${escapeXml(u.loc)}" />\n`
    xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(u.loc)}" />\n`

    if (u.images && u.images.length > 0) {
      for (const img of u.images) {
        xml += `    <image:image>\n`
        xml += `      <image:loc>${escapeXml(img.loc)}</image:loc>\n`
        if (img.title) {
          xml += `      <image:title>${escapeXml(img.title)}</image:title>\n`
        }
        if (img.caption) {
          xml += `      <image:caption>${escapeXml(img.caption)}</image:caption>\n`
        }
        xml += `    </image:image>\n`
      }
    }

    xml += `  </url>\n`
  }

  xml += `</urlset>\n`

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true })
  }

  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8')
  console.log(`Successfully generated sitemap with ${urls.length} URLs at ${SITEMAP_PATH}`)
}

generate().catch((err) => {
  console.error('Failed to generate sitemap:', err)
  // Do not crash the build if offline
  process.exit(0)
})
