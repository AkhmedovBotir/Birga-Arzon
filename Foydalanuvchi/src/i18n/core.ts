import { cyrl } from './cyrl';
import { ru } from './ru';
import { LOCALE_META, STORAGE_KEY, uz, type DictKey, type Locale } from './uz';

export type { DictKey, Locale };
export { LOCALE_META, STORAGE_KEY, uz };

const DICTS = { uz, ru, cyrl } as const;

let current: Locale = 'uz';

export function getLocale(): Locale {
  return current;
}

export function setCurrentLocale(locale: Locale): void {
  current = locale;
}

export function localeAccept(locale: Locale = current): string {
  return LOCALE_META.find((m) => m.id === locale)?.accept || 'uz';
}

export function readStoredLocale(): Locale {
  if (typeof localStorage === 'undefined') return 'uz';
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'ru' || v === 'cyrl' || v === 'uz') return v;
  return 'uz';
}

export function interpolate(tpl: string, vars?: Record<string, string | number>): string {
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

export function translate(locale: Locale, key: DictKey, vars?: Record<string, string | number>): string {
  const dict = DICTS[locale] || uz;
  return interpolate(dict[key] || uz[key] || key, vars);
}

export function tStatic(key: DictKey, vars?: Record<string, string | number>): string {
  return translate(current, key, vars);
}

export function errText(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return tStatic('common_error');
}
