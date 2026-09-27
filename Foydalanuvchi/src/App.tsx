import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { CartProvider } from './cart/CartContext'
import { AppShell } from './components/AppShell'
import { HomePage } from './pages/HomePage'
import { CategoriesPage } from './pages/CategoriesPage'
import { CartPage } from './pages/CartPage'
import { OrdersPage } from './pages/OrdersPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { ProfilePage } from './pages/ProfilePage'
import { YigimDetailPage } from './pages/YigimDetailPage'
import { HowItWorksPage } from './pages/HowItWorksPage'
import { PaymentPage } from './pages/PaymentPage'
import { LoginPage } from './pages/LoginPage'
import { OtpPage } from './pages/OtpPage'
import { ProfileSetupPage } from './pages/ProfileSetupPage'

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="kategoriyalar" element={<CategoriesPage />} />
              <Route path="yigim/:id" element={<YigimDetailPage />} />
              <Route path="savat" element={<CartPage />} />
              <Route path="buyurtmalar" element={<OrdersPage />} />
              <Route path="buyurtmalar/:id" element={<OrderDetailPage />} />
              <Route path="buyurtmalar/:id/tolov" element={<PaymentPage />} />
              <Route path="profil" element={<ProfilePage />} />
              <Route path="qanday-ishlaydi" element={<HowItWorksPage />} />
            </Route>
            <Route path="kirish" element={<LoginPage />} />
            <Route path="kirish/kod" element={<OtpPage />} />
            <Route path="kirish/profil" element={<ProfileSetupPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  )
}
