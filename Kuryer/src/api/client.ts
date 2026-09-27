import { config } from '../config'

const API_BASE = config.apiBaseUrl

export type Kuryer = {
  id: string
  first_name: string
  last_name: string
  full_name: string
  phone: string
  viloyat_id?: string | null
  tuman_id?: string | null
  viloyat_name?: string
  tuman_name?: string
  is_active: boolean
}

export type LoginResult = {
  token: string
  kuryer: Kuryer
}

export type Dashboard = {
  kuryer: Kuryer
  deliveries: number
  pending: number
  completed: number
  today_hint: string
}

export type OrderItem = {
  id: string
  product_name: string
  unit: string
  unit_price: number
  qty: number
  image: string
}

export type Order = {
  id: string
  status: string
  status_label?: string
  first_name: string
  last_name: string
  phone: string
  viloyat_name: string
  tuman_name: string
  lat?: number | null
  lng?: number | null
  total_amount: number
  delivery_fee?: number
  note?: string
  items: OrderItem[]
  created_at: string
  assigned_at?: string | null
  delivered_at?: string | null
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  }
  return data as T
}

export const api = {
  login: (phone: string, password: string) =>
    request<LoginResult>('/kuryer/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    }),

  me: (token: string) => request<Kuryer>('/kuryer/me', {}, token),

  dashboard: (token: string) =>
    request<Dashboard>('/kuryer/dashboard', {}, token),

  myOrders: (token: string) =>
    request<{ items: Order[] }>('/kuryer/orders', {}, token),

  orderHistory: (token: string) =>
    request<{ items: Order[] }>('/kuryer/orders/history', {}, token),

  deliverOrder: (token: string, id: string, code: string) =>
    request<Order>(`/kuryer/orders/${id}/deliver`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    }, token),
}
