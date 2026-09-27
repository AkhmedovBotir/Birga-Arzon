import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  LayoutGrid,
  Percent,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react'
import {
  api,
  type CategoryNode,
  type ProductListItem,
  type Yigim,
} from '../api/client'
import { mediaUrl } from '../config'
import { useAuth } from '../auth/AuthContext'
import { useCategoryPicker } from '../components/CategoryPicker'
import { EmptyBox } from '../components/Mascot'
import { YigimCard, type YigimCardData } from '../components/YigimCard'
import { useSEO } from '../lib/seo'

/** Birinchi qator: mobil 2, tablet 3, desktop 4 */
const HOME_YIGIM_LIMIT = 4

function unitLabel(unit: string) {
  if (unit === 'litr') return 'l'
  if (unit === 'dona') return 'dona'
  return unit
}

function firstImage(...lists: (string[] | undefined | null)[]) {
  for (const list of lists) {
    const src = list?.find(Boolean)
    if (src) return src
  }
  return undefined
}

function comboPrice(
  y: Yigim,
  productMap: Map<string, ProductListItem>,
): number | undefined {
  const items = y.items ?? []
  if (items.length === 0) return undefined
  let total = 0
  let known = 0
  for (const it of items) {
    const p = productMap.get(it.product_id)
    if (p) {
      total += p.price * (it.qty || 1)
      known++
    }
  }
  return known > 0 ? total : undefined
}

