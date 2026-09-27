import type { FormEvent } from 'react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LockKeyhole, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/Button'
import { Input, PasswordInput } from '../components/ui/Input'

export function LoginPage() {
  const { t } = useTranslation()
  const { login, admin, loading } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && admin) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.loginError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 15% 10%, rgba(45,212,191,0.22), transparent 55%), radial-gradient(ellipse 60% 50% at 90% 85%, rgba(13,148,136,0.18), transparent 50%), linear-gradient(165deg, #f4fbf9 0%, #e8f4f1 45%, #f7faf9 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(15,118,110,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,118,110,0.04) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <motion.div
        className="relative w-full max-w-[420px]"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="mb-7 text-center">
          <motion.div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-800 text-teal-50 shadow-lg shadow-teal-900/25"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08, duration: 0.35 }}
          >
            <LockKeyhole size={26} strokeWidth={1.75} />
          </motion.div>
          <p className="text-[11px] font-semibold tracking-[0.32em] text-teal-700 uppercase">
            {t('admin.brand')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {t('admin.panelTitle')}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {t('admin.loginHint')}
          </p>
        </div>

        <div className="overflow-hidden rounded-[1.35rem] border border-teal-900/10 bg-white shadow-[0_24px_60px_-28px_rgba(15,118,110,0.55)]">
          <div className="h-1.5 bg-gradient-to-r from-teal-700 via-emerald-500 to-teal-600" />

          <form className="space-y-5 p-6 sm:p-7" onSubmit={onSubmit}>
            <div className="relative">
              <div className="pointer-events-none absolute top-[2.35rem] left-3 z-10 text-slate-400">
                <UserRound size={17} strokeWidth={1.8} />
              </div>
              <Input
                label={t('common.username')}
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-10"
                placeholder="admin"
                required
              />
            </div>

            <PasswordInput
              label={t('common.password')}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              className="w-full py-3 text-[15px]"
              disabled={submitting}
            >
              {submitting ? t('admin.loggingIn') : t('auth.loginBtn')}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
