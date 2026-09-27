import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight,
  LayoutGrid,
  Search,
  X,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import {
  api,
  type CategoryNode,
  type ProductListItem,
  type Yigim,
} from '../api/client'
import { mediaUrl } from '../config'
import { EmptyBox } from '../components/Mascot'
import { YigimCard, type YigimCardData } from '../components/YigimCard'
import { useSEO } from '../lib/seo'

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

function CategoryPhoto({ src, name }: { src: string; name: string }) {
  const [broken, setBroken] = useState(false)
  const letter = (name.trim().slice(0, 1) || '?').toUpperCase()

  if (!src || broken) {
    return (
      <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--brand-soft)] to-[var(--sand)] text-lg font-extrabold text-[var(--brand)]">
        {letter}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  )
}

export function CategoriesPage() {
  const { t } = useTranslation()
  useSEO('Kategoriyalar — Barcha mahsulotlar', 'Birga Arzon do‘konidagi barcha mahsulot kategoriyalari va ommaviy yig‘imlar ro‘yxati.')
  const [params, setParams] = useSearchParams()
  const catId = params.get('cat') ?? ''
  const subId = params.get('sub') ?? ''

  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [yigims, setYigims] = useState<Yigim[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [listOpen, setListOpen] = useState(false)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError('')
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
        setError(err instanceof Error ? err.message : t('categories.loadError'))
      } finally {
        setLoading(false)
      }
    })()
  }, [t])

  useEffect(() => {
    if (!listOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [listOpen])

  const productMap = useMemo(() => {
    const m = new Map<string, ProductListItem>()
    for (const p of products) m.set(p.id, p)
    return m
  }, [products])

  const photoFallback = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of products) {
      if (!p.category_id || m.has(p.category_id)) continue
      const img = p.images?.find(Boolean)
      if (img) m.set(p.category_id, mediaUrl(img))
    }
    return m
  }, [products])

  const yigimCountByCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const y of yigims) {
      const isCombo = y.type === 'combo'
      if (isCombo) {
        const ids = new Set<string>()
        for (const it of y.items ?? []) {
          const p = productMap.get(it.product_id)
          if (p?.category_id) ids.add(p.category_id)
        }
        for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1)
      } else {
        const p = y.product_id ? productMap.get(y.product_id) : undefined
        if (p?.category_id) m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1)
      }
    }
    return m
  }, [yigims, productMap])

  const selectedCat = useMemo(
    () => categories.find((c) => c.id === catId) ?? null,
    [categories, catId],
  )

  const activeSubs = useMemo(
    () => (selectedCat?.children ?? []).filter((s) => s.status === 'active'),
    [selectedCat],
  )

  const selectedSub = useMemo(
    () => activeSubs.find((s) => s.id === subId) ?? null,
    [activeSubs, subId],
  )

  const setFilter = (nextCat: string, nextSub = '') => {
    const sp = new URLSearchParams(params)
    if (nextCat) sp.set('cat', nextCat)
    else sp.delete('cat')
    if (nextSub) sp.set('sub', nextSub)
    else sp.delete('sub')
    setParams(sp, { replace: true })
    setListOpen(false)
  }

  const cards = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list: YigimCardData[] = []

    for (const y of yigims) {
      const isCombo = y.type === 'combo'
      const product = y.product_id ? productMap.get(y.product_id) : undefined
      const title = isCombo
        ? y.name?.trim() || t('home.comboPool')
        : y.product_name || product?.name || t('home.productPool')

      const categoryId = product?.category_id
      const categoryName = product?.category_name

      if (catId) {
        if (isCombo) {
          const hit = (y.items ?? []).some((it) => {
            const p = productMap.get(it.product_id)
            if (!p || p.category_id !== catId) return false
            if (subId && p.subcategory_id !== subId) return false
            return true
          })
          if (!hit) continue
        } else {
          if (categoryId !== catId) continue
          if (subId && product?.subcategory_id !== subId) continue
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

      const price = isCombo ? comboPrice(y, productMap) : product?.price
      const unit = isCombo
        ? 'dona'
        : product
          ? unitLabel(product.unit)
          : undefined
      const image =
        firstImage(
          y.images,
          product?.images,
          ...(y.items ?? []).map((it) => productMap.get(it.product_id)?.images),
        ) ?? undefined

      list.push({
        yigim: {
          ...y,
          images: image
            ? [image, ...(y.images ?? []).filter((i) => i !== image)]
            : y.images,
        },
        title,
        price,
        unit,
        categoryName,
        location: categoryName
          ? `${categoryName}${product?.subcategory_name ? ` · ${product.subcategory_name}` : ''}`
          : t('home.localPool'),
      })
    }

    return list
  }, [yigims, productMap, query, catId, subId, t])

  const showCategoryStrip = !catId
  const showSubChips = Boolean(catId && activeSubs.length > 0)

  const categoryList = (
    <nav className="space-y-1">
      <button
        type="button"
        onClick={() => setFilter('')}
        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
          !catId
            ? 'bg-[var(--brand)] text-white shadow-[var(--shadow-btn)]'
            : 'text-[var(--ink)] hover:bg-[var(--sand)]'
        }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            !catId ? 'bg-white/20' : 'bg-[var(--brand-soft)] text-[var(--brand)]'
          }`}
        >
          <LayoutGrid size={18} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px] font-extrabold">
          {t('categories.all')}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
            !catId ? 'bg-white/20 text-white' : 'bg-[var(--sand)] text-[var(--muted)]'
          }`}
        >
          {yigims.length}
        </span>
      </button>

      {categories.map((c) => {
        const catActive = catId === c.id
        const count = yigimCountByCat.get(c.id) ?? 0
        const photo = c.image?.trim()
          ? mediaUrl(c.image)
          : photoFallback.get(c.id) ?? ''
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilter(c.id)}
            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
              catActive
                ? 'bg-[var(--brand)] text-white shadow-[var(--shadow-btn)]'
                : 'text-[var(--ink)] hover:bg-[var(--sand)]'
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-[var(--sand)] ring-1 ring-[var(--line)]">
              {photo ? (
                <img src={photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <span
                  className={`flex h-full w-full items-center justify-center text-sm font-extrabold ${
                    catActive ? 'text-white' : 'text-[var(--brand)]'
                  }`}
                >
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-extrabold">
              {c.name}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                catActive
                  ? 'bg-white/20 text-white'
                  : 'bg-[var(--sand)] text-[var(--muted)]'
              }`}
            >
              {count}
            </span>
          </button>
        )
      })}
    </nav>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-[var(--green)] sm:text-2xl">
            {t('categories.title')}
          </h1>
          <nav className="mt-1.5 flex flex-wrap items-center gap-1 text-[13px] font-bold">
            <button
              type="button"
              onClick={() => setFilter('')}
              className={
                !catId
                  ? 'text-[var(--brand)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }
            >
              {t('common.all')}
            </button>
            {selectedCat && (
              <>
                <ChevronRight size={13} className="text-[var(--muted)]/70" />
                <button
                  type="button"
                  onClick={() => setFilter(selectedCat.id)}
                  className={
                    !subId
                      ? 'text-[var(--brand)]'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }
                >
                  {selectedCat.name}
                </button>
              </>
            )}
            {selectedSub && (
              <>
                <ChevronRight size={13} className="text-[var(--muted)]/70" />
                <span className="text-[var(--brand)]">{selectedSub.name}</span>
              </>
            )}
          </nav>
        </div>

        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-sm font-extrabold text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)] lg:hidden"
        >
          <LayoutGrid size={15} className="text-[var(--brand)]" />
          {t('nav.categories')}
          {catId && <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />}
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-[var(--line)] focus-within:ring-[var(--brand)]/35">
        <Search size={16} className="shrink-0 text-[var(--muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('common.search')}
          className="min-w-0 w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[var(--muted)]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-[var(--muted)] hover:text-[var(--ink)]"
            aria-label={t('common.clear')}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-2xl bg-white px-4 py-5 text-center text-sm text-rose-600 ring-1 ring-[var(--line)]">
          {error}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)] xl:gap-5">
        {/* LEFT categories — desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-[1.35rem] bg-white p-4 shadow-[0_10px_40px_-18px_rgba(15,61,46,0.18)] ring-1 ring-[var(--line)]">
            <p className="mb-3 text-[11px] font-extrabold tracking-[0.12em] text-[var(--muted)] uppercase">
              {t('nav.categories')}
            </p>
            {categoryList}
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="aspect-square animate-pulse rounded-2xl bg-white ring-1 ring-[var(--line)]"
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="aspect-[4/5] animate-pulse rounded-[1.15rem] bg-white ring-1 ring-[var(--line)]"
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {showCategoryStrip && categories.length > 0 && (
                <section className="rounded-[1.25rem] bg-white/70 p-3 ring-1 ring-[var(--line)] sm:p-4 lg:hidden">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-[11px] font-extrabold tracking-[0.12em] text-[var(--muted)] uppercase">
                      {t('nav.categories')}
                    </h2>
                    <span className="text-[11px] font-bold text-[var(--muted)]">
                      {t('categories.count', { count: categories.length })}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-4">
                    {categories.map((c) => {
                      const photo = c.image?.trim()
                        ? mediaUrl(c.image)
                        : photoFallback.get(c.id) ?? ''
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setFilter(c.id)}
                          className="group flex min-w-0 flex-col overflow-hidden rounded-2xl bg-[var(--sand)]/60 p-1.5 text-left transition hover:bg-white hover:ring-1 hover:ring-[var(--brand)]/30 sm:p-2"
                        >
                          <span className="aspect-square overflow-hidden rounded-xl bg-white shadow-sm">
                            <CategoryPhoto src={photo} name={c.name} />
                          </span>
                          <span className="mt-1.5 line-clamp-2 text-center text-[10px] font-extrabold text-[var(--ink)] break-words sm:text-[11px]">
                            {c.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              {showSubChips && (
                <section className="rounded-[1.25rem] bg-white/70 p-3 ring-1 ring-[var(--line)] sm:p-3.5">
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <h2 className="text-[11px] font-extrabold tracking-[0.12em] text-[var(--muted)] uppercase">
                      {t('categories.subs')}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setFilter('')}
                      className="text-[11px] font-extrabold text-[var(--brand)]"
                    >
                      {t('categories.back')}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setFilter(catId)}
                      className={`rounded-full px-3.5 py-2 text-[12px] font-extrabold transition ${
                        !subId
                          ? 'bg-[var(--brand)] text-white shadow-sm'
                          : 'bg-white text-[var(--ink)] ring-1 ring-[var(--line)] hover:ring-[var(--brand)]/35'
                      }`}
                    >
                      {t('common.all')}
                    </button>
                    {activeSubs.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setFilter(catId, s.id)}
                        className={`rounded-full px-3.5 py-2 text-[12px] font-extrabold transition ${
                          subId === s.id
                            ? 'bg-[var(--brand)] text-white shadow-sm'
                            : 'bg-white text-[var(--ink)] ring-1 ring-[var(--line)] hover:ring-[var(--brand)]/35'
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="space-y-3">
                <div className="flex items-end justify-between gap-2 px-0.5">
                  <h2 className="text-base font-extrabold text-[var(--ink)] sm:text-lg">
                    {selectedSub?.name ||
                      selectedCat?.name ||
                      t('categories.openYigims')}
                    <span className="ml-1.5 text-sm font-bold text-[var(--muted)]">
                      ({cards.length})
                    </span>
                  </h2>
                  {catId && !showSubChips && (
                    <button
                      type="button"
                      onClick={() => setFilter(subId ? catId : '')}
                      className="text-[11px] font-extrabold text-[var(--brand)]"
                    >
                      {t('categories.back')}
                    </button>
                  )}
                </div>

                {categories.length === 0 && cards.length === 0 ? (
                  <EmptyState text={t('categories.emptyLong')} />
                ) : cards.length === 0 ? (
                  <EmptyState text={t('categories.emptySection')} />
                ) : (
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 xl:grid-cols-3">
                    {cards.map((data) => (
                      <YigimCard key={data.yigim.id} data={data} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* Mobile categories sheet — bottom, not right */}
      {listOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#0f3d2e]/35 backdrop-blur-[2px]"
            aria-label={t('common.close')}
            onClick={() => setListOpen(false)}
          />
          <div className="relative z-[1] flex max-h-[min(88svh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.5rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3.5">
              <span className="text-base font-extrabold text-[var(--green)]">
                {t('nav.categories')}
              </span>
              <button
                type="button"
                onClick={() => setListOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sand)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {categoryList}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center rounded-[1.35rem] bg-white px-4 py-10 text-center ring-1 ring-[var(--line)]">
      <EmptyBox className="mb-2 h-28 w-36" />
      <p className="text-sm font-extrabold text-[var(--ink)]">{text}</p>
    </div>
  )
}
