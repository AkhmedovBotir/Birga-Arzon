import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Heart } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { api, type ProductListItem, type Yigim } from '../api/client'
import { useFavorites } from '../favorites/FavoritesContext'
import { YigimCard, type YigimCardData } from '../components/YigimCard'
import { EmptyBox } from '../components/Mascot'

type TabFilter = 'all' | 'open' | 'closed'

export function FavoritesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { favorites } = useFavorites()

  const [cards, setCards] = useState<YigimCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<TabFilter>('all')

  useEffect(() => {
    if (favorites.length === 0) {
      setCards([])
      setLoading(false)
      return
    }

    let active = true
    void (async () => {
      setLoading(true)
      try {
        const [allProducts, allYigims] = await Promise.all([
          api.productsList().catch(() => ({ items: [] as ProductListItem[] })),
          api.yigimsList().catch(() => ({ items: [] as Yigim[] })),
        ])

        const productMap = new Map(
          (allProducts.items ?? []).map((p) => [p.id, p] as const),
        )
        const yigimMap = new Map(
          (allYigims.items ?? []).map((y) => [y.id, y] as const),
        )

        // For closed yigims not in active list, fetch individually
        const missing = favorites.filter((id) => !yigimMap.has(id))
        if (missing.length > 0) {
          const fetched = await Promise.all(
            missing.map((id) => api.yigimGet(id).catch(() => null)),
          )
          for (const item of fetched) {
            if (item) yigimMap.set(item.id, item)
          }
        }

        if (!active) return

        const list: YigimCardData[] = []
        for (const id of favorites) {
          const y = yigimMap.get(id)
          if (!y) continue

          const isCombo = y.type === 'combo'
          const rp = y.product_id ? productMap.get(y.product_id) : undefined

          const rTitle = isCombo
            ? y.name?.trim() || t('yigim.comboPool')
            : y.product_name || rp?.name || t('yigim.productPool')

          const rPrice = isCombo
            ? (y.items ?? []).reduce((s, it) => {
                const p = productMap.get(it.product_id)
                return s + (p?.price ?? 0) * (it.qty || 1)
              }, 0) || undefined
            : rp?.price

          const rImage =
            y.images?.[0] ||
            rp?.images?.[0] ||
            y.items?.[0]?.product_image

          list.push({
            yigim: {
              ...y,
              images: rImage
                ? [rImage, ...(y.images ?? []).filter((i) => i !== rImage)]
                : y.images,
            },
            title: rTitle,
            price: rPrice,
            unit: isCombo ? 'dona' : rp?.unit ? rp.unit : 'dona',
            categoryName: rp?.category_name,
            location: rp?.category_name || t('yigim.localPool'),
          })
        }

        setCards(list)
      } catch {
        if (active) setCards([])
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [favorites, t])

  const openCount = useMemo(
    () => cards.filter((c) => c.yigim.status === 'active').length,
    [cards],
  )
  const closedCount = useMemo(
    () => cards.filter((c) => c.yigim.status !== 'active').length,
    [cards],
  )

  const filteredCards = useMemo(() => {
    if (filter === 'open') return cards.filter((c) => c.yigim.status === 'active')
    if (filter === 'closed') return cards.filter((c) => c.yigim.status !== 'active')
    return cards
  }, [cards, filter])

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)] transition hover:text-[var(--brand)] sm:h-10 sm:w-10"
            aria-label={t('common.back')}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-[var(--ink)] sm:text-2xl">
              {t('favorites.title')}
            </h1>
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--brand-soft)] px-2 text-xs font-extrabold text-[var(--brand)]">
              {favorites.length}
            </span>
          </div>
        </div>

        {cards.length > 0 && closedCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-xl bg-[var(--sand)]/80 p-1 text-xs font-extrabold">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-lg px-2.5 py-1.5 transition ${
                filter === 'all'
                  ? 'bg-white text-[var(--ink)] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {t('favorites.all')} ({cards.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('open')}
              className={`rounded-lg px-2.5 py-1.5 transition ${
                filter === 'open'
                  ? 'bg-white text-[var(--green)] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {t('favorites.open')} ({openCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('closed')}
              className={`rounded-lg px-2.5 py-1.5 transition ${
                filter === 'closed'
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {t('favorites.closed')} ({closedCount})
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="aspect-[3/4] animate-pulse rounded-[1.15rem] bg-white ring-1 ring-[var(--line)]"
            />
          ))}
        </div>
      ) : favorites.length === 0 || cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[1.5rem] bg-white px-4 py-12 text-center shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] sm:py-16">
          <div className="relative mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--brand-soft)] text-rose-500 shadow-sm">
            <Heart size={36} fill="currentColor" />
          </div>
          <p className="text-lg font-extrabold text-[var(--ink)] sm:text-xl">
            {t('favorites.empty')}
          </p>
          <p className="mt-1.5 max-w-sm text-xs font-semibold leading-relaxed text-[var(--muted)] sm:text-sm">
            {t('favorites.emptyHint')}
          </p>
          <Link
            to="/kategoriyalar"
            className="ba-btn mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold shadow-sm"
          >
            {t('favorites.exploreYigims')}
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[1.5rem] bg-white px-4 py-12 text-center ring-1 ring-[var(--line)]">
          <EmptyBox className="mb-3 h-24 w-32" />
          <p className="text-sm font-extrabold text-[var(--ink)]">
            {filter === 'open'
              ? 'Ochiq saqlangan yig‘imlar yo‘q'
              : 'Yopilgan saqlangan yig‘imlar yo‘q'}
          </p>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="mt-3 text-xs font-extrabold text-[var(--brand)]"
          >
            Barchasini ko‘rish
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence>
            {filteredCards.map((data) => (
              <YigimCard key={data.yigim.id} data={data} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
