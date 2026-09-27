import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Heart,
  Info,
  Layers,
  MapPin,
  Package,
  Scale,
  Share2,
  ShoppingCart,
  Target,
  Truck,
  Users,
} from 'lucide-react'
import {
  api,
  type ProductDetail,
  type ProductListItem,
  type Yigim,
} from '../api/client'
import { formatSom, mediaUrl } from '../config'
import { useCart, yigimCartKey } from '../cart/CartContext'
import { useFavorites } from '../favorites/FavoritesContext'
import { YigimCard, type YigimCardData } from '../components/YigimCard'
import { YigimProgress } from '../components/YigimProgress'
import { useSEO } from '../lib/seo'

function unitLabel(unit: string) {
  if (unit === 'litr') return 'l'
  if (unit === 'dona') return 'dona'
  return unit
}

function deltaToText(delta?: ProductDetail['description']) {
  if (!delta?.ops?.length) return ''
  return delta.ops
    .map((op) => (typeof op.insert === 'string' ? op.insert : ''))
    .join('')
    .trim()
}

export function YigimDetailPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { upsert, getByKey } = useCart()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [yigim, setYigim] = useState<Yigim | null>(null)
  useSEO(
    yigim?.name ? `${yigim.name}` : 'Yig‘im tafsilotlari',
    yigim?.name
      ? `${yigim.name} mahsulotini Birga Arzon orqali birgalikda ommaviy arzon narxda xarid qiling!`
      : undefined
  )
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [related, setRelated] = useState<YigimCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qty, setQty] = useState(1)
  const [activeImg, setActiveImg] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!id) return
    void (async () => {
      setLoading(true)
      setError('')
      setActiveImg(0)
      try {
        const [y, allProducts, allYigims] = await Promise.all([
          api.yigimGet(id),
          api.productsList().catch(() => ({ items: [] as ProductListItem[] })),
          api.yigimsList().catch(() => ({ items: [] as Yigim[] })),
        ])
        setYigim(y)
        const existing = getByKey(yigimCartKey(y.id))
        setQty(existing?.qty ?? 1)

        const productMap = new Map(
          (allProducts.items ?? []).map((p) => [p.id, p] as const),
        )

        let mainProduct: ProductDetail | null = null
        if (y.type === 'single' && y.product_id) {
          try {
            mainProduct = await api.productGet(y.product_id)
          } catch {
            mainProduct = (productMap.get(y.product_id) as ProductDetail) ?? null
          }
          setProduct(mainProduct)
          setProducts([])
        } else if (y.type === 'combo') {
          setProduct(null)
          setProducts(
            (y.items ?? [])
              .map((it) => productMap.get(it.product_id))
              .filter((p): p is ProductListItem => !!p),
          )
        }

        const categoryId =
          mainProduct?.category_id ||
          (y.items ?? [])
            .map((it) => productMap.get(it.product_id)?.category_id)
            .find(Boolean)

        const relatedCards: YigimCardData[] = []
        for (const ry of allYigims.items ?? []) {
          if (ry.id === y.id || ry.status !== 'active') continue
          const rp = ry.product_id ? productMap.get(ry.product_id) : undefined
          if (categoryId) {
            if (ry.type === 'combo') {
              const hit = (ry.items ?? []).some(
                (it) => productMap.get(it.product_id)?.category_id === categoryId,
              )
              if (!hit) continue
            } else if (rp?.category_id !== categoryId) {
              continue
            }
          }
          const rTitle =
            ry.type === 'combo'
              ? ry.name?.trim() || t('yigim.comboPool')
              : ry.product_name || rp?.name || t('yigim.productPool')
          const rPrice =
            ry.type === 'combo'
              ? (ry.items ?? []).reduce((s, it) => {
                  const p = productMap.get(it.product_id)
                  return s + (p?.price ?? 0) * (it.qty || 1)
                }, 0) || undefined
              : rp?.price
          const rImage =
            ry.images?.[0] ||
            rp?.images?.[0] ||
            ry.items?.[0]?.product_image
          relatedCards.push({
            yigim: {
              ...ry,
              images: rImage
                ? [rImage, ...(ry.images ?? []).filter((i) => i !== rImage)]
                : ry.images,
            },
            title: rTitle,
            price: rPrice,
            unit: ry.type === 'combo' ? 'dona' : rp ? unitLabel(rp.unit) : 'dona',
            categoryName: rp?.category_name,
            location: rp?.category_name || t('yigim.localPool'),
          })
          if (relatedCards.length >= 4) break
        }
        setRelated(relatedCards)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('yigim.notFound'))
        setYigim(null)
        setRelated([])
      } finally {
        setLoading(false)
      }
    })()
  }, [id, t])

  const isCombo = yigim?.type === 'combo'
  const title = useMemo(() => {
    if (!yigim) return ''
    if (isCombo) return yigim.name?.trim() || t('yigim.comboPool')
    return yigim.product_name || product?.name || t('yigim.productPool')
  }, [yigim, isCombo, product, t])

  const price = useMemo(() => {
    if (!yigim) return undefined
    if (isCombo) {
      if (products.length === 0) return undefined
      let total = 0
      for (const it of yigim.items ?? []) {
        const p = products.find((x) => x.id === it.product_id)
        if (p) total += p.price * (it.qty || 1)
      }
      return total || undefined
    }
    return product?.price
  }, [yigim, isCombo, product, products])

  const unit = isCombo
    ? 'dona'
    : product
      ? unitLabel(product.unit)
      : 'dona'

  const description = useMemo(() => deltaToText(product?.description), [product])

  const images = useMemo(() => {
    const list: string[] = []
    for (const img of yigim?.images ?? []) if (img) list.push(img)
    for (const img of product?.images ?? []) {
      if (img && !list.includes(img)) list.push(img)
    }
    for (const it of yigim?.items ?? []) {
      if (it.product_image && !list.includes(it.product_image)) {
        list.push(it.product_image)
      }
    }
    for (const p of products) {
      const img = p.images?.[0]
      if (img && !list.includes(img)) list.push(img)
    }
    return list
  }, [yigim, product, products])

  useEffect(() => {
    setActiveImg(0)
  }, [id, images.length])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-40 animate-pulse rounded-xl bg-[var(--sand)]" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="aspect-[5/4] animate-pulse rounded-[1.5rem] bg-white ring-1 ring-[var(--line)]" />
          <div className="h-80 animate-pulse rounded-[1.5rem] bg-white ring-1 ring-[var(--line)]" />
        </div>
      </div>
    )
  }

  if (error || !yigim) {
    return (
      <div className="mx-auto max-w-md px-2 pt-10 text-center">
        <p className="text-lg font-extrabold text-[var(--ink)]">
          {error || t('yigim.notFound')}
        </p>
        <Link
          to="/kategoriyalar"
          className="ba-btn mt-5 inline-flex px-5 py-3 text-sm"
        >
          {t('yigim.backToYigims')}
        </Link>
      </div>
    )
  }

  const target = Math.max(yigim.target_qty || 1, 1)
  const currentQty = Math.max(0, yigim.current_qty ?? 0)
  const remaining = Math.max(target - currentQty, 0)
  const pct = Math.min(100, Math.round((currentQty / target) * 100))
  const location = product
    ? `${product.category_name}${product.subcategory_name ? ` · ${product.subcategory_name}` : ''}`
    : isCombo
      ? t('yigim.comboSet')
      : t('yigim.localPool')
  const imgSrc = images[activeImg] ? mediaUrl(images[activeImg]) : ''
  const lineTotal = price != null ? price * qty : null
  const isOpen = yigim.status === 'active'
  const cartKey = yigimCartKey(yigim.id)
  const inCart = Boolean(getByKey(cartKey))

  const onJoin = () => {
    if (!isOpen) return
    upsert({
      key: cartKey,
      productId: yigim.product_id || yigim.id,
      name: title,
      price: price ?? 0,
      unit,
      image: images[0],
      yigimId: yigim.id,
      qty,
    })
    navigate('/savat')
  }

  const onShare = async () => {
    const url = window.location.href
    const shareTitle = title || 'Birga Arzon'
    const shareText = `${shareTitle} — Birga Arzon bilan birgalikda arzonroq xarid qiling!`

    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      navigator.canShare?.({ title: shareTitle, text: shareText, url })
    ) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url,
        })
        return
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = url
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      /* ignore */
    }
  }

  const howSteps = [
    {
      Icon: ShoppingCart,
      step: '1',
      title: t('yigim.step1Title'),
      text: t('yigim.step1Text'),
    },
    {
      Icon: Users,
      step: '2',
      title: t('yigim.step2Title'),
      text: t('yigim.step2Text'),
    },
    {
      Icon: Truck,
      step: '3',
      title: t('yigim.step3Title'),
      text: t('yigim.step3Text'),
    },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24 md:space-y-6 md:pb-8">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-extrabold text-[var(--muted)] transition hover:text-[var(--ink)]"
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>
        {product?.category_id && (
          <Link
            to={`/kategoriyalar?cat=${encodeURIComponent(product.category_id)}`}
            className="min-w-0 truncate text-right text-sm font-extrabold text-[var(--brand)]"
          >
            {product.category_name} →
          </Link>
        )}
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-3">
          <div className="relative overflow-hidden rounded-[1.5rem] bg-[var(--sand)] shadow-[var(--shadow-card)] ring-1 ring-[var(--line)]">
            <div className="aspect-[4/3] sm:aspect-[5/4] lg:aspect-[4/3]">
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="flex h-full items-center justify-center bg-cover bg-center text-[var(--green-mid)]"
                  style={{ backgroundImage: "url('/images/yigim-bg.png')" }}
                >
                  <span className="rounded-2xl bg-white/85 p-4 shadow-sm">
                    {isCombo ? <Layers size={40} /> : <Package size={40} />}
                  </span>
                </div>
              )}
            </div>
            <div className="absolute top-3 left-3 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase ${
                  isOpen
                    ? 'bg-[var(--green-soft)] text-[var(--green)]'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {isOpen ? t('yigim.open') : t('favorites.closed')}
              </span>
              <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-extrabold text-[var(--ink)] shadow-sm">
                {isCombo ? t('yigim.combo') : t('yigim.simple')}
              </span>
            </div>
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <button
                type="button"
                aria-label={t('common.share')}
                title={t('common.share')}
                onClick={onShare}
                className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-sm transition active:scale-90 ${
                  copied
                    ? 'text-[var(--green)]'
                    : 'text-[var(--muted)] hover:text-[var(--brand)]'
                }`}
              >
                {copied ? <Check size={18} /> : <Share2 size={18} />}
              </button>
              <button
                type="button"
                aria-label={t('common.favorite')}
                onClick={() => yigim && toggleFavorite(yigim.id)}
                className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-sm transition active:scale-90 ${
                  (yigim ? isFavorite(yigim.id) : false)
                    ? 'text-rose-500 fill-rose-500'
                    : 'text-[var(--muted)] hover:text-rose-500'
                }`}
              >
                <Heart
                  size={18}
                  fill={
                    (yigim ? isFavorite(yigim.id) : false)
                      ? 'currentColor'
                      : 'none'
                  }
                />
              </button>
            </div>
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={img + i}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-2 transition sm:h-16 sm:w-16 ${
                    i === activeImg
                      ? 'ring-[var(--brand)]'
                      : 'ring-transparent opacity-75 hover:opacity-100'
                  }`}
                >
                  <img
                    src={mediaUrl(img)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4 rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] sm:p-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-extrabold tracking-wide text-[var(--brand)] uppercase">
                {isCombo ? t('yigim.comboPool') : t('yigim.productPool')}
              </p>
              <button
                type="button"
                onClick={onShare}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sand)] px-2.5 py-1 text-xs font-bold text-[var(--ink)] transition hover:bg-[var(--sand-deep)] active:scale-95"
              >
                {copied ? (
                  <Check size={13} className="text-[var(--green)]" />
                ) : (
                  <Share2 size={13} />
                )}
                <span>
                  {copied ? t('common.linkCopied') : t('common.share')}
                </span>
              </button>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--ink)] break-words sm:text-[1.85rem]">
              {title}
            </h1>
            <p className="mt-2 inline-flex max-w-full items-center gap-1.5 text-sm font-semibold text-[var(--muted)] truncate">
              <MapPin size={14} className="shrink-0 text-[var(--brand)]" />
              <span className="truncate">{location}</span>
            </p>
          </div>

          {price != null && (
            <div>
              <p className="text-3xl font-extrabold tracking-tight text-[var(--brand)]">
                {formatSom(price)}{' '}
                <span className="text-base font-bold">
                  {t('common.perUnit', { unit })}
                </span>
              </p>
              {product?.unit_size != null && product.unit_size !== 1 && (
                <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                  {t('yigim.measure', { size: product.unit_size, unit })}
                </p>
              )}
            </div>
          )}

          {isOpen ? (
            <>
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex items-center justify-between rounded-xl bg-[var(--sand)] p-1 sm:justify-center">
                  <span className="px-2.5 text-xs font-bold text-[var(--muted)] sm:hidden">
                    {t('cart.qty') || 'Miqdor'}:
                  </span>
                  <div className="flex items-center">
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-extrabold text-[var(--ink)] transition hover:bg-black/5 active:scale-95 sm:h-11 sm:w-11"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      aria-label="Kamaytirish"
                    >
                      −
                    </button>
                    <span className="w-9 text-center text-sm font-extrabold">
                      {qty}
                    </span>
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-extrabold text-[var(--ink)] transition hover:bg-black/5 active:scale-95 sm:h-11 sm:w-11"
                      onClick={() => setQty((q) => q + 1)}
                      aria-label="Ko'paytirish"
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onJoin}
                  className="ba-btn min-w-0 flex-1 rounded-xl px-4 py-3 text-sm sm:py-3.5"
                >
                  <ShoppingCart size={16} className="shrink-0" />
                  <span className="truncate">
                    {inCart ? t('yigim.update') : t('yigim.join')}
                    {lineTotal != null && (
                      <span className="opacity-90"> · {formatSom(lineTotal)}</span>
                    )}
                  </span>
                </button>
              </div>
              {inCart && (
                <p className="text-center text-xs font-semibold text-[var(--green)]">
                  {t('yigim.inCartHint')}
                </p>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-rose-200/90 bg-rose-50/80 p-4 text-center sm:p-5">
              <div className="inline-flex items-center gap-2 text-sm font-extrabold text-rose-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-600 font-black">
                  ✕
                </span>
                {t('favorites.closedAlert')}
              </div>
              <p className="mt-1.5 text-xs font-semibold leading-relaxed text-rose-600/90">
                {t('favorites.closedAlertHint')}
              </p>
            </div>
          )}

          <div className="space-y-2.5 rounded-2xl bg-[var(--surface)] p-4">
            <YigimProgress
              current={currentQty}
              target={target}
              unit={unit}
              size="md"
            />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <Target size={12} className="text-[var(--green-mid)]" />
                {t('yigim.goal', { count: target, unit })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users size={12} className="text-[var(--brand)]" />
                {t('yigim.remaining', { count: remaining, unit })}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[var(--green)]">
                {t('yigim.donePct', { pct })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              {
                Icon: Scale,
                label: t('yigim.unitLabel'),
                value: unit,
              },
              {
                Icon: Package,
                label: t('yigim.stock'),
                value:
                  product?.stock != null
                    ? `${product.stock} ${unit}`
                    : isCombo
                      ? t('yigim.productsCount', {
                          count: yigim.items?.length ?? 0,
                        })
                      : '—',
              },
            ].map(({ Icon, label, value }) => (
              <div
                key={label}
                className="min-w-0 rounded-xl bg-[var(--sand)]/70 px-3 py-2.5"
              >
                <p className="flex items-center gap-1 text-[10px] font-bold tracking-wide text-[var(--muted)] uppercase truncate">
                  <Icon size={11} className="shrink-0" />
                  <span className="truncate">{label}</span>
                </p>
                <p className="mt-0.5 truncate text-sm font-extrabold text-[var(--ink)]">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {isCombo && (yigim.items?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-extrabold text-[var(--ink)]">
                {t('yigim.contents', { count: yigim.items!.length })}
              </h2>
              <ul className="space-y-2">
                {(yigim.items ?? []).map((it) => {
                  const p = products.find((x) => x.id === it.product_id)
                  return (
                    <li
                      key={it.product_id}
                      className="flex items-center gap-3 rounded-xl bg-[var(--sand)]/60 px-3 py-2.5"
                    >
                      <div className="h-12 w-12 overflow-hidden rounded-xl bg-white">
                        {(it.product_image || p?.images?.[0]) && (
                          <img
                            src={mediaUrl(it.product_image || p?.images?.[0])}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[var(--ink)]">
                          {it.product_name || p?.name || t('common.product')}
                        </p>
                        <p className="text-xs font-semibold text-[var(--muted)]">
                          {it.qty} {p ? unitLabel(p.unit) : 'dona'}
                          {p
                            ? ` · ${formatSom(p.price)} ${t('common.som')}`
                            : ''}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      <section className="rounded-[1.5rem] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] sm:p-6">
        <h2 className="inline-flex items-center gap-2 text-lg font-extrabold text-[var(--ink)]">
          <Info size={18} className="text-[var(--brand)]" />
          {t('home.howItWorks')}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {howSteps.map(({ Icon, step, title: stepTitle, text }) => (
            <div
              key={step}
              className="rounded-2xl bg-[var(--surface)] px-4 py-3.5"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="text-[10px] font-extrabold tracking-wide text-[var(--muted)] uppercase">
                    {t('yigim.step', { n: step })}
                  </p>
                  <p className="text-sm font-extrabold text-[var(--ink)]">
                    {stepTitle}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed font-semibold text-[var(--muted)]">
                {text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {(description || (!isCombo && product)) && (
        <section className="rounded-[1.5rem] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] sm:p-6">
          <h2 className="text-lg font-extrabold text-[var(--ink)]">
            {t('yigim.aboutProduct')}
          </h2>
          {description ? (
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--muted)]">
              {description}
            </p>
          ) : (
            <p className="mt-3 break-words text-sm text-[var(--muted)]">
              {t('yigim.aboutFallback', { title })}
            </p>
          )}
          {!isCombo && product && (
            <ul className="mt-4 space-y-2">
              {[
                product.category_name &&
                  t('yigim.category', { name: product.category_name }),
                product.subcategory_name &&
                  t('yigim.subcategory', { name: product.subcategory_name }),
                t('yigim.unitRow', { unit: unitLabel(product.unit) }),
                product.stock != null &&
                  t('yigim.stockRow', { count: product.stock }),
              ]
                .filter(Boolean)
                .map((row) => (
                  <li
                    key={String(row)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]"
                  >
                    <CheckCircle2
                      size={15}
                      className="text-[var(--green-bright)]"
                    />
                    {row}
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

      {related.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-lg font-extrabold text-[var(--ink)] sm:text-xl">
              {t('yigim.related')}
            </h2>
            <Link
              to={
                product?.category_id
                  ? `/kategoriyalar?cat=${encodeURIComponent(product.category_id)}`
                  : '/kategoriyalar'
              }
              className="text-sm font-extrabold text-[var(--brand)]"
            >
              {t('common.seeAllArrow')}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {related.map((data) => (
              <YigimCard key={data.yigim.id} data={data} />
            ))}
          </div>
        </section>
      )}

      {/* Floating toast notification when link copied */}
      {copied && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-[var(--ink)]/90 px-4 py-2.5 text-xs font-extrabold text-white shadow-xl backdrop-blur-md transition sm:bottom-8">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-[var(--green-bright)]" />
            <span>{t('common.linkCopied')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
