import { useEffect, useMemo, useState } from 'react'
import {
  ClipboardList,
  Eye,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  Truck,
  UserMinus,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api, type AdminOrder, type AdminOrderItem, type OrderStats } from '../api/client'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { config } from '../config'
import { phoneDisplay } from '../lib/phone'

function mediaUrl(path?: string | null) {
  if (!path) return ''
  const raw = String(path).trim()
  if (!raw) return ''
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  const normalized = raw.startsWith('/') ? raw : `/${raw}`
  return `${config.mediaBaseUrl}${normalized}`
}

function formatSom(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function tone(status: string) {
  switch (status) {
    case 'waiting':
      return 'bg-amber-50 text-amber-800 ring-amber-100'
    case 'ready':
      return 'bg-sky-50 text-sky-800 ring-sky-100'
    case 'assigned':
      return 'bg-blue-50 text-blue-800 ring-blue-100'
    case 'delivered':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
    case 'cancelled':
      return 'bg-rose-50 text-rose-700 ring-rose-100'
    default:
      return 'bg-slate-50 text-slate-700 ring-slate-100'
  }
}

function ProductThumb({ item }: { item: AdminOrderItem }) {
  const src = mediaUrl(item.image)
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200/80">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <Package size={14} className="text-slate-400" strokeWidth={1.6} />
      )}
    </div>
  )
}

