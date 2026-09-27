import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutGrid, X } from 'lucide-react'
import { api, type CategoryNode } from '../api/client'
import { mediaUrl } from '../config'

type CategoryPickerContextValue = {
  open: boolean
  openPicker: () => void
  closePicker: () => void
  togglePicker: () => void
}

const CategoryPickerContext = createContext<CategoryPickerContextValue | null>(
  null,
)

export function useCategoryPicker() {
  const ctx = useContext(CategoryPickerContext)
  if (!ctx) {
    throw new Error('useCategoryPicker must be used within CategoryPickerProvider')
  }
  return ctx
}

export function CategoryPickerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const openPicker = useCallback(() => setOpen(true), [])
  const closePicker = useCallback(() => setOpen(false), [])
  const togglePicker = useCallback(() => setOpen((v) => !v), [])
  const value = useMemo(
    () => ({ open, openPicker, closePicker, togglePicker }),
    [open, openPicker, closePicker, togglePicker],
  )

  return (
    <CategoryPickerContext.Provider value={value}>
      {children}
      <CategoryPickerSheet />
    </CategoryPickerContext.Provider>
  )
}

function CategoryPickerSheet() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { open, closePicker } = useCategoryPicker()
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api.categoriesTree()
        if (cancelled) return
        setCategories((res.items ?? []).filter((c) => c.status === 'active'))
      } catch (err) {
        if (cancelled) return
        setCategories([])
        setError(
          err instanceof Error ? err.message : t('categories.loadError'),
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, t])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePicker()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, closePicker])

  /** Kategoriya tanlanganda boshqa sahifaga o‘tmaydi — home’da filtrlanadi */
  const pick = (catId?: string) => {
    closePicker()
    if (catId) {
      navigate(`/?cat=${encodeURIComponent(catId)}`)
    } else {
      navigate('/')
    }
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
          <motion.button
            type="button"
            aria-label={t('common.close')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#0f3d2e]/45 backdrop-blur-[2px]"
            onClick={closePicker}
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-labelledby="category-picker-title"
            initial={{ y: '100%', opacity: 0.85 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className="relative z-[1] flex max-h-[min(85svh,620px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.5rem] bg-white shadow-2xl sm:rounded-[1.5rem]"
          >
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--line)] sm:hidden" />
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <p
                  id="category-picker-title"
                  className="text-base font-extrabold text-[var(--green)] sm:text-lg"
                >
                  {t('nav.categories')}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--muted)]">
                  {t('categories.pickHint')}
                </p>
              </div>
              <button
                type="button"
                onClick={closePicker}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--sand)] text-[var(--ink)]"
                aria-label={t('common.close')}
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4">
              {loading ? (
                <div className="space-y-2 p-1">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="h-14 animate-pulse rounded-2xl bg-[var(--sand)]"
                    />
                  ))}
                </div>
              ) : error ? (
                <p className="rounded-2xl bg-rose-50 px-4 py-6 text-center text-sm font-semibold text-rose-600">
                  {error}
                </p>
              ) : categories.length === 0 ? (
                <p className="rounded-2xl bg-[var(--sand)] px-4 py-8 text-center text-sm font-semibold text-[var(--muted)]">
                  {t('categories.emptyLong')}
                </p>
              ) : (
                <ul className="space-y-1">
                  <li>
                    <button
                      type="button"
                      onClick={() => pick()}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition active:bg-[var(--brand-soft)] hover:bg-[var(--sand)]"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                        <LayoutGrid size={22} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-[var(--ink)]">
                        {t('categories.all')}
                      </span>
                    </button>
                  </li>
                  {categories.map((c) => {
                    const photo = c.image?.trim() ? mediaUrl(c.image) : ''
                    const letter = (c.name.trim().slice(0, 1) || '?').toUpperCase()
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => pick(c.id)}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition active:bg-[var(--brand-soft)] hover:bg-[var(--sand)]"
                        >
                          <span className="flex h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[var(--sand)] ring-1 ring-[var(--line)]">
                            {photo ? (
                              <img
                                src={photo}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-sm font-extrabold text-[var(--brand)]">
                                {letter}
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-[var(--ink)]">
                            {c.name}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
