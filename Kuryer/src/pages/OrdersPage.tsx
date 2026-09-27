import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, KeyRound, MapPin, Phone } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api, type Order } from '../api/client'
import { formatSom } from '../config'
import { phoneDisplay } from '../lib/phone'
import { OrderDetailModal, ProductStack } from '../components/OrderVisual'

export function OrdersPage() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [items, setItems] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<Order | null>(null)
  const [deliverId, setDeliverId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const res = await api.myOrders(token)
      setItems(res.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('home.loadError'))
    } finally {
      setLoading(false)
    }
  }, [token, t])

  useEffect(() => {
    void load()
  }, [load])

  const onDeliver = async () => {
    if (!token || !deliverId) return
    setSaving(true)
    setError('')
    try {
      await api.deliverOrder(token, deliverId, code.trim())
      setDeliverId(null)
      setDetail(null)
      setCode('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const openDeliver = (id: string) => {
    setDeliverId(id)
    setCode('')
    setError('')
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.28em] text-blue-700 uppercase">
          {t('kuryer.brand')}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {t('kuryer.ordersTitle')}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {t('orders.openCard')}
        </p>
      </div>

      {error && !deliverId && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {t('common.loading')}
        </p>
      ) : !items.length ? (
        <div className="rounded-2xl border border-dashed border-blue-300/70 bg-blue-50/60 px-4 py-10 text-center">
          <p className="font-semibold text-slate-900">{t('orders.noActive')}</p>
          <p className="mt-1 text-sm text-slate-600">
            {t('orders.noActiveHint')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((o) => {
            const region = [o.viloyat_name, o.tuman_name]
              .filter(Boolean)
              .join(', ')
            const name =
              `${o.first_name} ${o.last_name}`.trim() || t('common.customer')
            const orderItems = o.items ?? []
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setDetail(o)}
                className="w-full overflow-hidden rounded-[1.35rem] border border-slate-200/90 bg-white text-left shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] transition hover:border-blue-300 active:scale-[0.99]"
              >
                <div className="flex gap-3 p-3.5">
                  <ProductStack items={orderItems} max={3} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold text-slate-900">
                        {name}
                      </p>
                      <ChevronRight
                        size={18}
                        className="mt-0.5 shrink-0 text-slate-400"
                      />
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <Phone size={12} />
                      {phoneDisplay(o.phone)}
                    </p>
                    {region && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                        <MapPin size={12} className="shrink-0" />
                        {region}
                      </p>
                    )}
                    <p className="mt-2 text-sm font-semibold text-blue-700">
                      {formatSom(o.total_amount)} {t('common.som')}
                      <span className="ml-2 font-medium text-slate-400">
                        · {t('orders.itemsCount', { count: orderItems.length })}
                      </span>
                    </p>
                    {(o.delivery_fee ?? 0) > 0 && (
                      <p className="mt-0.5 text-xs font-semibold text-emerald-700">
                        {t('orders.courierShare')}:{' '}
                        {formatSom(o.delivery_fee ?? 0)} {t('common.som')}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {detail && !deliverId && (
        <OrderDetailModal
          order={detail}
          onClose={() => setDetail(null)}
          badge={
            <span className="rounded-full bg-amber-400/90 px-2.5 py-1 text-[10px] font-bold tracking-wide text-amber-950 uppercase">
              {t('orders.delivering')}
            </span>
          }
          footer={
            <button
              type="button"
              onClick={() => openDeliver(detail.id)}
              className="w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-md shadow-blue-900/20"
            >
              {t('orders.confirmDelivery')}
            </button>
          }
        />
      )}

      {deliverId && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0"
            aria-label={t('common.close')}
            onClick={() => !saving && setDeliverId(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                <KeyRound size={24} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">
                  {t('orders.confirmTitle')}
                </h2>
                <p className="text-sm text-slate-500">
                  {t('orders.confirmHint')}
                </p>
              </div>
            </div>
            <input
              inputMode="numeric"
              maxLength={4}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, '').slice(0, 4))
              }
              placeholder="••••"
              className="mb-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3.5 text-center text-2xl font-semibold tracking-[0.45em] outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              autoFocus
            />
            {error && (
              <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={saving || code.length !== 4}
              onClick={() => void onDeliver()}
              className="w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? t('orders.checking') : t('common.confirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
