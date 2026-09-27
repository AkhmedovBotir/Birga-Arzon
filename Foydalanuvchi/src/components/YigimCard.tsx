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
  const {
    yigim,
    title,
    price,
    unit,
    location,
    discount,
  } = data
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
      className="flex flex-col overflow-hidden rounded-[1.15rem] bg-white shadow-[0_8px_28px_-12px_rgba(15,61,46,0.16)] ring-1 ring-[var(--line)] transition hover:ring-[var(--brand)]/35"
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
          {showDiscount && (
            <span className="absolute top-2.5 left-2.5 rounded-md bg-[var(--brand)] px-2 py-1 text-[11px] font-extrabold text-white shadow-sm">
              −{discount}%
            </span>
          )}
          <button
            type="button"
            aria-label={t('common.favorite')}
            onClick={stop}
            className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[var(--muted)] shadow-sm"
          >
            <Heart size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5 px-3.5 pt-3.5">
          <h3 className="line-clamp-2 text-[13px] leading-snug font-extrabold text-[var(--ink)] sm:text-sm">
            {title}
          </h3>

          <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--muted)]">
            <MapPin size={12} className="text-[var(--brand)]" />
            {resolvedLocation}
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

          <div className="mt-0.5 flex items-center gap-3 text-[10px] font-bold text-[var(--muted)]">
            <span className="inline-flex items-center gap-1">
              <Target size={11} className="text-[var(--green-mid)]" />
              {t('yigim.goalShort', { count: target })}
            </span>
            <span
              className={`inline-flex items-center gap-1 ${
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

      <div className="mt-auto flex gap-2 p-3.5 pt-2.5">
        <Link
          to={detailTo}
          className="inline-flex flex-1 items-center justify-center rounded-xl bg-[var(--sand)] px-2 py-2.5 text-[12px] font-extrabold text-[var(--ink)] transition hover:bg-[var(--sand-deep)]"
        >
          {t('common.details')}
        </Link>
        <button
          type="button"
          onClick={onJoin}
          disabled={!isOpen}
          className="ba-btn min-w-0 flex-[1.35] rounded-xl px-2 py-2.5 text-[12px] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {inCart ? <Check size={14} /> : <ShoppingCart size={14} />}
          <span className="truncate">
            {!isOpen
              ? t('yigim.closedShort')
              : inCart
                ? t('yigim.inCart')
                : t('yigim.joinShort')}
          </span>
        </button>
      </div>
    </motion.article>
  )
}
