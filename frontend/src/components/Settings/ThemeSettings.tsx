import React from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { THEME_PREFERENCES, useTheme } from '../../contexts/ThemeContext';
import { THEME_ICONS, THEME_LABEL_KEYS } from '../Common/ThemeToggle';

export const ThemeSettings: React.FC = () => {
  const { t } = useTranslation();
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">{t('theme.label')}</h3>
      <div className="space-y-2">
        {THEME_PREFERENCES.map((option) => {
          const Icon = THEME_ICONS[option];
          const isActive = option === theme;
          return (
            <button
              key={option}
              onClick={() => setTheme(option)}
              aria-pressed={isActive}
              className={`w-full flex items-center justify-between p-3 border rounded-lg transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {t(THEME_LABEL_KEYS[option])}
                {option === 'auto' && (
                  <span className="text-xs text-gray-500">
                    {t('theme.autoResolved', { theme: t(THEME_LABEL_KEYS[resolvedTheme]) })}
                  </span>
                )}
              </span>
              {isActive && <Check className="w-4 h-4" />}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-500">{t('theme.hint')}</p>
    </div>
  );
};
