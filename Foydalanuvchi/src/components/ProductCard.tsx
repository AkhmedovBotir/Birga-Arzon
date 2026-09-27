import { Link } from 'react-router-dom'
import { Heart, ShoppingCart, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { formatSom, mediaUrl } from '../config'
import { useFavorites } from '../favorites/FavoritesContext'

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
  const { isFavorite, toggleFavorite } = useFavorites()
  const favId = item.yigimId || item.id
  const isFav = isFavorite(favId)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-w-0 flex-col overflow-hidden rounded-[1.25rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-[var(--line)]"
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
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            toggleFavorite(favId)
          }}
          className={`absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm transition active:scale-90 ${
            isFav
              ? 'text-rose-500 fill-rose-500'
              : 'text-[var(--muted)] hover:text-rose-500'
          }`}
        >
          <Heart size={15} fill={isFav ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-3.5">
        <h3 className="line-clamp-2 text-sm leading-snug font-extrabold text-[var(--ink)] break-words">
          {item.name}
        </h3>
        <p className="text-base font-extrabold tracking-tight text-[var(--brand)]">
          {formatSom(item.price)}{' '}
          <span className="text-xs font-bold text-[var(--muted)]">
            {t('common.perUnit', { unit: item.unit })}
          </span>
        </p>
        {item.yigimLabel && (
          <p className="inline-flex max-w-full items-center gap-1 text-[11px] font-bold text-[var(--green-mid)] truncate">
            <Users size={12} className="shrink-0" />
            <span className="truncate">{t('yigim.poolLabel', { label: item.yigimLabel })}</span>
          </p>
        )}
        <div className="mt-auto flex flex-col gap-1.5 pt-2 sm:flex-row sm:gap-2">
          <button
            type="button"
            onClick={onAdd}
            className={`ba-btn min-w-0 w-full rounded-xl py-2 px-2.5 text-[12px] font-extrabold sm:py-2.5 ${
              item.yigimId ? 'sm:order-2 sm:flex-[1.35]' : ''
            }`}
          >
            <ShoppingCart size={14} className="shrink-0" />
            <span className="truncate">{t('yigim.addToCart')}</span>
          </button>
          {item.yigimId && (
            <Link
              to={`/yigim/${item.yigimId}`}
              className="inline-flex min-w-0 w-full items-center justify-center rounded-xl bg-[var(--sand)] py-1.5 px-2.5 text-[12px] font-extrabold text-[var(--ink)] transition hover:bg-[var(--sand-deep)] sm:order-1 sm:flex-1 sm:py-2.5"
            >
              <span className="truncate">{t('common.details')}</span>
            </Link>
          )}
        </div>
      </div>
    </motion.article>
  )
}
