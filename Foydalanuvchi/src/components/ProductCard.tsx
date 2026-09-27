import { Heart, ShoppingCart, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { formatSom, mediaUrl } from '../config'

export type CatalogCard = {
  id: string
  name: string
  price: number
  unit: string
  image?: string
  discount?: number
  yigimLabel?: string
  yigimId?: string
}

type Props = {
  item: CatalogCard
  onAdd: () => void
}

export function ProductCard({ item, onAdd }: Props) {
  const { t } = useTranslation()

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col overflow-hidden rounded-[1.6rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-[var(--line)]"
    >
      <div className="relative aspect-[4/3] bg-[var(--sand)]">
        {item.image ? (
          <img
            src={mediaUrl(item.image)}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">🛒</div>
        )}
        {item.discount != null && item.discount > 0 && (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-[var(--brand)] px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm">
            -{item.discount}%
          </span>
        )}
        <button
          type="button"
          aria-label={t('common.favorite')}
          className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[var(--muted)] shadow-sm"
        >
          <Heart size={15} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="line-clamp-2 text-sm leading-snug font-extrabold text-[var(--ink)]">
          {item.name}
        </h3>
        <p className="text-base font-extrabold tracking-tight text-[var(--brand)]">
          {formatSom(item.price)}{' '}
          <span className="text-xs font-bold text-[var(--muted)]">
            {t('common.perUnit', { unit: item.unit })}
          </span>
        </p>
        {item.yigimLabel && (
          <p className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--green-mid)]">
            <Users size={12} />
            {t('yigim.poolLabel', { label: item.yigimLabel })}
          </p>
        )}
        <button
          type="button"
          onClick={onAdd}
          className="ba-btn mt-auto w-full px-3 py-2.5 text-sm"
        >
          <ShoppingCart size={15} />
          {t('yigim.addToCart')}
        </button>
      </div>
    </motion.article>
  )
}
