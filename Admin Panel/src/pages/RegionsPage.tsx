import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api, type RegionNode, type RegionStats } from '../api/client'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { formatRegionCode } from '../utils/regionCode'

type FormState = {
  name: string
  code: string
  type: 'viloyat' | 'tuman'
  parent_id: string
  status: 'active' | 'inactive'
}

const emptyForm: FormState = {
  name: '',
  code: '',
  type: 'viloyat',
  parent_id: '',
  status: 'active',
}

export function RegionsPage() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [items, setItems] = useState<RegionNode[]>([])
  const [stats, setStats] = useState<RegionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<RegionNode | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [tree, st] = await Promise.all([
        api.regionsTree(token),
        api.regionsStats(token),
      ])
      setItems(tree.items ?? [])
      setStats(st)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [token])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items
      .map((v) => {
        const vMatch =
          v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q)
        const kids = (v.children ?? []).filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.code.toLowerCase().includes(q),
        )
        if (vMatch) return v
        if (kids.length > 0)
          return { ...v, children: kids, children_count: kids.length }
        return null
      })
      .filter(Boolean) as RegionNode[]
  }, [items, query])

  useEffect(() => {
    if (!query.trim()) return
    setOpenIds(new Set(filtered.map((v) => v.id)))
  }, [query, filtered])

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const patchStatusInTree = (id: string, status: string) => {
    setItems((list) =>
      list.map((v) => {
        if (v.id === id) return { ...v, status }
        return {
          ...v,
          children: (v.children ?? []).map((t) =>
            t.id === id ? { ...t, status } : t,
          ),
        }
      }),
    )
  }

  const onToggleStatus = async (item: RegionNode) => {
    if (!token) return
    const next = item.status === 'active' ? 'inactive' : 'active'
    setTogglingId(item.id)
    patchStatusInTree(item.id, next)
    try {
      await api.updateRegionStatus(token, item.id, next)
    } catch (err) {
      patchStatusInTree(item.id, item.status)
      setError(err instanceof Error ? err.message : t('admin.statusError'))
    } finally {
      setTogglingId(null)
    }
  }

  const openCreate = (type: 'viloyat' | 'tuman', parentId = '') => {
    setForm({ ...emptyForm, type, parent_id: parentId })
    setFormError('')
    setCreateOpen(true)
    if (parentId) setOpenIds((prev) => new Set(prev).add(parentId))
  }

  const openEdit = (item: RegionNode) => {
    setSelected(item)
    setForm({
      name: item.name,
      code: item.code,
      type: item.type === 'tuman' ? 'tuman' : 'viloyat',
      parent_id: '',
      status: item.status === 'inactive' ? 'inactive' : 'active',
    })
    setFormError('')
    setEditOpen(true)
  }

  const openDelete = (item: RegionNode) => {
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
      await api.createRegion(token, {
        name: form.name,
        code: form.code,
        type: form.type,
        parent_id: form.type === 'tuman' ? form.parent_id : null,
        status: form.status,
      })
      setCreateOpen(false)
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
      await api.updateRegion(token, selected.id, {
        name: form.name,
        code: form.code,
        status: form.status,
      })
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
      await api.deleteRegion(token, selected.id)
      setDeleteOpen(false)
      setSelected(null)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.deleteError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('nav.regions')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t('admin.regionsHint')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stats && (
            <>
              <span className="rounded-full bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-800">
                {t('admin.viloyatCount', { count: stats.viloyat })}
              </span>
              <span className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-800">
                {t('admin.tumanCount', { count: stats.tuman })}
              </span>
            </>
          )}
          <Button type="button" onClick={() => openCreate('viloyat')}>
            <Plus size={16} />
            {t('common.region')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => openCreate('tuman')}
          >
            <Plus size={16} />
            {t('common.district')}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-teal-900/8 bg-white shadow-[0_18px_50px_-32px_rgba(15,118,110,0.45)]">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:min-w-[280px]">
            <Search size={16} className="text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('admin.searchRegions')}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpenIds(new Set(filtered.map((v) => v.id)))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              {t('common.expandAll')}
            </button>
            <button
              type="button"
              onClick={() => setOpenIds(new Set())}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              {t('common.collapseAll')}
            </button>
          </div>
        </div>

        {error && (
          <p className="mx-4 mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:mx-5">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <MapPin size={20} />
            </div>
            <p className="font-medium text-slate-800">{t('admin.noRegions')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/90 text-[11px] tracking-wide text-slate-500 uppercase">
                  <th className="px-5 py-3 font-semibold">{t('nav.regions')}</th>
                  <th className="px-4 py-3 font-semibold">{t('common.code')}</th>
                  <th className="px-4 py-3 font-semibold">{t('common.type')}</th>
                  <th className="px-4 py-3 font-semibold">{t('common.status')}</th>
                  <th className="px-4 py-3 font-semibold">{t('admin.inside')}</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((viloyat) => {
                  const open = openIds.has(viloyat.id)
                  const kids = viloyat.children ?? []
                  return (
                    <ViloyatAccordion
                      key={viloyat.id}
                      viloyat={viloyat}
                      kids={kids}
                      open={open}
                      togglingId={togglingId}
                      onToggle={() => toggle(viloyat.id)}
                      onStatus={onToggleStatus}
                      onEdit={openEdit}
                      onDelete={openDelete}
                      onAddTuman={() => openCreate('tuman', viloyat.id)}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={
          form.type === 'viloyat' ? t('admin.newViloyat') : t('admin.newTuman')
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="region-create-form" disabled={saving}>
              {saving ? t('auth.saving') : t('common.create')}
            </Button>
          </>
        }
      >
        <form id="region-create-form" className="space-y-3" onSubmit={onCreate}>
          {form.type === 'tuman' && (
            <Select
              label={t('common.region')}
              required
              value={form.parent_id}
              onChange={(parent_id) => setForm((f) => ({ ...f, parent_id }))}
              options={items.map((v) => ({ value: v.id, label: v.name }))}
              searchable
            />
          )}
          <Input
            label={t('common.name')}
            value={form.name}
            onChange={(e) => {
              const name = e.target.value
              setForm((f) => ({
                ...f,
                name,
                code: formatRegionCode(name),
              }))
            }}
            required
          />
          <Input
            label={t('common.code')}
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder={t('admin.codeAuto')}
          />
          {formError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={t('admin.editRegion')}
        subtitle={selected?.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="region-edit-form" disabled={saving}>
              {saving ? t('auth.saving') : t('common.save')}
            </Button>
          </>
        }
      >
        <form id="region-edit-form" className="space-y-3" onSubmit={onUpdate}>
          <Input
            label={t('common.name')}
            value={form.name}
            onChange={(e) => {
              const name = e.target.value
              setForm((f) => ({
                ...f,
                name,
                code: formatRegionCode(name),
              }))
            }}
            required
          />
          <Input
            label={t('common.code')}
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder={t('admin.codeAuto')}
          />
          {formError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('admin.deleteRegion')}
        subtitle={t('admin.deleteRegionHint')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={onDelete} disabled={saving}>
              {saving ? t('common.deleting') : t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          {t('admin.deleteConfirmName', { name: selected?.name ?? '' })}
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

function StatusSwitch({
  active,
  disabled,
  onToggle,
}: {
  active: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
        active ? 'bg-teal-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
          active ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function ViloyatAccordion({
  viloyat,
  kids,
  open,
  togglingId,
  onToggle,
  onStatus,
  onEdit,
  onDelete,
  onAddTuman,
}: {
  viloyat: RegionNode
  kids: RegionNode[]
  open: boolean
  togglingId: string | null
  onToggle: () => void
  onStatus: (item: RegionNode) => void
  onEdit: (item: RegionNode) => void
  onDelete: (item: RegionNode) => void
  onAddTuman: () => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <tr className="border-t border-slate-100 bg-white transition hover:bg-teal-50/50">
        <td className="px-5 py-3.5">
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-teal-200 bg-teal-50 text-teal-800">
              <ChevronDown
                size={16}
                className={`transition duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
              />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-slate-900">
                {viloyat.name}
              </span>
              <span className="block text-xs text-slate-500">
                {t('common.region')}
              </span>
            </span>
          </button>
        </td>
        <td className="px-4 py-3.5 text-slate-600">{viloyat.code || '—'}</td>
        <td className="px-4 py-3.5">
          <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-semibold text-teal-800 uppercase">
            {t('admin.typeViloyat')}
          </span>
        </td>
        <td className="px-4 py-3.5">
          <StatusSwitch
            active={viloyat.status === 'active'}
            disabled={togglingId === viloyat.id}
            onToggle={() => onStatus(viloyat)}
          />
        </td>
        <td className="px-4 py-3.5 font-medium text-slate-700">
          {t('admin.tumanCountInline', { count: kids.length })}
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              title={t('admin.addTuman')}
              onClick={onAddTuman}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              title={t('common.edit')}
              onClick={() => onEdit(viloyat)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              title={t('common.delete')}
              onClick={() => onDelete(viloyat)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </td>
      </tr>

      <tr>
        <td colSpan={6} className="p-0">
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden bg-slate-50/80"
              >
                {kids.length === 0 ? (
                  <p className="px-14 py-4 text-sm text-slate-500">
                    {t('admin.noTumans')}
                  </p>
                ) : (
                  <table className="min-w-full text-left text-sm">
                    <tbody>
                      {kids.map((tuman, i) => (
                        <tr
                          key={tuman.id}
                          className={`border-t border-slate-100/80 ${
                            i % 2 === 0 ? 'bg-slate-50/60' : 'bg-white/60'
                          }`}
                        >
                          <td className="py-3 pr-4 pl-14">
                            <div className="flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                              <span className="font-medium text-slate-800">
                                {tuman.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {tuman.code || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-800 uppercase">
                              {t('admin.typeTuman')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <StatusSwitch
                              active={tuman.status === 'active'}
                              disabled={togglingId === tuman.id}
                              onToggle={() => onStatus(tuman)}
                            />
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {tuman.children_count > 0
                              ? t('admin.mfyCount', {
                                  count: tuman.children_count,
                                })
                              : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                title={t('common.edit')}
                                onClick={() => onEdit(tuman)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                title={t('common.delete')}
                                onClick={() => onDelete(tuman)}
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
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </td>
      </tr>
    </>
  )
}
