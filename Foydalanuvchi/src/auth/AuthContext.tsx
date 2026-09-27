import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, type UserProfile } from '../api/client'

const TOKEN_KEY = 'ba_user_token'
const USER_KEY = 'ba_user_profile'

function readStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as UserProfile
  } catch {
    return null
  }
}

type AuthState = {
  token: string | null
  user: UserProfile | null
  loading: boolean
  isAuthenticated: boolean
  setSession: (token: string, user: UserProfile) => void
  refreshMe: () => Promise<UserProfile | null>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  )
  const [user, setUser] = useState<UserProfile | null>(() =>
    localStorage.getItem(TOKEN_KEY) ? readStoredUser() : null,
  )
  const [loading, setLoading] = useState(!!localStorage.getItem(TOKEN_KEY))

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const setSession = useCallback((t: string, u: UserProfile) => {
    localStorage.setItem(TOKEN_KEY, t)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    setToken(t)
    setUser(u)
  }, [])

  const refreshMe = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY)
    if (!t) {
      setUser(null)
      return null
    }
    try {
      const me = await api.me(t)
      localStorage.setItem(USER_KEY, JSON.stringify(me))
      setUser(me)
      return me
    } catch {
      logout()
      return null
    }
  }, [logout])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    void (async () => {
      setLoading(true)
      await refreshMe()
      setLoading(false)
    })()
  }, [token, refreshMe])

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: !!token && !!user,
      setSession,
      refreshMe,
      logout,
    }),
    [token, user, loading, setSession, refreshMe, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
