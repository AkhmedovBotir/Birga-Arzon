import { getLocale, tStatic } from '@/src/i18n';
import { clsx, type ClassValue } from 'clsx';
import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import { twMerge } from 'tailwind-merge';
import tw from 'twrnc';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** motion.div (DOM) uchun: style massivini bitta ob'ektga birlashtirish */
export function flatStyle(...styles: (ViewStyle | undefined | false)[]): ViewStyle {
  return StyleSheet.flatten(styles.filter(Boolean) as ViewStyle[]) as ViewStyle;
}

export function cardShadowStyle(): ViewStyle {
  return Platform.OS === 'web' ? { boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' } : {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  };
}

export { tw };

export function formatCurrency(amount: number) {
  const loc = getLocale() === 'ru' ? 'ru-RU' : 'uz-UZ';
  return new Intl.NumberFormat(loc, {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(amount).replace(/,/g, ' ') + ' ' + tStatic('som');
}

export function formatNumber(num: number) {
  const loc = getLocale() === 'ru' ? 'ru-RU' : 'uz-UZ';
  return new Intl.NumberFormat(loc).format(num).replace(/,/g, ' ');
}
