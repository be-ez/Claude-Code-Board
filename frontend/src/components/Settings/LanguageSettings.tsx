import React from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABEL_KEYS, type SupportedLanguage } from '../../i18n';

export const LanguageSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage ?? 'en') as SupportedLanguage;

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">{t('settings.language')}</h3>
      <div className="space-y-2">
        {SUPPORTED_LANGUAGES.map((lng) => {
          const isActive = lng === current;
          return (
            <button
              key={lng}
              onClick={() => i18n.changeLanguage(lng)}
              aria-pressed={isActive}
              className={`w-full flex items-center justify-between p-3 border rounded-lg transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{t(LANGUAGE_LABEL_KEYS[lng])}</span>
              {isActive && <Check className="w-4 h-4" />}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-500">{t('settings.languageHint')}</p>
    </div>
  );
};
