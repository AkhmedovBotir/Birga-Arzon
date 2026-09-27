import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api, type AdminUser } from '../api/client'

const TOKEN_KEY = 'ba_admin_token'

type AuthState = {
  token: string | null
  admin: AdminUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  )
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!token) {
      setAdmin(null)
      setLoading(false)
      return
    }
    try {
      const me = await api.me(token)
      setAdmin(me)
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setAdmin(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [token])

  const login = async (username: string, password: string) => {
    const res = await api.login(username, password)
    localStorage.setItem(TOKEN_KEY, res.token)
    setToken(res.token)
    setAdmin(res.admin)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setAdmin(null)
  }

  return (
    <AuthContext.Provider
      value={{ token, admin, loading, login, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
