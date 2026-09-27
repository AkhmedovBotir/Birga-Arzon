import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import uz from './locales/uz.json'
import ru from './locales/ru.json'
import en from './locales/en.json'

export const LANG_KEY = 'ba_lang'
export type AppLang = 'uz' | 'ru' | 'en'

export function readStoredLang(): AppLang {
  try {
    const v = localStorage.getItem(LANG_KEY)
    if (v === 'uz' || v === 'ru' || v === 'en') return v
  } catch {
    /* ignore */
  }
  return 'uz'
}

void i18n.use(initReactI18next).init({
  resources: {
    uz: { translation: uz },
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: typeof window !== 'undefined' ? readStoredLang() : 'uz',
  fallbackLng: 'uz',
  interpolation: { escapeValue: false },
  returnNull: false,
})

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(LANG_KEY, lng)
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng === 'uz' ? 'uz' : lng
  }
})

if (typeof document !== 'undefined') {
  document.documentElement.lang =
    i18n.language === 'uz' ? 'uz' : i18n.language
}

export default i18n
