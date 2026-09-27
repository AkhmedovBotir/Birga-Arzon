import { config } from '../config'

const API_BASE = config.apiBaseUrl

export type AdminRole = 'general' | 'admin'

export type AdminUser = {
  id: string
  first_name: string
  last_name: string
  phone: string
  role: AdminRole
  username: string
  is_active: boolean
  created_by?: string | null
  created_at: string
  updated_at: string
}

export type LoginResult = {
  token: string
  admin: AdminUser
}

export type AdminFormBody = {
  first_name: string
  last_name: string
  phone: string
  username: string
  password: string
  is_active?: boolean
}

export type AppUser = {
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
  is_blocked: boolean
  created_at: string
  updated_at: string
}

export type AppUserFormBody = {
  phone: string
  first_name: string
  last_name: string
  viloyat_id?: string | null
  tuman_id?: string | null
  lat?: number | null
  lng?: number | null
  profile_complete?: boolean
  is_blocked?: boolean
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
  login: (username: string, password: string) =>
    request<LoginResult>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  me: (token: string) => request<AdminUser>('/admin/me', {}, token),

  listAdmins: (token: string) =>
    request<{ items: AdminUser[] }>('/admin/admins', {}, token),

  createAdmin: (token: string, body: AdminFormBody) =>
    request<AdminUser>(
      '/admin/admins',
      {
        method: 'POST',
        body: JSON.stringify({
          first_name: body.first_name,
          last_name: body.last_name,
          phone: body.phone,
          username: body.username,
          password: body.password,
        }),
      },
      token,
    ),

  updateAdmin: (token: string, id: string, body: AdminFormBody) =>
    request<AdminUser>(
      `/admin/admins/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          first_name: body.first_name,
          last_name: body.last_name,
          phone: body.phone,
          username: body.username,
          password: body.password,
          is_active: body.is_active,
        }),
      },
      token,
    ),

  deleteAdmin: (token: string, id: string) =>
    request<{ status: string }>(
      `/admin/admins/${id}`,
      { method: 'DELETE' },
      token,
    ),

  listUsers: (token: string) =>
    request<{ items: AppUser[] }>('/admin/users', {}, token),

  createUser: (token: string, body: AppUserFormBody) =>
    request<AppUser>(
      '/admin/users',
      { method: 'POST', body: JSON.stringify(body) },
      token,
    ),

  updateUser: (token: string, id: string, body: AppUserFormBody) =>
    request<AppUser>(
      `/admin/users/${id}`,
      { method: 'PUT', body: JSON.stringify(body) },
      token,
    ),

  setUserBlocked: (token: string, id: string, is_blocked: boolean) =>
    request<AppUser>(
      `/admin/users/${id}/block`,
      { method: 'PATCH', body: JSON.stringify({ is_blocked }) },
      token,
    ),

  deleteUser: (token: string, id: string) =>
    request<{ status: string }>(
      `/admin/users/${id}`,
      { method: 'DELETE' },
      token,
    ),

  listKuryers: (token: string, q = '') =>
    request<{ items: Kuryer[] }>(
      `/kuryers${q ? `?q=${encodeURIComponent(q)}` : ''}`,
      {},
      token,
    ),

  kuryersStats: (token: string) =>
    request<KuryerStats>('/kuryers/stats', {}, token),

  createKuryer: (token: string, body: KuryerFormBody) =>
    request<Kuryer>(
      '/kuryers',
      { method: 'POST', body: JSON.stringify(body) },
      token,
    ),

  updateKuryer: (token: string, id: string, body: KuryerFormBody) =>
    request<Kuryer>(
      `/kuryers/${id}`,
      { method: 'PUT', body: JSON.stringify(body) },
      token,
    ),

  setKuryerActive: (token: string, id: string, is_active: boolean) =>
    request<Kuryer>(
      `/kuryers/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ is_active }) },
      token,
    ),

  deleteKuryer: (token: string, id: string) =>
    request<{ status: string }>(
      `/kuryers/${id}`,
      { method: 'DELETE' },
      token,
    ),

  ordersStats: (token: string) =>
    request<OrderStats>('/admin/orders/stats', {}, token),

  paymentsStats: (token: string) =>
    request<PaymentStats>('/admin/payments/stats', {}, token),

  paymentsList: (
    token: string,
    opts: { status?: string; method?: string; q?: string } = {},
  ) => {
    const params = new URLSearchParams()
    if (opts.status) params.set('status', opts.status)
    if (opts.method) params.set('method', opts.method)
    if (opts.q) params.set('q', opts.q)
    const qs = params.toString()
    return request<{ items: AdminPayment[] }>(
      `/admin/payments${qs ? `?${qs}` : ''}`,
      {},
      token,
    )
  },

  paymentSync: (token: string, orderId: string) =>
    request<{ synced: boolean }>(
      `/admin/payments/${orderId}/sync`,
      { method: 'POST' },
      token,
    ),

  paymentConfirm: (
    token: string,
    orderId: string,
    data?: { payment_id?: string; invoice?: string },
  ) =>
    request<{ status: string }>(
      `/admin/payments/${orderId}/confirm`,
      {
        method: 'POST',
        body: JSON.stringify(data || {}),
        headers: { 'Content-Type': 'application/json' },
      },
      token,
    ),

  listOrders: (token: string, status = '', q = '') => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (q) params.set('q', q)
    const qs = params.toString()
    return request<{ items: AdminOrder[] }>(
      `/admin/orders${qs ? `?${qs}` : ''}`,
      {},
      token,
    )
  },

  getOrder: (token: string, id: string) =>
    request<AdminOrder>(`/admin/orders/${id}`, {}, token),

  assignOrder: (token: string, id: string, kuryer_id: string) =>
    request<AdminOrder>(
      `/admin/orders/${id}/assign`,
      { method: 'PATCH', body: JSON.stringify({ kuryer_id }) },
      token,
    ),

  autoAssignOrder: (token: string, id: string) =>
    request<AdminOrder>(
      `/admin/orders/${id}/auto-assign`,
      { method: 'PATCH' },
      token,
    ),

  unassignOrder: (token: string, id: string) =>
    request<AdminOrder>(
      `/admin/orders/${id}/unassign`,
      { method: 'PATCH' },
      token,
    ),

  setOrderStatus: (token: string, id: string, status: string) =>
    request<AdminOrder>(
      `/admin/orders/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      token,
    ),

  regionsTree: (token: string) =>
    request<{ items: RegionNode[] }>('/regions/tree', {}, token),

  regionsStats: (token: string) =>
    request<RegionStats>('/regions/stats', {}, token),

  regionsViloyatlar: (token: string) =>
    request<{ items: Region[] }>('/regions/viloyatlar', {}, token),

  regionsChildren: (token: string, id: string, type = 'tuman') =>
    request<{ items: Region[] }>(
      `/regions/${id}/children?type=${encodeURIComponent(type)}`,
      {},
      token,
    ),

  createRegion: (
    token: string,
    body: {
      name: string
      code: string
      type: 'viloyat' | 'tuman'
      parent_id?: string | null
      status?: string
    },
  ) =>
    request<Region>(
      '/regions',
      { method: 'POST', body: JSON.stringify(body) },
      token,
    ),

  updateRegion: (
    token: string,
    id: string,
    body: { name: string; code: string; status: string },
  ) =>
    request<Region>(
      `/regions/${id}`,
      { method: 'PUT', body: JSON.stringify(body) },
      token,
    ),

  updateRegionStatus: (token: string, id: string, status: string) =>
    request<Region>(
      `/regions/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      token,
    ),

  deleteRegion: (token: string, id: string) =>
    request<{ status: string }>(
      `/regions/${id}`,
      { method: 'DELETE' },
      token,
    ),

  categoriesTree: (token: string) =>
    request<{ items: CategoryNode[] }>('/categories/tree', {}, token),

  categoriesStats: (token: string) =>
    request<CategoryStats>('/categories/stats', {}, token),

  createCategory: (
    token: string,
    body: { name: string; icon?: string; image?: string; status?: string },
  ) =>
    request<Category>(
      '/categories',
      { method: 'POST', body: JSON.stringify(body) },
      token,
    ),

  updateCategory: (
    token: string,
    id: string,
    body: { name: string; icon?: string; image?: string; status: string },
  ) =>
    request<Category>(
      `/categories/${id}`,
      { method: 'PUT', body: JSON.stringify(body) },
      token,
    ),

  updateCategoryStatus: (token: string, id: string, status: string) =>
    request<Category>(
      `/categories/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      token,
    ),

  deleteCategory: (token: string, id: string) =>
    request<{ status: string }>(
      `/categories/${id}`,
      { method: 'DELETE' },
      token,
    ),

  reorderCategories: (token: string, ids: string[]) =>
    request<{ status: string }>(
      '/categories/reorder',
      { method: 'PATCH', body: JSON.stringify({ ids }) },
      token,
    ),

  reorderSubcategories: (token: string, ids: string[]) =>
    request<{ status: string }>(
      '/subcategories/reorder',
      { method: 'PATCH', body: JSON.stringify({ ids }) },
      token,
    ),

  uploadCategoryImage: async (token: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/categories/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
    }
    return data as { url: string }
  },

  createSubcategory: (
    token: string,
    categoryId: string,
    body: { name: string; status?: string },
  ) =>
    request<Subcategory>(
      `/categories/${categoryId}/subcategories`,
      { method: 'POST', body: JSON.stringify(body) },
      token,
    ),

  updateSubcategory: (
    token: string,
    id: string,
    body: { name: string; status: string },
  ) =>
    request<Subcategory>(
      `/subcategories/${id}`,
      { method: 'PUT', body: JSON.stringify(body) },
      token,
    ),

  updateSubcategoryStatus: (token: string, id: string, status: string) =>
    request<Subcategory>(
      `/subcategories/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      token,
    ),

  deleteSubcategory: (token: string, id: string) =>
    request<{ status: string }>(
      `/subcategories/${id}`,
      { method: 'DELETE' },
      token,
    ),

  productsList: (token: string, q = '') =>
    request<{ items: ProductListItem[] }>(
      `/products${q ? `?q=${encodeURIComponent(q)}` : ''}`,
      {},
      token,
    ),

  productsStats: (token: string) =>
    request<ProductStats>('/products/stats', {}, token),

  getProduct: (token: string, id: string) =>
    request<Product>(`/products/${id}`, {}, token),

  createProduct: (token: string, body: ProductUpsertBody) =>
    request<Product>(
      '/products',
      { method: 'POST', body: JSON.stringify(body) },
      token,
    ),

  updateProduct: (token: string, id: string, body: ProductUpsertBody) =>
    request<Product>(
      `/products/${id}`,
      { method: 'PUT', body: JSON.stringify(body) },
      token,
    ),

  updateProductStatus: (token: string, id: string, status: string) =>
    request<Product>(
      `/products/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      token,
    ),

  deleteProduct: (token: string, id: string) =>
    request<{ status: string }>(
      `/products/${id}`,
      { method: 'DELETE' },
      token,
    ),

  uploadProductImage: async (token: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/products/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
    }
    return data as { url: string }
  },

  yigimsList: (token: string, q = '') =>
    request<{ items: Yigim[] }>(
      `/yigims${q ? `?q=${encodeURIComponent(q)}` : ''}`,
      {},
      token,
    ),

  yigimsStats: (token: string) =>
    request<YigimStats>('/yigims/stats', {}, token),

  getYigim: (token: string, id: string) =>
    request<Yigim>(`/yigims/${id}`, {}, token),

  createYigim: (token: string, body: YigimUpsertBody) =>
    request<Yigim>(
      '/yigims',
      { method: 'POST', body: JSON.stringify(body) },
      token,
    ),

  updateYigim: (token: string, id: string, body: YigimUpsertBody) =>
    request<Yigim>(
      `/yigims/${id}`,
      { method: 'PUT', body: JSON.stringify(body) },
      token,
    ),

  updateYigimStatus: (token: string, id: string, status: string) =>
    request<Yigim>(
      `/yigims/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      token,
    ),

  deleteYigim: (token: string, id: string) =>
    request<{ status: string }>(
      `/yigims/${id}`,
      { method: 'DELETE' },
      token,
    ),

  uploadYigimImage: async (token: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/yigims/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
    }
    return data as { url: string }
  },

  getSettings: (token: string) =>
    request<AppSettings>('/admin/settings', {}, token),

  updateSettings: (
    token: string,
    body: {
      min_order_amount?: number
      delivery_fee?: number
      telegram_bot_token?: string
      telegram_webapp_url?: string
    },
  ) =>
    request<AppSettings>(
      '/admin/settings',
      { method: 'PUT', body: JSON.stringify(body) },
      token,
    ),

  getBotStatus: (token: string) =>
    request<{
      active: boolean
      bot_id?: number
      username?: string
      first_name?: string
      webapp_url?: string
      error?: string
    }>('/admin/bot/status', {}, token),

  testBotToken: (token: string, botToken: string) =>
    request<{
      ok: boolean
      bot_id?: number
      username?: string
      first_name?: string
      error?: string
    }>(
      '/admin/bot/test',
      { method: 'POST', body: JSON.stringify({ token: botToken }) },
      token,
    ),

  syncBotCommands: (token: string) =>
    request<{ status: string; message: string }>(
      '/admin/bot/sync-commands',
      { method: 'POST' },
      token,
    ),
}

