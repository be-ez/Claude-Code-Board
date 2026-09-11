import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from './Tooltip';
import { cn } from '../../utils';
import { THEME_PREFERENCES, useTheme, type ThemePreference } from '../../contexts/ThemeContext';

export const THEME_ICONS: Record<ThemePreference, React.ComponentType<{ className?: string }>> = {
  light: Sun,
  dark: Moon,
  auto: Monitor,
};

export const THEME_LABEL_KEYS: Record<ThemePreference, string> = {
  light: 'theme.light',
  dark: 'theme.dark',
  auto: 'theme.auto',
};

interface ThemeToggleProps {
  /** Icon-only single button that cycles through the three modes. */
  compact?: boolean;
  className?: string;
}

/** Light / dark / auto switch. `auto` follows the operating system setting. */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ compact = false, className }) => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  if (compact) {
    const Icon = THEME_ICONS[theme];
    const next = THEME_PREFERENCES[(THEME_PREFERENCES.indexOf(theme) + 1) % THEME_PREFERENCES.length];

    return (
      <Tooltip content={`${t('theme.label')}: ${t(THEME_LABEL_KEYS[theme])}`} side="right">
        <button
          onClick={() => setTheme(next)}
          aria-label={`${t('theme.label')}: ${t(THEME_LABEL_KEYS[theme])}`}
          className={cn(
            'w-full flex items-center justify-center p-2.5 bg-white/20 text-gray-700 rounded-lg',
            'hover:bg-white/30 shadow-soft-md hover:shadow-soft-lg transition-all duration-200',
            'border border-white/40 backdrop-blur-sm group mx-1',
            className
          )}
        >
          <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>
      </Tooltip>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={t('theme.label')}
      className={cn(
        'flex items-center gap-1 p-1 rounded-xl bg-white/20 border border-white/40 backdrop-blur-sm',
        className
      )}
    >
      {THEME_PREFERENCES.map((option) => {
        const Icon = THEME_ICONS[option];
        const isActive = option === theme;
        return (
          <button
            key={option}
            role="radio"
            aria-checked={isActive}
            title={t(THEME_LABEL_KEYS[option])}
            onClick={() => setTheme(option)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium',
              'transition-all duration-200',
              isActive
                ? 'bg-white/80 text-gray-900 shadow-soft border border-white/60'
                : 'text-gray-600 border border-transparent hover:bg-white/40 hover:text-gray-800'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{t(THEME_LABEL_KEYS[option])}</span>
          </button>
        );
      })}
    </div>
  );
};
