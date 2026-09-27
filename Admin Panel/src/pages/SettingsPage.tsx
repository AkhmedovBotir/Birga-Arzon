import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Bot, Check, RefreshCw, Send, ShoppingBag, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api/client'
import { Box } from '../components/ui/Box'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

type TabId = 'orders' | 'courier' | 'bot'

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
  const [botToken, setBotToken] = useState('')
  const [botWebappUrl, setBotWebappUrl] = useState('https://birgaarzon.uz')
  const [botStatus, setBotStatus] = useState<{
    active: boolean
    username?: string
    first_name?: string
    bot_id?: number
    error?: string
  } | null>(null)
  const [testingBot, setTestingBot] = useState(false)
  const [syncingCommands, setSyncingCommands] = useState(false)
  const [botNotice, setBotNotice] = useState('')
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
        const [s, bStatus] = await Promise.all([
          api.getSettings(token),
          api.getBotStatus(token).catch(() => null),
        ])
        if (!cancelled) {
          setMinOrder(String(Math.round(s.min_order_amount || 0)))
          setCourierFee(String(Math.round(s.delivery_fee || 0)))
          setBotToken(s.telegram_bot_token || '')
          if (s.telegram_webapp_url) {
            setBotWebappUrl(s.telegram_webapp_url)
          }
          if (bStatus) {
            setBotStatus(bStatus)
          }
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

  const onSaveBot = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setError('')
    setSaved(false)
    setBotNotice('')
    try {
      await api.updateSettings(token, {
        telegram_bot_token: botToken.trim(),
        telegram_webapp_url: botWebappUrl.trim() || 'https://birgaarzon.uz',
      })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)

      const bStatus = await api.getBotStatus(token).catch(() => null)
      if (bStatus) setBotStatus(bStatus)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const onTestBot = async () => {
    if (!token || !botToken.trim()) return
    setTestingBot(true)
    setError('')
    setBotNotice('')
    try {
      const res = await api.testBotToken(token, botToken.trim())
      if (res.ok) {
        setBotNotice(
          `${t('admin.botTestSuccess')} (@${res.username || 'Bot'} - ${res.first_name || ''})`,
        )
        const bStatus = await api.getBotStatus(token).catch(() => null)
        if (bStatus) setBotStatus(bStatus)
      } else {
        setError(res.error || 'Botga ulanib bo‘lmadi')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bot test xatosi')
    } finally {
      setTestingBot(false)
    }
  }

  const onSyncCommands = async () => {
    if (!token) return
    setSyncingCommands(true)
    setError('')
    setBotNotice('')
    try {
      const res = await api.syncBotCommands(token)
      setBotNotice(res.message || 'Komandalar sinxronlandi!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sinxronlashda xatolik')
    } finally {
      setSyncingCommands(false)
    }
  }

  const tabs: { id: TabId; label: string; icon: typeof ShoppingBag }[] = [
    { id: 'orders', label: t('admin.settingsTabOrders'), icon: ShoppingBag },
    { id: 'courier', label: t('admin.settingsTabCourier'), icon: Truck },
    { id: 'bot', label: t('admin.settingsTabBot'), icon: Bot },
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

      {tab === 'bot' && (
        <Box
          title={t('admin.botSettingsTitle')}
          subtitle={t('admin.botSettingsSubtitle')}
        >
          {loading ? (
            <p className="text-sm font-medium text-slate-500">
              {t('common.loading')}
            </p>
          ) : (
            <form onSubmit={(e) => void onSaveBot(e)} className="space-y-5">
              {/* Bot status badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4 bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      botStatus?.active
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    <Bot size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          botStatus?.active ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                        }`}
                      />
                      <p className="text-sm font-bold text-slate-900">
                        {botStatus?.active
                          ? `@${botStatus.username || 'Birgaarzon_bot'}`
                          : t('admin.botStatusInactive')}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {botStatus?.active
                        ? `${botStatus.first_name || 'BirgaArzon'} (ID: ${botStatus.bot_id || ''})`
                        : botStatus?.error || 'Tokenni saqlang va tekshiring'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    className="!px-3 !py-1.5 !text-xs"
                    disabled={testingBot || !botToken.trim()}
                    onClick={() => void onTestBot()}
                  >
                    <RefreshCw size={14} className={testingBot ? 'animate-spin' : ''} />
                    {t('admin.botTestButton')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="!px-3 !py-1.5 !text-xs"
                    disabled={syncingCommands || !botStatus?.active}
                    onClick={() => void onSyncCommands()}
                  >
                    <Send size={14} className={syncingCommands ? 'animate-spin' : ''} />
                    {t('admin.botSyncButton')}
                  </Button>
                </div>
              </div>

              {/* Bot Token field */}
              <div className="space-y-1.5">
                <Input
                  label={t('admin.botTokenLabel')}
                  type="text"
                  value={botToken}
                  onChange={(e) => {
                    setBotToken(e.target.value.trim())
                    setSaved(false)
                    setBotNotice('')
                  }}
                  placeholder="123456789:ABCdefGhI..."
                />
                <p className="text-xs text-slate-500">
                  {t('admin.botTokenHint')}
                </p>
              </div>

              {/* WebApp URL field */}
              <div className="space-y-1.5">
                <Input
                  label={t('admin.botWebappUrlLabel')}
                  type="url"
                  value={botWebappUrl}
                  onChange={(e) => {
                    setBotWebappUrl(e.target.value.trim())
                    setSaved(false)
                    setBotNotice('')
                  }}
                  placeholder="https://birgaarzon.uz"
                />
                <p className="text-xs text-slate-500">
                  {t('admin.botWebappUrlHint')}
                </p>
              </div>

              {/* Registered commands card */}
              <div className="rounded-2xl border border-teal-900/10 bg-teal-50/40 p-4 space-y-2">
                <p className="text-xs font-bold text-teal-950 uppercase tracking-wider">
                  {t('admin.botCommandsTitle')}
                </p>
                <div className="grid gap-2 sm:grid-cols-3 text-xs">
                  <div className="rounded-xl bg-white p-2.5 border border-teal-900/5 shadow-sm">
                    <p className="font-mono font-bold text-teal-800">/start</p>
                    <p className="text-slate-600 mt-0.5">{t('admin.botCmdStart')}</p>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 border border-teal-900/5 shadow-sm">
                    <p className="font-mono font-bold text-teal-800">/help</p>
                    <p className="text-slate-600 mt-0.5">{t('admin.botCmdHelp')}</p>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 border border-teal-900/5 shadow-sm">
                    <p className="font-mono font-bold text-teal-800">/app</p>
                    <p className="text-slate-600 mt-0.5">{t('admin.botCmdApp')}</p>
                  </div>
                </div>
              </div>

              {error && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                  {error}
                </p>
              )}
              {botNotice && (
                <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">
                  {botNotice}
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
