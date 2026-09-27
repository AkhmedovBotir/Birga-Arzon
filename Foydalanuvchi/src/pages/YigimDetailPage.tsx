import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  CheckCircle2,
  Heart,
  Info,
  Layers,
  MapPin,
  Package,
  Scale,
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
import { YigimCard, type YigimCardData } from '../components/YigimCard'
import { YigimProgress } from '../components/YigimProgress'

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
  const [yigim, setYigim] = useState<Yigim | null>(null)
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [related, setRelated] = useState<YigimCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qty, setQty] = useState(1)
  const [fav, setFav] = useState(false)
  const [activeImg, setActiveImg] = useState(0)

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
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[var(--muted)] transition hover:text-[var(--ink)]"
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>
        {product?.category_id && (
          <Link
            to={`/kategoriyalar?cat=${encodeURIComponent(product.category_id)}`}
            className="text-sm font-extrabold text-[var(--brand)]"
          >
            {product.category_name} →
          </Link>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-6">
        <div className="space-y-3">
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
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isOpen ? t('yigim.open') : t('yigim.closedShort')}
              </span>
              <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-extrabold text-[var(--ink)] shadow-sm">
                {isCombo ? t('yigim.combo') : t('yigim.simple')}
              </span>
            </div>
            <button
              type="button"
              aria-label={t('common.favorite')}
              onClick={() => setFav((v) => !v)}
              className={`absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-sm transition ${
                fav ? 'text-rose-500' : 'text-[var(--muted)]'
              }`}
            >
              <Heart size={18} fill={fav ? 'currentColor' : 'none'} />
            </button>
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

        <div className="space-y-4 rounded-[1.5rem] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] sm:p-6">
          <div>
            <p className="text-xs font-extrabold tracking-wide text-[var(--brand)] uppercase">
              {isCombo ? t('yigim.comboPool') : t('yigim.productPool')}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--ink)] sm:text-[1.85rem]">
              {title}
            </h1>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)]">
              <MapPin size={14} className="text-[var(--brand)]" />
              {location}
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

          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex items-center rounded-xl bg-[var(--sand)] p-0.5 sm:p-1">
              <button
                type="button"
                className="flex h-11 w-10 items-center justify-center rounded-lg text-lg font-extrabold text-[var(--ink)] sm:w-11"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-extrabold sm:w-9">
                {qty}
              </span>
              <button
                type="button"
                className="flex h-11 w-10 items-center justify-center rounded-lg text-lg font-extrabold text-[var(--ink)] sm:w-11"
                onClick={() => setQty((q) => q + 1)}
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={onJoin}
              disabled={!isOpen}
              className="ba-btn min-w-0 flex-1 rounded-xl px-3 py-3.5 text-sm disabled:opacity-50 sm:px-4"
            >
              <ShoppingCart size={16} />
              <span className="truncate">
                {!isOpen
                  ? t('yigim.closedShort')
                  : inCart
                    ? t('yigim.update')
                    : t('yigim.join')}
                {isOpen && lineTotal != null && (
                  <span className="opacity-90"> · {formatSom(lineTotal)}</span>
                )}
              </span>
            </button>
          </div>
          {inCart && isOpen && (
            <p className="text-center text-xs font-semibold text-[var(--green)]">
              {t('yigim.inCartHint')}
            </p>
          )}
          {!isOpen && (
            <p className="text-center text-xs font-semibold text-rose-600">
              {t('yigim.closedHint')}
            </p>
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
                className="rounded-xl bg-[var(--sand)]/70 px-3 py-2.5"
              >
                <p className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide text-[var(--muted)] uppercase">
                  <Icon size={11} />
                  {label}
                </p>
                <p className="mt-0.5 text-sm font-extrabold text-[var(--ink)]">
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
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--muted)]">
              {description}
            </p>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
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
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {related.map((data) => (
              <YigimCard key={data.yigim.id} data={data} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
