import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, ChevronLeft } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { AuthLayout } from '../components/AuthLayout'
import { phoneDisplay } from '../lib/phone'

type LocState = { phone?: string; from?: string }

export function OtpPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { setSession } = useAuth()
  const state = (location.state as LocState | null) ?? {}
  const phone = state.phone ?? ''
  const from = state.from || '/'
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  if (!phone) return <Navigate to="/kirish" replace state={{ from }} />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const digits = code.replace(/\D/g, '')
    if (digits.length < 4) {
      setError(t('auth.enterCode'))
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await api.verifyOtp(phone, digits)
      setSession(res.token, res.user)
      if (res.needs_profile) {
        navigate('/kirish/profil', { replace: true, state: { phone, from } })
      } else {
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    setResending(true)
    setError('')
    try {
      await api.sendOtp(phone)
      setCode('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthLayout>
      <div className="mb-8 flex items-center justify-between">
        <Link
          to="/kirish"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)] sm:bg-[var(--brand-soft)] sm:ring-0"
        >
          <ChevronLeft size={20} />
        </Link>
        <span className="text-sm font-extrabold text-[var(--muted)]">
          {t('auth.step', { current: 2, total: 3 })}
        </span>
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-[var(--ink)]">
        {t('auth.otpTitle')}
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {t('auth.otpSubtitle', { phone: phoneDisplay(phone) })}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <input
          inputMode="numeric"
          autoFocus
          maxLength={6}
          placeholder={t('auth.otpPlaceholder')}
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
          }
          className="w-full rounded-2xl bg-white px-4 py-4 text-center text-2xl font-extrabold tracking-[0.4em] shadow-sm ring-1 ring-[var(--line)] outline-none focus:ring-2 focus:ring-[var(--brand)]/30 sm:bg-[var(--surface)]"
        />
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
          {loading ? t('auth.verifying') : t('auth.verify')}
          <ArrowRight size={16} />
        </button>
      </form>

      <button
        type="button"
        onClick={() => void resend()}
        disabled={resending}
        className="mt-4 w-full text-center text-sm font-bold text-[var(--brand)] disabled:opacity-60"
      >
        {resending ? t('auth.sending') : t('auth.resendCode')}
      </button>
    </AuthLayout>
  )
}
