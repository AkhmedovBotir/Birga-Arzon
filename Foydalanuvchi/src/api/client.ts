import { config } from '../config'

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...init } = options
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${config.apiBaseUrl}${path}`, { ...init, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  }
  return data as T
}

export type CategoryNode = {
  id: string
  name: string
  icon: string
  image?: string
  status: string
  children?: { id: string; name: string; status: string }[]
}

export type ProductListItem = {
  id: string
  category_id: string
  subcategory_id: string
  name: string
  unit: string
  unit_size: number
  stock: number
  price: number
  images: string[]
  status: string
  category_name: string
  subcategory_name: string
}

export type ProductDetail = ProductListItem & {
  description?: { ops?: { insert?: string }[] } | null
}

export type Yigim = {
  id: string
  type: string
  name: string | null
  product_id: string | null
  target_qty: number
  current_qty?: number
  images: string[]
  status: string
  product_name?: string
  items: {
    product_id: string
    qty: number
    product_name?: string
    product_image?: string
  }[]
}

export type RegionItem = {
  id: string
  name: string
  code: string
  type: string
  status: string
  parent_id?: string | null
}

export type UserProfile = {
  id: string
  phone: string
  first_name: string
  last_name: string
  full_name: string
  viloyat_id?: string | null
  tuman_id?: string | null
  viloyat_name?: string | null
  tuman_name?: string | null
  lat?: number | null
  lng?: number | null
  profile_complete: boolean
}

export type OrderItem = {
  id: string
  yigim_id: string
  product_id?: string | null
  product_name: string
  unit: string
  unit_price: number
  qty: number
  image: string
  yigim_status?: string
  yigim_name?: string
}

export type Order = {
  id: string
  user_id: string
  status: 'waiting' | 'ready' | 'assigned' | 'delivered' | 'cancelled' | string
  status_label?: string
  delivery_code: string
  kuryer_id?: string | null
  first_name: string
  last_name: string
  phone: string
  viloyat_name: string
  tuman_name: string
  lat?: number | null
  lng?: number | null
  total_amount: number
  delivery_fee?: number
  payable_amount?: number
  payment_status?: 'unpaid' | 'pending' | 'paid' | 'cod' | string
  payment_method?: 'card' | 'cash' | string
  needs_payment?: boolean
  note?: string
  items: OrderItem[]
  kuryer_name?: string
  kuryer_phone?: string
  created_at: string
  assigned_at?: string | null
  delivered_at?: string | null
  paid_at?: string | null
}

export type PaymentInfo = {
  order_id: string
  order_status: string
  payment_status: string
  payment_method: string
  goods_amount: number
  delivery_fee: number
  payable_amount: number
  needs_payment: boolean
  atmos_enabled: boolean
  items_count: number
}

export type AuthResult = {
  token: string
  needs_profile: boolean
  user: UserProfile
}

export const api = {
  categoriesTree: () =>
    request<{ items: CategoryNode[] }>('/categories/tree'),
  productsList: (q = '') =>
    request<{ items: ProductListItem[] }>(
      `/products${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    ),
  yigimsList: (q = '') =>
    request<{ items: Yigim[] }>(
      `/yigims${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    ),
  yigimGet: (id: string) => request<Yigim>(`/yigims/${id}`),
  productGet: (id: string) => request<ProductDetail>(`/products/${id}`),

  regionsViloyatlar: () =>
    request<{ items: RegionItem[] }>('/regions/viloyatlar'),
  regionsChildren: (id: string, type = 'tuman') =>
    request<{ items: RegionItem[] }>(
      `/regions/${id}/children?type=${encodeURIComponent(type)}`,
    ),

  sendOtp: (phone: string) =>
    request<{ status: string; message: string }>(
      '/user/auth/send-otp',
      { method: 'POST', body: JSON.stringify({ phone }) },
    ),
  verifyOtp: (phone: string, code: string) =>
    request<AuthResult>('/user/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),
  completeProfile: (
    token: string,
    body: {
      first_name: string
      last_name: string
      viloyat_id: string
      tuman_id: string
      lat: number
      lng: number
    },
  ) =>
    request<UserProfile>('/user/profile', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    }),
  me: (token: string) => request<UserProfile>('/user/me', { token }),

  getSettings: () =>
    request<{ min_order_amount: number; delivery_fee?: number }>('/settings'),

  createOrder: (
    token: string,
    body: { items: { yigim_id: string; qty: number }[]; note?: string },
  ) =>
    request<Order>('/orders', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    }),
  myOrders: (token: string) =>
    request<{ items: Order[] }>('/orders', { token }),
  orderGet: (token: string, id: string) =>
    request<Order>(`/orders/${id}`, { token }),
  orderPayment: (token: string, id: string) =>
    request<PaymentInfo>(`/orders/${id}/payment`, { token }),
  payCard: (token: string, id: string, lang = 'uz') =>
    request<{
      checkout_url: string
      payment_id: string
      token?: string
      amount: number
      amount_tiyin: number
    }>(`/orders/${id}/payment/card?lang=${encodeURIComponent(lang)}`, {
      method: 'POST',
      token,
      body: '{}',
    }),
  payCash: (token: string, id: string) =>
    request<Order>(`/orders/${id}/payment/cash`, {
      method: 'POST',
      token,
      body: '{}',
    }),
}