export function HomePage() {
  const { t } = useTranslation()
  useSEO('Bosh sahifa — Birga xarid, arzon narx')
  const { isAuthenticated } = useAuth()
  const { openPicker } = useCategoryPicker()
  const yigimRef = useRef<HTMLElement>(null)
  const [params] = useSearchParams()
  const query = params.get('q') ?? ''
  const catParam = params.get('cat') ?? ''
  const subParam = params.get('sub') ?? ''
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [yigims, setYigims] = useState<Yigim[]>([])
  const [activeCat, setActiveCat] = useState('all')
  const [activeSub, setActiveSub] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setLoadError('')
      try {
        const [cats, prods, ygs] = await Promise.all([
          api.categoriesTree(),
          api.productsList(),
          api.yigimsList(),
        ])
        setCategories((cats.items ?? []).filter((c) => c.status === 'active'))
        setProducts((prods.items ?? []).filter((p) => p.status === 'active'))
        setYigims((ygs.items ?? []).filter((y) => y.status === 'active'))
      } catch (err) {
        setCategories([])
        setProducts([])
        setYigims([])
        setLoadError(
          err instanceof Error ? err.message : t('home.loadError'),
        )
      } finally {
        setLoading(false)
      }
    })()
  }, [t])

  useEffect(() => {
    if (catParam) setActiveCat(catParam)
    else setActiveCat('all')
    setActiveSub(subParam)
  }, [catParam, subParam])

  useEffect(() => {
    if (loading) return
    if (!catParam && !subParam && !query.trim()) return
    const timer = window.setTimeout(() => {
      yigimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [catParam, subParam, query, loading])

  const productMap = useMemo(() => {
    const m = new Map<string, ProductListItem>()
    for (const p of products) m.set(p.id, p)
    return m
  }, [products])

  const catPhotoFallback = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of products) {
      if (!p.category_id || m.has(p.category_id)) continue
      const img = p.images?.[0]
      if (img) m.set(p.category_id, mediaUrl(img))
    }
    return m
  }, [products])

  /** Home strip: "Kategoriyalar" + birinchi N kategoriya */
  const homeCatStrip = useMemo(() => {
    const maxCats = 7
    return [
      { id: 'picker', name: t('nav.categories'), photo: '', isPicker: true },
      ...categories.slice(0, maxCats).map((c) => ({
        id: c.id,
        name: c.name,
        photo: c.image?.trim()
          ? mediaUrl(c.image)
          : catPhotoFallback.get(c.id) ?? '',
        isPicker: false,
      })),
    ]
  }, [categories, catPhotoFallback, t])

  const cards = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list: YigimCardData[] = []

    for (const y of yigims) {
      if (y.status !== 'active') continue
      const isCombo = y.type === 'combo'
      const product = y.product_id ? productMap.get(y.product_id) : undefined
      const title = isCombo
        ? y.name?.trim() || t('home.comboPool')
        : y.product_name || product?.name || t('home.productPool')

      const categoryId = product?.category_id
      const categoryName = product?.category_name

      if (activeCat !== 'all') {
        if (isCombo) {
          const hit = (y.items ?? []).some((it) => {
            const p = productMap.get(it.product_id)
            if (!p || p.category_id !== activeCat) return false
            if (activeSub && p.subcategory_id !== activeSub) return false
            return true
          })
          if (!hit) continue
        } else {
          if (categoryId !== activeCat) continue
          if (activeSub && product?.subcategory_id !== activeSub) continue
        }
      }

      if (q) {
        const hay = [
          title,
          y.name,
          y.product_name,
          categoryName,
          product?.subcategory_name,
          ...(y.items ?? []).map((i) => i.product_name),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) continue
      }

      const price = isCombo
        ? comboPrice(y, productMap)
        : product?.price

      const unit = isCombo
        ? 'dona'
        : product
          ? unitLabel(product.unit)
          : undefined

      const image =
        firstImage(
          y.images,
          product?.images,
          ...(y.items ?? []).map((it) => {
            const p = productMap.get(it.product_id)
            return p?.images
          }),
        ) ?? undefined

      const yigimForCard: Yigim = {
        ...y,
        images: image
          ? [image, ...(y.images ?? []).filter((i) => i !== image)]
          : y.images,
      }

      list.push({
        yigim: yigimForCard,
        title,
        price,
        unit,
        categoryName,
        location: categoryName
          ? `${categoryName}${product?.subcategory_name ? `, ${product.subcategory_name}` : ''}`
          : t('home.localPool'),
      })
    }

    return list
  }, [yigims, productMap, query, activeCat, activeSub, t])

  const previewCards = useMemo(
    () => cards.slice(0, HOME_YIGIM_LIMIT),
    [cards],
  )
  const hasMoreYigims = cards.length > HOME_YIGIM_LIMIT
  const searching = Boolean(query.trim() || catParam || subParam)

  return (
    <div className="space-y-5 sm:space-y-7 md:space-y-9">
      {/* ===== COMPACT HERO ===== */}
      <section className="relative overflow-hidden rounded-[1.15rem] sm:rounded-[1.35rem]">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/hero-bg.png')" }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-[#fff8f0]/97 via-[#fff8f0]/88 to-[#fff8f0]/35"
        />

        <div className="relative flex items-center gap-3 px-4 py-3.5 sm:gap-5 sm:px-6 sm:py-4 lg:px-8 lg:py-5">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-w-0 flex-1"
          >
            <h1 className="text-[1.15rem] leading-[1.15] font-extrabold tracking-tight text-[var(--green)] sm:text-xl md:text-2xl lg:text-[1.65rem]">
              {t('home.heroTitle')}{' '}
              <span className="text-[var(--brand)]">{t('home.heroHighlight')}</span>
            </h1>
            <p className="mt-1 line-clamp-2 max-w-md text-[12px] leading-snug text-[var(--muted)] sm:mt-1.5 sm:line-clamp-none sm:text-sm">
              {t('home.heroSubtitleShort')}
            </p>
            <Link
              to="/kategoriyalar"
              className="ba-btn mt-2.5 inline-flex rounded-lg px-3.5 py-2 text-[12px] sm:mt-3 sm:rounded-xl sm:px-5 sm:py-2.5 sm:text-[13px]"
            >
              {t('home.viewYigims')}
              <ArrowRight size={14} className="sm:hidden" />
              <ArrowRight size={16} className="hidden sm:block" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.06 }}
            className="relative hidden shrink-0 sm:block"
          >
            <img
              src="/images/hero-mascot-removebg.png"
              alt=""
              className="relative z-[1] h-16 w-auto object-contain drop-shadow-md sm:h-20 md:h-24 lg:h-28"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = '/images/hero-mascot.png'
              }}
            />
            <div className="absolute -top-0.5 -left-2 z-[2] max-w-[88px] rounded-xl rounded-br-sm bg-[var(--green)] px-2 py-1 text-[8px] leading-tight font-extrabold text-white shadow sm:max-w-[110px] sm:px-2.5 sm:py-1.5 sm:text-[9px] md:-left-3">
              {t('home.bubbleLine1')}
              <br />
              {t('home.bubbleLine2')}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== KATEGORIYALAR ===== */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-extrabold text-[var(--green)] sm:text-xl md:text-2xl">
            {t('nav.categories')}
          </h2>
          <button
            type="button"
            onClick={openPicker}
            className="inline-flex items-center gap-1 text-sm font-extrabold text-[var(--brand)]"
          >
            {t('common.seeAll')}
            <ArrowRight size={14} />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 sm:gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-[1rem] bg-[var(--sand)] sm:rounded-[1.15rem]"
              />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-[var(--muted)] ring-1 ring-[var(--line)]">
            {loadError || t('categories.emptyLong')}
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:gap-3 md:grid-cols-6 lg:grid-cols-8">
            {homeCatStrip.map((c) => {
              if (c.isPicker) {
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={openPicker}
                    className="flex min-w-0 flex-col items-center gap-1.5 rounded-[1rem] bg-[var(--sand)] p-1.5 text-[var(--ink)] transition hover:bg-[var(--brand)] hover:text-white hover:shadow-[var(--shadow-btn)] sm:gap-2 sm:rounded-[1.15rem] sm:p-2.5"
                  >
                    <span className="flex aspect-square w-full max-w-[3.5rem] items-center justify-center overflow-hidden rounded-xl bg-white sm:max-w-[4rem] sm:rounded-2xl">
                      <LayoutGrid size={22} className="text-[var(--brand)] sm:h-6 sm:w-6" />
                    </span>
                    <span className="line-clamp-2 text-center text-[10px] font-extrabold leading-tight break-words sm:text-[11px] md:text-xs">
                      {c.name}
                    </span>
                  </button>
                )
              }
              return (
                <Link
                  key={c.id}
                  to={`/kategoriyalar?cat=${encodeURIComponent(c.id)}`}
                  className="flex min-w-0 flex-col items-center gap-1.5 rounded-[1rem] bg-[var(--sand)] p-1.5 text-[var(--ink)] transition hover:bg-[var(--brand)] hover:text-white hover:shadow-[var(--shadow-btn)] sm:gap-2 sm:rounded-[1.15rem] sm:p-2.5"
                >
                  <span className="flex aspect-square w-full max-w-[3.5rem] items-center justify-center overflow-hidden rounded-xl bg-white sm:max-w-[4rem] sm:rounded-2xl">
                    {c.photo ? (
                      <img
                        src={c.photo}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-sm font-extrabold text-[var(--brand)] sm:text-lg">
                        {c.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-center text-[10px] font-extrabold leading-tight break-words sm:text-[11px] md:text-xs">
                    {c.name}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* ===== OCHIQ YIG‘IMLAR (preview) ===== */}
      <section
        ref={yigimRef}
        id="yigimlar"
        className="space-y-3 scroll-mt-24 sm:space-y-4"
      >
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-[var(--green)] sm:text-xl md:text-2xl">
              {query.trim()
                ? t('home.searchResult', { q: query.trim() })
                : t('home.openYigims')}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted)] sm:text-sm">
              {t('home.openYigimsHint')}
            </p>
          </div>
          <Link
            to="/kategoriyalar"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-extrabold text-[var(--brand)]"
          >
            {t('common.seeAll')}
            <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse rounded-[1.15rem] bg-white ring-1 ring-[var(--line)]"
              />
            ))}
          </div>
        ) : previewCards.length === 0 ? (
          <div className="flex flex-col items-center rounded-[1.5rem] bg-white px-4 py-10 text-center shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] sm:py-12">
            <EmptyBox className="mb-3 h-28 w-36 sm:h-36 sm:w-44" />
            <p className="text-base font-extrabold text-[var(--ink)] sm:text-lg">
              {loadError || t('home.emptyOpen')}
            </p>
            <p className="mt-1 max-w-sm text-sm text-[var(--muted)]">
              {loadError ? t('home.backendHint') : t('home.emptyOpenHint')}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
              {previewCards.map((data) => (
                <YigimCard key={data.yigim.id} data={data} />
              ))}
            </div>
            {(hasMoreYigims || searching) && (
              <div className="flex justify-center pt-1">
                <Link
                  to="/kategoriyalar"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[var(--brand)] ring-1 ring-[var(--brand)]/25 transition hover:bg-[var(--brand-soft)]"
                >
                  {t('home.seeAllYigims', { count: cards.length })}
                  <ArrowRight size={15} />
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      {/* ===== BU QANDAY ISHLAYDI ===== */}
      <section className="overflow-hidden rounded-[1.25rem] bg-[var(--green-soft)] sm:rounded-[1.35rem]">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--green)] shadow-sm sm:h-12 sm:w-12">
              <BookOpen size={22} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-extrabold text-[var(--green)] sm:text-base">
                {t('home.howItWorks')}
              </h2>
              <p className="mt-0.5 text-xs leading-snug text-[var(--muted)] sm:text-sm">
                {t('home.howItWorksHint')}
              </p>
            </div>
          </div>
          <Link
            to="/qanday-ishlaydi"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 self-stretch rounded-xl bg-[var(--green)] px-4 py-2.5 text-[13px] font-extrabold text-white transition hover:bg-[var(--green-mid)] sm:self-auto"
          >
            {t('home.howItWorksCta')}
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="rounded-[1.25rem] bg-white px-4 py-5 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] sm:rounded-[1.5rem] sm:px-8 sm:py-7">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6">
          {[
            {
              Icon: Percent,
              title: t('home.feature1Title'),
              text: t('home.feature1Text'),
            },
            {
              Icon: Users,
              title: t('home.feature2Title'),
              text: t('home.feature2Text'),
            },
            {
              Icon: ShieldCheck,
              title: t('home.feature3Title'),
              text: t('home.feature3Text'),
            },
            {
              Icon: Truck,
              title: t('home.feature4Title'),
              text: t('home.feature4Text'),
            },
          ].map(({ Icon, title, text }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 sm:gap-3.5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--green-soft)] text-[var(--green)] sm:h-12 sm:w-12">
                <Icon size={20} className="sm:h-[22px] sm:w-[22px]" />
              </span>
              <div>
                <h3 className="text-[14px] font-extrabold text-[var(--ink)] sm:text-[15px]">
                  {title}
                </h3>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)] sm:mt-1">
                  {text}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===== BOTTOM CTA ===== */}
      <section className="relative overflow-hidden rounded-[1.35rem] bg-[#fff0e0] sm:rounded-[1.75rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-[#ffd4a8]/70 blur-2xl"
        />
        <div className="relative grid items-end lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative z-[1] px-5 py-7 sm:px-10 sm:py-12 lg:pb-14">
            <h2 className="text-lg font-extrabold text-[var(--ink)] sm:text-2xl lg:text-[1.85rem]">
              {t('home.ctaTitle')}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">
              {t('home.ctaText')}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5 sm:mt-6 sm:gap-3">
              <Link
                to="/kategoriyalar"
                className="ba-btn inline-flex rounded-full px-5 py-2.5 text-sm sm:px-6 sm:py-3"
              >
                {t('home.goToYigims')}
                <ArrowRight size={16} />
              </Link>
              {!isAuthenticated ? (
                <Link
                  to="/kirish"
                  className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[var(--ink)] shadow-sm sm:px-6 sm:py-3"
                >
                  {t('common.login')}
                </Link>
              ) : (
                <Link
                  to="/buyurtmalar"
                  className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[var(--ink)] shadow-sm sm:px-6 sm:py-3"
                >
                  {t('home.myOrders')}
                </Link>
              )}
            </div>
          </div>

          <div className="relative z-[1] flex min-h-[120px] items-end justify-end px-2 pb-0 sm:min-h-[200px] lg:min-h-[260px]">
            <img
              src="/images/cta-veggies.png"
              alt=""
              className="w-full max-w-[280px] translate-x-2 translate-y-1 object-contain object-bottom drop-shadow-[0_18px_28px_rgba(15,61,46,0.18)] sm:max-w-[520px] sm:translate-x-4 sm:translate-y-3 lg:max-w-none lg:w-[115%]"
            />
          </div>
        </div>
      </section>
    </div>
  )
}