export type AppSettings = {
  min_order_amount: number
  delivery_fee?: number
  telegram_bot_token?: string
  telegram_webapp_url?: string
  updated_at?: string
}

export type RegionStats = {
  viloyat: number
  tuman: number
  mfy: number
}

export type RegionNode = {
  id: string
  name: string
  code: string
  type: string
  status: string
  children_count: number
  children?: RegionNode[]
}

export type Region = {
  id: string
  legacy_id: string
  name: string
  code: string
  type: string
  parent_id?: string | null
  status: string
  created_at: string
  updated_at: string
}

export type CategoryStats = {
  categories: number
  subcategories: number
}

export type SubcategoryNode = {
  id: string
  name: string
  status: string
  sort_order?: number
}

export type CategoryNode = {
  id: string
  name: string
  icon: string
  image?: string
  status: string
  sort_order?: number
  children_count: number
  children?: SubcategoryNode[]
}

export type Category = {
  id: string
  name: string
  icon: string
  image?: string
  status: string
  sort_order?: number
  created_at: string
  updated_at: string
}

export type Subcategory = {
  id: string
  category_id: string
  name: string
  status: string
  created_at: string
  updated_at: string
}

export type ProductStats = {
  total: number
  active: number
  inactive: number
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
  created_at: string
  updated_at: string
}

