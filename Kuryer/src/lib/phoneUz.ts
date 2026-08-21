/** Milliy qism: 9 ta raqam (masalan 901234567) */
export const UZ_NATIONAL_LEN = 9;

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/** API / saqlangan qiymatdan milliy 9 raqamni ajratish */
export function nationalDigitsFromAny(phone: string): string {
  const d = digitsOnly(phone);
  if (d.startsWith('998')) return d.slice(3, 3 + UZ_NATIONAL_LEN);
  return d.slice(0, UZ_NATIONAL_LEN);
}

/** Milliy qismni "+998901234567" ko‘rinishida */
export function toFullUzE164(nationalDigits: string): string {
  const d = digitsOnly(nationalDigits).slice(0, UZ_NATIONAL_LEN);
  return `+998${d}`;
}

/** Milliy qismni foydalanuvchiga: "90 123 45 67" */
export function formatNationalDisplay(nationalDigits: string): string {
  const d = digitsOnly(nationalDigits).slice(0, UZ_NATIONAL_LEN);
  if (d.length === 0) return '';
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`;
  if (d.length <= 7) return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

/** To‘liq raqamni ko‘rsatish: "+998 90 123 45 67" */
export function formatFullUzDisplay(phone: string): string {
  const nat = nationalDigitsFromAny(phone);
  const rest = formatNationalDisplay(nat);
  return rest ? `+998 ${rest}` : '+998 ';
}
