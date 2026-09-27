import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api, type AdminFormBody, type AdminUser } from '../api/client'
import { Button } from '../components/ui/Button'
import { Input, PasswordInput } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { PhoneInput } from '../components/ui/PhoneInput'
import { phoneDigits, phoneDisplay } from '../lib/phone'

type FormState = {
  first_name: string
  last_name: string
  phone: string
  username: string
  password: string
  is_active: boolean
}

const emptyForm: FormState = {
  first_name: '',
  last_name: '',
  phone: '',
  username: '',
  password: '',
  is_active: true,
}

function toCreateBody(form: FormState): AdminFormBody {
  return {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    phone: form.phone.trim(),
    username: form.username.trim(),
    password: form.password,
  }
}

function toUpdateBody(form: FormState): AdminFormBody {
  return {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    phone: form.phone.trim(),
    username: form.username.trim(),
    password: form.password,
    is_active: form.is_active,
  }
}

export function AdminsPage() {
  const { t } = useTranslation()
  const { token, admin, loading: authLoading } = useAuth()

  const roleLabel = (role: string) => {
    if (role === 'general') return t('admin.roleGeneral')
    if (role === 'admin') return t('admin.roleAdmin')
    return role
  }
  const [items, setItems] = useState<AdminUser[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState('')

  const isGeneral = admin?.role === 'general'

  const load = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const res = await api.listAdmins(token)
      setItems(res.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && token) void load()
  }, [token, authLoading])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const hay = [
        item.first_name,
        item.last_name,
        item.username,
        item.phone,
        item.role,
        roleLabel(item.role),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [items, query, t])

  const openCreate = () => {
    setEditingId(null)
    setSelected(null)
    setForm(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (item: AdminUser) => {
    setEditingId(item.id)
    setSelected(item)
    setForm({
      first_name: item.first_name,
      last_name: item.last_name,
      phone: phoneDigits(item.phone),
      username: item.username,
      password: '',
      is_active: item.is_active,
    })
    setFormError('')
    setModalOpen(true)
  }

  const openDelete = (item: AdminUser) => {
    setSelected(item)
    setFormError('')
    setDeleteOpen(true)
  }

  const validateForm = (forCreate: boolean) => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setFormError(t('auth.needName'))
      return false
    }
    if (phoneDigits(form.phone).length !== 9) {
      setFormError(t('admin.needPhone'))
      return false
    }
    if (!form.username.trim()) {
      setFormError(t('admin.needUsername'))
      return false
    }
    if (forCreate && !form.password.trim()) {
      setFormError(t('admin.passwordRequired'))
      return false
    }
    return true
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token || !isGeneral) return
    const forCreate = !editingId
    if (!validateForm(forCreate)) return

    setSaving(true)
    setFormError('')
    try {
      if (forCreate) {
        await api.createAdmin(token, toCreateBody(form))
      } else {
        await api.updateAdmin(token, editingId, toUpdateBody(form))
      }
      setModalOpen(false)
      setEditingId(null)
      setSelected(null)
      setForm(emptyForm)
      await load()
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : forCreate
            ? t('admin.createError')
            : t('admin.updateError'),
      )
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!token || !selected || !isGeneral) return
    setSaving(true)
    setFormError('')
    try {
      await api.deleteAdmin(token, selected.id)
      setDeleteOpen(false)
      setSelected(null)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.deleteError'))
    } finally {
      setSaving(false)
    }
  }

  const onToggleActive = async (item: AdminUser) => {
    if (!token || !isGeneral || item.role === 'general') return
    setTogglingId(item.id)
    setError('')
    const next = !item.is_active
    setItems((list) =>
      list.map((a) => (a.id === item.id ? { ...a, is_active: next } : a)),
    )
    try {
      await api.updateAdmin(token, item.id, {
        first_name: item.first_name,
        last_name: item.last_name,
        phone: item.phone,
        username: item.username,
        password: '',
        is_active: next,
      })
    } catch (err) {
      setItems((list) =>
        list.map((a) =>
          a.id === item.id ? { ...a, is_active: item.is_active } : a,
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
      const value =
        e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm((f) => ({ ...f, [key]: value }))
    }

  const canManageRow = (item: AdminUser) =>
    isGeneral && (item.role !== 'general' || item.id === admin?.id)

  const canDeleteRow = (item: AdminUser) =>
    isGeneral && item.role !== 'general' && item.id !== admin?.id

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('nav.admins')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('admin.countShowing', {
              total: items.length,
              showing: filtered.length,
            })}
          </p>
        </div>
        {isGeneral ? (
          <Button onClick={openCreate} className="shrink-0">
            <UserPlus size={16} />
            {t('admin.newAdmin')}
          </Button>
        ) : (
          !authLoading && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-100">
              {t('admin.limitedHint')}
            </p>
          )
        )}
      </div>

      {!authLoading && !isGeneral && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Shield size={18} className="mt-0.5 shrink-0 text-amber-700" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">{t('admin.limitedAccess')}</p>
            <p className="mt-0.5 text-amber-800/90">
              {t('admin.limitedRoleHint', {
                role: roleLabel(admin?.role ?? ''),
              })}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-teal-900/8 bg-white shadow-[0_18px_50px_-32px_rgba(15,118,110,0.45)]">
        <div className="border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-white px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:max-w-sm">
            <Search size={16} className="text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('admin.searchAdmin')}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {error && (
          <p className="mx-4 mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:mx-5">
            {error}
          </p>
        )}

        {loading || authLoading ? (
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
            <p className="font-medium text-slate-800">{t('admin.notFound')}</p>
            <p className="mt-1 text-sm text-slate-500">
              {isGeneral ? t('admin.searchEmptyHint') : t('admin.listEmpty')}
            </p>
            {isGeneral && (
              <Button onClick={openCreate} className="mt-4">
                <UserPlus size={16} />
                {t('admin.newAdmin')}
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[220px]" />
                <col className="w-[150px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[110px]" />
                <col className="w-[120px]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-50/90 text-[11px] tracking-wide text-slate-500 uppercase">
                  <th className="px-4 py-3 font-semibold">{t('admin.adminColumn')}</th>
                  <th className="px-3 py-3 font-semibold">{t('common.phone')}</th>
                  <th className="px-3 py-3 font-semibold">{t('common.role')}</th>
                  <th className="px-3 py-3 font-semibold">{t('common.status')}</th>
                  <th className="px-3 py-3 font-semibold">{t('admin.created')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('common.actions')}</th>
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
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-sm font-semibold text-white">
                          {(
                            item.first_name?.[0] ||
                            item.username?.[0] ||
                            'A'
                          ).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {item.first_name} {item.last_name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            @{item.username}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap text-slate-700">
                      {phoneDisplay(item.phone)}
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          item.role === 'general'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-teal-100 text-teal-800'
                        }`}
                      >
                        {roleLabel(item.role)}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      {item.role === 'general' || !isGeneral ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            item.is_active
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {item.is_active ? t('common.active') : t('common.inactive')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={item.is_active}
                          aria-label={
                            item.is_active
                              ? t('admin.deactivate')
                              : t('admin.activate')
                          }
                          disabled={togglingId === item.id}
                          onClick={() => void onToggleActive(item)}
                          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
                            item.is_active ? 'bg-teal-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                              item.is_active
                                ? 'translate-x-6'
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap text-slate-500">
                      {new Date(item.created_at).toLocaleDateString('uz-UZ')}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManageRow(item) ? (
                          <>
                            <button
                              type="button"
                              title={t('common.edit')}
                              onClick={() => openEdit(item)}
                              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
                            >
                              <Pencil size={14} />
                              {t('admin.editShort')}
                            </button>
                            {canDeleteRow(item) && (
                              <button
                                type="button"
                                title={t('common.delete')}
                                onClick={() => openDelete(item)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
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
        onClose={() => !saving && setModalOpen(false)}
        title={editingId ? t('admin.editAdmin') : t('admin.newAdmin')}
        subtitle={
          editingId
            ? selected
              ? `@${selected.username}`
              : undefined
            : t('admin.roleAuto')
        }
        footer={
          <>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => setModalOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="admin-form" disabled={saving}>
              {saving
                ? t('auth.saving')
                : editingId
                  ? t('common.save')
                  : t('common.create')}
            </Button>
          </>
        }
      >
        <form
          id="admin-form"
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={onSubmit}
        >
          <Input
            label={t('common.name')}
            value={form.first_name}
            onChange={setField('first_name')}
            required
            autoComplete="given-name"
          />
          <Input
            label={t('common.lastName')}
            value={form.last_name}
            onChange={setField('last_name')}
            required
            autoComplete="family-name"
          />
          <PhoneInput
            value={form.phone}
            onChange={(phone) => setForm((f) => ({ ...f, phone }))}
            required
            className="sm:col-span-2"
            label={t('common.phone')}
          />
          <div className="sm:col-span-2">
            <Input
              label={t('common.username')}
              value={form.username}
              onChange={setField('username')}
              required
              autoComplete="username"
            />
          </div>
          <div className="sm:col-span-2">
            <PasswordInput
              label={
                editingId ? t('admin.passwordOptional') : t('common.password')
              }
              value={form.password}
              onChange={setField('password')}
              required={!editingId}
              placeholder={
                editingId ? t('admin.passwordKeep') : undefined
              }
              autoComplete={editingId ? 'new-password' : 'new-password'}
            />
          </div>
          {editingId && selected?.role !== 'general' && (
            <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={setField('is_active')}
                className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600/30"
              />
              <span className="text-sm font-medium text-slate-700">
                {t('admin.activeAccount')}
              </span>
            </label>
          )}
          {formError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2">
              {formError}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => !saving && setDeleteOpen(false)}
        title={t('admin.deleteAdmin')}
        subtitle={t('admin.irreversible')}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => setDeleteOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => void onDelete()} disabled={saving}>
              {saving ? t('common.deleting') : t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          {t('admin.deleteConfirm', {
            name: `${selected?.first_name ?? ''} ${selected?.last_name ?? ''}`.trim(),
            username: selected?.username ?? '',
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
