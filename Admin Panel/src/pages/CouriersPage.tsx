import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import {
  api,
  type Kuryer,
  type KuryerFormBody,
  type KuryerStats,
  type Region,
} from '../api/client'
import { Button } from '../components/ui/Button'
import { Input, PasswordInput } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { PhoneInput } from '../components/ui/PhoneInput'
import { Select } from '../components/ui/Select'
import { phoneDigits, phoneDisplay } from '../lib/phone'

type FormState = {
  first_name: string
  last_name: string
  phone: string
  password: string
  viloyat_id: string
  tuman_id: string
  is_active: boolean
}

const emptyForm: FormState = {
  first_name: '',
  last_name: '',
  phone: '',
  password: '',
  viloyat_id: '',
  tuman_id: '',
  is_active: true,
}

function toBody(form: FormState, forCreate: boolean): KuryerFormBody {
  const body: KuryerFormBody = {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    phone: form.phone,
    viloyat_id: form.viloyat_id || null,
    tuman_id: form.tuman_id || null,
    is_active: form.is_active,
  }
  if (forCreate || form.password.trim()) {
    body.password = form.password
  }
  return body
}

export function CouriersPage() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [items, setItems] = useState<Kuryer[]>([])
  const [stats, setStats] = useState<KuryerStats | null>(null)
  const [viloyats, setViloyats] = useState<Region[]>([])
  const [tumans, setTumans] = useState<Region[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Kuryer | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState('')

  const load = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [listRes, statsRes, vilRes] = await Promise.all([
        api.listKuryers(token),
        api.kuryersStats(token),
        api.regionsViloyatlar(token),
      ])
      setItems(listRes.items ?? [])
      setStats(statsRes)
      setViloyats((vilRes.items ?? []).filter((r) => r.status === 'active'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [token])

  useEffect(() => {
    if (!token || !form.viloyat_id) {
      setTumans([])
      return
    }
    void (async () => {
      try {
        const res = await api.regionsChildren(token, form.viloyat_id, 'tuman')
        setTumans((res.items ?? []).filter((r) => r.status === 'active'))
      } catch {
        setTumans([])
      }
    })()
  }, [token, form.viloyat_id])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const hay = [
        item.first_name,
        item.last_name,
        item.full_name,
        item.phone,
        item.viloyat_name,
        item.tuman_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [items, query])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setTumans([])
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (item: Kuryer) => {
    setEditingId(item.id)
    setForm({
      first_name: item.first_name || '',
      last_name: item.last_name || '',
      phone: phoneDigits(item.phone),
      password: '',
      viloyat_id: item.viloyat_id || '',
      tuman_id: item.tuman_id || '',
      is_active: item.is_active,
    })
    setFormError('')
    setModalOpen(true)
  }

  const openDelete = (item: Kuryer) => {
    setSelected(item)
    setFormError('')
    setDeleteOpen(true)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    if (!editingId && form.password.trim().length < 4) {
      setFormError(t('admin.passwordMin4'))
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const body = toBody(form, !editingId)
      if (editingId) await api.updateKuryer(token, editingId, body)
      else await api.createKuryer(token, body)
      setModalOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!token || !selected) return
    setSaving(true)
    setFormError('')
    try {
      await api.deleteKuryer(token, selected.id)
      setDeleteOpen(false)
      setSelected(null)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.deleteError'))
    } finally {
      setSaving(false)
    }
  }

  const onToggle = async (item: Kuryer) => {
    if (!token || togglingId) return
    setTogglingId(item.id)
    const next = !item.is_active
    setItems((prev) =>
      prev.map((k) => (k.id === item.id ? { ...k, is_active: next } : k)),
    )
    try {
      await api.setKuryerActive(token, item.id, next)
    } catch (err) {
      setItems((prev) =>
        prev.map((k) =>
          k.id === item.id ? { ...k, is_active: item.is_active } : k,
        ),
      )
      setError(err instanceof Error ? err.message : t('admin.statusError'))
    } finally {
      setTogglingId(null)
    }
  }

  const setField =
    (key: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const target = e.target
      if (target.type === 'checkbox') {
        setForm((f) => ({ ...f, [key]: target.checked }))
        return
      }
      setForm((f) => ({ ...f, [key]: target.value }))
    }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('nav.couriers')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('admin.couriersHint')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stats && (
            <>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                {t('admin.statTotal', { count: stats.total })}
              </span>
              <span className="rounded-full bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-800">
                {t('admin.activeCount', { count: stats.active })}
              </span>
            </>
          )}
          <Button type="button" onClick={openCreate}>
            <Plus size={16} />
            {t('admin.addCourier')}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-teal-900/8 bg-white shadow-[0_18px_50px_-32px_rgba(15,118,110,0.45)]">
        <div className="border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-white px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:max-w-md">
            <Search size={16} className="text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('common.search')}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {error && (
          <p className="mx-4 mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:mx-5">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <Truck size={20} />
            </div>
            <p className="font-medium text-slate-800">{t('admin.noCouriers')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/90 text-[11px] tracking-wide text-slate-500 uppercase">
                  <th className="px-5 py-3 font-semibold">{t('admin.courierColumn')}</th>
                  <th className="px-4 py-3 font-semibold">{t('common.phone')}</th>
                  <th className="px-4 py-3 font-semibold">{t('nav.regions')}</th>
                  <th className="px-4 py-3 font-semibold">{t('common.active')}</th>
                  <th className="px-5 py-3 text-right font-semibold">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-slate-100 transition hover:bg-teal-50/40"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">
                        {item.full_name ||
                          `${item.first_name} ${item.last_name}`.trim()}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-700">
                      {phoneDisplay(item.phone)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {[item.viloyat_name, item.tuman_name]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.is_active}
                        disabled={togglingId === item.id}
                        onClick={() => void onToggle(item)}
                        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
                          item.is_active ? 'bg-teal-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                            item.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title={t('common.edit')}
                          onClick={() => openEdit(item)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          title={t('common.delete')}
                          onClick={() => openDelete(item)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? t('admin.editCourier') : t('admin.newCourier')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="kuryer-form" disabled={saving}>
              {saving ? t('auth.saving') : editingId ? t('common.save') : t('common.add')}
            </Button>
          </>
        }
      >
        <form id="kuryer-form" className="space-y-4" onSubmit={onSubmit}>
          {formError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={t('common.name')}
              value={form.first_name}
              onChange={setField('first_name')}
              required
            />
            <Input
              label={t('common.lastName')}
              value={form.last_name}
              onChange={setField('last_name')}
            />
          </div>
          <PhoneInput
            value={form.phone}
            onChange={(phone) => setForm((f) => ({ ...f, phone }))}
            required
          />
          <PasswordInput
            label={editingId ? t('admin.passwordOptional') : t('common.password')}
            value={form.password}
            onChange={setField('password')}
            required={!editingId}
            autoComplete="new-password"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label={t('common.region')}
              value={form.viloyat_id}
              onChange={(viloyat_id) =>
                setForm((f) => ({ ...f, viloyat_id, tuman_id: '' }))
              }
              options={viloyats.map((v) => ({ value: v.id, label: v.name }))}
              searchable
            />
            <Select
              label={t('common.district')}
              value={form.tuman_id}
              onChange={(tuman_id) => setForm((f) => ({ ...f, tuman_id }))}
              options={tumans.map((t) => ({ value: t.id, label: t.name }))}
              disabled={!form.viloyat_id}
              placeholder={!form.viloyat_id ? t('auth.selectViloyatFirst') : t('common.select')}
              searchable
            />
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <span className="text-sm font-medium text-slate-700">{t('common.active')}</span>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={setField('is_active')}
              className="h-4 w-4 accent-teal-600"
            />
          </label>
        </form>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('admin.deleteCourier')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={saving}
              onClick={() => void onDelete()}
            >
              {t('common.delete')}
            </Button>
          </>
        }
      >
        {formError && (
          <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formError}
          </p>
        )}
        <p className="text-sm text-slate-600">
          {t('admin.deleteCourierConfirm', { name: selected?.full_name ?? '' })}
        </p>
      </Modal>
    </div>
  )
}
