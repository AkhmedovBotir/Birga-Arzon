import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { api, type Order } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { EmptyBox } from '../components/Mascot'
import { formatSom, mediaUrl } from '../config'

const STATUS_KEYS = [
  'waiting',
  'ready',
  'assigned',
  'delivered',
  'cancelled',
] as const

function statusTone(status: string) {
  switch (status) {
    case 'waiting':
      return 'bg-amber-50 text-amber-800 ring-amber-200'
    case 'ready':
      return 'bg-sky-50 text-sky-800 ring-sky-200'
    case 'assigned':
      return 'bg-blue-50 text-blue-800 ring-blue-200'
    case 'delivered':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200'
    case 'cancelled':
      return 'bg-rose-50 text-rose-700 ring-rose-200'
    default:
      return 'bg-slate-50 text-slate-700 ring-slate-200'
  }
}

export function OrdersPage() {
  const { t, i18n } = useTranslation()
  const { token, isAuthenticated, loading: authLoading } = useAuth()
  const [items, setItems] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const statusLabel = (status: string, fallback?: string) =>
    (STATUS_KEYS as readonly string[]).includes(status)
      ? t(`orders.${status}`)
      : fallback || status

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const res = await api.myOrders(token)
      setItems(res.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orders.loadError'))
    } finally {
      setLoading(false)
    }
  }, [token, t])

  useEffect(() => {
    if (token) void load()
    else setLoading(false)
  }, [token, load])

  if (authLoading) {
    return (
      <p className="py-16 text-center text-sm font-bold text-[var(--muted)]">
        {t('common.loading')}
      </p>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-2 pt-10 text-center">
        <EmptyBox className="mb-4 h-40 w-52" />
        <h1 className="text-xl font-extrabold text-[var(--ink)]">
          {t('orders.loginRequired')}
        </h1>
        <Link to="/kirish" className="ba-btn mt-6 px-5 py-3 text-sm">
          {t('common.login')}
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <p className="py-16 text-center text-sm font-bold text-[var(--muted)]">
        {t('common.loading')}
      </p>
    )
  }

  if (!items.length) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-2 pt-10 text-center md:pt-16">
        <EmptyBox className="mb-4 h-40 w-52 sm:h-48 sm:w-60" />
        <h1 className="text-xl font-extrabold text-[var(--ink)] sm:text-2xl">
          {t('orders.emptyLong')}
        </h1>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--muted)]">
          {t('orders.emptyHintLong')}
        </p>
        <Link to="/kategoriyalar" className="ba-btn mt-6 px-5 py-3 text-sm">
          {t('orders.goToYigims')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--green)]">
          {t('orders.listTitle')}
        </h1>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-bold text-[var(--ink)] ring-1 ring-[var(--line)]"
        >
          <RefreshCw size={15} />
          {t('common.refresh')}
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {items.map((o) => {
          const first = o.items?.[0]
          const extra = Math.max(0, (o.items?.length ?? 0) - 1)
          return (
            <Link
              key={o.id}
              to={`/buyurtmalar/${o.id}`}
              className="block overflow-hidden rounded-[1.35rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] transition hover:ring-[var(--brand)]/40 active:scale-[0.99]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${statusTone(o.status)}`}
                >
                  {statusLabel(o.status, o.status_label)}
                </span>
                <span className="text-xs font-bold text-[var(--muted)]">
                  {new Date(o.created_at).toLocaleString(i18n.language)}
                </span>
              </div>

              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--sand)]">
                  {first?.image ? (
                    <img
                      src={mediaUrl(first.image)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xl">📦</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-[var(--ink)]">
                    {first?.product_name || t('orders.fallbackName')}
                    {extra > 0 ? ` +${extra}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-[var(--muted)]">
                    {t('orders.itemsCountShort', {
                      count: (o.items ?? []).reduce((s, i) => s + i.qty, 0),
                    })}
                  </p>
                  <p className="mt-1 text-sm font-extrabold text-[var(--brand)]">
                    {formatSom(o.payable_amount ?? o.total_amount)}{' '}
                    {t('common.som')}
                  </p>
                  {o.needs_payment && (
                    <p className="mt-1 text-[11px] font-extrabold text-[var(--brand)]">
                      {t('payment.payNow')} →
                    </p>
                  )}
                </div>
                <ChevronRight
                  size={20}
                  className="shrink-0 text-[var(--muted)]"
                />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
