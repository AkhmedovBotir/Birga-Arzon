import type { FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, ChevronLeft } from 'lucide-react'
import { api, type RegionItem } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { AuthLayout } from '../components/AuthLayout'
import { LocationPicker, type LatLng } from '../components/LocationPicker'
import { Select } from '../components/Select'

const fieldClass =
  'w-full rounded-xl bg-white px-3 py-2.5 text-sm font-bold shadow-sm ring-1 ring-[var(--line)] outline-none focus:ring-2 focus:ring-[var(--brand)]/30 sm:bg-[var(--surface)]'

export function ProfileSetupPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { token, user, setSession, loading: authLoading } = useAuth()
  const isEdit = !!user?.profile_complete

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [viloyatId, setViloyatId] = useState('')
  const [tumanId, setTumanId] = useState('')
  const [viloyats, setViloyats] = useState<RegionItem[]>([])
  const [tumans, setTumans] = useState<RegionItem[]>([])
  const [location, setLocation] = useState<LatLng | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingRegs, setLoadingRegs] = useState(true)
  const [hydrated, setHydrated] = useState(false)

  /** Birinchi yuklashda tuman_id ni saqlab qolish */
  const pendingTumanId = useRef<string | null>(null)

  useEffect(() => {
    if (!user || hydrated) return
    setFirstName(user.first_name || '')
    setLastName(user.last_name || '')
    if (user.viloyat_id) {
      pendingTumanId.current = user.tuman_id || null
      setViloyatId(user.viloyat_id)
    }
    if (user.lat != null && user.lng != null) {
      setLocation({ lat: user.lat, lng: user.lng })
    }
    setHydrated(true)
  }, [user, hydrated])

  useEffect(() => {
    void (async () => {
      setLoadingRegs(true)
      try {
        const res = await api.regionsViloyatlar()
        setViloyats((res.items ?? []).filter((r) => r.status === 'active'))
      } catch {
        setViloyats([])
      } finally {
        setLoadingRegs(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!viloyatId) {
      setTumans([])
      setTumanId('')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await api.regionsChildren(viloyatId, 'tuman')
        if (cancelled) return
        const list = (res.items ?? []).filter((r) => r.status === 'active')
        setTumans(list)
        const keep = pendingTumanId.current
        if (keep && list.some((t) => t.id === keep)) {
          setTumanId(keep)
          pendingTumanId.current = null
        } else {
          setTumanId('')
        }
      } catch {
        if (!cancelled) {
          setTumans([])
          setTumanId('')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [viloyatId])

  const regionFocus = useMemo(() => {
    if (!viloyatId || !tumanId) return null
    const viloyat = viloyats.find((v) => v.id === viloyatId)
    const tuman = tumans.find((t) => t.id === tumanId)
    if (!viloyat || !tuman) return null
    return { viloyatName: viloyat.name, tumanName: tuman.name }
  }, [viloyatId, tumanId, viloyats, tumans])

  if (authLoading) {
    return (
      <AuthLayout compact>
        <p className="py-20 text-center text-sm font-bold text-[var(--muted)]">
          {t('common.loading')}
        </p>
      </AuthLayout>
    )
  }

  if (!token) return <Navigate to="/kirish" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      setError(t('auth.needName'))
      return
    }
    if (!viloyatId || !tumanId) {
      setError(t('auth.needRegion'))
      return
    }
    if (!location) {
      setError(t('auth.needLocation'))
      return
    }
    setError('')
    setLoading(true)
    try {
      const updated = await api.completeProfile(token, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        viloyat_id: viloyatId,
        tuman_id: tumanId,
        lat: location.lat,
        lng: location.lng,
      })
      setSession(token, updated)
      navigate(isEdit ? '/profil' : '/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const onViloyatChange = (id: string) => {
    pendingTumanId.current = null
    setViloyatId(id)
  }

  return (
    <AuthLayout wide compact>
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <Link
          to={isEdit ? '/profil' : '/kirish/kod'}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)] sm:bg-[var(--brand-soft)] sm:ring-0"
        >
          <ChevronLeft size={18} />
        </Link>
        {!isEdit && (
          <span className="text-xs font-extrabold text-[var(--muted)]">
            {t('auth.step', { current: 3, total: 3 })}
          </span>
        )}
      </div>

      <h1 className="shrink-0 text-xl font-extrabold tracking-tight text-[var(--ink)] sm:text-2xl">
        {isEdit ? t('auth.editProfile') : t('auth.register')}
      </h1>
      <p className="mt-0.5 shrink-0 text-xs text-[var(--muted)] sm:text-sm">
        {isEdit ? t('auth.editProfileHint') : t('auth.registerHint')}
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-3 flex min-h-0 flex-1 flex-col gap-2.5 sm:mt-4 sm:gap-3"
      >
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:gap-3">
          <label className="block space-y-1">
            <span className="text-[10px] font-extrabold tracking-[0.14em] text-[var(--muted)] uppercase">
              {t('common.name')}
            </span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={t('auth.firstNamePlaceholder')}
              className={fieldClass}
              required
              autoComplete="given-name"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-extrabold tracking-[0.14em] text-[var(--muted)] uppercase">
              {t('common.lastName')}
            </span>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder={t('auth.lastNamePlaceholder')}
              className={fieldClass}
              required
              autoComplete="family-name"
            />
          </label>
        </div>

        <Select
          className="shrink-0"
          label={t('common.region')}
          required
          value={viloyatId}
          onChange={onViloyatChange}
          options={viloyats.map((v) => ({ value: v.id, label: v.name }))}
          placeholder={
            loadingRegs ? t('common.loading') : t('auth.selectViloyat')
          }
          disabled={loadingRegs}
          searchable
        />

        <Select
          className="shrink-0"
          label={t('common.district')}
          required
          value={tumanId}
          onChange={setTumanId}
          options={tumans.map((tuman) => ({
            value: tuman.id,
            label: tuman.name,
          }))}
          placeholder={
            !viloyatId
              ? t('auth.selectViloyatFirst')
              : t('auth.selectTuman')
          }
          disabled={!viloyatId}
          searchable
        />

        <div className="min-h-0 flex-1">
          <LocationPicker
            value={location}
            onChange={setLocation}
            compact
            regionFocus={regionFocus}
          />
        </div>

        {error && (
          <p className="shrink-0 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="ba-btn mt-auto w-full shrink-0 rounded-xl py-3 text-sm disabled:opacity-60"
        >
          {loading
            ? t('auth.saving')
            : isEdit
              ? t('common.save')
              : t('auth.start')}
          <ArrowRight size={16} />
        </button>
      </form>
    </AuthLayout>
  )
}
