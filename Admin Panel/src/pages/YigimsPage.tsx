import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  Eye,
  ImagePlus,
  Layers,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import {
  api,
  type ProductListItem,
  type Yigim,
  type YigimStats,
  type YigimUpsertBody,
} from '../api/client'
import { config } from '../config'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { YigimProgressBar } from '../components/YigimProgressBar'

const MAX_IMAGES = 5
const MIN_IMAGES = 1
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

type Tab = 'single' | 'combo'

type ComboRow = { product_id: string; qty: string }

type FormState = {
  type: Tab
  product_id: string
  name: string
  target_qty: string
  current_qty: string
  images: string[]
  status: 'active' | 'inactive'
  items: ComboRow[]
}

const emptyForm: FormState = {
  type: 'single',
  product_id: '',
  name: '',
  target_qty: '10',
  current_qty: '0',
  images: [],
  status: 'active',
  items: [
    { product_id: '', qty: '1' },
    { product_id: '', qty: '1' },
  ],
}

function mediaUrl(path: string) {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return `${config.mediaBaseUrl}${path}`
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

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <div className="text-sm text-slate-900">{children}</div>
    </div>
  )
}

export function YigimsPage() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [items, setItems] = useState<Yigim[]>([])
  const [stats, setStats] = useState<YigimStats | null>(null)
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Yigim | null>(null)
  const [viewing, setViewing] = useState<Yigim | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const productMap = useMemo(() => {
    const m = new Map<string, ProductListItem>()
    for (const p of products) m.set(p.id, p)
    return m
  }, [products])

  const load = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [list, st, prods] = await Promise.all([
        api.yigimsList(token, query.trim()),
        api.yigimsStats(token),
        api.productsList(token),
      ])
      setItems(list.items ?? [])
      setStats(st)
      setProducts(prods.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!token) return
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const list = await api.yigimsList(token, query.trim())
          setItems(list.items ?? [])
        } catch {
          /* keep */
        }
      })()
    }, 280)
    return () => window.clearTimeout(t)
  }, [query, token])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  const openView = async (item: Yigim) => {
    if (!token) return
    setSaving(true)
    try {
      const full = await api.getYigim(token, item.id)
      setViewing(full)
      setViewOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.loadError'))
    } finally {
      setSaving(false)
    }
  }

  const openEdit = async (item: Yigim) => {
    if (!token) return
    setFormError('')
    setSaving(true)
    try {
      const full = await api.getYigim(token, item.id)
      const type: Tab = full.type === 'combo' ? 'combo' : 'single'
      setEditingId(full.id)
      setForm({
        type,
        product_id: full.product_id ?? '',
        name: full.name ?? '',
        target_qty: String(full.target_qty),
        current_qty: String(full.current_qty ?? 0),
        images: full.images ?? [],
        status: full.status === 'inactive' ? 'inactive' : 'active',
        items:
          type === 'combo' && (full.items?.length ?? 0) >= 2
            ? full.items.map((it) => ({
                product_id: it.product_id,
                qty: String(it.qty),
              }))
            : [
                { product_id: '', qty: '1' },
                { product_id: '', qty: '1' },
              ],
      })
      setModalOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.loadError'))
    } finally {
      setSaving(false)
    }
  }

  const openDelete = (item: Yigim) => {
    setSelected(item)
    setFormError('')
    setDeleteOpen(true)
  }

  const onToggleStatus = async (item: Yigim) => {
    if (!token) return
    const next = item.status === 'active' ? 'inactive' : 'active'
    setTogglingId(item.id)
    setItems((list) =>
      list.map((y) => (y.id === item.id ? { ...y, status: next } : y)),
    )
    try {
      await api.updateYigimStatus(token, item.id, next)
    } catch (err) {
      setItems((list) =>
        list.map((y) =>
          y.id === item.id ? { ...y, status: item.status } : y,
        ),
      )
      setError(err instanceof Error ? err.message : t('admin.statusError'))
    } finally {
      setTogglingId(null)
    }
  }

  const onUploadImages = async (files: FileList | null) => {
    if (!token || !files?.length) return
    const room = MAX_IMAGES - form.images.length
    if (room <= 0) {
      setFormError(t('admin.maxImages', { count: MAX_IMAGES }))
      return
    }
    const batch = Array.from(files).slice(0, room)
    for (const f of batch) {
      if (f.size > MAX_IMAGE_BYTES) {
        setFormError(t('admin.fileTooLarge', { name: f.name }))
        return
      }
      if (!f.type.startsWith('image/')) {
        setFormError(t('admin.fileNotImage', { name: f.name }))
        return
      }
    }
    setUploading(true)
    setFormError('')
    try {
      const urls: string[] = []
      for (const f of batch) {
        const res = await api.uploadYigimImage(token, f)
        urls.push(res.url)
      }
      setForm((prev) => ({ ...prev, images: [...prev.images, ...urls] }))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.uploadError'))
    } finally {
      setUploading(false)
    }
  }

  const buildBody = (): YigimUpsertBody | string => {
    const target = Number(form.target_qty)
    const current = Number(form.current_qty)
    if (!Number.isInteger(target) || target < 1) return t('admin.targetMin')
    if (!Number.isInteger(current) || current < 0)
      return t('admin.currentMin')
    if (current > target) return t('admin.currentExceeds')
    if (form.images.length < MIN_IMAGES || form.images.length > MAX_IMAGES)
      return t('admin.imagesRange', { min: MIN_IMAGES, max: MAX_IMAGES })

    if (form.type === 'single') {
      if (!form.product_id) return t('admin.selectProduct')
      return {
        type: 'single',
        product_id: form.product_id,
        target_qty: target,
        current_qty: current,
        images: form.images,
        status: form.status,
        items: [],
      }
    }

    const name = form.name.trim()
    if (!name) return t('admin.comboNameRequired')
    const rows = form.items
      .map((r) => ({
        product_id: r.product_id,
        qty: Number(r.qty),
      }))
      .filter((r) => r.product_id)
    if (rows.length < 2) return t('admin.needTwoProducts')
    if (rows.some((r) => !Number.isInteger(r.qty) || r.qty < 1))
      return t('admin.qtyMin')
    const ids = rows.map((r) => r.product_id)
    if (new Set(ids).size !== ids.length) return t('admin.noDuplicateProducts')

    return {
      type: 'combo',
      name,
      target_qty: target,
      current_qty: current,
      images: form.images,
      status: form.status,
      items: rows,
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    const body = buildBody()
    if (typeof body === 'string') {
      setFormError(body)
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (editingId) await api.updateYigim(token, editingId, body)
      else await api.createYigim(token, body)
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
      await api.deleteYigim(token, selected.id)
      setDeleteOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.deleteError'))
    } finally {
      setSaving(false)
    }
  }

  const titleOf = (y: Yigim) =>
    y.type === 'combo'
      ? y.name || t('admin.combo')
      : y.product_name || t('admin.productYigim')

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('nav.yigims')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('admin.yigimsHint')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stats && (
            <>
              <span className="rounded-full bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-800">
                {t('admin.statTotal', { count: stats.total })}
              </span>
              <span className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-800">
                {t('admin.singleCount', { count: stats.single })}
              </span>
              <span className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-800">
                {t('admin.comboCount', { count: stats.combo })}
              </span>
            </>
          )}
          <Button type="button" onClick={openCreate}>
            <Plus size={16} />
            {t('admin.openYigim')}
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
              placeholder={t('admin.searchYigims')}
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
        ) : items.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <Layers size={20} />
            </div>
            <p className="font-medium text-slate-800">{t('admin.noYigims')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/90 text-[11px] tracking-wide text-slate-500 uppercase">
                  <th className="px-5 py-3 font-semibold">{t('nav.yigims')}</th>
                  <th className="px-4 py-3 font-semibold">{t('common.type')}</th>
                  <th className="px-4 py-3 font-semibold">{t('admin.progress')}</th>
                  <th className="px-4 py-3 font-semibold">{t('common.open')}</th>
                  <th className="px-5 py-3 text-right font-semibold">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-slate-100 transition hover:bg-teal-50/40"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={mediaUrl(item.images?.[0] || '')}
                          alt=""
                          className="h-11 w-11 rounded-xl object-cover ring-1 ring-slate-200"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).style.opacity = '0.3'
                          }}
                        />
                        <div>
                          <p className="font-semibold text-slate-900">
                            {titleOf(item)}
                          </p>
                          {item.type === 'combo' && (
                            <p className="text-xs text-slate-500">
                              {t('admin.productsInCombo', { count: item.items?.length ?? 0 })}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${
                          item.type === 'combo'
                            ? 'bg-violet-100 text-violet-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {item.type === 'combo' ? t('admin.combo') : t('admin.typeSingle')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <YigimProgressBar
                        current={item.current_qty ?? 0}
                        target={item.target_qty}
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusSwitch
                        active={item.status === 'active'}
                        disabled={togglingId === item.id}
                        onToggle={() => void onToggleStatus(item)}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title={t('common.view')}
                          onClick={() => void openView(item)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          title={t('common.edit')}
                          onClick={() => void openEdit(item)}
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

      {/* Create / Edit */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? t('admin.editYigim') : t('admin.openYigim')}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="yigim-form" disabled={saving || uploading}>
              {saving ? t('auth.saving') : editingId ? t('common.save') : t('common.open')}
            </Button>
          </>
        }
      >
        <form id="yigim-form" className="space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  type: 'single',
                  images: f.type === 'single' ? f.images : f.images,
                }))
              }
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                form.type === 'single'
                  ? 'bg-white text-teal-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package size={16} />
              {t('admin.singleProduct')}
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, type: 'combo' }))}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                form.type === 'combo'
                  ? 'bg-white text-teal-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={16} />
              {t('admin.combo')}
            </button>
          </div>

          {form.type === 'single' ? (
            <>
              <Select
                label={t('admin.btnProduct')}
                required
                value={form.product_id}
                onChange={(product_id) =>
                  setForm((f) => ({ ...f, product_id }))
                }
                options={products.map((p) => ({ value: p.id, label: p.name }))}
                searchable
              />
              <Input
                label={t('admin.targetOrders')}
                type="number"
                min="1"
                step="1"
                value={form.target_qty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, target_qty: e.target.value }))
                }
                required
              />
              <Input
                label={t('admin.currentCollected')}
                type="number"
                min="0"
                step="1"
                value={form.current_qty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, current_qty: e.target.value }))
                }
                required
              />
              <YigimProgressBar
                current={Number(form.current_qty) || 0}
                target={Math.max(1, Number(form.target_qty) || 1)}
                className="rounded-xl bg-teal-50/80 px-3 py-2.5"
              />
            </>
          ) : (
            <>
              <Input
                label={t('admin.comboName')}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">
                    {t('admin.productsMin2')}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        items: [...f.items, { product_id: '', qty: '1' }],
                      }))
                    }
                  >
                    <Plus size={14} />
                    {t('common.add')}
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.items.map((row, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 sm:flex-row sm:items-center"
                    >
                      <Select
                        className="flex-1"
                        value={row.product_id}
                        placeholder={t('admin.btnProduct')}
                        onChange={(product_id) =>
                          setForm((f) => {
                            const items = [...f.items]
                            items[idx] = {
                              ...items[idx],
                              product_id,
                            }
                            return { ...f, items }
                          })
                        }
                        options={products.map((p) => ({
                          value: p.id,
                          label: p.name,
                        }))}
                        searchable
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          title={t('admin.bundleProducts')}
                          placeholder={t('admin.qtyPlaceholder')}
                          className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                          value={row.qty}
                          onChange={(e) =>
                            setForm((f) => {
                              const items = [...f.items]
                              items[idx] = { ...items[idx], qty: e.target.value }
                              return { ...f, items }
                            })
                          }
                        />
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          {t('admin.unitDona')}
                        </span>
                        {form.items.length > 2 && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                items: f.items.filter((_, i) => i !== idx),
                              }))
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Input
                label={t('admin.targetBundles')}
                type="number"
                min="1"
                step="1"
                value={form.target_qty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, target_qty: e.target.value }))
                }
                required
              />
              <Input
                label={t('admin.currentCollected')}
                type="number"
                min="0"
                step="1"
                value={form.current_qty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, current_qty: e.target.value }))
                }
                required
              />
              <YigimProgressBar
                current={Number(form.current_qty) || 0}
                target={Math.max(1, Number(form.target_qty) || 1)}
                className="rounded-xl bg-teal-50/80 px-3 py-2.5"
              />
            </>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-700">
                {t('admin.imagesCount', { count: form.images.length, max: MAX_IMAGES })}
              </span>
              <span className="text-xs text-slate-400">
                {t('admin.imagesHint', { min: MIN_IMAGES })}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {form.images.map((url) => (
                <div
                  key={url}
                  className="relative aspect-square overflow-hidden rounded-xl ring-1 ring-slate-200"
                >
                  <img
                    src={mediaUrl(url)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        images: f.images.filter((u) => u !== url),
                      }))
                    }
                    className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-lg bg-slate-950/60 text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {form.images.length < MAX_IMAGES && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-teal-400 hover:bg-teal-50 hover:text-teal-800">
                  <ImagePlus size={20} />
                  <span className="text-[11px] font-medium">
                    {uploading ? '…' : t('common.upload')}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      void onUploadImages(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3">
            <span className="text-sm font-medium text-slate-700">
              {t('admin.openClosed')}
            </span>
            <StatusSwitch
              active={form.status === 'active'}
              onToggle={() =>
                setForm((f) => ({
                  ...f,
                  status: f.status === 'active' ? 'inactive' : 'active',
                }))
              }
            />
          </div>

          {formError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          )}
        </form>
      </Modal>

      {/* View */}
      <Modal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title={t('admin.viewYigim')}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setViewOpen(false)}>
              {t('common.close')}
            </Button>
            {viewing && (
              <Button
                onClick={() => {
                  setViewOpen(false)
                  void openEdit(viewing)
                }}
              >
                <Pencil size={16} />
                {t('common.edit')}
              </Button>
            )}
          </>
        }
      >
        {viewing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {(viewing.images ?? []).map((url) => (
                <img
                  key={url}
                  src={mediaUrl(url)}
                  alt=""
                  className="aspect-square rounded-xl object-cover ring-1 ring-slate-200"
                />
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('common.name')}>{titleOf(viewing)}</Field>
              <Field label={t('common.type')}>
                {viewing.type === 'combo' ? t('admin.combo') : t('admin.singleProduct')}
              </Field>
              <Field label={t('common.status')}>
                {viewing.status === 'active' ? t('common.open') : t('common.closed')}
              </Field>
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {t('admin.progress')}
                </p>
                <YigimProgressBar
                  current={viewing.current_qty ?? 0}
                  target={viewing.target_qty}
                  className="rounded-xl border border-teal-100 bg-teal-50/50 px-3 py-2.5"
                />
              </div>
            </div>
            {viewing.type === 'single' ? (
              <Field label={t('admin.btnProduct')}>
                {viewing.product_name ||
                  productMap.get(viewing.product_id || '')?.name ||
                  '—'}
              </Field>
            ) : (
              <Field label={t('admin.bundleProducts')}>
                <ul className="space-y-2">
                  {(viewing.items ?? []).map((it) => (
                    <li
                      key={it.product_id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <span className="font-medium">
                        {it.product_name ||
                          productMap.get(it.product_id)?.name ||
                          it.product_id}
                      </span>
                      <span className="text-slate-600">× {it.qty}</span>
                    </li>
                  ))}
                </ul>
              </Field>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t('common.loading')}</p>
        )}
      </Modal>

      {/* Delete */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('admin.deleteYigim')}
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
          {t('admin.deleteConfirmName', {
            name: selected ? titleOf(selected) : '',
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
