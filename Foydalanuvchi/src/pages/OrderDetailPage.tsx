import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ChevronLeft,
  CreditCard,
  KeyRound,
  MapPin,
  Phone,
  Truck,
  UserRound,
} from 'lucide-react'
import { api, type Order } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { formatSom, mediaUrl } from '../config'
import { phoneDisplay } from '../lib/phone'

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

export function OrderDetailPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { token, isAuthenticated, loading: authLoading } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const statusLabel = (status: string, fallback?: string) =>
    (STATUS_KEYS as readonly string[]).includes(status)
      ? t(`orders.${status}`)
      : fallback || status

  const load = useCallback(async () => {
    if (!token || !id) return
    setLoading(true)
    setError('')
    try {
      let o = await api.orderGet(token, id)
      if (o.needs_payment && o.payment_status === 'pending') {
        try {
          const p = await api.orderPayment(token, id)
          if (p.payment_status === 'paid') {
            o = await api.orderGet(token, id)
          }
        } catch {
          // ignore
        }
      }
      setOrder(o)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orders.loadError'))
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [token, id, t])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/kirish', { state: { from: `/buyurtmalar/${id}` }, replace: true })
      return
    }
    if (token && id) void load()
  }, [authLoading, isAuthenticated, token, id, load, navigate])

  if (authLoading || loading) {
    return (
      <p className="py-16 text-center text-sm font-bold text-[var(--muted)]">
        {t('common.loading')}
      </p>
    )
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-2 pt-6 text-center">
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {error || t('orders.notFound')}
        </p>
        <Link
          to="/buyurtmalar"
          className="inline-flex items-center gap-1 text-sm font-extrabold text-[var(--brand)]"
        >
          <ChevronLeft size={16} />
          {t('orders.backToOrders')}
        </Link>
      </div>
    )
  }

  const isPaid =
    order.payment_status === 'paid' || order.payment_status === 'cod'
  const showCode =
    Boolean(order.delivery_code) &&
    isPaid &&
    (order.status === 'waiting' ||
      order.status === 'ready' ||
      order.status === 'assigned')

  const fullName =
    `${order.first_name} ${order.last_name}`.trim() || t('profile.user')
  const region = [order.viloyat_name, order.tuman_name]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <Link
          to="/buyurtmalar"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]"
        >
          <ChevronLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold text-[var(--ink)]">
            {t('orders.detail')}
          </h1>
          <p className="text-xs font-bold text-[var(--muted)]">
            {new Date(order.created_at).toLocaleString(i18n.language)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${statusTone(order.status)}`}
        >
          {statusLabel(order.status, order.status_label)}
        </span>
      </div>

      {order.needs_payment && (
        <Link
          to={`/buyurtmalar/${order.id}/tolov`}
          className="ba-btn flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px]"
        >
          <CreditCard size={18} />
          {t('payment.payNow')}
        </Link>
      )}

      {(isPaid) && (
        <p className="rounded-[1.15rem] bg-[var(--green-soft)] px-4 py-3 text-center text-sm font-extrabold text-[var(--green)] ring-1 ring-[var(--green)]/15">
          {order.payment_status === 'cod'
            ? t('payment.codOk')
            : t('payment.paidOk')}
        </p>
      )}

      {order.needs_payment && !showCode && (
        <p className="rounded-[1.15rem] bg-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-800 ring-1 ring-amber-200/80">
          {t('orders.codeAfterPay')}
        </p>
      )}

      {showCode && (
        <section className="flex items-center gap-3 rounded-[1.35rem] bg-[var(--green-soft)] px-4 py-4 ring-1 ring-[var(--green)]/20">
          <KeyRound className="shrink-0 text-[var(--green)]" size={26} />
          <div>
            <p className="text-[10px] font-extrabold tracking-wide text-[var(--green)] uppercase">
              {t('orders.deliveryCodeHint')}
            </p>
            <p className="text-3xl font-extrabold tracking-[0.35em] text-[var(--green)]">
              {order.delivery_code}
            </p>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-[1.35rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-[var(--line)]">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <p className="text-[10px] font-extrabold tracking-wide text-[var(--muted)] uppercase">
            {t('orders.myInfo')}
          </p>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
              <UserRound size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--muted)]">
                {t('common.name')}
              </p>
              <p className="font-extrabold text-[var(--ink)]">{fullName}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--green-soft)] text-[var(--green)]">
              <Phone size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--muted)]">
                {t('common.phone')}
              </p>
              <p className="font-extrabold text-[var(--ink)]">
                {phoneDisplay(order.phone)}
              </p>
            </div>
          </div>
          {(region || order.lat != null) && (
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                <MapPin size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--muted)]">
                  {t('common.address')}
                </p>
                {region && (
                  <p className="font-extrabold text-[var(--ink)]">{region}</p>
                )}
                {order.lat != null && order.lng != null && (
                  <p className="mt-0.5 text-xs font-bold text-[var(--muted)]">
                    {order.lat.toFixed(5)}, {order.lng.toFixed(5)}
                  </p>
                )}
              </div>
            </div>
          )}
          {order.note && (
            <div className="rounded-xl bg-[var(--surface)] px-3 py-2.5">
              <p className="text-xs font-bold text-[var(--muted)]">
                {t('common.note')}
              </p>
              <p className="mt-0.5 text-sm font-bold text-[var(--ink)]">
                {order.note}
              </p>
            </div>
          )}
        </div>
      </section>

      {order.status === 'assigned' && order.kuryer_name && (
        <section className="rounded-[1.35rem] bg-white px-4 py-4 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)]">
          <p className="text-[10px] font-extrabold tracking-wide text-[var(--muted)] uppercase">
            {t('common.courier')}
          </p>
          <p className="mt-2 flex items-center gap-2 font-extrabold text-[var(--ink)]">
            <Truck size={18} className="text-[var(--brand)]" />
            {order.kuryer_name}
          </p>
          {order.kuryer_phone && (
            <p className="mt-1 pl-7 text-sm font-bold text-[var(--muted)]">
              {phoneDisplay(order.kuryer_phone)}
            </p>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-[1.35rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-[var(--line)]">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <p className="text-[10px] font-extrabold tracking-wide text-[var(--muted)] uppercase">
            {t('common.products')}
          </p>
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {(order.items ?? []).map((it) => (
            <li key={it.id} className="flex gap-3 px-4 py-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--sand)]">
                {it.image ? (
                  <img
                    src={mediaUrl(it.image)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xl">📦</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-[var(--ink)]">
                  {it.product_name}
                </p>
                <p className="text-xs font-bold text-[var(--muted)]">
                  {t('orders.unitLine', {
                    qty: it.qty,
                    unit: it.unit,
                    price: formatSom(it.unit_price),
                  })}
                </p>
              </div>
              <p className="shrink-0 self-center text-sm font-extrabold text-[var(--brand)]">
                {formatSom(it.unit_price * it.qty)}
              </p>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-3.5">
          <span className="text-sm font-bold text-[var(--muted)]">
            {t('common.total')}
          </span>
          <span className="text-lg font-extrabold text-[var(--brand)]">
            {formatSom(order.total_amount)} {t('common.som')}
          </span>
        </div>
      </section>

      {order.status === 'waiting' && (
        <p className="text-center text-sm font-bold text-[var(--muted)]">
          {t('orders.waitingHint')}
        </p>
      )}
    </div>
  )
}
