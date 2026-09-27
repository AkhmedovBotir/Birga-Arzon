import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type CartItem = {
  key: string
  productId: string
  name: string
  price: number
  unit: string
  image?: string
  qty: number
  yigimId?: string
}

type CartInput = Omit<CartItem, 'qty'> & { qty?: number }

type CartCtx = {
  items: CartItem[]
  add: (item: CartInput) => void
  /** Qo‘shilish: miqdorni qo‘yadi (yig‘indi emas) */
  upsert: (item: CartInput) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
  clearKeys: (keys: string[]) => void
  getByKey: (key: string) => CartItem | undefined
  count: number
  total: number
}

const STORAGE_KEY = 'ba_user_cart'
const Ctx = createContext<CartCtx | null>(null)

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CartItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (i) => i && typeof i.key === 'string' && typeof i.qty === 'number' && i.qty > 0,
    )
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() =>
    typeof window === 'undefined' ? [] : readCart(),
  )

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      /* ignore */
    }
  }, [items])

  const value = useMemo<CartCtx>(
    () => ({
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      total: items.reduce((s, i) => s + i.price * i.qty, 0),
      getByKey: (key) => items.find((i) => i.key === key),
      add: (item) => {
        setItems((prev) => {
          const exist = prev.find((p) => p.key === item.key)
          const delta = item.qty ?? 1
          if (exist) {
            const nextQty = exist.qty + delta
            if (nextQty <= 0) return prev.filter((p) => p.key !== item.key)
            return prev.map((p) =>
              p.key === item.key ? { ...p, ...item, qty: nextQty } : p,
            )
          }
          if (delta <= 0) return prev
          return [...prev, { ...item, qty: delta }]
        })
      },
      upsert: (item) => {
        setItems((prev) => {
          const qty = Math.max(1, item.qty ?? 1)
          const exist = prev.find((p) => p.key === item.key)
          if (exist) {
            return prev.map((p) =>
              p.key === item.key ? { ...p, ...item, qty } : p,
            )
          }
          return [...prev, { ...item, qty }]
        })
      },
      setQty: (key, qty) => {
        setItems((prev) => {
          if (qty <= 0) return prev.filter((p) => p.key !== key)
          return prev.map((p) => (p.key === key ? { ...p, qty } : p))
        })
      },
      remove: (key) => setItems((prev) => prev.filter((p) => p.key !== key)),
      clear: () => setItems([]),
      clearKeys: (keys) => {
        const set = new Set(keys)
        setItems((prev) => prev.filter((p) => !set.has(p.key)))
      },
    }),
    [items],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('CartProvider required')
  return ctx
}

export function yigimCartKey(yigimId: string) {
  return `yigim-${yigimId}`
}
