import { Navigate, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from './AuthContext'

export function ProtectedRoute() {
  const { t } = useTranslation()
  const { kuryer, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-slate-500">
        {t('common.loading')}
      </div>
    )
  }

  if (!kuryer) return <Navigate to="/login" replace />
  return <Outlet />
}
