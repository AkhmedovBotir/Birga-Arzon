import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Banknote,
  CreditCard,
  Eye,
  RefreshCw,
  Search,
  Wallet,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import {
  api,
  type AdminPayment,
  type PaymentStats,
} from '../api/client'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { phoneDisplay } from '../lib/phone'

function formatSom(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function payTone(status: string) {
  switch (status) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
    case 'cod':
      return 'bg-amber-50 text-amber-800 ring-amber-100'
    case 'pending':
      return 'bg-sky-50 text-sky-800 ring-sky-100'
    case 'unpaid':
      return 'bg-rose-50 text-rose-700 ring-rose-100'
    default:
      return 'bg-slate-50 text-slate-700 ring-slate-100'
  }
}

function PaymentDetailModal({
  item,
  onClose,
  statusLabel,
  methodLabel,
  onUpdated,
}: {
  item: AdminPayment
  onClose: () => void
  statusLabel: (s: string) => string
  methodLabel: (s: string) => string
  onUpdated: () => void
}) {
  const { t, i18n } = useTranslation()
  const { token } = useAuth()
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState('')

  const name =
    item.user_full_name ||
    `${item.first_name} ${item.last_name}`.trim() ||
    t('profile.user')
  const region = [item.viloyat_name, item.tuman_name].filter(Boolean).join(', ')

  const handleSync = async () => {
    if (!token) return
    setActionLoading(true)
    setActionMsg('')
    try {
      const res = await api.paymentSync(token, item.order_id)
      if (res.synced) {
        setActionMsg('Atmos to‘lovi tasdiqlandi va saqlandi!')
        onUpdated()
      } else {
        setActionMsg('Atmos hali bu to‘lovni tasdiqlamadi.')
      }
    } catch (e: any) {
      setActionMsg(e?.message || 'Xatolik yuz berdi')
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!token) return
    if (!confirm('Ushbu buyurtma to‘lovini to‘langan deb tasdiqlaysizmi?')) return
    setActionLoading(true)
    setActionMsg('')
    try {
      await api.paymentConfirm(token, item.order_id, {
        payment_id: item.atmos_payment_id || '',
        invoice: item.request_id || '',
      })
      setActionMsg('To‘lov muvaffaqiyatli tasdiqlandi!')
      onUpdated()
    } catch (e: any) {
      setActionMsg(e?.message || 'Xatolik yuz berdi')
    } finally {
      setActionLoading(false)
    }
  }

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
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${payTone(item.payment_status)}`}
            >
              {statusLabel(item.payment_status)}
            </span>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">
              {t('admin.paymentDetail')}
            </h3>
            <p className="mt-0.5 font-mono text-xs text-slate-500">
              {item.order_id.slice(0, 8)}…
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-xl bg-slate-50 p-3.5 text-sm">
            <p className="font-semibold text-slate-900">{name}</p>
            <p className="mt-0.5 text-slate-600">{phoneDisplay(item.phone)}</p>
            {region && <p className="mt-1 text-slate-500">{region}</p>}
          </div>

          <div className="space-y-2 rounded-xl ring-1 ring-slate-100 p-3.5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">{t('admin.paymentGoods')}</span>
              <span className="font-semibold">
                {formatSom(item.total_amount)} so‘m
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">{t('admin.paymentDelivery')}</span>
              <span className="font-semibold">
                {formatSom(item.delivery_fee)} so‘m
              </span>
            </div>
            <div className="flex justify-between gap-3 border-t border-slate-100 pt-2">
              <span className="font-semibold text-slate-800">
                {t('admin.paymentTotal')}
              </span>
              <span className="text-base font-bold text-teal-700">
                {formatSom(item.payable_amount)} so‘m
              </span>
            </div>
          </div>

          <div className="grid gap-2 text-sm">
            <p>
              <span className="text-slate-500">{t('admin.paymentMethod')}: </span>
              <span className="font-semibold">
                {methodLabel(item.payment_method)}
              </span>
            </p>
            <p>
              <span className="text-slate-500">{t('admin.orderStatus')}: </span>
              <span className="font-semibold">{item.order_status}</span>
            </p>
            {item.atmos_payment_id && (
              <p className="break-all">
                <span className="text-slate-500">Atmos ID: </span>
                <span className="font-mono text-xs font-semibold">
                  {item.atmos_payment_id}
                </span>
              </p>
            )}
            {item.request_id && (
              <p className="break-all">
                <span className="text-slate-500">Request: </span>
                <span className="font-mono text-xs">{item.request_id}</span>
              </p>
            )}
            <p>
              <span className="text-slate-500">{t('common.date')}: </span>
              {new Date(item.created_at).toLocaleString(i18n.language)}
            </p>
            {item.paid_at && (
              <p>
                <span className="text-slate-500">{t('admin.paidAt')}: </span>
                {new Date(item.paid_at).toLocaleString(i18n.language)}
              </p>
            )}
          </div>

          {item.payment_status !== 'paid' && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              {actionMsg && (
                <p className="rounded-lg bg-slate-100 p-2 text-center text-xs font-semibold text-slate-700">
                  {actionMsg}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1 py-2 text-xs"
                  disabled={actionLoading}
                  onClick={handleSync}
                >
                  <RefreshCw size={14} className={actionLoading ? 'animate-spin' : ''} />
                  Atmosdan tekshirish
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 py-2 text-xs !bg-emerald-600 hover:!bg-emerald-700 !border-emerald-600"
                  disabled={actionLoading}
                  onClick={handleConfirm}
                >
                  To‘langan deb tasdiqlash
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function PaymentsPage() {
  const { t, i18n } = useTranslation()
  const { token } = useAuth()
  const [items, setItems] = useState<AdminPayment[]>([])
  const [stats, setStats] = useState<PaymentStats | null>(null)
  const [status, setStatus] = useState('')
  const [method, setMethod] = useState('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<AdminPayment | null>(null)

  const statusLabel = useCallback(
    (s: string) => {
      const map: Record<string, string> = {
        unpaid: t('admin.payUnpaid'),
        pending: t('admin.payPending'),
        paid: t('admin.payPaid'),
        cod: t('admin.payCod'),
      }
      return map[s] || s
    },
    [t],
  )

  const methodLabel = useCallback(
    (s: string) => {
      if (s === 'card') return t('admin.payMethodCard')
      if (s === 'cash') return t('admin.payMethodCash')
      return s || '—'
    },
    [t],
  )

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [list, st] = await Promise.all([
        api.paymentsList(token, { status, method, q }),
        api.paymentsStats(token),
      ])
      setItems(list.items ?? [])
      setStats(st)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [token, status, method, q, t])

  useEffect(() => {
    void load()
  }, [load])

  const statusOptions = useMemo(
    () => [
      { value: '', label: t('common.all') },
      { value: 'unpaid', label: t('admin.payUnpaid') },
      { value: 'pending', label: t('admin.payPending') },
      { value: 'paid', label: t('admin.payPaid') },
      { value: 'cod', label: t('admin.payCod') },
    ],
    [t],
  )

  const methodOptions = useMemo(
    () => [
      { value: '', label: t('common.all') },
      { value: 'card', label: t('admin.payMethodCard') },
      { value: 'cash', label: t('admin.payMethodCash') },
    ],
    [t],
  )

  const chips = [
    {
      label: t('admin.payPaid'),
      value: stats ? formatSom(stats.paid_amount) : '—',
      count: stats?.paid ?? 0,
      icon: CreditCard,
      tone: 'text-emerald-700 bg-emerald-50 ring-emerald-100',
    },
    {
      label: t('admin.payCod'),
      value: stats ? formatSom(stats.cod_amount) : '—',
      count: stats?.cod ?? 0,
      icon: Banknote,
      tone: 'text-amber-700 bg-amber-50 ring-amber-100',
    },
    {
      label: t('admin.payPending'),
      value: stats ? formatSom(stats.pending_amount) : '—',
      count: stats?.pending ?? 0,
      icon: Wallet,
      tone: 'text-sky-700 bg-sky-50 ring-sky-100',
    },
    {
      label: t('admin.payUnpaid'),
      value: stats ? formatSom(stats.unpaid_amount) : '—',
      count: stats?.unpaid ?? 0,
      icon: Wallet,
      tone: 'text-rose-700 bg-rose-50 ring-rose-100',
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('nav.payments')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t('admin.paymentsHint')}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void load()}
          className="gap-1.5"
        >
          <RefreshCw size={15} />
          {t('common.refresh')}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {chips.map(({ label, value, count, icon: Icon, tone }) => (
          <div
            key={label}
            className={`rounded-2xl p-4 ring-1 ${tone}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold tracking-wide uppercase opacity-80">
                {label}
              </p>
              <Icon size={16} />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums">
              {value} <span className="text-sm font-semibold">so‘m</span>
            </p>
            <p className="mt-0.5 text-xs font-medium opacity-70">
              {t('admin.paymentCount', { count })}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/80 sm:flex-row sm:items-center sm:p-4">
        <div className="relative min-w-0 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('admin.paymentSearch')}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3 pl-9 text-sm outline-none focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:w-[320px]">
          <Select
            value={status}
            onChange={setStatus}
            options={statusOptions}
            placeholder={t('common.status')}
          />
          <Select
            value={method}
            onChange={setMethod}
            options={methodOptions}
            placeholder={t('admin.paymentMethod')}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">{t('common.customer')}</th>
                <th className="px-4 py-3 font-semibold">{t('common.status')}</th>
                <th className="px-4 py-3 font-semibold">{t('admin.paymentMethod')}</th>
                <th className="px-4 py-3 font-semibold">{t('admin.paymentTotal')}</th>
                <th className="px-4 py-3 font-semibold">{t('common.date')}</th>
                <th className="px-4 py-3 font-semibold">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    {t('admin.noPayments')}
                  </td>
                </tr>
              ) : (
                items.map((it) => {
                  const name =
                    it.user_full_name ||
                    `${it.first_name} ${it.last_name}`.trim() ||
                    t('profile.user')
                  return (
                    <tr key={it.order_id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{name}</p>
                        <p className="text-xs text-slate-500">
                          {phoneDisplay(it.phone)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${payTone(it.payment_status)}`}
                        >
                          {statusLabel(it.payment_status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {methodLabel(it.payment_method)}
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-teal-700">
                        {formatSom(it.payable_amount)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(
                          it.paid_at || it.created_at,
                        ).toLocaleString(i18n.language)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelected(it)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-800"
                        >
                          <Eye size={14} />
                          {t('common.details')}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <PaymentDetailModal
          item={selected}
          onClose={() => setSelected(null)}
          statusLabel={statusLabel}
          methodLabel={methodLabel}
          onUpdated={() => {
            void load()
            setSelected((prev) => (prev ? { ...prev, payment_status: 'paid' } : null))
          }}
        />
      )}
    </div>
  )
}
