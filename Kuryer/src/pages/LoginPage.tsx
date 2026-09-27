import type { FormEvent } from 'react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { LockKeyhole } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { PhoneInput } from '../components/PhoneInput'

export function LoginPage() {
  const { t } = useTranslation()
  const { login, kuryer, loading } = useAuth()
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && kuryer) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(phone, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.wrongCredentials'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-12">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-16 h-64 w-64 rounded-full bg-blue-300/40 blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, 20, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-sky-200/50 blur-3xl"
        animate={{ x: [0, -30, 0], y: [0, -25, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="relative w-full max-w-[400px]"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="mb-7 text-center">
          <motion.div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-800 text-blue-50 shadow-lg shadow-blue-900/25"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08, duration: 0.35 }}
          >
            <LockKeyhole size={26} strokeWidth={1.75} />
          </motion.div>
          <p className="text-[11px] font-semibold tracking-[0.32em] text-blue-700 uppercase">
            {t('kuryer.brand')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {t('common.courier')}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {t('auth.courierHint')}
          </p>
        </div>

        <div className="overflow-hidden rounded-[1.35rem] border border-blue-900/10 bg-white/90 shadow-[0_24px_60px_-28px_rgba(29,78,216,0.45)] backdrop-blur">
          <div className="h-1.5 bg-gradient-to-r from-blue-700 via-sky-500 to-blue-600" />

          <form className="space-y-5 p-6 sm:p-7" onSubmit={onSubmit}>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              required
            />

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">
                {t('common.password')}
              </span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="••••••••"
                required
              />
            </label>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-blue-700 py-3 text-[15px] font-semibold text-white shadow-md shadow-blue-900/20 transition hover:bg-blue-800 disabled:opacity-60"
            >
              {submitting ? t('auth.loggingIn') : t('auth.loginBtn')}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
