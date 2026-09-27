import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'ba_user_favorites'

type FavoritesCtx = {
  favorites: string[]
  isFavorite: (id: string) => boolean
  toggleFavorite: (id: string) => void
  addFavorite: (id: string) => void
  removeFavorite: (id: string) => void
  count: number
}

const Ctx = createContext<FavoritesCtx | null>(null)

function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (id): id is string => typeof id === 'string' && id.trim().length > 0,
    )
  } catch {
    return []
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readFavorites(),
  )

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
    } catch {
      /* ignore */
    }
  }, [favorites])

  const isFavorite = useCallback(
    (id: string) => Boolean(id && favorites.includes(id)),
    [favorites],
  )

  const toggleFavorite = useCallback((id: string) => {
    if (!id) return
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const addFavorite = useCallback((id: string) => {
    if (!id) return
    setFavorites((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const removeFavorite = useCallback((id: string) => {
    if (!id) return
    setFavorites((prev) => prev.filter((x) => x !== id))
  }, [])

  const value = useMemo<FavoritesCtx>(
    () => ({
      favorites,
      isFavorite,
      toggleFavorite,
      addFavorite,
      removeFavorite,
      count: favorites.length,
    }),
    [favorites, isFavorite, toggleFavorite, addFavorite, removeFavorite],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useFavorites() {
  const ctx = useContext(Ctx)
  if (!ctx) {
    throw new Error('useFavorites must be used within FavoritesProvider')
  }
  return ctx
}
