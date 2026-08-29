export type UserRole = 'admin' | 'courier' | 'customer';

export type CollectionStatus =
  | 'open'
  | 'closed'
  | 'in_fulfillment'
  | 'completed'
  | 'cancelled';

export type OrderStatus =
  | 'collecting'
  | 'awaiting_courier'
  | 'with_courier'
  | 'issued'
  | 'cancelled';

export type DeliveryMethod = 'pickup_mfy' | 'home_delivery';

export type PaymentProvider = 'click' | 'payme' | 'uzum' | 'cash_on_delivery';

export interface City {
  id: string;
  name: string;
  regionId?: string | null;
}

export interface Region {
  id: string;
  name: string;
  code?: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
}

export interface Product {
  id: string;
  subcategoryId: string;
  categoryId?: string;
  categoryName?: string;
  subcategoryName?: string;
  name: string;
  description: string;
  unitLabel: string;
  unitPriceUzs: number;
  photoUrl?: string | null;
  stock: number;
  active: boolean;
}

export interface StockMove {
  id: string;
  productId: string;
  productName?: string;
  kind: 'in' | 'out';
  quantity: number;
  note: string;
  createdAt: string;
}

export interface Mfy {
  id: string;
  cityId: string;
  name: string;
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
}

export interface UserProfile {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string;
  phoneMasked?: string;
  cityId?: string | null;
  mfyId?: string | null;
  cityName?: string | null;
  mfyName?: string | null;
  regionId?: string | null;
  regionName?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryAddress?: string | null;
  profileCompleted: boolean;
}

export interface GroupBuyItem {
  productId: string;
  name: string;
  unitLabel: string;
  unitPriceUzs: number;
  quantity: number;
  stock: number;
  photoUrl?: string | null;
}

export interface GroupBuy {
  id: string;
  kind?: 'product' | 'combo';
  title: string;
  description: string;
  photoUrl?: string;
  photoUrls?: string[];
  productId?: string | null;
  unitLabel: string;
  unitPriceUzs: number;
  minVolume: number;
  currentVolume: number;
  stock?: number;
  items?: GroupBuyItem[];
  status: CollectionStatus;
  cashOnDeliveryAllowed: boolean;
  paymentDeadlineAt?: string;
  createdAt: string;
}

export interface CartItem {
  groupBuyId: string;
  title: string;
  unitLabel: string;
  unitPriceUzs: number;
  quantity: number;
  photoUrl?: string | null;
  minVolume: number;
  currentVolume: number;
  status: string;
}

export interface OrderItem {
  id: string;
  groupBuyId: string;
  title: string;
  quantity: number;
  unitPriceUzs: number;
  unitLabel: string;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  deliveryMethod: DeliveryMethod;
  deliveryFeeUzs: number;
  paymentProvider?: PaymentProvider | null;
  status: OrderStatus;
  pickupCode?: string;
  hasPickupCode?: boolean;
  paymentDeadlineAt?: string | null;
  cityId?: string | null;
  mfyId?: string | null;
  customerName?: string;
  customerPhone?: string;
  subtotalUzs?: number;
  totalUzs: number;
  createdAt: string;
}

export interface WarehouseLeftover {
  id: string;
  groupBuyId: string;
  title: string;
  quantity: number;
  reason: 'unpaid';
}

export interface DeliveryTask {
  orderId: string;
  customerName: string;
  phoneMasked: string;
  deliveryMethod: DeliveryMethod;
  address?: string;
  lat?: number;
  lng?: number;
  status: Extract<OrderStatus, 'with_courier' | 'issued'>;
}
