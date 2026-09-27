import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Quill from 'quill'
import {
  Eye,
  ImagePlus,
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
  type CategoryNode,
  type Product,
  type ProductListItem,
  type ProductStats,
  type ProductUpsertBody,
} from '../api/client'
import { config } from '../config'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import {
  DeltaEditor,
  EMPTY_DELTA,
  type DeltaJSON,
} from '../components/ui/DeltaEditor'

const MAX_IMAGES = 5
const MIN_IMAGES = 1
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

type Unit = 'dona' | 'litr' | 'kg'

type FormState = {
  category_id: string
  subcategory_id: string
  name: string
  description: DeltaJSON
  unit: Unit
  unit_size: string
  stock: string
  price: string
  images: string[]
  status: 'active' | 'inactive'
}

const emptyForm: FormState = {
  category_id: '',
  subcategory_id: '',
  name: '',
  description: EMPTY_DELTA,
  unit: 'dona',
  unit_size: '1',
  stock: '0',
  price: '',
  images: [],
  status: 'active',
}

function formatSom(n: number | string): string {
  const digits = String(n).replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function parseSom(s: string): number {
  const n = Number(s.replace(/\s/g, ''))
  return Number.isFinite(n) ? n : 0
}

function mediaUrl(path: string) {
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

function deltaToHtml(delta: DeltaJSON | null | undefined): string {
  if (!delta?.ops?.length) return ''
  const wrap = document.createElement('div')
  const el = document.createElement('div')
  wrap.appendChild(el)
  const q = new Quill(el, { modules: { toolbar: false }, readOnly: true })
  q.setContents(delta as Parameters<Quill['setContents']>[0])
  return q.root.innerHTML
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <div className="text-sm text-slate-900">{children}</div>
    </div>
  )
}

export function ProductsPage() {
  const { t } = useTranslation()
  const { token } = useAuth()

  const unitLabel = (unit: Unit) => {
    if (unit === 'litr') return t('admin.unitLitr')
    if (unit === 'kg') return t('admin.unitKg')
    return t('admin.unitDona')
  }

  const [items, setItems] = useState<ProductListItem[]>([])
  const [stats, setStats] = useState<ProductStats | null>(null)
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<ProductListItem | null>(null)
  const [viewing, setViewing] = useState<Product | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [list, st, tree] = await Promise.all([
        api.productsList(token, query.trim()),
        api.productsStats(token),
        api.categoriesTree(token),
      ])
      setItems(list.items ?? [])
      setStats(st)
      setCategories(tree.items ?? [])
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
          const list = await api.productsList(token, query.trim())
          setItems(list.items ?? [])
        } catch {
          /* keep */
        }
      })()
    }, 280)
    return () => window.clearTimeout(t)
  }, [query, token])

  const subOptions = useMemo(() => {
    const cat = categories.find((c) => c.id === form.category_id)
    return cat?.children ?? []
  }, [categories, form.category_id])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  const openView = async (item: ProductListItem) => {
    if (!token) return
    setFormError('')
    setSaving(true)
    try {
      const full = await api.getProduct(token, item.id)
      setViewing(full)
      setViewOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.loadError'))
    } finally {
      setSaving(false)
    }
  }

  const openEdit = async (item: ProductListItem) => {
    if (!token) return
    setFormError('')
    setSaving(true)
    try {
      const full = await api.getProduct(token, item.id)
      setEditingId(item.id)
      setForm({
        category_id: full.category_id,
        subcategory_id: full.subcategory_id,
        name: full.name,
        description: full.description?.ops
          ? full.description
          : EMPTY_DELTA,
        unit: (full.unit as Unit) || 'dona',
        unit_size: String(full.unit_size),
        stock: String(full.stock),
        price: formatSom(full.price),
        images: full.images ?? [],
        status: full.status === 'inactive' ? 'inactive' : 'active',
      })
      setModalOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.loadError'))
    } finally {
      setSaving(false)
    }
  }

  const openDelete = (item: ProductListItem) => {
    setSelected(item)
    setFormError('')
    setDeleteOpen(true)
  }

  const onToggleStatus = async (item: ProductListItem) => {
    if (!token) return
    const next = item.status === 'active' ? 'inactive' : 'active'
    setTogglingId(item.id)
    setItems((list) =>
      list.map((p) => (p.id === item.id ? { ...p, status: next } : p)),
    )
    try {
      await api.updateProductStatus(token, item.id, next)
    } catch (err) {
      setItems((list) =>
        list.map((p) =>
          p.id === item.id ? { ...p, status: item.status } : p,
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
        const res = await api.uploadProductImage(token, f)
        urls.push(res.url)
      }
      setForm((prev) => ({ ...prev, images: [...prev.images, ...urls] }))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.uploadError'))
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (url: string) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((u) => u !== url),
    }))
  }

  const buildBody = (): ProductUpsertBody | string => {
    if (!form.category_id) return t('admin.selectCategory')
    if (!form.subcategory_id) return t('admin.selectSubcategory')
    const name = form.name.trim()
    if (!name) return t('admin.nameRequired')
    const unitSize = Number(form.unit_size)
    if (!Number.isFinite(unitSize) || unitSize <= 0) return t('admin.unitSizeInvalid')
    const stock = Number(form.stock)
    if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock))
      return t('admin.stockInvalid')
    const price = parseSom(form.price)
    if (price < 0 || !Number.isFinite(price)) return t('admin.priceInvalid')
    if (form.images.length < MIN_IMAGES || form.images.length > MAX_IMAGES)
      return t('admin.imagesRange', { min: MIN_IMAGES, max: MAX_IMAGES })
    return {
      category_id: form.category_id,
      subcategory_id: form.subcategory_id,
      name,
      description: form.description?.ops?.length
        ? form.description
        : EMPTY_DELTA,
      unit: form.unit,
      unit_size: unitSize,
      stock,
      price,
      images: form.images,
      status: form.status,
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
      if (editingId) await api.updateProduct(token, editingId, body)
      else await api.createProduct(token, body)
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
      await api.deleteProduct(token, selected.id)
      setDeleteOpen(false)
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
            {t('nav.products')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('admin.productsHint')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stats && (
            <>
              <span className="rounded-full bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-800">
                {t('admin.statTotal', { count: stats.total })}
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                {t('admin.activeCount', { count: stats.active })}
              </span>
            </>
          )}
          <Button type="button" onClick={openCreate}>
            <Plus size={16} />
            {t('admin.btnProduct')}
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
              placeholder={t('admin.searchProducts')}
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
              <Package size={20} />
            </div>
            <p className="font-medium text-slate-800">{t('admin.noProducts')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/90 text-[11px] tracking-wide text-slate-500 uppercase">
                  <th className="px-5 py-3 font-semibold">{t('admin.btnProduct')}</th>
                  <th className="px-4 py-3 font-semibold">{t('admin.btnCategory')}</th>
                  <th className="px-4 py-3 font-semibold">{t('common.unit')}</th>
                  <th className="px-4 py-3 font-semibold">{t('common.stock')}</th>
                  <th className="px-4 py-3 font-semibold">{t('common.price')}</th>
                  <th className="px-4 py-3 font-semibold">{t('common.status')}</th>
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
                        <span className="font-semibold text-slate-900">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      <div className="font-medium text-slate-800">
                        {item.category_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.subcategory_name}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {item.unit_size} {unitLabel(item.unit as Unit)}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-800">
                      {item.stock}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-900">
                      {formatSom(item.price)} {t('common.som')}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? t('admin.editProduct') : t('admin.newProduct')}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="product-form" disabled={saving || uploading}>
              {saving ? t('auth.saving') : editingId ? t('common.save') : t('common.create')}
            </Button>
          </>
        }
      >
        <form id="product-form" className="space-y-3" onSubmit={onSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label={t('admin.btnCategory')}
              required
              value={form.category_id}
              onChange={(category_id) =>
                setForm((f) => ({
                  ...f,
                  category_id,
                  subcategory_id: '',
                }))
              }
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              searchable
            />
            <Select
              label={t('admin.btnSubcategory')}
              required
              value={form.subcategory_id}
              disabled={!form.category_id}
              onChange={(subcategory_id) =>
                setForm((f) => ({ ...f, subcategory_id }))
              }
              options={subOptions.map((s) => ({ value: s.id, label: s.name }))}
              searchable
            />
          </div>

          <Input
            label={t('common.name')}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />

          <DeltaEditor
            value={form.description}
            onChange={(description) => setForm((f) => ({ ...f, description }))}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <Select
              label={t('common.unit')}
              value={form.unit}
              clearable={false}
              onChange={(unit) =>
                setForm((f) => ({ ...f, unit: unit as Unit }))
              }
              options={[
                { value: 'dona', label: t('admin.unitDonaFull') },
                { value: 'litr', label: t('admin.unitLitrFull') },
                { value: 'kg', label: t('admin.unitKgFull') },
              ]}
            />
            <Input
              label={t('admin.unitSize', { unit: unitLabel(form.unit) })}
              type="number"
              step="0.001"
              min="0.001"
              value={form.unit_size}
              onChange={(e) =>
                setForm((f) => ({ ...f, unit_size: e.target.value }))
              }
              required
            />
            <Input
              label={t('admin.inStock')}
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
              required
            />
          </div>

          <Input
            label={t('admin.priceSom')}
            inputMode="numeric"
            placeholder="1 000"
            value={form.price}
            onChange={(e) =>
              setForm((f) => ({ ...f, price: formatSom(e.target.value) }))
            }
            required
          />

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
                    onClick={() => removeImage(url)}
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
            <span className="text-sm font-medium text-slate-700">{t('common.status')}</span>
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

      <Modal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title={t('admin.viewProduct')}
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
              <Field label={t('common.name')}>
                <span className="text-base font-semibold">{viewing.name}</span>
              </Field>
              <Field label={t('common.status')}>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    viewing.status === 'active'
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {viewing.status === 'active' ? t('common.active') : t('common.inactive')}
                </span>
              </Field>
              <Field label={t('admin.btnCategory')}>{viewing.category_name}</Field>
              <Field label={t('admin.btnSubcategory')}>{viewing.subcategory_name}</Field>
              <Field label={t('common.unit')}>
                {viewing.unit_size} {unitLabel(viewing.unit as Unit)} ({viewing.unit})
              </Field>
              <Field label={t('admin.inStock')}>{viewing.stock}</Field>
              <Field label={t('common.price')}>
                <span className="font-semibold">
                  {formatSom(viewing.price)} {t('common.som')}
                </span>
              </Field>
            </div>

            <Field label={t('common.description')}>
              <div
                className="rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-sm leading-relaxed text-slate-700 [&_a]:text-teal-700 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{
                  __html:
                    deltaToHtml(viewing.description) ||
                    `<span class="text-slate-400">${t('admin.noDescription')}</span>`,
                }}
              />
            </Field>
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t('common.loading')}</p>
        )}
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('admin.deleteProduct')}
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
