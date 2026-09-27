import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Banknote,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { api, type Order, type PaymentInfo } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { formatSom } from '../config'

type Method = 'card' | 'cash'

export function PaymentPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { token, isAuthenticated, loading: authLoading } = useAuth()

  const [order, setOrder] = useState<Order | null>(null)
  const [info, setInfo] = useState<PaymentInfo | null>(null)
  const [method, setMethod] = useState<Method>('card')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successHint, setSuccessHint] = useState(params.get('paid') === '1')

  const load = useCallback(async () => {
    if (!token || !id) return
    setLoading(true)
    setError('')
    try {
      const p = await api.orderPayment(token, id)
      const o = await api.orderGet(token, id)
      setOrder(o)
      setInfo(p)
      if (o.payment_method === 'cash') setMethod('cash')
      if (o.payment_status === 'paid' || o.payment_status === 'cod' || p.payment_status === 'paid') {
        setSuccessHint(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('payment.loadError'))
      setOrder(null)
      setInfo(null)
    } finally {
      setLoading(false)
    }
  }, [token, id, t])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/kirish', {
        state: { from: `/buyurtmalar/${id}/tolov` },
        replace: true,
      })
      return
    }
    if (token && id) void load()
  }, [authLoading, isAuthenticated, token, id, load, navigate])

  const onPay = async () => {
    if (!token || !id) return
    setSubmitting(true)
    setError('')
    try {
      if (method === 'cash') {
        await api.payCash(token, id)
        await load()
        setSuccessHint(true)
        return
      }
      const res = await api.payCard(token, id, i18n.language?.slice(0, 2) || 'uz')
      if (res.checkout_url) {
        window.location.href = res.checkout_url
        return
      }
      setError(t('payment.noCheckout'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('payment.payError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <p className="py-16 text-center text-sm font-bold text-[var(--muted)]">
        {t('common.loading')}
      </p>
    )
  }

  if (error && !order) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-2 pt-6 text-center">
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {error}
        </p>
        <Link
          to={`/buyurtmalar/${id}`}
          className="inline-flex items-center gap-1 text-sm font-extrabold text-[var(--brand)]"
        >
          <ChevronLeft size={16} />
          {t('orders.backToOrders')}
        </Link>
      </div>
    )
  }

  const goods = info?.goods_amount ?? order?.total_amount ?? 0
  const fee = info?.delivery_fee ?? order?.delivery_fee ?? 0
  const total = info?.payable_amount ?? goods + fee
  const paid =
    order?.payment_status === 'paid' || order?.payment_status === 'cod'
  const canPay = info?.needs_payment && !paid

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <Link
          to={`/buyurtmalar/${id}`}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]"
        >
          <ChevronLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold text-[var(--ink)]">
            {t('payment.title')}
          </h1>
          <p className="text-xs font-bold text-[var(--muted)]">
            {t('payment.subtitle')}
          </p>
        </div>
      </div>

      {successHint && paid && (
        <div className="flex items-start gap-3 rounded-[1.25rem] bg-[var(--green-soft)] px-4 py-3.5 ring-1 ring-[var(--green)]/20">
          <CheckCircle2 className="mt-0.5 shrink-0 text-[var(--green)]" size={22} />
          <div>
            <p className="text-sm font-extrabold text-[var(--green)]">
              {order?.payment_status === 'cod'
                ? t('payment.codOk')
                : t('payment.paidOk')}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-[var(--muted)]">
              {t('payment.paidHint')}
            </p>
          </div>
        </div>
      )}

      <section className="rounded-[1.25rem] bg-[var(--sand)]/80 px-4 py-4 ring-1 ring-[var(--line)]">
        <div className="flex items-center justify-between gap-3 text-sm font-bold text-[var(--muted)]">
          <span>{t('payment.goodsAmount')}</span>
          <span className="text-[var(--ink)]">
            {formatSom(goods)} {t('common.som')}
          </span>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-3 text-sm font-bold text-[var(--muted)]">
          <span>{t('payment.deliveryAmount')}</span>
          <span className="text-[var(--ink)]">
            {formatSom(fee)} {t('common.som')}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
          <span className="text-sm font-extrabold text-[var(--ink)]">
            {t('payment.total')}
          </span>
          <span className="text-lg font-extrabold text-[var(--brand)]">
            {formatSom(total)} {t('common.som')}
          </span>
        </div>
      </section>

      {canPay && (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setMethod('card')}
              className={`flex flex-col items-center gap-2 rounded-[1.15rem] px-3 py-4 text-center transition ring-2 ${
                method === 'card'
                  ? 'bg-white ring-[var(--brand)] shadow-sm'
                  : 'bg-white/70 ring-[var(--line)]'
              }`}
            >
              <CreditCard
                size={26}
                className={
                  method === 'card' ? 'text-[var(--brand)]' : 'text-[var(--muted)]'
                }
              />
              <span className="text-[13px] font-extrabold text-[var(--ink)]">
                {t('payment.methodCard')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMethod('cash')}
              className={`flex flex-col items-center gap-2 rounded-[1.15rem] px-3 py-4 text-center transition ring-2 ${
                method === 'cash'
                  ? 'bg-white ring-[var(--brand)] shadow-sm'
                  : 'bg-white/70 ring-[var(--line)]'
              }`}
            >
              <Banknote
                size={26}
                className={
                  method === 'cash' ? 'text-[var(--brand)]' : 'text-[var(--muted)]'
                }
              />
              <span className="text-[13px] font-extrabold leading-tight text-[var(--ink)]">
                {t('payment.methodCash')}
              </span>
            </button>
          </div>

          {method === 'card' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {['HUMO', 'UZCARD', 'Mastercard', 'VISA'].map((name) => (
                  <span
                    key={name}
                    className="rounded-lg bg-[var(--sand)] px-2.5 py-1.5 text-[10px] font-extrabold tracking-wide text-[var(--muted)] ring-1 ring-[var(--line)]"
                  >
                    {name}
                  </span>
                ))}
              </div>
              <p className="text-center text-xs leading-relaxed text-[var(--muted)]">
                {t('payment.cardHint')}
              </p>
              <div className="flex items-start gap-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-[var(--line)]">
                <ShieldCheck
                  size={16}
                  className="mt-0.5 shrink-0 text-[var(--green)]"
                />
                <p className="text-[11px] leading-snug font-semibold text-[var(--muted)]">
                  {t('payment.pci')}
                </p>
              </div>
            </div>
          )}

          {method === 'cash' && (
            <p className="rounded-[1.15rem] bg-white px-4 py-3 text-sm leading-relaxed font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]">
              {t('payment.cashHint')}
            </p>
          )}

          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={submitting || (method === 'card' && info && !info.atmos_enabled)}
            onClick={() => void onPay()}
            className="ba-btn flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] disabled:opacity-55"
          >
            {submitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : method === 'card' ? (
              <CreditCard size={18} />
            ) : (
              <Banknote size={18} />
            )}
            {method === 'card' ? t('payment.payCard') : t('payment.confirmCash')}
          </button>

          {method === 'card' && info && !info.atmos_enabled && (
            <p className="text-center text-xs font-bold text-amber-700">
              {t('payment.atmosOff')}
            </p>
          )}
        </>
      )}

      {!canPay && !paid && (
        <p className="rounded-[1.15rem] bg-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-800 ring-1 ring-amber-200">
          {t('payment.notReady')}
        </p>
      )}

      <p className="pt-2 text-center text-[11px] font-bold tracking-wide text-[var(--muted)]">
        Powered by ATMOS
      </p>
    </div>
  )
}
