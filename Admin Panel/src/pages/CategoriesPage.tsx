import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  FolderTree,
  ImagePlus,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import {
  api,
  type CategoryNode,
  type CategoryStats,
  type SubcategoryNode,
} from '../api/client'
import { config } from '../config'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function mediaUrl(path: string) {
  if (!path) return ''
  const raw = String(path).trim()
  if (!raw) return ''
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  const normalized = raw.startsWith('/') ? raw : `/${raw}`
  return `${config.mediaBaseUrl}${normalized}`
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

export function CategoriesPage() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [items, setItems] = useState<CategoryNode[]>([])
  const [stats, setStats] = useState<CategoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [catModal, setCatModal] = useState(false)
  const [subModal, setSubModal] = useState(false)
  const [editCatModal, setEditCatModal] = useState(false)
  const [editSubModal, setEditSubModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)

  const [selectedCat, setSelectedCat] = useState<CategoryNode | null>(null)
  const [selectedSub, setSelectedSub] = useState<SubcategoryNode | null>(null)
  const [deleteKind, setDeleteKind] = useState<'category' | 'subcategory'>(
    'category',
  )

  const [catForm, setCatForm] = useState({
    name: '',
    image: '',
    status: 'active' as 'active' | 'inactive',
  })
  const [subForm, setSubForm] = useState({
    name: '',
    status: 'active' as 'active' | 'inactive',
    category_id: '',
  })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [tree, st] = await Promise.all([
        api.categoriesTree(token),
        api.categoriesStats(token),
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
      .map((c) => {
        const match = c.name.toLowerCase().includes(q)
        const kids = (c.children ?? []).filter((s) =>
          s.name.toLowerCase().includes(q),
        )
        if (match) return c
        if (kids.length)
          return { ...c, children: kids, children_count: kids.length }
        return null
      })
      .filter(Boolean) as CategoryNode[]
  }, [items, query])

  useEffect(() => {
    if (!query.trim()) return
    setOpenIds(new Set(filtered.map((c) => c.id)))
  }, [query, filtered])

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const patchCatStatus = (id: string, status: string) => {
    setItems((list) =>
      list.map((c) => (c.id === id ? { ...c, status } : c)),
    )
  }

  const patchSubStatus = (catId: string, subId: string, status: string) => {
    setItems((list) =>
      list.map((c) =>
        c.id !== catId
          ? c
          : {
              ...c,
              children: (c.children ?? []).map((s) =>
                s.id === subId ? { ...s, status } : s,
              ),
            },
      ),
    )
  }

  const onToggleCat = async (item: CategoryNode) => {
    if (!token) return
    const next = item.status === 'active' ? 'inactive' : 'active'
    setTogglingId(item.id)
    patchCatStatus(item.id, next)
    try {
      await api.updateCategoryStatus(token, item.id, next)
    } catch (err) {
      patchCatStatus(item.id, item.status)
      setError(err instanceof Error ? err.message : t('admin.statusError'))
    } finally {
      setTogglingId(null)
    }
  }

  const onToggleSub = async (cat: CategoryNode, sub: SubcategoryNode) => {
    if (!token) return
    const next = sub.status === 'active' ? 'inactive' : 'active'
    setTogglingId(sub.id)
    patchSubStatus(cat.id, sub.id, next)
    try {
      await api.updateSubcategoryStatus(token, sub.id, next)
    } catch (err) {
      patchSubStatus(cat.id, sub.id, sub.status)
      setError(err instanceof Error ? err.message : t('admin.statusError'))
    } finally {
      setTogglingId(null)
    }
  }

  const openCreateCat = () => {
    setCatForm({ name: '', image: '', status: 'active' })
    setFormError('')
    setCatModal(true)
  }

  const openEditCat = (c: CategoryNode) => {
    setSelectedCat(c)
    setCatForm({
      name: c.name,
      image: c.image || '',
      status: c.status === 'inactive' ? 'inactive' : 'active',
    })
    setFormError('')
    setEditCatModal(true)
  }

  const openCreateSub = (catId: string) => {
    setSubForm({ name: '', status: 'active', category_id: catId })
    setFormError('')
    setSubModal(true)
    setOpenIds((p) => new Set(p).add(catId))
  }

  const openEditSub = (cat: CategoryNode, sub: SubcategoryNode) => {
    setSelectedCat(cat)
    setSelectedSub(sub)
    setSubForm({
      name: sub.name,
      status: sub.status === 'inactive' ? 'inactive' : 'active',
      category_id: cat.id,
    })
    setFormError('')
    setEditSubModal(true)
  }

  const openDeleteCat = (c: CategoryNode) => {
    setSelectedCat(c)
    setSelectedSub(null)
    setDeleteKind('category')
    setFormError('')
    setDeleteModal(true)
  }

  const openDeleteSub = (cat: CategoryNode, sub: SubcategoryNode) => {
    setSelectedCat(cat)
    setSelectedSub(sub)
    setDeleteKind('subcategory')
    setFormError('')
    setDeleteModal(true)
  }

  const onCreateCat = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    if (!catForm.image.trim()) {
      setFormError(t('admin.needImage'))
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await api.createCategory(token, {
        name: catForm.name,
        image: catForm.image,
        icon: 'tag',
        status: catForm.status,
      })
      setCatModal(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.createError'))
    } finally {
      setSaving(false)
    }
  }

  const onUpdateCat = async (e: FormEvent) => {
    e.preventDefault()
    if (!token || !selectedCat) return
    if (!catForm.image.trim()) {
      setFormError(t('admin.needImage'))
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await api.updateCategory(token, selectedCat.id, {
        name: catForm.name,
        image: catForm.image,
        icon: selectedCat.icon || 'tag',
        status: catForm.status,
      })
      setEditCatModal(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.updateError'))
    } finally {
      setSaving(false)
    }
  }

  const onCreateSub = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setFormError('')
    try {
      await api.createSubcategory(token, subForm.category_id, {
        name: subForm.name,
        status: subForm.status,
      })
      setSubModal(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.createError'))
    } finally {
      setSaving(false)
    }
  }

  const onUpdateSub = async (e: FormEvent) => {
    e.preventDefault()
    if (!token || !selectedSub) return
    setSaving(true)
    setFormError('')
    try {
      await api.updateSubcategory(token, selectedSub.id, {
        name: subForm.name,
        status: subForm.status,
      })
      setEditSubModal(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.updateError'))
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!token) return
    setSaving(true)
    setFormError('')
    try {
      if (deleteKind === 'category' && selectedCat) {
        await api.deleteCategory(token, selectedCat.id)
      } else if (deleteKind === 'subcategory' && selectedSub) {
        await api.deleteSubcategory(token, selectedSub.id)
      }
      setDeleteModal(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.deleteError'))
    } finally {
      setSaving(false)
    }
  }

  const onUploadCatImage = async (files: FileList | null) => {
    if (!token || !files?.[0]) return
    const f = files[0]
    if (f.size > MAX_IMAGE_BYTES) {
      setFormError(t('admin.imageTooLarge'))
      return
    }
    if (!f.type.startsWith('image/')) {
      setFormError(t('admin.imageOnly'))
      return
    }
    setUploading(true)
    setFormError('')
    try {
      const res = await api.uploadCategoryImage(token, f)
      setCatForm((prev) => ({ ...prev, image: res.url }))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.uploadError'))
    } finally {
      setUploading(false)
    }
  }

  const CatImageField = () => (
    <div className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{t('common.image')}</span>
      {catForm.image ? (
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <img
              src={mediaUrl(catForm.image)}
              alt=""
              className="h-24 w-24 rounded-2xl object-cover ring-1 ring-slate-200"
            />
            <button
              type="button"
              onClick={() => setCatForm((f) => ({ ...f, image: '' }))}
              className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-600 shadow ring-1 ring-slate-200 hover:text-rose-600"
              aria-label={t('admin.removeImage')}
            >
              <X size={14} />
            </button>
          </div>
          <label className="cursor-pointer text-sm font-semibold text-teal-700 hover:text-teal-900">
            {uploading ? t('admin.uploading') : t('admin.changeImage')}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                void onUploadCatImage(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      ) : (
        <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-teal-400 hover:bg-teal-50/40 hover:text-teal-800">
          <ImagePlus size={22} />
          <span className="text-xs font-semibold">
            {uploading ? t('admin.uploading') : t('admin.uploadImage')}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              void onUploadCatImage(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      )}
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('nav.categories')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('admin.categoriesHint')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stats && (
            <>
              <span className="rounded-full bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-800">
                {t('admin.categoryCount', { count: stats.categories })}
              </span>
              <span className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-800">
                {t('admin.subCount', { count: stats.subcategories })}
              </span>
            </>
          )}
          <Button type="button" onClick={openCreateCat}>
            <Plus size={16} />
            {t('admin.btnCategory')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => openCreateSub(items[0]?.id ?? '')}
            disabled={items.length === 0}
          >
            <Plus size={16} />
            {t('admin.btnSubcategory')}
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
              placeholder={t('admin.searchCategories')}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpenIds(new Set(filtered.map((c) => c.id)))}
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
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <FolderTree size={20} />
            </div>
            <p className="font-medium text-slate-800">{t('admin.noCategories')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/90 text-[11px] tracking-wide text-slate-500 uppercase">
                  <th className="px-5 py-3 font-semibold">{t('common.name')}</th>
                  <th className="px-4 py-3 font-semibold">{t('common.image')}</th>
                  <th className="px-4 py-3 font-semibold">{t('common.type')}</th>
                  <th className="px-4 py-3 font-semibold">{t('common.status')}</th>
                  <th className="px-4 py-3 font-semibold">{t('admin.inside')}</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cat) => {
                  const open = openIds.has(cat.id)
                  const kids = cat.children ?? []
                  return (
                    <CategoryAccordion
                      key={cat.id}
                      cat={cat}
                      kids={kids}
                      open={open}
                      togglingId={togglingId}
                      onToggle={() => toggle(cat.id)}
                      onStatusCat={() => void onToggleCat(cat)}
                      onStatusSub={(sub) => void onToggleSub(cat, sub)}
                      onAddSub={() => openCreateSub(cat.id)}
                      onEditCat={() => openEditCat(cat)}
                      onDeleteCat={() => openDeleteCat(cat)}
                      onEditSub={(sub) => openEditSub(cat, sub)}
                      onDeleteSub={(sub) => openDeleteSub(cat, sub)}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={catModal}
        onClose={() => setCatModal(false)}
        title={t('admin.newCategory')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCatModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="cat-create" disabled={saving || uploading}>
              {saving ? t('auth.saving') : t('common.create')}
            </Button>
          </>
        }
      >
        <form id="cat-create" className="space-y-3" onSubmit={onCreateCat}>
          <Input
            label={t('common.name')}
            value={catForm.name}
            onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <CatImageField />
          {formError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={editCatModal}
        onClose={() => setEditCatModal(false)}
        title={t('admin.editCategory')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditCatModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="cat-edit" disabled={saving || uploading}>
              {saving ? t('auth.saving') : t('common.save')}
            </Button>
          </>
        }
      >
        <form id="cat-edit" className="space-y-3" onSubmit={onUpdateCat}>
          <Input
            label={t('common.name')}
            value={catForm.name}
            onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <CatImageField />
          {formError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={subModal}
        onClose={() => setSubModal(false)}
        title={t('admin.newSubcategory')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSubModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="sub-create" disabled={saving}>
              {saving ? t('auth.saving') : t('common.create')}
            </Button>
          </>
        }
      >
        <form id="sub-create" className="space-y-3" onSubmit={onCreateSub}>
          <Select
            label={t('admin.btnCategory')}
            required
            value={subForm.category_id}
            onChange={(category_id) =>
              setSubForm((f) => ({ ...f, category_id }))
            }
            options={items.map((c) => ({ value: c.id, label: c.name }))}
            searchable
          />
          <Input
            label={t('common.name')}
            value={subForm.name}
            onChange={(e) => setSubForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          {formError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={editSubModal}
        onClose={() => setEditSubModal(false)}
        title={t('admin.editSubcategory')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditSubModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="sub-edit" disabled={saving}>
              {saving ? t('auth.saving') : t('common.save')}
            </Button>
          </>
        }
      >
        <form id="sub-edit" className="space-y-3" onSubmit={onUpdateSub}>
          <Input
            label={t('common.name')}
            value={subForm.name}
            onChange={(e) => setSubForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          {formError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={deleteModal}
        onClose={() => setDeleteModal(false)}
        title={
          deleteKind === 'category'
            ? t('admin.deleteCategory')
            : t('admin.deleteSubcategory')
        }
        subtitle={
          deleteKind === 'category' ? t('admin.deleteCategoryHint') : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteModal(false)}>
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
            name:
              deleteKind === 'category'
                ? (selectedCat?.name ?? '')
                : (selectedSub?.name ?? ''),
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

function CategoryAccordion({
  cat,
  kids,
  open,
  togglingId,
  onToggle,
  onStatusCat,
  onStatusSub,
  onAddSub,
  onEditCat,
  onDeleteCat,
  onEditSub,
  onDeleteSub,
}: {
  cat: CategoryNode
  kids: SubcategoryNode[]
  open: boolean
  togglingId: string | null
  onToggle: () => void
  onStatusCat: () => void
  onStatusSub: (sub: SubcategoryNode) => void
  onAddSub: () => void
  onEditCat: () => void
  onDeleteCat: () => void
  onEditSub: (sub: SubcategoryNode) => void
  onDeleteSub: (sub: SubcategoryNode) => void
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
            <span className="font-semibold text-slate-900">{cat.name}</span>
          </button>
        </td>
        <td className="px-4 py-3.5">
          {cat.image ? (
            <img
              src={mediaUrl(cat.image)}
              alt=""
              className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200"
            />
          ) : (
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <Tag size={16} />
            </span>
          )}
        </td>
        <td className="px-4 py-3.5">
          <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-semibold text-teal-800 uppercase">
            {t('admin.typeCategory')}
          </span>
        </td>
        <td className="px-4 py-3.5">
          <StatusSwitch
            active={cat.status === 'active'}
            disabled={togglingId === cat.id}
            onToggle={onStatusCat}
          />
        </td>
        <td className="px-4 py-3.5 font-medium text-slate-700">
          {t('admin.subCountInline', { count: kids.length })}
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              title={t('admin.addSub')}
              onClick={onAddSub}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              title={t('common.edit')}
              onClick={onEditCat}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              title={t('common.delete')}
              onClick={onDeleteCat}
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
                    {t('admin.noSubcategories')}
                  </p>
                ) : (
                  <table className="min-w-full text-left text-sm">
                    <tbody>
                      {kids.map((sub, i) => (
                        <tr
                          key={sub.id}
                          className={`border-t border-slate-100/80 ${
                            i % 2 === 0 ? 'bg-slate-50/60' : 'bg-white/60'
                          }`}
                        >
                          <td className="py-3 pr-4 pl-14">
                            <div className="flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                              <span className="font-medium text-slate-800">
                                {sub.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-400">—</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-800 uppercase">
                              {t('admin.typeSub')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <StatusSwitch
                              active={sub.status === 'active'}
                              disabled={togglingId === sub.id}
                              onToggle={() => onStatusSub(sub)}
                            />
                          </td>
                          <td className="px-4 py-3 text-slate-400">—</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                title={t('common.edit')}
                                onClick={() => onEditSub(sub)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                title={t('common.delete')}
                                onClick={() => onDeleteSub(sub)}
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