function OrderDetailModal({
  order,
  onClose,
}: {
  order: AdminOrder
  onClose: () => void
}) {
  const { t } = useTranslation()
  const name =
    order.user_full_name ||
    `${order.first_name} ${order.last_name}`.trim() ||
    t('profile.user')
  const region = [order.viloyat_name, order.tuman_name]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${tone(order.status)}`}
            >
              {order.status_label || order.status}
            </span>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">
              {t('admin.orderDetail')}
            </h3>
            <p className="mt-0.5 font-mono text-sm font-semibold tracking-wide text-teal-700">
              {t('orders.code', { code: order.delivery_code })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 grid gap-2.5 rounded-xl bg-slate-50 p-3.5">
            <p className="flex items-center gap-2 text-sm text-slate-800">
              <Phone size={15} className="shrink-0 text-teal-600" />
              <span>
                <span className="font-semibold">{name}</span>
                <span className="text-slate-500"> · {phoneDisplay(order.phone)}</span>
              </span>
            </p>
            {region && (
              <p className="flex items-start gap-2 text-sm text-slate-700">
                <MapPin size={15} className="mt-0.5 shrink-0 text-teal-600" />
                {region}
              </p>
            )}
            {order.kuryer_name && (
              <p className="flex items-start gap-2 text-sm text-slate-700">
                <Truck size={15} className="mt-0.5 shrink-0 text-blue-600" />
                <span>
                  <span className="font-medium">{order.kuryer_name}</span>
                  {order.kuryer_phone && (
                    <span className="text-slate-500">
                      {' '}
                      · {phoneDisplay(order.kuryer_phone)}
                    </span>
                  )}
                </span>
              </p>
            )}
            {order.note && (
              <p className="rounded-lg bg-white px-3 py-2 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-100">
                {order.note}
              </p>
            )}
          </div>

          <p className="mb-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            {t('common.products')}
          </p>
          <ul className="space-y-2">
            {(order.items ?? []).map((it) => {
              const src = mediaUrl(it.image)
              return (
                <li
                  key={it.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-2.5"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/80">
                    {src ? (
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package size={20} className="text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">
                      {it.product_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t('admin.qtyUnitPrice', {
                        qty: it.qty,
                        unit: it.unit,
                        price: formatSom(it.unit_price),
                        currency: t('common.som'),
                      })}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-teal-700">
                    {formatSom(it.unit_price * it.qty)}
                  </p>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="border-t border-slate-100 px-5 py-3.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">{t('common.total')}</span>
            <span className="text-lg font-semibold text-slate-900">
              {formatSom(order.total_amount)} {t('common.som')}
            </span>
          </div>
          <p className="mt-1 text-center text-xs text-slate-400">
            {new Date(order.created_at).toLocaleString()}
            {order.delivered_at
              ? ` · ${t('admin.deliveredAt', {
                  date: new Date(order.delivered_at).toLocaleString(),
                })}`
              : ''}
          </p>
        </div>
      </div>
    </div>
  )
}

export function OrdersPage() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [items, setItems] = useState<AdminOrder[]>([])
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminOrder | null>(null)

  const statusFilters = useMemo(
    () => [
      { value: '', label: t('common.all') },
      { value: 'waiting', label: t('orders.waiting') },
      { value: 'ready', label: t('admin.ready') },
      { value: 'assigned', label: t('orders.assigned') },
      { value: 'delivered', label: t('admin.delivered') },
      { value: 'cancelled', label: t('admin.cancelled') },
    ],
    [t],
  )

  const load = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [listRes, statsRes] = await Promise.all([
        api.listOrders(token, status, query),
        api.ordersStats(token),
      ])
      setItems(listRes.items ?? [])
      setStats(statsRes)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [token, status])

  const onAutoAssign = async (o: AdminOrder) => {
    if (!token) return
    setSavingId(o.id)
    setError('')
    try {
      await api.autoAssignOrder(token, o.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.assignError'))
    } finally {
      setSavingId(null)
    }
  }

  const onAction = async (
    id: string,
    action: 'unassign' | 'cancel' | 'ready',
  ) => {
    if (!token) return
    setSavingId(id)
    setError('')
    try {
      if (action === 'unassign') await api.unassignOrder(token, id)
      else if (action === 'cancel')
        await api.setOrderStatus(token, id, 'cancelled')
      else await api.setOrderStatus(token, id, 'ready')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.actionError'))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('admin.ordersTitle')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t('admin.ordersHint')}</p>
        </div>
        {stats && (
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              {t('admin.statTotal', { count: stats.total })}
            </span>
            <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800">
              {t('admin.statWaiting', { count: stats.waiting })}
            </span>
            <span className="rounded-full bg-sky-100 px-3 py-1.5 text-sky-800">
              {t('admin.statReady', { count: stats.ready })}
            </span>
            <span className="rounded-full bg-blue-100 px-3 py-1.5 text-blue-800">
              {t('admin.statOnWay', { count: stats.assigned })}
            </span>
            <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">
              {t('admin.statDelivered', { count: stats.delivered })}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load()}
            placeholder={t('admin.searchOrders')}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3 pl-9 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
        <div className="sm:w-48">
          <Select
            value={status}
            onChange={setStatus}
            options={statusFilters
              .filter((s) => s.value)
              .map((s) => ({
                value: s.value,
                label: s.label,
              }))}
            placeholder={t('common.all')}
            clearable
          />
        </div>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          {t('common.refresh')}
        </Button>
      </div>

      {error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">
            {t('common.loading')}
          </p>
        ) : !items.length ? (
          <div className="flex flex-col items-center py-16 text-center">
            <ClipboardList className="mb-3 text-slate-300" size={40} />
            <p className="font-medium text-slate-600">{t('admin.noOrders')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[118px]" />
                <col className="w-[190px]" />
                <col className="w-[200px]" />
                <col className="w-[150px]" />
                <col className="w-[100px]" />
                <col className="w-[90px]" />
                <col className="w-[168px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] tracking-wide text-slate-500 uppercase">
                  <th className="px-3 py-3 font-semibold">{t('admin.statusCode')}</th>
                  <th className="px-3 py-3 font-semibold">{t('common.customer')}</th>
                  <th className="px-3 py-3 font-semibold">{t('common.products')}</th>
                  <th className="px-3 py-3 font-semibold">{t('common.courier')}</th>
                  <th className="px-3 py-3 font-semibold">{t('common.amount')}</th>
                  <th className="px-3 py-3 font-semibold">{t('common.date')}</th>
                  <th className="px-3 py-3 text-right font-semibold">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o, idx) => {
                  const name =
                    o.user_full_name ||
                    `${o.first_name} ${o.last_name}`.trim() ||
                    t('profile.user')
                  const region = [o.viloyat_name, o.tuman_name]
                    .filter(Boolean)
                    .join(', ')
                  const orderItems = o.items ?? []
                  const busy = savingId === o.id
                  const canAct =
                    o.status !== 'delivered' && o.status !== 'cancelled'

                  return (
                    <tr
                      key={o.id}
                      className={`border-t border-slate-100 transition hover:bg-teal-50/40 ${
                        idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      }`}
                    >
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${tone(o.status)}`}
                        >
                          {o.status_label || o.status}
                        </span>
                        <p className="mt-1.5 font-mono text-xs font-semibold tracking-wide text-teal-700">
                          {o.delivery_code}
                        </p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="truncate font-medium text-slate-900">
                          {name}
                        </p>
                        <p className="truncate text-xs text-slate-600">
                          {phoneDisplay(o.phone)}
                        </p>
                        {region && (
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">
                            {region}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center">
                            {orderItems.slice(0, 3).map((it, i) => (
                              <div
                                key={it.id}
                                className="relative rounded-lg ring-2 ring-white"
                                style={{
                                  marginLeft: i === 0 ? 0 : -8,
                                  zIndex: 3 - i,
                                }}
                              >
                                <ProductThumb item={it} />
                              </div>
                            ))}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-800">
                              {orderItems[0]?.product_name ?? '—'}
                              {orderItems.length > 1
                                ? ` +${orderItems.length - 1}`
                                : ''}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {t('admin.itemCountShort', {
                                count: orderItems.length,
                              })}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        {o.kuryer_name ? (
                          <div className="min-w-0">
                            <p className="flex items-center gap-1 truncate font-medium text-slate-800">
                              <Truck
                                size={13}
                                className="shrink-0 text-blue-600"
                              />
                              <span className="truncate">{o.kuryer_name}</span>
                            </p>
                            {o.kuryer_phone && (
                              <p className="truncate text-[11px] text-slate-500">
                                {phoneDisplay(o.kuryer_phone)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top whitespace-nowrap font-semibold text-slate-900">
                        {formatSom(o.total_amount)}
                        <span className="block text-[11px] font-normal text-slate-500">
                          {t('common.som')}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top text-xs text-slate-500">
                        <p>{new Date(o.created_at).toLocaleDateString()}</p>
                        <p className="text-[11px] text-slate-400">
                          {new Date(o.created_at).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title={t('common.details')}
                            onClick={() => setDetail(o)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
                          >
                            <Eye size={14} />
                            {t('common.details')}
                          </button>
                          {canAct && (
                            <>
                              {(o.status === 'ready' ||
                                o.status === 'waiting' ||
                                o.status === 'assigned') && (
                                <button
                                  type="button"
                                  title={
                                    o.status === 'assigned'
                                      ? t('admin.resendCourier')
                                      : t('admin.sendToCourier')
                                  }
                                  disabled={busy}
                                  onClick={() => void onAutoAssign(o)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white transition hover:bg-teal-800 disabled:opacity-50"
                                >
                                  {o.status === 'assigned' ? (
                                    <RefreshCw size={14} />
                                  ) : (
                                    <Truck size={14} />
                                  )}
                                </button>
                              )}
                              {o.status === 'assigned' && (
                                <button
                                  type="button"
                                  title={t('admin.detach')}
                                  disabled={busy}
                                  onClick={() => void onAction(o.id, 'unassign')}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50"
                                >
                                  <UserMinus size={14} />
                                </button>
                              )}
                              <button
                                type="button"
                                title={t('admin.cancelOrder')}
                                disabled={busy}
                                onClick={() => void onAction(o.id, 'cancel')}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && (
        <OrderDetailModal order={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}
