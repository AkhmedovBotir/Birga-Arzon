import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Clock3,
  LogOut,
  MapPin,
  Package,
  Truck,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api, type Dashboard } from '../api/client'
import { phoneDisplay } from '../lib/phone'

export function DashboardPage() {
  const { t } = useTranslation()
  const { token, kuryer, logout } = useAuth()
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await api.dashboard(token)
        if (!cancelled) setDash(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('home.loadError'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, t])

  const profile = dash?.kuryer ?? kuryer
  const region = [profile?.viloyat_name, profile?.tuman_name]
    .filter(Boolean)
    .join(', ')

  const helloName = (() => {
    const raw =
      profile?.first_name?.trim() ||
      profile?.full_name?.trim().split(/\s+/)[0] ||
      ''
    if (raw && !/^\d+$/.test(raw) && /[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ]/.test(raw)) {
      return raw
    }
    return t('common.courier')
  })()

  const stats = [
    {
      label: t('kuryer.totalDeliveries'),
      value: dash?.deliveries ?? 0,
      icon: Package,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: t('orders.waiting'),
      value: dash?.pending ?? 0,
      icon: Clock3,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: t('kuryer.completed'),
      value: dash?.completed ?? 0,
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-700',
    },
  ]

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col px-4 pb-10 pt-5">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.28em] text-blue-700 uppercase">
            {t('kuryer.brand')}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {t('kuryer.hello', {
              name: helloName,
            })}
          </h1>
          {profile?.phone && (
            <p className="mt-0.5 text-sm text-slate-500">
              {phoneDisplay(profile.phone)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <LogOut size={16} />
          {t('common.logout')}
        </button>
      </header>

      {profile && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 overflow-hidden rounded-2xl border border-blue-900/10 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-700 text-white">
              <Truck size={22} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">
                {helloName === t('common.courier') && profile?.phone
                  ? phoneDisplay(profile.phone)
                  : profile?.full_name && !/^\d+(\s+\d+)*$/.test(profile.full_name.trim())
                    ? profile.full_name
                    : helloName}
              </p>
              {region ? (
                <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
                  <MapPin size={14} className="shrink-0" />
                  <span className="truncate">{region}</span>
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-slate-400">
                  {t('profile.noRegion')}
                </p>
              )}
            </div>
          </div>
        </motion.section>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {t('common.loading')}
        </p>
      ) : error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          {error}
        </p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-3 gap-2.5">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm"
              >
                <div
                  className={`mb-2 inline-flex rounded-lg p-1.5 ${s.tone}`}
                >
                  <s.icon size={16} strokeWidth={1.8} />
                </div>
                <p className="text-xl font-semibold tabular-nums text-slate-900">
                  {s.value}
                </p>
                <p className="mt-0.5 text-[11px] leading-tight text-slate-500">
                  {s.label}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl border border-dashed border-blue-300/70 bg-blue-50/60 px-4 py-8 text-center"
          >
            <Package
              size={28}
              className="mx-auto mb-3 text-blue-600"
              strokeWidth={1.6}
            />
            <h2 className="text-base font-semibold text-slate-900">
              {t('kuryer.todayTasks')}
            </h2>
            <p className="mx-auto mt-1.5 max-w-xs text-sm text-slate-600">
              {dash?.today_hint || t('kuryer.todayHint')}
            </p>
          </motion.section>
        </>
      )}
    </div>
  )
}
