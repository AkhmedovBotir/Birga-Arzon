import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Check, ShoppingBag, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api/client'
import { Box } from '../components/ui/Box'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

type TabId = 'orders' | 'courier'

function parseAmount(raw: string): number {
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return NaN
  return Math.round(n)
}

export function SettingsPage() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [tab, setTab] = useState<TabId>('orders')
  const [minOrder, setMinOrder] = useState('0')
  const [courierFee, setCourierFee] = useState('0')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const s = await api.getSettings(token)
        if (!cancelled) {
          setMinOrder(String(Math.round(s.min_order_amount || 0)))
          setCourierFee(String(Math.round(s.delivery_fee || 0)))
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('admin.loadError'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, t])

  const onSaveOrders = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    const value = parseAmount(minOrder)
    if (Number.isNaN(value)) {
      setError(t('admin.minOrderInvalid'))
      return
    }
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const s = await api.updateSettings(token, { min_order_amount: value })
      setMinOrder(String(Math.round(s.min_order_amount || 0)))
      setCourierFee(String(Math.round(s.delivery_fee || 0)))
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const onSaveCourier = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    const value = parseAmount(courierFee)
    if (Number.isNaN(value)) {
      setError(t('admin.courierFeeInvalid'))
      return
    }
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const s = await api.updateSettings(token, { delivery_fee: value })
      setMinOrder(String(Math.round(s.min_order_amount || 0)))
      setCourierFee(String(Math.round(s.delivery_fee || 0)))
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const tabs: { id: TabId; label: string; icon: typeof ShoppingBag }[] = [
    { id: 'orders', label: t('admin.settingsTabOrders'), icon: ShoppingBag },
    { id: 'courier', label: t('admin.settingsTabCourier'), icon: Truck },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t('nav.settings')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{t('admin.settingsHint')}</p>
      </motion.div>

      <div
        role="tablist"
        className="flex gap-1 rounded-2xl bg-white/90 p-1.5 shadow-[0_10px_40px_-24px_rgba(15,118,110,0.45)] ring-1 ring-teal-900/8"
      >
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(id)
                setError('')
                setSaved(false)
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon size={16} />
              <span className="truncate">{label}</span>
            </button>
          )
        })}
      </div>

      {tab === 'orders' && (
        <Box
          title={t('admin.minOrderTitle')}
          subtitle={t('admin.minOrderHint')}
        >
          {loading ? (
            <p className="text-sm font-medium text-slate-500">
              {t('common.loading')}
            </p>
          ) : (
            <form onSubmit={(e) => void onSaveOrders(e)} className="space-y-4">
              <Input
                label={t('admin.minOrderLabel')}
                inputMode="numeric"
                value={minOrder}
                onChange={(e) => {
                  setMinOrder(e.target.value.replace(/[^\d]/g, ''))
                  setSaved(false)
                }}
                placeholder="0"
              />
              <p className="text-xs text-slate-500">
                {t('admin.minOrderZeroHint')}
              </p>

              {error && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                  {error}
                </p>
              )}
              {saved && !error && (
                <p className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800">
                  <Check size={16} />
                  {t('admin.settingsSaved')}
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="submit" disabled={saving}>
                  {saving ? t('auth.saving') : t('common.save')}
                </Button>
              </div>
            </form>
          )}
        </Box>
      )}

      {tab === 'courier' && (
        <Box
          title={t('admin.courierFeeTitle')}
          subtitle={t('admin.courierFeeHint')}
        >
          {loading ? (
            <p className="text-sm font-medium text-slate-500">
              {t('common.loading')}
            </p>
          ) : (
            <form onSubmit={(e) => void onSaveCourier(e)} className="space-y-4">
              <Input
                label={t('admin.courierFeeLabel')}
                inputMode="numeric"
                value={courierFee}
                onChange={(e) => {
                  setCourierFee(e.target.value.replace(/[^\d]/g, ''))
                  setSaved(false)
                }}
                placeholder="8000"
              />
              <ul className="space-y-1.5 text-xs leading-relaxed text-slate-500">
                <li>• {t('admin.courierFeeBullet1')}</li>
                <li>• {t('admin.courierFeeBullet2')}</li>
                <li>• {t('admin.courierFeeBullet3')}</li>
              </ul>

              {error && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                  {error}
                </p>
              )}
              {saved && !error && (
                <p className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800">
                  <Check size={16} />
                  {t('admin.settingsSaved')}
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="submit" disabled={saving}>
                  {saving ? t('auth.saving') : t('common.save')}
                </Button>
              </div>
            </form>
          )}
        </Box>
      )}
    </div>
  )
}
