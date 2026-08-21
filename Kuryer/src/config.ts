/**
 * Backend API manzili (oxirida `/` bo‘lmasin).
 */
export const API_BASE_URL = 'https://demo-api.mydiller.uz';

export const APP_TIMEZONE = 'Asia/Tashkent';

export const APP_ROLE = 'courier' as const;
export const APP_NAME = 'Birga Xarid — Kuryer';

export const PAYMENT_TIMEOUT_HOURS = 4;
export const HOME_DELIVERY_FEE_UZS = 10_000;
export const PICKUP_CODE_LENGTH = 4;

export const PAYMENT_PROVIDERS = ['click', 'payme', 'uzum', 'cash_on_delivery'] as const;
