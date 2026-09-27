import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Package, Phone, X } from 'lucide-react'
import type { Order, OrderItem } from '../api/client'
import { formatSom, mediaUrl } from '../config'
import { phoneDisplay } from '../lib/phone'

export function ProductThumb({
  item,
  size = 'md',
}: {
  item: OrderItem
  size?: 'sm' | 'md' | 'lg'
}) {
  const cls =
    size === 'lg'
      ? 'h-16 w-16'
      : size === 'sm'
        ? 'h-10 w-10'
        : 'h-12 w-12'
  const src = mediaUrl(item.image)
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/80 ${cls}`}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <Package
          size={size === 'lg' ? 22 : 16}
          className="text-slate-400"
          strokeWidth={1.6}
        />
      )}
    </div>
  )
}

export function ProductStack({ items, max = 3 }: { items: OrderItem[]; max?: number }) {
  const list = items.slice(0, max)
  const extra = Math.max(0, items.length - max)
  return (
    <div className="flex items-center">
      {list.map((it, i) => (
        <div
          key={it.id}
          className="relative rounded-xl ring-2 ring-white"
          style={{ marginLeft: i === 0 ? 0 : -10, zIndex: list.length - i }}
        >
          <ProductThumb item={it} size="md" />
        </div>
      ))}
      {extra > 0 && (
        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
          +{extra}
        </span>
      )}
    </div>
  )
}

export function OrderDetailModal({
  order,
  onClose,
  footer,
  badge,
}: {
  order: Order
  onClose: () => void
  footer?: ReactNode
  badge?: ReactNode
}) {
  const { t } = useTranslation()
  const name =
    `${order.first_name} ${order.last_name}`.trim() || t('common.customer')
  const region = [order.viloyat_name, order.tuman_name]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[92svh] w-full max-w-md flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl sm:rounded-[1.75rem]">
        {/* Hero product strip */}
        <div className="relative bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 px-4 pt-4 pb-5 text-white">
          <div className="mb-3 flex items-start justify-between gap-2">
            {badge ?? (
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase backdrop-blur">
                {t('orders.order')}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-lg font-semibold tracking-tight">{name}</p>
          <p className="mt-0.5 text-sm text-blue-100">
            {phoneDisplay(order.phone)}
          </p>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {(order.items ?? []).map((it) => (
              <div
                key={it.id}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/20 ring-2 ring-white/30"
              >
                {mediaUrl(it.image) ? (
                  <img
                    src={mediaUrl(it.image)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Package size={22} className="text-white/70" />
                  </div>
                )}
                <span className="absolute right-1 bottom-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                  ×{it.qty}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4 grid gap-2.5 rounded-2xl bg-slate-50 p-3.5">
            <p className="flex items-center gap-2 text-sm text-slate-700">
              <Phone size={15} className="shrink-0 text-blue-600" />
              {phoneDisplay(order.phone)}
            </p>
            {region && (
              <p className="flex items-start gap-2 text-sm text-slate-700">
                <MapPin size={15} className="mt-0.5 shrink-0 text-blue-600" />
                <span>{region}</span>
              </p>
            )}
            {order.lat != null && order.lng != null && (
              <p className="pl-6 text-xs text-slate-400">
                {order.lat.toFixed(5)}, {order.lng.toFixed(5)}
              </p>
            )}
            {order.note && (
              <p className="rounded-xl bg-white px-3 py-2 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-100">
                {order.note}
              </p>
            )}
          </div>

          <p className="mb-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            {t('common.products')}
          </p>
          <ul className="space-y-2">
            {(order.items ?? []).map((it) => (
              <li
                key={it.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm"
              >
                <ProductThumb item={it} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">
                    {it.product_name}
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    {it.qty} {it.unit} · {formatSom(it.unit_price)}{' '}
                    {t('common.som')}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-blue-700">
                  {formatSom(it.unit_price * it.qty)}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-slate-100 bg-white px-4 py-3.5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              {t('common.total')}
            </span>
            <span className="text-lg font-semibold text-slate-900">
              {formatSom(order.total_amount)} {t('common.som')}
            </span>
          </div>
          {(order.delivery_fee ?? 0) > 0 && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2">
              <span className="text-sm font-medium text-blue-800">
                {t('orders.courierShare')}
              </span>
              <span className="text-sm font-semibold text-blue-900">
                {formatSom(order.delivery_fee ?? 0)} {t('common.som')}
              </span>
            </div>
          )}
          {footer}
        </div>
      </div>
    </div>
  )
}