export type Product = ProductListItem & {
  description: { ops: Array<Record<string, unknown>> }
}

export type ProductUpsertBody = {
  category_id: string
  subcategory_id: string
  name: string
  description: { ops: Array<Record<string, unknown>> }
  unit: 'dona' | 'litr' | 'kg'
  unit_size: number
  stock: number
  price: number
  images: string[]
  status: 'active' | 'inactive'
}

export type YigimStats = {
  total: number
  single: number
  combo: number
  open: number
  closed: number
}

export type YigimItem = {
  id?: string
  product_id: string
  qty: number
  product_name?: string
  product_image?: string
}

export type Yigim = {
  id: string
  type: 'single' | 'combo' | string
  name: string | null
  product_id: string | null
  target_qty: number
  current_qty?: number
  images: string[]
  status: string
  created_at: string
  updated_at: string
  product_name?: string
  items: YigimItem[]
}

export type YigimUpsertBody = {
  type: 'single' | 'combo'
  name?: string
  product_id?: string
  target_qty: number
  current_qty?: number
  images: string[]
  status: 'active' | 'inactive'
  items?: { product_id: string; qty: number }[]
}

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

export type KuryerStats = {
  total: number
  active: number
  inactive: number
}

export type KuryerFormBody = {
  first_name: string
  last_name: string
  phone: string
  password?: string
  viloyat_id?: string | null
  tuman_id?: string | null
  is_active?: boolean
}

