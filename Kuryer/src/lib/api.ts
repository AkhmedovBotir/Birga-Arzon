import { localeAccept, tStatic } from '@/src/i18n';
import { API_BASE_URL } from '@/src/config';
import { toast } from '@/src/lib/toast';

export const TOKEN_STORAGE_KEY = 'jamao_courier_token';

export function getStoredToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function apiOrigin(): string {
  return API_BASE_URL.replace(/\/$/, '');
}

function buildUrl(path: string): string {
  const origin = apiOrigin();
  const p = path.startsWith('/') ? path : `/${path}`;
  return origin ? `${origin}${p}` : p;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function readErrorMessage(body: Record<string, unknown>, fallback: string): string {
  const msg = body.message ?? body.error ?? body.msg;
  return typeof msg === 'string' && msg.trim() ? msg : fallback;
}

function shouldSkipErrorToast(path: string, status: number) {
  return status === 401 && path.includes('/auth/me');
}

type RequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
  headers?: HeadersInit;
  form?: FormData;
  success?: string;
  silent?: boolean;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', token, body, headers: initHeaders, form, success, silent } = options;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': localeAccept(),
    ...(initHeaders as Record<string, string> | undefined),
  };

  let fetchBody: BodyInit | undefined;
  if (form) {
    fetchBody = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }

  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path), { method, headers, body: fetchBody });
  } catch {
    const err = new ApiError(0, tStatic('api_offline'));
    if (!silent) toast(err.message, 'error');
    throw err;
  }

  let json: Record<string, unknown> = {};
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      const err = new ApiError(res.status, text || res.statusText);
      if (!silent && !shouldSkipErrorToast(path, res.status)) toast(err.message, 'error');
      throw err;
    }
  }

  if (!res.ok || json.success === false) {
    const err = new ApiError(
      res.status,
      readErrorMessage(json, res.status === 401 ? tStatic('api_denied') : res.statusText || tStatic('api_bad'))
    );
    if (!silent && !shouldSkipErrorToast(path, res.status)) toast(err.message, 'error');
    throw err;
  }

  if (success) toast(success, 'ok');
  return json.data as T;
}
