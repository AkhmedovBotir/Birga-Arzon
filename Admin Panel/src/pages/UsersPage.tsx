import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import {
  api,
  type AppUser,
  type AppUserFormBody,
  type Region,
} from '../api/client'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { PhoneInput } from '../components/ui/PhoneInput'
import { Select } from '../components/ui/Select'
import { LocationMapField } from '../components/LocationMapField'
import { phoneDigits, phoneDisplay } from '../lib/phone'

type FormState = {
  phone: string
  first_name: string
  last_name: string
  viloyat_id: string
  tuman_id: string
  lat: string
  lng: string
  profile_complete: boolean
  is_blocked: boolean
}

const emptyForm: FormState = {
  phone: '',
  first_name: '',
  last_name: '',
  viloyat_id: '',
  tuman_id: '',
  lat: '',
  lng: '',
  profile_complete: false,
  is_blocked: false,
}

function toBody(form: FormState): AppUserFormBody {
  const lat = form.lat.trim() === '' ? null : Number(form.lat)
  const lng = form.lng.trim() === '' ? null : Number(form.lng)
  return {
    phone: form.phone,
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    viloyat_id: form.viloyat_id || null,
    tuman_id: form.tuman_id || null,
    lat: lat != null && !Number.isNaN(lat) ? lat : null,
    lng: lng != null && !Number.isNaN(lng) ? lng : null,
    profile_complete: form.profile_complete,
    is_blocked: form.is_blocked,
  }
}

