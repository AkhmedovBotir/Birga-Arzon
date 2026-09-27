import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function ProtectedRoute() {
  const { admin, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-slate-500">
        Yuklanmoqda…
      </div>
    )
  }

  if (!admin) return <Navigate to="/login" replace />
  return <Outlet />
}