export type OrderStats = {
  total: number
  waiting: number
  ready: number
  assigned: number
  delivered: number
  cancelled: number
}

export type AdminOrderItem = {
  id: string
  yigim_id: string
  product_name: string
  unit: string
  unit_price: number
  qty: number
  image: string
  yigim_status?: string
}

export type AdminOrder = {
  id: string
  user_id: string
  status: string
  status_label?: string
  delivery_code: string
  kuryer_id?: string | null
  first_name: string
  last_name: string
  phone: string
  viloyat_name: string
  tuman_name: string
  total_amount: number
  delivery_fee?: number
  payable_amount?: number
  payment_status?: string
  payment_method?: string
  needs_payment?: boolean
  note?: string
  items: AdminOrderItem[]
  kuryer_name?: string
  kuryer_phone?: string
  user_full_name?: string
  created_at: string
  assigned_at?: string | null
  delivered_at?: string | null
  paid_at?: string | null
}

export type PaymentStats = {
  total: number
  unpaid: number
  pending: number
  paid: number
  cod: number
  paid_amount: number
  cod_amount: number
  unpaid_amount: number
  pending_amount: number
}

export type AdminPayment = {
  order_id: string
  order_status: string
  payment_status: string
  payment_method: string
  total_amount: number
  delivery_fee: number
  payable_amount: number
  atmos_payment_id?: string
  atmos_invoice?: string
  request_id?: string
  checkout_url?: string
  first_name: string
  last_name: string
  phone: string
  user_full_name?: string
  viloyat_name?: string
  tuman_name?: string
  created_at: string
  paid_at?: string | null
  updated_at?: string
}
