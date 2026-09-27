import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { MascotMark } from '../components/Mascot'
import { AuthLayout } from '../components/AuthLayout'
import { PhoneInput } from '../components/PhoneInput'
import { config } from '../config'
import { phoneDigits } from '../lib/phone'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.3 14.7 2.3 12 2.3 6.9 2.3 2.8 6.4 2.8 11.5S6.9 20.7 12 20.7c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
      />
      <path
        fill="#34A853"
        d="M3.9 7.4l3.2 2.3C8 7.6 9.8 6.3 12 6.3c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.3 14.7 2.3 12 2.3 8.3 2.3 5.1 4.4 3.9 7.4z"
      />
      <path
        fill="#4A90E2"
        d="M12 20.7c2.6 0 4.8-.9 6.4-2.4l-3.1-2.4c-.9.6-2 1-3.3 1-3.9 0-5.3-2.5-5.5-3.8l-3.3 2.5C5.1 18.6 8.3 20.7 12 20.7z"
      />
      <path
        fill="#FBBC05"
        d="M3.9 15.6l3.3-2.5c.3 1.3 1.7 3.8 5.5 3.8 1.3 0 2.4-.4 3.3-1l3.1 2.4C16.8 19.8 14.6 20.7 12 20.7c-3.7 0-6.9-2.1-8.1-5.1z"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}

function SocialSoonButton({ provider }: { provider: 'google' | 'apple' }) {
  const { t } = useTranslation()
  const isGoogle = provider === 'google'
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      className="relative flex w-full cursor-not-allowed items-center justify-center gap-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-b from-white to-[#faf6f1] py-3.5 text-sm font-extrabold text-[var(--ink)] opacity-70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_16px_-12px_rgba(26,20,16,0.35)]"
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-black/5 ${
          isGoogle ? 'bg-white text-[var(--ink)]' : 'bg-[#111] text-white'
        }`}
      >
        {isGoogle ? <GoogleIcon /> : <AppleIcon />}
      </span>
      <span className="pr-16">
        {isGoogle ? t('auth.viaGoogle') : t('auth.viaApple')}
      </span>
      <span className="absolute top-2 right-2 rounded-full bg-[var(--brand)] px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-white uppercase shadow-sm shadow-orange-500/30">
        {t('auth.comingSoon')}
      </span>
    </button>
  )
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as { from?: string } | null)?.from || '/'
  const { isAuthenticated, user, loading: authLoading } = useAuth()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (authLoading) {
    return (
      <AuthLayout>
        <p className="py-20 text-center text-sm font-bold text-[var(--muted)]">
          {t('common.loading')}
        </p>
      </AuthLayout>
    )
  }

  if (isAuthenticated && user?.profile_complete) {
    return <Navigate to={from} replace />
  }
  if (isAuthenticated && user && !user.profile_complete) {
    return <Navigate to="/kirish/profil" replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const digits = phoneDigits(phone)
    if (digits.length !== 9) {
      setError(t('auth.enterPhone'))
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.sendOtp(digits)
      navigate('/kirish/kod', {
        state: { phone: digits, from },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)] sm:bg-[var(--brand-soft)] sm:ring-0"
        >
          <ChevronLeft size={20} />
        </Link>
        <span className="text-sm font-extrabold text-[var(--muted)]">
          {t('auth.step', { current: 1, total: 3 })}
        </span>
      </div>

      <div className="mb-8 flex items-center gap-3">
        <MascotMark size={48} />
        <div>
          <p className="text-lg font-extrabold text-[var(--ink)]">
            {config.appName}
          </p>
          <p className="text-[10px] font-bold tracking-[0.14em] text-[var(--green-mid)] uppercase">
            {config.tagline}
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--ink)]">
          {t('auth.title')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {t('auth.subtitle')}
        </p>
      </motion.div>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <PhoneInput value={phone} onChange={setPhone} required />

        {error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="ba-btn w-full py-3.5 text-sm disabled:opacity-60"
        >
          {loading ? t('auth.sending') : t('auth.getCode')}
          <ArrowRight size={16} />
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--line)]" />
        <span className="text-xs font-bold text-[var(--muted)]">{t('auth.or')}</span>
        <div className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <div className="space-y-2.5">
        <SocialSoonButton provider="google" />
        <SocialSoonButton provider="apple" />
      </div>

      <p className="mt-8 text-center text-[11px] leading-relaxed text-[var(--muted)] sm:mt-10">
        {t('auth.termsAgree')}{' '}
        <button type="button" className="font-bold text-[var(--brand)] underline">
          {t('auth.terms')}
        </button>{' '}
        {t('auth.and')}{' '}
        <button type="button" className="font-bold text-[var(--brand)] underline">
          {t('auth.privacy')}
        </button>{' '}
        {t('auth.termsSuffix')}
      </p>
    </AuthLayout>
  )
}
