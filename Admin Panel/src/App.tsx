import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AdminLayout } from './components/layout/AdminLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { AdminsPage } from './pages/AdminsPage'
import { UsersPage } from './pages/UsersPage'
import { RegionsPage } from './pages/RegionsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { ProductsPage } from './pages/ProductsPage'
import { YigimsPage } from './pages/YigimsPage'
import { CouriersPage } from './pages/CouriersPage'
import { OrdersPage } from './pages/OrdersPage'
import { PaymentsPage } from './pages/PaymentsPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="admins" element={<AdminsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="hududlar" element={<RegionsPage />} />
              <Route path="kategoriyalar" element={<CategoriesPage />} />
              <Route path="mahsulotlar" element={<ProductsPage />} />
              <Route path="yigimlar" element={<YigimsPage />} />
              <Route path="buyurtmalar" element={<OrdersPage />} />
              <Route path="tolovlar" element={<PaymentsPage />} />
              <Route path="kuryerlar" element={<CouriersPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