export function UsersPage() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [items, setItems] = useState<AppUser[]>([])
  const [viloyats, setViloyats] = useState<Region[]>([])
  const [tumans, setTumans] = useState<Region[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<AppUser | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState('')

  const load = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [usersRes, vilRes] = await Promise.all([
        api.listUsers(token),
        api.regionsViloyatlar(token),
      ])
      setItems(usersRes.items ?? [])
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
    setForm(emptyForm)
    setTumans([])
    setFormError('')
    setCreateOpen(true)
  }

  const openEdit = (item: AppUser) => {
    setSelected(item)
    setForm({
      phone: phoneDigits(item.phone),
      first_name: item.first_name || '',
      last_name: item.last_name || '',
      viloyat_id: item.viloyat_id || '',
      tuman_id: item.tuman_id || '',
      lat: item.lat != null ? String(item.lat) : '',
      lng: item.lng != null ? String(item.lng) : '',
      profile_complete: item.profile_complete,
      is_blocked: item.is_blocked,
    })
    setFormError('')
    setEditOpen(true)
  }

  const openDelete = (item: AppUser) => {
    setSelected(item)
    setFormError('')
    setDeleteOpen(true)
  }

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setFormError('')
    try {
      await api.createUser(token, toBody(form))
      setCreateOpen(false)
      setForm(emptyForm)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.createError'))
    } finally {
      setSaving(false)
    }
  }

  const onUpdate = async (e: FormEvent) => {
    e.preventDefault()
    if (!token || !selected) return
    setSaving(true)
    setFormError('')
    try {
      await api.updateUser(token, selected.id, toBody(form))
      setEditOpen(false)
      setSelected(null)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.updateError'))
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!token || !selected) return
    setSaving(true)
    setFormError('')
    try {
      await api.deleteUser(token, selected.id)
      setDeleteOpen(false)
      setSelected(null)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.deleteError'))
    } finally {
      setSaving(false)
    }
  }

  const onToggleBlock = async (item: AppUser) => {
    if (!token || togglingId) return
    setTogglingId(item.id)
    setError('')
    const nextBlocked = !item.is_blocked
    setItems((prev) =>
      prev.map((u) =>
        u.id === item.id ? { ...u, is_blocked: nextBlocked } : u,
      ),
    )
    try {
      await api.setUserBlocked(token, item.id, nextBlocked)
    } catch (err) {
      setItems((prev) =>
        prev.map((u) =>
          u.id === item.id ? { ...u, is_blocked: item.is_blocked } : u,
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
      const value =
        target.type === 'checkbox' ? target.checked : target.value
      setForm((f) => ({ ...f, [key]: value }))
    }

  const formFields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input
        label={t('common.name')}
        value={form.first_name}
        onChange={setField('first_name')}
      />
      <Input
        label={t('common.lastName')}
        value={form.last_name}
        onChange={setField('last_name')}
      />
      <div className="sm:col-span-2">
        <PhoneInput
          value={form.phone}
          onChange={(phone) => setForm((f) => ({ ...f, phone }))}
          required
        />
      </div>
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
      <Input label="Lat" value={form.lat} onChange={setField('lat')} placeholder="41.31" />
      <Input label="Lng" value={form.lng} onChange={setField('lng')} placeholder="69.28" />
      <div className="sm:col-span-2">
        <LocationMapField
          lat={form.lat}
          lng={form.lng}
          onChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))}
        />
      </div>
      <label className="flex items-center gap-2 sm:col-span-2">
        <input
          type="checkbox"
          checked={form.profile_complete}
          onChange={setField('profile_complete')}
          className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
        />
        <span className="text-sm font-medium text-slate-700">
          {t('admin.profileComplete')}
        </span>
      </label>
      <label className="flex items-center gap-2 sm:col-span-2">
        <input
          type="checkbox"
          checked={form.is_blocked}
          onChange={setField('is_blocked')}
          className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
        />
        <span className="text-sm font-medium text-slate-700">
          {t('common.blocked')}
        </span>
      </label>
      {formError && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2">
          {formError}
        </p>
      )}
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('nav.users')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('admin.countShowing', { total: items.length, showing: filtered.length })}
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <UserPlus size={16} />
          {t('admin.newUser')}
        </Button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-teal-900/8 bg-white shadow-[0_18px_50px_-32px_rgba(15,118,110,0.45)]">
        <div className="border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-white px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:max-w-sm">
            <Search size={16} className="text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('admin.searchUsers')}
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
              <div
                key={i}
                className="h-14 animate-pulse rounded-2xl bg-slate-100"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <Plus size={20} />
            </div>
            <p className="font-medium text-slate-800">{t('admin.noUsers')}</p>
            <p className="mt-1 text-sm text-slate-500">
              {t('admin.noUsersHint')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/90 text-[11px] tracking-wide text-slate-500 uppercase">
                  <th className="px-5 py-3 font-semibold">{t('admin.userColumn')}</th>
                  <th className="px-4 py-3 font-semibold">{t('common.phone')}</th>
                  <th className="px-4 py-3 font-semibold">{t('nav.regions')}</th>
                  <th className="px-4 py-3 font-semibold">{t('nav.profile')}</th>
                  <th className="px-4 py-3 font-semibold">{t('common.status')}</th>
                  <th className="px-4 py-3 font-semibold">{t('admin.created')}</th>
                  <th className="px-5 py-3 text-right font-semibold">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`border-t border-slate-100 transition hover:bg-teal-50/40 ${
                      idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-sm font-semibold text-white">
                          {(
                            item.first_name?.[0] ||
                            item.full_name?.[0] ||
                            item.phone?.[0] ||
                            'U'
                          ).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {item.full_name?.trim() ||
                              [item.first_name, item.last_name]
                                .filter(Boolean)
                                .join(' ') ||
                              t('admin.nameless')}
                          </p>
                          {item.lat != null && item.lng != null && (
                            <p className="truncate text-xs text-slate-500">
                              {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-700">
                      {phoneDisplay(item.phone)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      <p className="truncate font-medium">
                        {item.tuman_name || '—'}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {item.viloyat_name || ''}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          item.profile_complete
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {item.profile_complete ? t('common.complete') : t('admin.profilePartial')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!item.is_blocked}
                          aria-label={
                            item.is_blocked ? t('admin.activate') : t('admin.block')
                          }
                          disabled={togglingId === item.id}
                          onClick={() => void onToggleBlock(item)}
                          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
                            item.is_blocked ? 'bg-rose-500' : 'bg-teal-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                              item.is_blocked
                                ? 'translate-x-1'
                                : 'translate-x-6'
                            }`}
                          />
                        </button>
                        <span
                          className={`text-xs font-semibold ${
                            item.is_blocked
                              ? 'text-rose-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {item.is_blocked ? t('common.blocked') : t('common.active')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">
                      {new Date(item.created_at).toLocaleDateString('uz-UZ')}
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
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('admin.newUser')}
        subtitle={t('admin.newUserHint')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="user-create-form" disabled={saving}>
              {saving ? t('auth.saving') : t('common.create')}
            </Button>
          </>
        }
      >
        <form id="user-create-form" onSubmit={onCreate}>
          {formFields}
        </form>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={t('admin.editUser')}
        subtitle={selected ? phoneDisplay(selected.phone) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="user-edit-form" disabled={saving}>
              {saving ? t('auth.saving') : t('common.save')}
            </Button>
          </>
        }
      >
        <form id="user-edit-form" onSubmit={onUpdate}>
          {formFields}
        </form>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('common.delete')}
        subtitle={t('admin.irreversible')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => void onDelete()}
              disabled={saving}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {saving ? t('common.deleting') : t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          {t('admin.deleteUserConfirm', {
            name: selected?.full_name || selected?.phone || '',
          })}
        </p>
        {formError && (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formError}
          </p>
        )}
      </Modal>
    </div>
  )
}
