import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api, type Order } from '../api/client'
import { formatSom } from '../config'
import { phoneDisplay } from '../lib/phone'
import { OrderDetailModal, ProductStack } from '../components/OrderVisual'

export function HistoryPage() {
  const { t, i18n } = useTranslation()
  const { token } = useAuth()
  const [items, setItems] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<Order | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const res = await api.orderHistory(token)
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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(
      i18n.language === 'en' ? 'en-US' : i18n.language === 'ru' ? 'ru-RU' : 'uz-UZ',
    )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t('kuryer.historyTitle')}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {t('orders.historyHint')}
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {t('common.loading')}
        </p>
      ) : !items.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
          <p className="font-semibold text-slate-700">{t('orders.historyEmpty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((o) => {
            const name =
              `${o.first_name} ${o.last_name}`.trim() ||
              phoneDisplay(o.phone)
            const orderItems = o.items ?? []
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setDetail(o)}
                className="w-full overflow-hidden rounded-[1.35rem] border border-slate-200/90 bg-white text-left shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] transition hover:border-emerald-300 active:scale-[0.99]"
              >
                <div className="flex gap-3 p-3.5">
                  <ProductStack items={orderItems} max={3} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold text-slate-900">
                        {name}
                      </p>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                        <CheckCircle2 size={11} />
                        {t('orders.delivered')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {phoneDisplay(o.phone)}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {formatSom(o.total_amount)} {t('common.som')}
                        </p>
                        {(o.delivery_fee ?? 0) > 0 && (
                          <p className="text-xs font-semibold text-emerald-700">
                            {t('orders.courierShare')}:{' '}
                            {formatSom(o.delivery_fee ?? 0)} {t('common.som')}
                          </p>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>
                    {o.delivered_at && (
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {formatDate(o.delivered_at)}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {detail && (
        <OrderDetailModal
          order={detail}
          onClose={() => setDetail(null)}
          badge={
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/95 px-2.5 py-1 text-[10px] font-bold tracking-wide text-emerald-950 uppercase">
              <CheckCircle2 size={12} />
              {t('orders.delivered')}
            </span>
          }
          footer={
            detail.delivered_at ? (
              <p className="text-center text-xs text-slate-400">
                {formatDate(detail.delivered_at)}
              </p>
            ) : null
          }
        />
      )}
    </div>
  )
}
