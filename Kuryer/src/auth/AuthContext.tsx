import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api, type Kuryer } from '../api/client'

const TOKEN_KEY = 'ba_kuryer_token'

type AuthState = {
  token: string | null
  kuryer: Kuryer | null
  loading: boolean
  login: (phone: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  )
  const [kuryer, setKuryer] = useState<Kuryer | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!token) {
      setKuryer(null)
      setLoading(false)
      return
    }
    try {
      const me = await api.me(token)
      setKuryer(me)
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setKuryer(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [token])

  const login = async (phone: string, password: string) => {
    const res = await api.login(phone, password)
    localStorage.setItem(TOKEN_KEY, res.token)
    setToken(res.token)
    setKuryer(res.kuryer)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setKuryer(null)
  }

  return (
    <AuthContext.Provider
      value={{ token, kuryer, loading, login, logout, refresh }}
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
