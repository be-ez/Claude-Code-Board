import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { enUS, zhTW } from 'date-fns/locale';
import type { Locale } from 'date-fns';

import en from './locales/en.json';
import zhTWMessages from './locales/zh-TW.json';

export const SUPPORTED_LANGUAGES = ['en', 'zh-TW'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABEL_KEYS: Record<SupportedLanguage, string> = {
  en: 'language.en',
  'zh-TW': 'language.zhTW',
};

const DATE_LOCALES: Record<SupportedLanguage, Locale> = {
  en: enUS,
  'zh-TW': zhTW,
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      'zh-TW': { translation: zhTWMessages },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    // zh-TW is the only Chinese variant we ship; map zh, zh-Hant, zh-HK onto it
    // rather than falling all the way back to English.
    load: 'currentOnly',
    nonExplicitSupportedLngs: true,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ccb-language',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  });

/** date-fns locale matching the active UI language, for formatDistanceToNow etc. */
export const getDateLocale = (): Locale =>
  DATE_LOCALES[(i18n.resolvedLanguage as SupportedLanguage) ?? 'en'] ?? enUS;

/** Keep <html lang> in sync so the browser picks the right font stack. */
const applyHtmlLang = (lng: string) => {
  document.documentElement.lang = lng;
};
applyHtmlLang(i18n.resolvedLanguage ?? 'en');
i18n.on('languageChanged', applyHtmlLang);

export default i18n;
