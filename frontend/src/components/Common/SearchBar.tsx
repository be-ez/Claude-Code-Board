import React, { useState, useCallback, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { useTranslation } from 'react-i18next';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  defaultValue?: string;
  className?: string;
  autoFocus?: boolean;
  showClearButton?: boolean;
  debounceDelay?: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder: placeholderProp,
  onSearch,
  defaultValue = '',
  className = '',
  autoFocus = false,
  showClearButton = true,
  debounceDelay = 300
}) => {
  const { t } = useTranslation();
  const placeholder = placeholderProp ?? t('common.search');
  const [searchQuery, setSearchQuery] = useState(defaultValue);
  const debouncedQuery = useDebounce(searchQuery, debounceDelay);

  // 當 debounced 值改變時觸發搜尋
  useEffect(() => {
    onSearch(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  const handleClear = useCallback(() => {
    setSearchQuery('');
    onSearch('');
  }, [onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {showClearButton && searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            title={t('common.clearSearch')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};