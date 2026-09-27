import { type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Check,
  Heart,
  Layers,
  MapPin,
  Package,
  ShoppingCart,
  Target,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { formatSom, mediaUrl } from '../config'
import type { Yigim } from '../api/client'
import { useCart, yigimCartKey } from '../cart/CartContext'
import { useFavorites } from '../favorites/FavoritesContext'
import { YigimProgress } from './YigimProgress'

export type YigimCardData = {
  yigim: Yigim
  title: string
  price?: number
  unit?: string
  categoryName?: string
  location?: string
  currentQty?: number
  discount?: number
}

type Props = {
  data: YigimCardData
}

export function YigimCard({ data }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { upsert, getByKey } = useCart()
  const { isFavorite, toggleFavorite } = useFavorites()
  const {
    yigim,
    title,
    price,
    unit,
    location,
    discount,
  } = data
  const fav = isFavorite(yigim.id)
  const resolvedLocation = location || t('yigim.uzbekistan')
  const isCombo = yigim.type === 'combo'
  const isOpen = yigim.status === 'active'
  const image = yigim.images?.[0]
  const target = Math.max(yigim.target_qty || 1, 1)
  const currentQty = Math.max(0, data.currentQty ?? yigim.current_qty ?? 0)
  const unitSuffix = unit || (isCombo ? 'dona' : 'kg')
  const showDiscount = discount != null && discount > 0
  const oldPrice =
    showDiscount && price != null
      ? Math.round(price / (1 - discount / 100))
      : null

  const imgSrc = image?.startsWith('http') ? image : mediaUrl(image)
  const detailTo = `/yigim/${yigim.id}`
  const cartKey = yigimCartKey(yigim.id)
  const inCart = Boolean(getByKey(cartKey))

  const stop = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const onToggleFav = (e: MouseEvent) => {
    stop(e)
    toggleFavorite(yigim.id)
  }

  const onJoin = (e: MouseEvent) => {
    stop(e)
    if (!isOpen) return
    upsert({
      key: cartKey,
      productId: yigim.product_id || yigim.id,
      name: title,
      price: price ?? 0,
      unit: unitSuffix,
      image: yigim.images?.[0],
      yigimId: yigim.id,
      qty: getByKey(cartKey)?.qty ?? 1,
    })
    navigate('/savat')
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-w-0 flex-col overflow-hidden rounded-[1.15rem] bg-white shadow-[0_8px_28px_-12px_rgba(15,61,46,0.16)] ring-1 ring-[var(--line)] transition hover:ring-[var(--brand)]/35"
    >
      <Link to={detailTo} className="block focus:outline-none">
        <div className="relative aspect-[5/4] bg-[var(--sand)]">
          {imgSrc ? (
            <img src={imgSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="flex h-full items-center justify-center bg-cover bg-center text-[var(--green-mid)]"
              style={{ backgroundImage: "url('/images/yigim-bg.png')" }}
            >
              <span className="rounded-2xl bg-white/85 p-3 shadow-sm">
                {isCombo ? <Layers size={32} /> : <Package size={32} />}
              </span>
            </div>
          )}
          {!isOpen ? (
            <span className="absolute top-2.5 left-2.5 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm">
              {t('favorites.closed') || 'Yopilgan'}
            </span>
          ) : showDiscount ? (
            <span className="absolute top-2.5 left-2.5 rounded-md bg-[var(--brand)] px-2 py-1 text-[11px] font-extrabold text-white shadow-sm">
              −{discount}%
            </span>
          ) : null}
          <button
            type="button"
            aria-label={t('common.favorite')}
            onClick={onToggleFav}
            className={`absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm transition active:scale-90 ${
              fav
                ? 'text-rose-500 shadow-rose-200'
                : 'text-[var(--muted)] hover:text-rose-500'
            }`}
          >
            <Heart size={15} fill={fav ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5 px-3 pt-3 sm:px-3.5 sm:pt-3.5">
          <h3 className="line-clamp-2 text-[12.5px] leading-snug font-extrabold text-[var(--ink)] break-words sm:text-sm">
            {title}
          </h3>

          <p className="inline-flex max-w-full items-center gap-1 text-[11px] font-semibold text-[var(--muted)] truncate">
            <MapPin size={12} className="shrink-0 text-[var(--brand)]" />
            <span className="truncate">{resolvedLocation}</span>
          </p>

          {price != null && (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-lg leading-none font-extrabold tracking-tight text-[var(--brand)]">
                {formatSom(price)}{' '}
                <span className="text-xs font-bold">
                  {t('common.perUnit', { unit: unitSuffix })}
                </span>
              </p>
              {oldPrice != null && (
                <p className="text-xs font-semibold text-[var(--muted)] line-through">
                  {formatSom(oldPrice)}
                </p>
              )}
            </div>
          )}

          <YigimProgress
            current={currentQty}
            target={target}
            unit={unitSuffix}
            size="sm"
            className="mt-1"
          />

          <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px] font-bold text-[var(--muted)]">
            <span className="inline-flex shrink-0 items-center gap-1">
              <Target size={11} className="text-[var(--green-mid)]" />
              {t('yigim.goalShort', { count: target })}
            </span>
            <span
              className={`inline-flex shrink-0 items-center gap-1 ${
                isOpen ? 'text-[var(--green-mid)]' : 'text-rose-500'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isOpen ? 'bg-[var(--green-bright)]' : 'bg-rose-500'
                }`}
              />
              {isOpen ? t('yigim.open') : t('yigim.closedShort')}
            </span>
          </div>
        </div>
      </Link>

      <div className="mt-auto flex flex-col gap-1.5 p-2.5 pt-2 sm:flex-row sm:gap-2 sm:p-3.5 sm:pt-2.5">
        {isOpen ? (
          <>
            <button
              type="button"
              onClick={onJoin}
              className="ba-btn min-w-0 w-full rounded-xl py-2 px-2 text-[12px] font-extrabold sm:order-2 sm:flex-[1.35] sm:py-2.5"
            >
              {inCart ? (
                <Check size={14} className="shrink-0" />
              ) : (
                <ShoppingCart size={14} className="shrink-0" />
              )}
              <span className="truncate">
                {inCart ? t('yigim.inCart') : t('yigim.joinShort')}
              </span>
            </button>
            <Link
              to={detailTo}
              className="inline-flex min-w-0 w-full items-center justify-center rounded-xl bg-[var(--sand)] py-1.5 px-2 text-[12px] font-extrabold text-[var(--ink)] transition hover:bg-[var(--sand-deep)] sm:order-1 sm:flex-1 sm:py-2.5"
            >
              <span className="truncate">{t('common.details')}</span>
            </Link>
          </>
        ) : (
          <Link
            to={detailTo}
            className="inline-flex min-w-0 w-full items-center justify-center rounded-xl bg-[var(--sand)] py-2.5 px-3 text-[12px] font-extrabold text-[var(--ink)] transition hover:bg-[var(--sand-deep)]"
          >
            <span className="truncate">{t('favorites.viewClosed') || t('common.details')}</span>
          </Link>
        )}
      </div>
    </motion.article>
  )
}
