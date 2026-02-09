import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@stillnoob/shared/i18n/en.json';
import es from '@stillnoob/shared/i18n/es.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng: localStorage.getItem('stillnoob-lang') || (navigator.language.startsWith('es') ? 'es' : 'en'),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
