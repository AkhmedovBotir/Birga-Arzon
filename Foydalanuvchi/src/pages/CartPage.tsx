import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Minus, Plus, Trash2, X } from 'lucide-react'
import { useCart } from '../cart/CartContext'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api/client'
import { formatSom, mediaUrl } from '../config'
import { EmptyCart } from '../components/Mascot'
import { phoneDisplay } from '../lib/phone'

export function CartPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { items, remove, setQty, count, total, clearKeys } = useCart()
  const { isAuthenticated, token, user, refreshMe } = useAuth()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [minOrderAmount, setMinOrderAmount] = useState(0)

  const orderable = useMemo(
    () => items.filter((i) => Boolean(i.yigimId)),
    [items],
  )

  const orderableTotal = useMemo(
    () => orderable.reduce((s, i) => s + i.price * i.qty, 0),
    [orderable],
  )

  const compareTotal = checkoutOpen ? orderableTotal : total
  const belowMin = minOrderAmount > 0 && compareTotal < minOrderAmount
  const remaining = Math.max(0, minOrderAmount - compareTotal)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await api.getSettings()
        if (!cancelled) {
          setMinOrderAmount(Number(s.min_order_amount) || 0)
        }
      } catch {
        /* keep 0 — backend still enforces */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!items.length) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-2 pt-10 text-center md:pt-16">
        <EmptyCart className="mb-4 h-40 w-52 sm:h-48 sm:w-60" />
        <h1 className="text-xl font-extrabold text-[var(--ink)] sm:text-2xl">
          {t('cart.empty')}
        </h1>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--muted)] sm:max-w-sm sm:text-base">
          {t('cart.emptyHintLong')}
        </p>
        <Link to="/kategoriyalar" className="ba-btn mt-6 px-5 py-3 text-sm">
          {t('cart.goToYigims')}
        </Link>
      </div>
    )
  }

  const openCheckout = async () => {
    if (!isAuthenticated) {
      navigate('/kirish', { state: { from: '/savat' } })
      return
    }
    if (minOrderAmount > 0 && total < minOrderAmount) {
      setError(
        t('cart.belowMinFull', {
          min: `${formatSom(minOrderAmount)} ${t('common.som')}`,
          total: `${formatSom(total)} ${t('common.som')}`,
        }),
      )
      return
    }
    setError('')
    await refreshMe()
    setCheckoutOpen(true)
  }

  const confirmOrder = async () => {
    if (!token) return
    if (!user?.profile_complete) {
      setError(t('cart.fillFirst'))
      return
    }
    if (!orderable.length) {
      setError(t('cart.needItems'))
      return
    }
    if (minOrderAmount > 0 && orderableTotal < minOrderAmount) {
      setError(
        t('cart.belowMinFull', {
          min: `${formatSom(minOrderAmount)} ${t('common.som')}`,
          total: `${formatSom(orderableTotal)} ${t('common.som')}`,
        }),
      )
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.createOrder(token, {
        items: orderable.map((i) => ({
          yigim_id: i.yigimId!,
          qty: i.qty,
        })),
        note: note.trim() || undefined,
      })
      clearKeys(orderable.map((i) => i.key))
      setCheckoutOpen(false)
      navigate('/buyurtmalar')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const region = [user?.viloyat_name, user?.tuman_name].filter(Boolean).join(', ')

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-start">
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--green)] sm:text-3xl">
          {t('cart.titleCount', { count })}
        </h1>

        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex gap-3 rounded-[1.25rem] bg-white p-3 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] sm:p-4"
            >
              <Link
                to={item.yigimId ? `/yigim/${item.yigimId}` : '/kategoriyalar'}
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--sand)] sm:h-20 sm:w-20"
              >
                {item.image ? (
                  <img
                    src={mediaUrl(item.image)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-2xl">📦</span>
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to={item.yigimId ? `/yigim/${item.yigimId}` : '/kategoriyalar'}
                  className="truncate font-extrabold text-[var(--ink)] hover:text-[var(--brand)]"
                >
                  {item.name}
                </Link>
                <p className="text-sm font-bold text-[var(--brand)]">
                  {formatSom(item.price)}{' '}
                  {t('common.perUnit', { unit: item.unit })}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={t('common.decrease')}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--green-soft)] text-[var(--green)]"
                    onClick={() => setQty(item.key, item.qty - 1)}
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center text-sm font-extrabold">
                    {item.qty}
                  </span>
                  <button
                    type="button"
                    aria-label={t('common.increase')}
                    className="ba-btn flex h-8 w-8 items-center justify-center rounded-xl p-0"
                    onClick={() => setQty(item.key, item.qty + 1)}
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={t('common.delete')}
                    onClick={() => remove(item.key)}
                    className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl text-rose-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <p className="shrink-0 self-center text-sm font-extrabold text-[var(--ink)]">
                {formatSom(item.price * item.qty)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-24 rounded-[1.4rem] bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] md:bottom-6 md:top-28 lg:self-start">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-bold text-[var(--muted)]">
            {t('common.products')}
          </span>
          <span className="text-sm font-bold text-[var(--ink)]">
            {t('common.pcs', { count })}
          </span>
        </div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-[var(--muted)]">
            {t('common.total')}
          </span>
          <span className="text-lg font-extrabold text-[var(--brand)]">
            {formatSom(total)} {t('common.som')}
          </span>
        </div>

        {minOrderAmount > 0 && (
          <div
            className={`mb-3 rounded-xl px-3 py-2 text-xs font-bold ${
              belowMin
                ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                : 'bg-[var(--green-soft)] text-[var(--green)]'
            }`}
          >
            <p>
              {t('cart.minOrder', {
                amount: `${formatSom(minOrderAmount)} ${t('common.som')}`,
              })}
            </p>
            {belowMin && (
              <p className="mt-0.5">
                {t('cart.belowMin', {
                  amount: `${formatSom(remaining)} ${t('common.som')}`,
                })}
              </p>
            )}
          </div>
        )}

        {error && !checkoutOpen && (
          <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void openCheckout()}
          disabled={belowMin && isAuthenticated}
          className="ba-btn flex w-full py-3.5 text-sm disabled:opacity-50"
        >
          {isAuthenticated ? t('cart.checkoutShort') : t('cart.loginCheckout')}
        </button>
        <Link
          to="/kategoriyalar"
          className="mt-2 flex w-full items-center justify-center py-2.5 text-sm font-extrabold text-[var(--brand)]"
        >
          {t('cart.addMore')}
        </Link>
      </div>

      {checkoutOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label={t('common.close')}
            className="absolute inset-0"
            onClick={() => !saving && setCheckoutOpen(false)}
          />
          <div className="relative z-10 max-h-[90svh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-[var(--ink)]">
                  {t('cart.checkout')}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {t('cart.confirmHint')}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => setCheckoutOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--sand)] text-[var(--ink)]"
              >
                <X size={18} />
              </button>
            </div>

            {!user?.profile_complete ? (
              <div className="space-y-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
                <p className="text-sm font-bold text-amber-900">
                  {t('cart.profileIncomplete')}
                </p>
                <Link
                  to="/kirish/profil"
                  className="ba-btn inline-flex px-4 py-2.5 text-sm"
                >
                  {t('cart.fillProfile')}
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-2xl bg-[var(--surface)] p-3.5 ring-1 ring-[var(--line)]">
                  <p className="text-[10px] font-extrabold tracking-wide text-[var(--muted)] uppercase">
                    {t('cart.delivery')}
                  </p>
                  <p className="mt-1 font-extrabold text-[var(--ink)]">
                    {user.full_name || `${user.first_name} ${user.last_name}`}
                  </p>
                  <p className="text-sm font-bold text-[var(--muted)]">
                    {phoneDisplay(user.phone)}
                  </p>
                  {region && (
                    <p className="mt-1 text-sm font-bold text-[var(--ink)]">
                      {region}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl bg-white p-3.5 ring-1 ring-[var(--line)]">
                  <p className="mb-2 text-[10px] font-extrabold tracking-wide text-[var(--muted)] uppercase">
                    {t('cart.productsCount', { count: orderable.length })}
                  </p>
                  <ul className="space-y-1.5">
                    {orderable.map((i) => (
                      <li
                        key={i.key}
                        className="flex justify-between gap-2 text-sm font-bold text-[var(--ink)]"
                      >
                        <span className="truncate">
                          {i.name} × {i.qty}
                        </span>
                        <span className="shrink-0 text-[var(--brand)]">
                          {formatSom(i.price * i.qty)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex justify-between border-t border-[var(--line)] pt-2">
                    <span className="text-sm font-bold text-[var(--muted)]">
                      {t('common.total')}
                    </span>
                    <span className="font-extrabold text-[var(--brand)]">
                      {formatSom(orderableTotal)} {t('common.som')}
                    </span>
                  </div>
                </div>

                {minOrderAmount > 0 && belowMin && (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
                    {t('cart.belowMinFull', {
                      min: `${formatSom(minOrderAmount)} ${t('common.som')}`,
                      total: `${formatSom(orderableTotal)} ${t('common.som')}`,
                    })}
                  </p>
                )}

                <label className="block space-y-1">
                  <span className="text-[10px] font-extrabold tracking-wide text-[var(--muted)] uppercase">
                    {t('cart.noteOptional')}
                  </span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder={t('cart.courierNote')}
                    className="w-full rounded-xl bg-[var(--surface)] px-3 py-2.5 text-sm font-bold outline-none ring-1 ring-[var(--line)] focus:ring-2 focus:ring-[var(--brand)]/30"
                  />
                </label>

                {error && (
                  <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  disabled={saving || belowMin}
                  onClick={() => void confirmOrder()}
                  className="ba-btn w-full py-3.5 text-sm disabled:opacity-60"
                >
                  {saving ? t('cart.placing') : t('cart.placeOrderFull')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
