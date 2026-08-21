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

export interface GroupBuy {
  id: string;
  title: string;
  description: string;
  photoUrl?: string;
  unitLabel: string;
  unitPriceUzs: number;
  minVolume: number;
  currentVolume: number;
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
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryAddress?: string | null;
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
